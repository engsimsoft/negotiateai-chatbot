/**
 * ТЗ-C1: Shared tools factory
 *
 * Extracts tool configuration from chat/route.ts into a reusable module.
 * Used by both the main chat route and the task expert route.
 */

import type { Session } from "next-auth";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ChatMode } from "@/lib/ai/chat-mode-config";
import { estimateTokenCount } from "@/lib/utils";
import { createDocument } from "./create-document";
import { parseExcel } from "./excel";
import { getCurrentDate } from "./get-current-date";
import { getWeather } from "./get-weather";
import { readProjectFile } from "./read-project-file";
import { updateDocument } from "./update-document";
import { webSearch } from "./web-search";
import { fetchUrl } from "./fetch-url";
import { deepResearch } from "./deep-research";
import { loadSkill } from "./load-skill";
import { readTelegramChannel } from "./read-telegram-channel";

interface GetStandardToolsParams {
  session: Session;
  dataStream: any; // UIMessageStreamWriter
  isProjectChat: boolean;
  projectId?: string;
  chatId?: string;
  /** Chat mode for regular (non-project) chats — determines tool availability */
  chatMode?: ChatMode;
  /** ТЗ-PX: Override depth for deepResearch (from dev-mode UI switcher) */
  researchDepth?: "pro" | "deep";
}

/**
 * Build the standard tools object for streamText().
 *
 * - readProjectFile is included only for project chats (needs projectId)
 * - createDocument/updateDocument need session + dataStream
 *
 * Attached file handling (non-project chats):
 *  - DOCX/TXT/MD/CSV are converted to text/plain on upload ([app/(chat)/api/files/upload/route.ts])
 *    and inlined into the prompt by `convertTextFilesInAllMessages` in chat/route.ts
 *  - PDF/images flow through vision fallback when default model lacks capability (chat-vision task → Claude Haiku 4.5)
 *  - .xlsx/.xls/.csv structured data → `parseExcel` tool
 *
 * There is no file-system knowledge base in Simply — the legacy `readDocument`
 * tool referencing `knowledge/` was removed in TZ_SimplyReadDocumentTool after
 * audit confirmed the directory was deleted back in v2.0.0 ("cleanup: remove
 * old MIR.TRADE files", commit 62540ff). If a knowledge-base feature returns
 * in the future, it will be a separate pgvector-based path, not a filesystem
 * reader.
 */
export function getStandardTools({
  session,
  dataStream,
  isProjectChat,
  projectId,
  chatId,
  chatMode,
  researchDepth,
}: GetStandardToolsParams) {
  return {
    getCurrentDate,
    getWeather,
    ...(isProjectChat && projectId
      ? { readProjectFile: readProjectFile({ projectId }) }
      : {}),
    createDocument: createDocument({ session, dataStream }),
    updateDocument: updateDocument({ session, dataStream }),
    webSearch,
    fetchUrl,
    deepResearch: deepResearch({ defaultDepth: researchDepth, userId: session.user?.id }),
    parseExcel,
    loadSkill,
    readTelegramChannel,
  };
}

/**
 * Wrap the LAST tool in the object with Anthropic `providerOptions.cacheControl`.
 *
 * Per Anthropic prompt caching spec ([docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)),
 * placing `cache_control` on the last tool definition caches ALL preceding tool
 * definitions (including the last one itself) as a single cache breakpoint. The
 * contents of tool definitions rarely change, so this gives a large cacheable
 * block essentially for free.
 *
 * Safe to apply to:
 *  - `anthropic` provider (pure Claude через `@ai-sdk/anthropic`)
 *  - `minimax` / `minimaxLong` providers (тонкая обёртка над `AnthropicMessages-
 *    LanguageModel` из `@ai-sdk/anthropic/internal`, идентичный синтаксис)
 *
 * The last key is chosen by JavaScript object-key insertion order, which is
 * deterministic since ES2015. In `getStandardTools()` the last entry is always
 * `readTelegramChannel` (both for project and non-project flows), so the
 * cache key stays stable across requests.
 */
export function withCacheControlOnLastTool<T extends Record<string, any>>(
  tools: T,
): T {
  const keys = Object.keys(tools);
  if (keys.length === 0) return tools;
  const lastKey = keys[keys.length - 1];
  const lastTool = tools[lastKey];
  return {
    ...tools,
    [lastKey]: {
      ...lastTool,
      providerOptions: {
        ...((lastTool as { providerOptions?: Record<string, unknown> }).providerOptions ?? {}),
        anthropic: {
          ...(((lastTool as { providerOptions?: { anthropic?: Record<string, unknown> } }).providerOptions?.anthropic) ?? {}),
          cacheControl: { type: "ephemeral" as const },
        },
      },
    },
  } as T;
}

