export const DEFAULT_CHAT_MODEL: string = "claude-sonnet-4";

export type ChatModel = {
  id: string;
  name: string;
  description: string;
};

export const chatModels: ChatModel[] = [
  {
    id: "claude-sonnet-4",
    name: "Claude Sonnet 4.5",
    description: "Anthropic's most capable model for complex tasks and analysis",
  },
];
