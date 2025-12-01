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
    name: "gemini-3-pro-preview (Самая умная)",
    description: "Google's latest experimental model",
    pricing: {
      input: "Preview",
      output: "Preview",
    },
  },
  {
    id: "claude-haiku-3.5",
    name: "gemini-2.5-flash (Самая быстрая)",
    description: "Google's fastest model - low latency",
    pricing: {
      input: "Preview",
      output: "Preview",
    },
  },
];