/**
 * Оценить токены, которые tools schemas займут в payload провайдера.
 *
 * Provider (Anthropic / xAI) сериализует каждый tool как `{ name, description, input_schema }`
 * — это входит в input_tokens billing. AI SDK v6 использует `zod-to-json-schema`
 * внутри для конверсии Zod → JSON Schema; используем тот же путь напрямую (одна
 * транзитивная версия в lockfile → нулевой drift).
 *
 * ТЗ-COMPACTION-1 fix #2 (архитекторское решение 2026-04-19):
 * Compaction middleware принимает `toolsTokens` отдельным полем в `CompactionContext`.
 * Считаем здесь — место где tools registry формируется (call site SSOT).
 *
 * Tool в AI SDK v6: `{ description?, inputSchema: ZodType | JSONSchema7, execute?, ... }`.
 * Если `inputSchema` — Zod, конвертим. Если уже JSON-объект, сериализуем as-is.
 * Любая ошибка конкретного tool — silent skip (никогда не блокирует основной flow).
 */
export function computeToolsTokens(tools: Record<string, unknown>): number {
  let total = 0;
  for (const [name, tool] of Object.entries(tools)) {
    total += estimateTokenCount(name);
    const t = tool as { description?: string; inputSchema?: unknown };
    if (t.description) {
      total += estimateTokenCount(t.description);
    }
    if (t.inputSchema) {
      try {
        // Zod schemas имеют `_def` поле (внутренняя структура). Если его нет —
        // считаем что это уже сериализованный JSONSchema объект.
        const isZodSchema =
          typeof t.inputSchema === "object" &&
          t.inputSchema !== null &&
          "_def" in t.inputSchema;
        const json = isZodSchema
          ? JSON.stringify(zodToJsonSchema(t.inputSchema as Parameters<typeof zodToJsonSchema>[0]))
          : JSON.stringify(t.inputSchema);
        total += estimateTokenCount(json);
      } catch {
        // Невалидная схема — пропускаем этот tool, не блокируем расчёт.
      }
    }
  }
  return total;
}

/** All tool names that can be active */
const ALL_TOOL_NAMES = [
  "getCurrentDate",
  "getWeather",
  "webSearch",
  "fetchUrl",
  "deepResearch",
  "createDocument",
  "updateDocument",
  "parseExcel",
  "loadSkill",
  "readProjectFile",
  "readTelegramChannel",
] as const;

type ToolName = (typeof ALL_TOOL_NAMES)[number];

/** Tools excluded for chatMode 'simply' (MiniMax) — expensive Perplexity API ($0.02-$0.80/call) */
const SIMPLY_MODE_EXCLUDED_TOOLS: ToolName[] = ["deepResearch"];

/**
 * Active tools list for experimental_activeTools.
 * Controls which tools the model can call.
 *
 * @param isProjectChat - true for project chats (separate tool set)
 * @param chatMode - chat mode for regular chats — filters deepResearch for 'simply' (MiniMax) unless Think is active
 * @param think - true when "Думать" mode is active (Sonnet override) — unlocks all tools for simply
 */
export function getActiveToolNames(isProjectChat: boolean, chatMode?: ChatMode, think?: boolean): ToolName[] {
  if (isProjectChat) {
    return [
      "getCurrentDate",
      "getWeather",
      "webSearch",
      "fetchUrl",
      "deepResearch",
      "createDocument",
      "updateDocument",
      "parseExcel",
      "loadSkill",
      "readProjectFile",
      "readTelegramChannel",
    ];
  }

  const baseTools: ToolName[] = [
    "getCurrentDate",
    "getWeather",
    "webSearch",
    "fetchUrl",
    "deepResearch",
    "createDocument",
    "updateDocument",
    "parseExcel",
    "loadSkill",
    "readTelegramChannel",
  ];

  // Filter out deepResearch for chatMode 'simply' (MiniMax) — unless "Думать" (Sonnet) is active
  if (chatMode === "simply" && !think) {
    return baseTools.filter((t) => !SIMPLY_MODE_EXCLUDED_TOOLS.includes(t));
  }

  return baseTools;
}
