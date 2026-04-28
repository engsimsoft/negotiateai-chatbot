/**
 * ТЗ-COMPACTION-1 / ТЗ-COMPACTION-UNIFY: Simply Compaction middleware.
 *
 * Вызывается из chat handler'а ДО конверсии `convertToModelMessages`.
 * Получает чистую историю `ChatMessage[]` (без system prompt); возвращает
 * либо ту же историю (no-op ниже Soft threshold), либо новую историю с
 * prepended synthetic assistant-summary + verbatim window.
 *
 * ТЗ-COMPACTION-UNIFY (v3.95.0):
 * - Middleware теперь оркестрирует `extract → compact` на одной группе сообщений
 *   (Mem0 best practice 2026: «memory formation before summarization»).
 * - Гарантия: ни одно сообщение не покидает историю без попытки извлечь факты.
 * - Strategy-check удалён — middleware вызывается для ВСЕХ chat-моделей (включая
 *   Anthropic Opus/Sonnet, ранее использовавших нативный Compaction API).
 * - ADR 054 Single-strategy provider-agnostic compaction.
 *
 * Архитектурный источник: specs/Simply_xAI/SIMPLY_COMPACTION_ARCHITECTURE.md (v2.0).
 */

import "server-only";

import type { UIMessagePart } from "ai";

import {
  COMPACTION_SUMMARY_TARGET_TOKENS,
  COMPACTION_THRESHOLD_HARD,
  COMPACTION_THRESHOLD_SOFT,
  COMPACTION_VERBATIM_WINDOW_TOKENS,
  SIMPLY_CONTEXT_LIMIT,
} from "@/lib/ai/context-limits";
import { emitDebugWarning } from "@/lib/ai/debug-events";
import { batchExtractFacts } from "@/lib/ai/memory/extract";
import type { TaskId } from "@/lib/ai/task-assignments";
import type { ChatMessage, CustomUIDataTypes, ChatTools } from "@/lib/types";
import { estimateMessageTokens, estimateTokenCount, generateUUID } from "@/lib/utils";

import { getCompactionState, saveCompactionState } from "./db-queries";
import { generateCompactionSummary } from "./summarize";
import type {
  CompactionContext,
  CompactionEvent,
  PrepareMessagesResult,
} from "./types";

/** Hard upper bound для edge case B — 2× verbatim window = 80K токенов. */
const COMPACTION_MESSAGE_HARD_CAP_TOKENS =
  COMPACTION_VERBATIM_WINDOW_TOKENS * 2;

// ---------------------------------------------------------------------------
// Верхний уровень: middleware
// ---------------------------------------------------------------------------

