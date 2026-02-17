/**
 * Chat Models Configuration
 *
 * Источник правды для цен и характеристик: docs/ai-providers.md
 * Этот файл содержит только UI-представление моделей.
 */

export const DEFAULT_CHAT_MODEL: string = "claude-sonnet";

export type ChatModel = {
  id: string;
  name: string;
  description: string;
  pricing?: {
    input: string;  // per million tokens
    output: string; // per million tokens
  };
};

export const chatModels: ChatModel[] = [
  {
    id: "claude-sonnet",
    name: "Simply Sonnet",
    description: "Основная модель — баланс скорости и качества",
    pricing: {
      input: "$3",
      output: "$15",
    },
  },
  {
    id: "claude-haiku",
    name: "Simply Haiku",
    description: "Быстрая модель для простых задач",
    pricing: {
      input: "$1",
      output: "$5",
    },
  },
  {
    id: "claude-opus",
    name: "Simply Opus",
    description: "Максимальное качество для сложных задач",
    pricing: {
      input: "$5",
      output: "$25",
    },
  },
];
