import type { ChatModel } from "./models";

type Entitlements = {
  maxMessagesPerDay: number;
  availableChatModelIds: ChatModel["id"][];
};

/**
 * Entitlements for authenticated users.
 *
 * Семейный приватный проект - все пользователи имеют одинаковые права:
 * - Неограниченное количество сообщений (personal project с платным API)
 * - Доступ ко всем моделям Claude (Sonnet, Haiku, Opus)
 */
export const userEntitlements: Entitlements = {
  maxMessagesPerDay: 999999, // Без практических ограничений
  availableChatModelIds: ["claude-sonnet", "claude-haiku", "claude-opus"],
};
