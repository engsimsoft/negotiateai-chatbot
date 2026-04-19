import type {
  AssistantModelMessage,
  ToolModelMessage,
  ModelMessage,
  UIMessage,
  UIMessagePart,
} from 'ai';
import { type ClassValue, clsx } from 'clsx';
import { formatISO } from 'date-fns';
import { twMerge } from 'tailwind-merge';
import type { DBMessage, Document } from '@/lib/db/schema';
import { ChatSDKError, type ErrorCode } from './errors';
import type { ChatMessage, ChatTools, CustomUIDataTypes } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    const { code, cause } = await response.json();
    throw new ChatSDKError(code as ErrorCode, cause);
  }

  return response.json();
};

export async function fetchWithErrorHandlers(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  try {
    const response = await fetch(input, init);

    if (!response.ok) {
      const { code, cause } = await response.json();
      throw new ChatSDKError(code as ErrorCode, cause);
    }

    return response;
  } catch (error: unknown) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new ChatSDKError('offline:chat');
    }

    throw error;
  }
}

export function getLocalStorage(key: string) {
  if (typeof window !== 'undefined') {
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
  return [];
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Build a mode-aware chat URL.
 * /simply, /expertise/[id], /create/[id], or /projects/[pid]/chat/[id]
 *
 * ТЗ-LegacyChatCleanup: legacy-режим `chat` и маршрут /chat/[id] удалены.
 * Для unknown chatMode функция бросает Error — это сигнал что в коде где-то
 * передаётся устаревший или невалидный режим. Лучше упасть громко, чем тихо
 * сгенерить ссылку на 404. Caller обязан гарантировать корректный chatMode.
 */
export function getChatUrl(
  chatId: string,
  chatMode?: string,
  projectId?: string,
): string {
  if (projectId) {
    return `/projects/${projectId}/chat/${chatId}`;
  }
  switch (chatMode) {
    case "simply":
      return "/simply";
    case "expertise":
      return `/expertise/${chatId}`;
    case "create":
      return `/create/${chatId}`;
    default:
      throw new Error(
        `getChatUrl: неизвестный chatMode "${chatMode}". Допустимые: simply | expertise | create | (с projectId — project chat). Возможно вы пытаетесь открыть legacy-чат удалённого режима "chat".`,
      );
  }
}

type ResponseMessageWithoutId = ToolModelMessage | AssistantModelMessage;
type ResponseMessage = ResponseMessageWithoutId & { id: string };

export function getMostRecentUserMessage(messages: UIMessage[]) {
  const userMessages = messages.filter((message) => message.role === 'user');
  return userMessages.at(-1);
}

export function getDocumentTimestampByIndex(
  documents: Document[],
  index: number,
) {
  if (!documents) { return new Date(); }
  if (index > documents.length) { return new Date(); }

  return documents[index].createdAt;
}

export function getTrailingMessageId({
  messages,
}: {
  messages: ResponseMessage[];
}): string | null {
  const trailingMessage = messages.at(-1);

  if (!trailingMessage) { return null; }

  return trailingMessage.id;
}

export function sanitizeText(text: string) {
  return text.replace('<has_function_call>', '');
}

export function convertToUIMessages(messages: DBMessage[]): ChatMessage[] {
  return messages.map((message) => {
    const parts = message.parts as UIMessagePart<CustomUIDataTypes, ChatTools>[];

    return {
      id: message.id,
      role: message.role as 'user' | 'assistant' | 'system',
      parts: parts,
      metadata: {
        createdAt: formatISO(message.createdAt),
      },
    };
  });
}

/**
 * ТЗ-1 hotfix — UI-level pre-sanitization of AI SDK v6 tool parts.
 *
 * AI SDK v6 persists tool invocations as typed parts (`tool-<name>`) with a
 * `state` field: `input-streaming` | `input-available` | `output-available`
 * | `output-error`. Only `output-available` is safe to send to a provider —
 * it represents a tool call that completed successfully and has structured
 * input and output. All other states mean the call is either in-flight or
 * failed, and the persisted data is incomplete:
 *
 *   - `output-error` carries `rawInput` (a raw JSON string that failed to
 *     parse against the tool's Zod schema) and an `errorText`. When
 *     `convertToModelMessages()` processes this, the downstream provider
 *     (MiniMax, Anthropic, etc.) gets a tool_call with unparseable
 *     arguments → 400 "invalid function arguments json string".
 *   - `input-streaming` / `input-available` represent an interrupted
 *     invocation — same problem.
 *
 * This function strips such parts at the UI-message level, BEFORE conversion
 * to core messages. Parts with `state === 'output-available'` (success) and
 * parts without a `state` field (legacy data, conservative) are preserved.
 * If stripping leaves a message with no meaningful content, a text
 * placeholder `[инструмент не завершён]` is inserted so the assistant
 * message stays valid for the provider.
 *
 * Defense-in-depth: this is the first of two layers. The second layer is
 * `sanitizeCoreMessages()` below, which handles orphan tool-call/tool-result
 * pairs at the ModelMessage level. If something slips through one layer,
 * the other catches it.
 *
 * Apply this to ALL `convertToModelMessages()` call sites.
 */
export function stripIncompleteToolParts(
  messages: ChatMessage[],
): ChatMessage[] {
  return messages.map((msg) => {
    if (!msg.parts || !Array.isArray(msg.parts)) return msg;

    const filtered = msg.parts.filter((part: any) => {
      if (typeof part.type !== 'string' || !part.type.startsWith('tool-')) {
        return true; // Not a tool part — keep untouched
      }
      // Tool part: keep only successful completion, or legacy (no state)
      if (part.state === undefined) return true;
      return part.state === 'output-available';
    });

    if (filtered.length === msg.parts.length) return msg;

    // If all meaningful content was removed (or only step-start markers
    // remain), insert a placeholder so the assistant message is valid.
    const hasMeaningfulContent = filtered.some(
      (part: any) => part.type !== 'step-start',
    );
    if (!hasMeaningfulContent) {
      return {
        ...msg,
        parts: [{ type: 'text' as const, text: '[инструмент не завершён]' }],
      } as ChatMessage;
    }

    return { ...msg, parts: filtered } as ChatMessage;
  });
}

/**
 * Sanitize CoreMessage[] for Anthropic API compatibility.
 * - Removes empty assistant/tool messages
 * - Removes orphan tool-call parts (tool_use without matching tool_result)
 * - Removes orphan tool messages (tool_result without preceding tool_use)
 * - Reorders assistant content so `tool-call` parts are LAST in content.
 *   Claude 4.5/4.6 API rejects `[tool_use, text]` ordering with
 *   "tool_use without tool_result" even when the tool_result is present
 *   in the next message. Moving tool_use to the end of the assistant content
 *   (while preserving relative order of other parts) makes the API accept
 *   the pair. Verified with live Anthropic Haiku 4.5 tests.
 * Legacy data from Gemini may contain these inconsistencies.
 */
export function sanitizeCoreMessages(messages: ModelMessage[]): ModelMessage[] {
  // Pass 1: Collect all tool result IDs
  const toolResultIds = new Set<string>();
  for (const msg of messages) {
    if (msg.role === 'tool' && Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === 'tool-result' && part.toolCallId) {
          toolResultIds.add(part.toolCallId);
        }
      }
    }
  }

  // Pass 2: Strip orphan tool-calls from assistant messages
  const cleaned = messages.map((msg) => {
    if (msg.role !== 'assistant' || typeof msg.content === 'string') return msg;

    const content = (msg.content as any[]).filter((part) => {
      if (part.type === 'tool-call') {
        return toolResultIds.has(part.toolCallId);
      }
      return true;
    });

    return { ...msg, content };
  });

  // Pass 3: Collect surviving tool-call IDs (after stripping)
  const survivingToolCallIds = new Set<string>();
  for (const msg of cleaned) {
    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      for (const part of msg.content as any[]) {
        if (part.type === 'tool-call') {
          survivingToolCallIds.add(part.toolCallId);
        }
      }
    }
  }

  // Pass 4: Filter out empty and orphan messages
  const filtered = cleaned.filter((msg) => {
    // Remove empty assistant messages (empty content array)
    if (msg.role === 'assistant') {
      if (typeof msg.content === 'string') return msg.content.trim().length > 0;
      if (Array.isArray(msg.content)) return msg.content.length > 0;
      return false;
    }
    // Remove tool messages with no surviving tool-call counterpart
    if (msg.role === 'tool' && Array.isArray(msg.content)) {
      const filtered = msg.content.filter(
        (part: any) => part.type === 'tool-result' && survivingToolCallIds.has(part.toolCallId)
      );
      if (filtered.length === 0) return false;
      (msg as any).content = filtered;
    }
    return true;
  });

  // Pass 5: Reorder assistant content so tool-call parts are LAST.
  // Preserves relative order of text/other parts and relative order of tool-calls.
  return filtered.map((msg) => {
    if (msg.role !== 'assistant' || !Array.isArray(msg.content)) return msg;
    const content = msg.content as any[];
    const hasToolCall = content.some((p) => p.type === 'tool-call');
    if (!hasToolCall) return msg;
    const nonToolParts = content.filter((p) => p.type !== 'tool-call');
    const toolCallParts = content.filter((p) => p.type === 'tool-call');
    // If tool-calls are already at the end, no-op (optimization + stability)
    const firstToolIdx = content.findIndex((p) => p.type === 'tool-call');
    const lastNonToolIdx = content.reduce(
      (max, p, i) => (p.type !== 'tool-call' ? i : max),
      -1,
    );
    if (firstToolIdx > lastNonToolIdx) return msg;
    return { ...msg, content: [...nonToolParts, ...toolCallParts] };
  });
}

