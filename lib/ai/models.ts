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
      input: "Зависит от агента",
      output: "$2-12 (3 Pro) / $0.075-0.30 (Flash)",
    },
  },
  {
    id: "gemini-3-pro",
    name: "Gemini 3 Pro",
    description: "Профессиональная модель с dynamic thinking",
    pricing: {
      input: "$2",
      output: "$12",
    },
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    description: "Быстрая модель для простых задач",
    pricing: {
      input: "$0.075",
      output: "$0.30",
    },
  },
];
