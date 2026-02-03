/**
 * Helper Types (ТЗ-07A)
 *
 * Типы для системы помощников:
 * - PresetHelper: предустановленные помощники (статичные, не в БД)
 * - CustomHelper: кастомные помощники пользователя (в БД)
 * - Helper: объединённый тип для UI
 */

// Предустановленный помощник (статичный, не сохраняется в БД)
export interface PresetHelper {
  id: string; // Уникальный ID (e.g., 'marketer', 'copywriter')
  type: "preset";
  name: string;
  emoji: string;
  description: string; // Краткое описание для карточки
  instruction: string; // Системный промпт
  skills: string[]; // ID навыков из Skills Registry
}

// Кастомный помощник пользователя (сохраняется в БД)
export interface CustomHelper {
  id: string; // UUID из БД
  type: "custom";
  userId: string;
  name: string;
  emoji: string;
  instruction: string | null;
  skills: string[] | null;
  createdAt: Date;
}

// Объединённый тип для UI (используется в компонентах)
export type Helper = PresetHelper | CustomHelper;

// Тип для API ответа (список помощников)
export interface HelpersListResponse {
  presets: PresetHelper[];
  custom: CustomHelper[];
}

// Тип для карточки помощника на Главной
export interface HelperCardData {
  id: string;
  type: "preset" | "custom";
  name: string;
  emoji: string;
  description?: string; // Только для presets
  isCustom: boolean;
}

// Утилита для проверки типа помощника
export function isPresetHelper(helper: Helper): helper is PresetHelper {
  return helper.type === "preset";
}

export function isCustomHelper(helper: Helper): helper is CustomHelper {
  return helper.type === "custom";
}
