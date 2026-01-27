export const DEFAULT_CHAT_MODEL: string = "auto";

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
    id: "auto",
    name: "Авто (рекомендуется)",
    description: "Автоматический выбор модели на основе агента",
    pricing: {
      input: "Gemini 3 Pro / 2.5 Flash",
      output: "Зависит от агента",
    },
  },
  {
    id: "claude-sonnet-4",
    name: "Gemini 2.5 Pro",
    description: "Единая модель для всех агентов (артефакты)",
    pricing: {
      input: "$1.25",
      output: "$5",
    },
  },
  {
    id: "claude-haiku-3.5",
    name: "Gemini 2.5 Flash",
    description: "Быстрая модель для простых задач",
    pricing: {
      input: "$0.075",
      output: "$0.30",
    },
  },
];
