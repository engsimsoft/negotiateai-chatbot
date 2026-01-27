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
 * - Доступ ко всем моделям (авто-выбор, Gemini 3 Pro, Gemini 2.5 Flash)
 */
export const userEntitlements: Entitlements = {
  maxMessagesPerDay: 999999, // Без практических ограничений
  availableChatModelIds: ["auto", "gemini-3-pro", "gemini-2.5-flash"],
};
