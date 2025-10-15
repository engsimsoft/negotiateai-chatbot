import type { UserType } from "@/app/(auth)/auth";
import type { ChatModel } from "./models";

type Entitlements = {
  maxMessagesPerDay: number;
  availableChatModelIds: ChatModel["id"][];
};

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account
   */
  guest: {
    maxMessagesPerDay: 999999, // Без ограничений (личный проект с платными API)
    availableChatModelIds: ["claude-sonnet-4", "claude-haiku-3.5"],
  },

  /*
   * For users with an account
   */
  regular: {
    maxMessagesPerDay: 999999, // Практически без ограничений (платная подписка на API)
    availableChatModelIds: ["claude-sonnet-4", "claude-haiku-3.5"],
  },

  /*
   * TODO: For users with an account and a paid membership
   */
};