export async function prepareMessagesWithCompaction(
  _taskId: TaskId,
  messages: ChatMessage[],
  context: CompactionContext,
  // Опциональный DataStream writer для emitDebugWarning при graceful fallback.
  // Middleware ничего не делает если он не передан (silent degrade).
  dataStream?: Parameters<typeof emitDebugWarning>[0],
): Promise<PrepareMessagesResult> {
  const mindTokens = context.mindTokens ?? 0;
  const toolsTokens = context.toolsTokens ?? 0;

  // Trigger baseline: предпочитаем реальный input прошлого turn'а от API модели
  // (виджет контекста читает то же самое), fallback на estimator-сумму.
  // Estimator занижает русский на 30-40% + слеп к binary attachments → раньше
  // Compaction не срабатывал когда виджет показывал >100% (см. лог
  // total:67479 при реальных ~110K на прошлом turn'е).
  const usingRealUsage = typeof context.realLastInputTokens === "number";
  const totalContext = usingRealUsage
    ? (context.realLastInputTokens as number) + context.newMessageTokens
    : context.systemPromptTokens +
      context.totalHistoryTokens +
      context.newMessageTokens +
      mindTokens +
      toolsTokens;

  const softThresholdTokens =
    COMPACTION_THRESHOLD_SOFT * SIMPLY_CONTEXT_LIMIT;
  const hardThresholdTokens =
    COMPACTION_THRESHOLD_HARD * SIMPLY_CONTEXT_LIMIT;

  // Permanent observability log — единая структурированная строка для production logs.
  // `action` различает:
  //  - `noop` — ниже Soft, ничего не делаем
  //  - `compact` — между Soft и Hard, обычное сжатие
  //  - `truncate` — выше Hard (≥85%), сжатие в зоне риска деградации качества.
  //    Для middleware поведение identical с `compact`, разница только в логе —
  //    Hard threshold в ТЗ-COMPACTION-UNIFY observability-only (user-visible
  //    warning убран, см. ADR 054).
  const action: "noop" | "compact" | "truncate" =
    totalContext < softThresholdTokens
      ? "noop"
      : totalContext < hardThresholdTokens
        ? "compact"
        : "truncate";
  const baselineTag = usingRealUsage
    ? `realPrevInput:${context.realLastInputTokens}`
    : `estimator{system:${context.systemPromptTokens},history:${context.totalHistoryTokens},mind:${mindTokens},tools:${toolsTokens}}`;
  console.info(
    `[Compaction] chat=${context.chatId} task=${_taskId} ` +
      `baseline=${baselineTag} new:${context.newMessageTokens} total:${totalContext} ` +
      `thresholds={soft:${softThresholdTokens},hard:${hardThresholdTokens}} action=${action}`,
  );

  // Фаза 0 — обычная работа: подставляем сохранённый summary вместо уже-сжатых
  // сообщений. Без этой подстановки compaction-эффект жил один turn: следующий
  // turn загружал из БД все исходные сообщения и слал их модели целиком (utечка
  // ~94K токенов на каждом noop-turn'е после compaction).
  // compactionIndex = count сообщений с головы массива, сжатых на прошлом
  // compact-turn'е. Массив из getMessagesByChatId отсортирован по createdAt asc,
  // synthetic summaries в БД не сохраняются (живут только в historyForStream),
  // поэтому индекс остаётся валидным между turn'ами.
  if (action === "noop") {
    const state = await getCompactionState(context.chatId);
    if (
      state.summary &&
      state.index &&
      state.index > 0 &&
      state.index < messages.length
    ) {
      const synth = buildSyntheticSummaryMessage(state.summary);
      return { messages: [synth, ...messages.slice(state.index)] };
    }
    return { messages };
  }

  // Безопасность: если messages пустой — нечего сжимать (шансы = 0, но
  // защищает от деления на 0 в алгоритме verbatim).
  if (messages.length === 0) {
    return { messages };
  }

  const state = await getCompactionState(context.chatId);

  // Split messages по алгоритму verbatim window.
  const split = buildVerbatimWindow(messages, COMPACTION_VERBATIM_WINDOW_TOKENS);

  // Если toCompact пустой — нечего сжимать. Такое возможно только при очень
  // странной комбинации (например, всего одно сообщение целиком занимает
  // весь бюджет и едва вмещается в verbatim). Middleware возвращает messages
  // как есть — caller положится на sliding window в getMessagesByChatId.
  if (split.toCompact.length === 0) {
    return { messages };
  }

  // ТЗ-COMPACTION-UNIFY: extract → compact на одной группе сообщений.
  // await блокирует compaction до завершения extract — гарантия что ни один
  // факт не потеряется с уходящими в summary сообщениями.
  // Graceful fallback: если extract падает — продолжаем с compact (факты
  // могут быть потеряны в этом окне, но разговор продолжается).
  //
  // ТЗ-FixSimplyMemory: фильтруем `split.toCompact` по `alreadyExtractedIds` —
  // сообщения, чьи факты уже извлечены ранее (extractedAt != null), повторно
  // в Grok не шлём. Если после фильтра пусто — extract step скипаем целиком.
  const messagesToExtract = split.toCompact.filter(
    (m) => !context.alreadyExtractedIds?.has(m.id),
  );
  const skippedExtractedCount = split.toCompact.length - messagesToExtract.length;

  if (messagesToExtract.length === 0) {
    console.info(
      `[Compaction] chat=${context.chatId} pre-compact-extract={` +
        `processed:0,extracted:0,stored:0,skipped:${skippedExtractedCount}} ` +
        `(all messages already extracted)`,
    );
  } else {
    try {
      const extractResult = await batchExtractFacts({
        userId: context.userId,
        chatId: context.chatId,
        sourceType: context.sourceType,
        sourceProjectId: context.sourceProjectId,
        messages: messagesToExtract.map((m) => ({
          id: m.id,
          role: m.role,
          parts: m.parts,
        })),
      });
      console.info(
        `[Compaction] chat=${context.chatId} pre-compact-extract={` +
          `processed:${extractResult.processed},extracted:${extractResult.extracted},` +
          `stored:${extractResult.stored},skipped:${skippedExtractedCount}}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[Compaction] Pre-compaction extract failed for chat ${context.chatId} — ` +
          `продолжаем с compaction (факты этого окна могут быть потеряны): ${message}`,
      );
      if (dataStream) {
        emitDebugWarning(dataStream, {
          source: "compaction:extract",
          message: `Pre-compaction extract failed (non-blocking): ${message}`,
          context: { chatId: context.chatId, userId: context.userId },
        });
      }
    }
  }

  const squeezedTokens = split.toCompact.reduce(
    (sum, msg) => sum + estimateMessageTokens(msg.parts as unknown as unknown[]),
    0,
  );

  // Генерация summary — ловим любую ошибку AI SDK / Grok (NoObjectGeneratedError,
  // timeout, network etc.) и делаем graceful fallback: возвращаем оригинал,
  // warning в DevPanel. Следующий turn снова попробует если threshold актуален.
  let summary: string;
  let summaryTokens: number;
  try {
    const result = await generateCompactionSummary({
      chatId: context.chatId,
      messagesToCompact: split.toCompact,
      previousSummary: state.summary,
    });
    summary = result.summary;
    summaryTokens = result.summaryTokens;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[Compaction] Summary generation failed for chat ${context.chatId} — ` +
        `falling back to original messages: ${message}`,
    );
    if (dataStream) {
      emitDebugWarning(dataStream, {
        source: "compaction:summarize",
        message: `Compaction summary generation failed: ${message}`,
        context: { chatId: context.chatId, modelId: context.modelId },
      });
    }
    return { messages };
  }

  const newCount = state.count + 1;
  const compactionIndex = split.toCompact.length;

  await saveCompactionState(context.chatId, {
    summary,
    index: compactionIndex,
    count: newCount,
  });

  const syntheticSummaryMessage = buildSyntheticSummaryMessage(summary);
  const newMessages: ChatMessage[] = [
    syntheticSummaryMessage,
    ...split.verbatim,
  ];

  // ТЗ-COMPACTION-UNIFY: CompactionEvent.kind удалён — compaction работает молча,
  // user-visible warning на Hard threshold убран (см. ADR 054, перенос ручного
  // handoff в COMPACTION-3).
  const compactionEvent: CompactionEvent = {
    chatId: context.chatId,
    compactionIndex,
    compactionCount: newCount,
    summaryTokens,
    squeezedTokens,
  };

  // Sanity-log: если summary вышло существенно больше таргета — логируем
  // warning для dev, полезно при тюнинге промпта.
  if (summaryTokens > COMPACTION_SUMMARY_TARGET_TOKENS * 1.5) {
    console.warn(
      `[Compaction] Summary exceeded target for chat ${context.chatId}: ` +
        `${summaryTokens} tokens (target ${COMPACTION_SUMMARY_TARGET_TOKENS}).`,
    );
  }

  return { messages: newMessages, compactionEvent };
}

// ---------------------------------------------------------------------------
// Verbatim window builder
// ---------------------------------------------------------------------------

interface VerbatimSplit {
  /** Сообщения, которые уходят в summary (старее verbatim окна). */
  toCompact: ChatMessage[];
  /** Сообщения, сохраняемые дословно (последние, укладываются в окно). */
  verbatim: ChatMessage[];
}

/**
 * Алгоритм сборки verbatim window (из §Дословное окно, архитектура v1.8):
 *
 *  1. Идём с конца истории назад, кумулятивно складываем токены.
 *  2. Останавливаемся на ПЕРВОМ сообщении, включение которого превысит `maxTokens`.
 *  3. Это сообщение НЕ включаем в verbatim — оно уходит в summary.
 *
 * Edge case A (≤ 80K): последнее сообщение само > maxTokens, но ≤ hard cap —
 *   включаем целиком (окно временно расширяется), старше него — в summary.
 *
 * Edge case B (> 80K): последнее сообщение само > hard cap — обрезаем его
 *   верхнюю (старую) часть до ~hard cap с маркером, включаем обрезанную
 *   версию в verbatim, старше — в summary.
 */
function buildVerbatimWindow(
  messages: ChatMessage[],
  maxTokens: number,
): VerbatimSplit {
  if (messages.length === 0) {
    return { toCompact: [], verbatim: [] };
  }

  // Cache token counts per index (избегаем повторного подсчёта).
  const tokenCounts = messages.map((msg) =>
    estimateMessageTokens(msg.parts as unknown as unknown[]),
  );

  let cumulative = 0;
  // splitIndex = индекс ПЕРВОГО сообщения входящего в verbatim.
  // Начинаем с messages.length (всё в toCompact, verbatim пусто) и двигаем влево.
  let splitIndex = messages.length;

  for (let i = messages.length - 1; i >= 0; i--) {
    const next = cumulative + tokenCounts[i];
    if (next > maxTokens) {
      break;
    }
    cumulative = next;
    splitIndex = i;
  }

  // Базовый случай: обычное окно заполнилось хотя бы одним сообщением.
  if (splitIndex < messages.length) {
    return {
      toCompact: messages.slice(0, splitIndex),
      verbatim: messages.slice(splitIndex),
    };
  }

  // Verbatim оказался пустым — значит последнее сообщение само > maxTokens.
  const lastIdx = messages.length - 1;
  const lastMsg = messages[lastIdx];
  const lastTokens = tokenCounts[lastIdx];

  if (lastTokens <= COMPACTION_MESSAGE_HARD_CAP_TOKENS) {
    // Edge case A: крупное вложение до 80K — включаем целиком.
    return {
      toCompact: messages.slice(0, lastIdx),
      verbatim: [lastMsg],
    };
  }

  // Edge case B: сообщение > 80K — обрезаем верх текстового контента.
  const truncated = truncateMessageTopText(
    lastMsg,
    COMPACTION_MESSAGE_HARD_CAP_TOKENS,
  );
  return {
    toCompact: messages.slice(0, lastIdx),
    verbatim: [truncated],
  };
}

// ---------------------------------------------------------------------------
// Truncate-top для edge case B (>80K сообщений)
// ---------------------------------------------------------------------------

const TRUNCATION_MARKER =
  "[...начало сообщения сокращено из-за большого размера...]\n\n";

/**
 * Обрезает верхнюю (старую) часть текстовых частей сообщения до ~`maxTokens`.
 * Non-text parts (file, tool-call и пр.) сохраняются как есть.
 *
 * Подход:
 *   1. Склеиваем все text parts в одну строку.
 *   2. Оцениваем текущий размер в токенах через `estimateTokenCount`.
 *   3. Вычисляем пропорцию символов которые нужно сохранить.
 *   4. Режем fullText с начала, оставляя последние keepChars.
 *   5. Префиксуем маркером, заменяем все text parts одной truncated-частью.
 */
function truncateMessageTopText(
  msg: ChatMessage,
  maxTokens: number,
): ChatMessage {
  type Part = ChatMessage["parts"][number];
  const parts = msg.parts as Part[];
  const textParts: Array<{ type: "text"; text: string }> = [];
  const nonTextParts: Part[] = [];

  for (const p of parts) {
    if (p.type === "text" && typeof (p as { text?: unknown }).text === "string") {
      textParts.push({ type: "text", text: (p as { text: string }).text });
    } else {
      nonTextParts.push(p);
    }
  }

  if (textParts.length === 0) {
    // Нет текста — резать нечего; return as-is. Caller'у стоит это заметить
    // по логам (>80K в non-text — странный кейс).
    console.warn(
      "[Compaction] Message exceeds hard cap but has no text parts to truncate.",
    );
    return msg;
  }

  const fullText = textParts.map((p) => p.text).join("\n");
  const currentTokens = estimateTokenCount(fullText);

  if (currentTokens <= maxTokens) {
    // Safety: edge case не сработал, возвращаем как есть.
    return msg;
  }

  const keepRatio = maxTokens / currentTokens;
  const keepChars = Math.max(1, Math.floor(fullText.length * keepRatio));
  const truncatedText = fullText.slice(fullText.length - keepChars);
  const finalText = TRUNCATION_MARKER + truncatedText;

  const newTextPart: UIMessagePart<CustomUIDataTypes, ChatTools> = {
    type: "text",
    text: finalText,
  };

  return {
    ...msg,
    parts: [newTextPart, ...nonTextParts] as ChatMessage["parts"],
  };
}

// ---------------------------------------------------------------------------
// Synthetic summary message builder
// ---------------------------------------------------------------------------

/**
 * Создаёт synthetic assistant-message несущее summary. Модель читает его как
 * прошлый ход разговора. Роль `assistant` — наиболее естественная семантика
 * (UIMessage doc не рекомендует `system` для user-facing частей истории).
 */
function buildSyntheticSummaryMessage(summaryMarkdown: string): ChatMessage {
  const body = `📋 **Итог предыдущей части разговора:**\n\n${summaryMarkdown}`;
  return {
    id: generateUUID(),
    role: "assistant",
    parts: [{ type: "text", text: body }],
  };
}
