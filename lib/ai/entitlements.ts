import type { ChatModel } from "./models";

type Entitlements = {
  maxMessagesPerDay: number;
  availableChatModelIds: ChatModel["id"][];
};

/**
 * Entitlements for authenticated users.
 * Since this is a private family project with no guest mode,
 * all users have the same entitlements.
 */
export const userEntitlements: Entitlements = {
  maxMessagesPerDay: 999999, // No practical limit (personal project with paid API)
  availableChatModelIds: ["claude-sonnet-4", "claude-haiku-3.5"],
};
