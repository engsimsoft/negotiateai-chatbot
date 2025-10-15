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
    name: "Claude Sonnet 4.5",
    description: "Anthropic's most capable model for complex tasks and analysis",
    pricing: {
      input: "$3.00/MTok",
      output: "$15.00/MTok",
    },
  },
  {
    id: "claude-haiku-3.5",
    name: "Claude Haiku 3.5",
    description: "Fast and cost-effective model for testing and simple tasks (75% cheaper)",
    pricing: {
      input: "$0.80/MTok",
      output: "$4.00/MTok",
    },
  },
];
