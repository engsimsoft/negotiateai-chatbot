/**
 * ТЗ-DV2: Chat Mode Configuration
 * ТЗ-1 CoreRegistry: now a thin wrapper over task-assignments.ts
 *
 * Server-side mapping: chatMode → domain config (displayName, tools, reserved).
 * The actual model for each mode is resolved via getTaskIdForChatMode() →
 * getModel(taskId). Client never chooses the model directly — only the chatMode.
 */

import { z } from "zod";
import { getModelIdForTask } from "./getModel";
import type { TaskId } from "./task-assignments";

export const chatModeSchema = z.enum(["chat", "expertise", "create", "simply"]);
export type ChatMode = z.infer<typeof chatModeSchema>;

interface ChatModeEntry {
  displayName: string;
  /** Tools available for this mode. null = all standard tools */
  tools: string[] | null;
  /** Reserved tools for future implementation */
  reservedTools?: string[];
}

/**
 * Domain config per chat mode (tools, displayName).
 * Model selection is handled via task-assignments — see getTaskIdForChatMode().
 */
export const CHAT_MODE_CONFIG: Record<ChatMode, ChatModeEntry> = {
  chat: {
    displayName: "Haiku",
    tools: null, // All standard tools
  },
  simply: {
    displayName: "Simply",
    tools: null, // Tools disabled at route level for MiniMax/Gemini
  },
  expertise: {
    displayName: "Sonnet",
    tools: null, // All standard tools (same as chat for now)
    reservedTools: ["deep_research", "analyze_document", "vision"],
  },
  create: {
    displayName: "Sonnet",
    tools: null, // All standard tools (same as chat for now)
    reservedTools: ["create_presentation", "create_image", "file_generation"],
  },
};

/**
 * ТЗ-1 CoreRegistry: map chatMode → TaskId for use with getModel().
 * Note: `simply` maps to the default "simply-chat" taskId, but the chat route
 * overrides this for "Думать" (simply-chat-think) and vision (simply-chat-vision).
 */
export function getTaskIdForChatMode(mode: ChatMode): TaskId {
  switch (mode) {
    case "chat":
      return "chat:haiku";
    case "expertise":
    case "create":
      return "chat:sonnet";
    case "simply":
      return "simply-chat";
  }
}

/**
 * Get the resolved physical modelId for a chat mode. Thin wrapper kept for
 * backwards-compatibility with existing call-sites.
 */
export function getModelForChatMode(mode: ChatMode): string {
  return getModelIdForTask(getTaskIdForChatMode(mode));
}
