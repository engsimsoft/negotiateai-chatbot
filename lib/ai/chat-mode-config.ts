/**
 * ТЗ-DV2: Chat Mode Configuration
 *
 * Server-side mapping: chatMode → model + tools config.
 * Client never chooses the model directly — only the chatMode.
 */

import { z } from "zod";

export const chatModeSchema = z.enum(["chat", "expertise", "create"]);
export type ChatMode = z.infer<typeof chatModeSchema>;

export const CHAT_MODE_CONFIG: Record<
  ChatMode,
  { modelId: string; displayName: string }
> = {
  chat: {
    modelId: "claude-haiku",
    displayName: "Haiku",
  },
  expertise: {
    modelId: "claude-sonnet",
    displayName: "Sonnet",
  },
  create: {
    modelId: "claude-sonnet",
    displayName: "Sonnet",
  },
};

/** Get model ID for a given chat mode */
export function getModelForChatMode(mode: ChatMode): string {
  return CHAT_MODE_CONFIG[mode].modelId;
}
