export const DEFAULT_CHAT_MODEL: string = "claude-sonnet-4";

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
    id: "claude-sonnet-4",
    name: "gemini-2.5-pro (Единая модель)",
    description: "Stable release of Google's flagship model",
    pricing: {
      input: "N/A",
      output: "N/A",
    },
  },
  {
    id: "claude-haiku-3.5",
    name: "Gemini 2.5 Flash (Быстрый)",
    description: "Speed-optimized model for quick responses and lower cost",
    pricing: {
      input: "Ниже",
      output: "Ниже",
    },
  },
];
