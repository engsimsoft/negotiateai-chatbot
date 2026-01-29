"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { motion } from "framer-motion";
import { memo } from "react";
import type { Agent, AgentCapabilities } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { Suggestion } from "./elements/suggestion";
import type { VisibilityType } from "./visibility-selector";

// ТЗ-4: Default suggestions when no agent is selected
const defaultSuggestions = [
  "Объясни простыми словами...",
  "Помоги составить план...",
  "Проанализируй информацию...",
  "Посоветуй как лучше...",
];

type SuggestedActionsProps = {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  selectedVisibilityType: VisibilityType;
  agent?: Agent;
};

function PureSuggestedActions({ chatId, sendMessage, agent }: SuggestedActionsProps) {
  // ТЗ-4: Get suggestions from agent's exampleTasks or use defaults
  const capabilities = agent?.capabilities as AgentCapabilities | undefined;
  const suggestedActions = capabilities?.exampleTasks?.length
    ? capabilities.exampleTasks.slice(0, 4) // Limit to 4 suggestions
    : defaultSuggestions;

  return (
    <div
      className="grid w-full gap-2 sm:grid-cols-2"
      data-testid="suggested-actions"
    >
      {suggestedActions.map((suggestedAction, index) => (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          initial={{ opacity: 0, y: 20 }}
          key={suggestedAction}
          transition={{ delay: 0.05 * index }}
        >
          <Suggestion
            className="h-auto w-full whitespace-normal p-3 text-left"
            onClick={(suggestion) => {
              window.history.replaceState({}, "", `/chat/${chatId}`);
              sendMessage({
                role: "user",
                parts: [{ type: "text", text: suggestion }],
              });
            }}
            suggestion={suggestedAction}
          >
            {suggestedAction}
          </Suggestion>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(
  PureSuggestedActions,
  (prevProps, nextProps) => {
    if (prevProps.chatId !== nextProps.chatId) {
      return false;
    }
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
      return false;
    }
    if (prevProps.agent?.id !== nextProps.agent?.id) {
      return false;
    }

    return true;
  }
);
