/**
 * @deprecated ТЗ-LegacyChatCleanup — этот файл legacy от старой системы UI-селектора
 * моделей до CoreRegistry. Сохраняется как тонкая заглушка для постепенного выпиливания
 * импортёров (compact-model-selector, input-model-selector, model-selector,
 * multimodal-input dropdown, entitlements). После очистки всех call-sites — удалить файл.
 *
 * Реальный SSOT моделей теперь: lib/ai/model-catalog.ts + lib/ai/task-assignments.ts.
 * Резолв через getModel(taskId).
 */

export const DEFAULT_CHAT_MODEL: string = "auto";

export type ChatModel = {
  id: string;
  name: string;
  description: string;
  pricing?: {
    input: string;
    output: string;
  };
};

/** Пустой массив — старые UI-селекторы перестали показывать выбор. */
export const chatModels: ChatModel[] = [];
