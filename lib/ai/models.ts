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
    name: "Claude Sonnet 4.5 (Sep 2025)",
    description: "Latest Anthropic model (claude-sonnet-4-5-20250929) - most capable for complex tasks",
    pricing: {
      input: "$3.00/MTok",
      output: "$15.00/MTok",
    },
  },
  {
    id: "claude-haiku-3.5",
    name: "Claude Haiku 4.5 (Oct 2025)",
    description: "Latest fast model (claude-haiku-4-5-20251001) - 2x faster, Sonnet-level coding (67% cheaper)",
    pricing: {
      input: "$1.00/MTok",
      output: "$5.00/MTok",
    },
  },
];
