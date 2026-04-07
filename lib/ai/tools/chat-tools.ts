/**
 * ТЗ-C1: Shared tools factory
 *
 * Extracts tool configuration from chat/route.ts into a reusable module.
 * Used by both the main chat route and the task expert route.
 */

import type { Session } from "next-auth";
import type { ChatMode } from "@/lib/ai/chat-mode-config";
import { createDocument } from "./create-document";
import { createSnapshot } from "./create-snapshot";
import { parseExcel } from "./excel";
import { getCurrentDate } from "./get-current-date";
import { getWeather } from "./get-weather";
import { readDocument } from "./read-document";
import { readProjectFile } from "./read-project-file";
import { requestSuggestions } from "./request-suggestions";
import { updateDocument } from "./update-document";
import { webSearch } from "./web-search";
import { fetchUrl } from "./fetch-url";
import { deepResearch } from "./deep-research";
import { loadSkill } from "./load-skill";
import { readTelegramChannel } from "./read-telegram-channel";
import { saveFact } from "./save-fact";

interface GetStandardToolsParams {
  session: Session;
  dataStream: any; // UIMessageStreamWriter
  isProjectChat: boolean;
  projectId?: string;
  chatId?: string;
  /** Current assistant message ID — needed for snapshot tool */
  messageId?: string;
  /** Chat mode for regular (non-project) chats — determines tool availability */
  chatMode?: ChatMode;
  /** ТЗ-PX: Override depth for deepResearch (from dev-mode UI switcher) */
  researchDepth?: "pro" | "deep";
}

/**
 * Build the standard tools object for streamText().
 *
 * - readDocument is excluded for project chats (project documents are in context)
 * - readProjectFile is included only for project chats (needs projectId)
 * - createDocument/updateDocument/requestSuggestions need session + dataStream
 */
export function getStandardTools({
  session,
  dataStream,
  isProjectChat,
  projectId,
  chatId,
  messageId,
  chatMode,
  researchDepth,
}: GetStandardToolsParams) {
  return {
    getCurrentDate,
    getWeather,
    ...(isProjectChat ? {} : { readDocument: readDocument({ userId: session.user?.id ?? "" }) }),
    ...(isProjectChat && projectId
      ? { readProjectFile: readProjectFile({ projectId }) }
      : {}),
    ...(chatId && messageId
      ? { createSnapshot: createSnapshot({ chatId, messageId }) }
      : {}),
    createDocument: createDocument({ session, dataStream }),
    updateDocument: updateDocument({ session, dataStream }),
    requestSuggestions: requestSuggestions({ session, dataStream }),
    webSearch,
    fetchUrl,
    deepResearch: deepResearch({ defaultDepth: researchDepth, userId: session.user?.id }),
    parseExcel,
    loadSkill,
    readTelegramChannel,
    // ТЗ-SaveFact: only for Simply Chat
    ...(chatMode === "simply"
      ? { saveFact: saveFact({ userId: session.user?.id ?? "", chatId }) }
      : {}),
  };
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
  "requestSuggestions",
  "parseExcel",
  "loadSkill",
  "readDocument",
  "readProjectFile",
  "createSnapshot",
  "readTelegramChannel",
  "saveFact",
] as const;

type ToolName = (typeof ALL_TOOL_NAMES)[number];

/** Tools excluded for chatMode 'chat' (Haiku) — expensive research tools */
const CHAT_MODE_EXCLUDED_TOOLS: ToolName[] = ["fetchUrl", "deepResearch"];

/**
 * Active tools list for experimental_activeTools.
 * Controls which tools the model can call.
 *
 * @param isProjectChat - true for project chats (separate tool set)
 * @param chatMode - chat mode for regular chats — filters expensive tools for 'chat' (Haiku)
 */
export function getActiveToolNames(isProjectChat: boolean, chatMode?: ChatMode): ToolName[] {
  if (isProjectChat) {
    return [
      "getCurrentDate",
      "getWeather",
      "webSearch",
      "fetchUrl",
      "deepResearch",
      "createDocument",
      "updateDocument",
      "requestSuggestions",
      "parseExcel",
      "loadSkill",
      "readProjectFile",
      "createSnapshot",
      "readTelegramChannel",
    ];
  }

  const baseTools: ToolName[] = [
    "getCurrentDate",
    "getWeather",
    "readDocument",
    "webSearch",
    "fetchUrl",
    "deepResearch",
    "createDocument",
    "updateDocument",
    "requestSuggestions",
    "parseExcel",
    "loadSkill",
    "createSnapshot",
    "readTelegramChannel",
  ];

  // Filter out expensive tools for chatMode 'chat' (Haiku)
  if (chatMode === "chat") {
    return baseTools.filter((t) => !CHAT_MODE_EXCLUDED_TOOLS.includes(t));
  }

  // ТЗ-SaveFact: saveFact only available in Simply Chat
  if (chatMode === "simply") {
    return [...baseTools, "saveFact"];
  }

  return baseTools;
}