export function getTextFromMessage(message: ChatMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

/**
 * Оценка количества токенов для текста с учётом языка
 * Формула для русского текста: ~1.5-2.0 токена на слово
 * Формула для английского текста: ~1.3 токена на слово
 */
export function estimateTokenCount(text: string): number {
  if (!text || text.length === 0) {
    return 0;
  }

  const words = text.split(/\s+/).length;
  const chars = text.length;

  // Определяем язык (приблизительно)
  const cyrillicChars = (text.match(/[а-яёА-ЯЁ]/g) || []).length;
  const isCyrillic = cyrillicChars > chars * 0.3;

  if (isCyrillic) {
    // Для русского языка: учитываем среднюю длину слов
    const avgCharsPerWord = words > 0 ? chars / words : 0;
    if (avgCharsPerWord > 5) {
      // Длинные русские слова
      return Math.ceil(words * 2.0);
    }
    return Math.ceil(words * 1.7);
  }

  // Английский или смешанный текст
  return Math.ceil(words * 1.3);
}

/**
 * Оценка количества токенов для сообщения.
 *
 * Учитывает все parts которые реально попадают в payload провайдера:
 *  - text parts (основное)
 *  - tool-call parts (input — аргументы tool от модели)
 *  - tool-result parts (output — результат tool, часто 10K+ для deepResearch/webSearch)
 *
 * ТЗ-COMPACTION-1 fix #2 (2026-04-19): добавлены tool-call/tool-result.
 * Раньше функция считала только text — это занижало `totalHistoryTokens`
 * на десятки тысяч в expertise/Simply Chat с активными tools, что приводило
 * к позднему срабатыванию compaction (см. SIMPLY_COMPACTION_ARCHITECTURE.md).
 *
 * file parts не считаем — для текстовых файлов конверсия в text part происходит
 * через `convertTextFilePartsInMessage` (см. chat/route.ts), для PDF/изображений
 * существует отдельный capability-routing на vision-модели.
 */
export function estimateMessageTokens(parts: any[]): number {
  let total = 0;

  for (const part of parts) {
    if (part.type === 'text' && part.text) {
      total += estimateTokenCount(part.text);
    } else if (part.type === 'tool-call' && part.input !== undefined) {
      total += estimateTokenCount(JSON.stringify(part.input));
    } else if (part.type === 'tool-result' && part.output !== undefined) {
      total += estimateTokenCount(JSON.stringify(part.output));
    }
    // step-start, step-finish, file (file конвертится в text заранее) — игнорируем
  }

  // Добавляем overhead для метаданных сообщения (role, id, timestamps, etc.)
  return total + 10;
}
