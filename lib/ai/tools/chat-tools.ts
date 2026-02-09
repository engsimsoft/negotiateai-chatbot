/**
 * ТЗ-C1: Shared tools factory
 *
 * Extracts tool configuration from chat/route.ts into a reusable module.
 * Used by both the main chat route and the task expert route.
 */

import type { Session } from "next-auth";
import { createDocument } from "./create-document";
import { parseExcel } from "./excel";
import { getCurrentDate } from "./get-current-date";
import { getWeather } from "./get-weather";
import { readDocument } from "./read-document";
import { requestSuggestions } from "./request-suggestions";
import { updateDocument } from "./update-document";
import { webSearch } from "./web-search";
import { loadSkill } from "./load-skill";

interface GetStandardToolsParams {
  session: Session;
  dataStream: any; // UIMessageStreamWriter
  isProjectChat: boolean;
}

/**
 * Build the standard tools object for streamText().
 *
 * - readDocument is excluded for project chats (project documents are in context)
 * - createDocument/updateDocument/requestSuggestions need session + dataStream
 */
export function getStandardTools({
  session,
  dataStream,
  isProjectChat,
}: GetStandardToolsParams) {
  return {
    getCurrentDate,
    getWeather,
    ...(isProjectChat ? {} : { readDocument }),
    createDocument: createDocument({ session, dataStream }),
    updateDocument: updateDocument({ session, dataStream }),
    requestSuggestions: requestSuggestions({ session, dataStream }),
    webSearch,
    parseExcel,
    loadSkill,
  };
}

/** All tool names that can be active */
const ALL_TOOL_NAMES = [
  "getCurrentDate",
  "getWeather",
  "webSearch",
  "createDocument",
  "updateDocument",
  "requestSuggestions",
  "parseExcel",
  "loadSkill",
  "readDocument",
] as const;

type ToolName = (typeof ALL_TOOL_NAMES)[number];

/**
 * Active tools list for experimental_activeTools.
 * Controls which tools the model can call.
 */
export function getActiveToolNames(isProjectChat: boolean): ToolName[] {
  if (isProjectChat) {
    return [
      "getCurrentDate",
      "getWeather",
      "webSearch",
      "createDocument",
      "updateDocument",
      "requestSuggestions",
      "parseExcel",
      "loadSkill",
    ];
  }

  return [
    "getCurrentDate",
    "getWeather",
    "readDocument",
    "webSearch",
    "createDocument",
    "updateDocument",
    "requestSuggestions",
    "parseExcel",
    "loadSkill",
  ];
}
