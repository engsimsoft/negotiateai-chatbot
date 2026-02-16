/**
 * ТЗ-DV2: Chat Mode Configuration
 *
 * Server-side mapping: chatMode → model + tools config.
 * Client never chooses the model directly — only the chatMode.
 */

import { z } from "zod";

export const chatModeSchema = z.enum(["chat", "expertise", "create"]);
export type ChatMode = z.infer<typeof chatModeSchema>;

interface ChatModeEntry {
  modelId: string;
  displayName: string;
  /** Tools available for this mode. null = all standard tools */
  tools: string[] | null;
  /** Reserved tools for future implementation */
  reservedTools?: string[];
}

export const CHAT_MODE_CONFIG: Record<ChatMode, ChatModeEntry> = {
  chat: {
    modelId: "claude-haiku",
    displayName: "Haiku",
    tools: null, // All standard tools
  },
  expertise: {
    modelId: "claude-sonnet",
    displayName: "Sonnet",
    tools: null, // All standard tools (same as chat for now)
    reservedTools: ["deep_research", "analyze_document", "vision"],
  },
  create: {
    modelId: "claude-sonnet",
    displayName: "Sonnet",
    tools: null, // All standard tools (same as chat for now)
    reservedTools: ["create_presentation", "create_image", "file_generation"],
  },
};

/** Get model ID for a given chat mode */
export function getModelForChatMode(mode: ChatMode): string {
  return CHAT_MODE_CONFIG[mode].modelId;
}
