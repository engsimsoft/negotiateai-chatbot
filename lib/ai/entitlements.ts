type Entitlements = {
  maxMessagesPerDay: number;
};

/**
 * Entitlements for authenticated users.
 *
 * Семейный приватный проект - все пользователи имеют одинаковые права:
 * неограниченное количество сообщений (personal project с платным API).
 */
export const userEntitlements: Entitlements = {
  maxMessagesPerDay: 999999, // Без практических ограничений
};
