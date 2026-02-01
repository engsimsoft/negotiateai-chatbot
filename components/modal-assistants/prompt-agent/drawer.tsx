"use client";

/**
 * Prompt-Agent Drawer
 *
 * Full drawer component with chat inside.
 */

import { AssistantDrawer } from "../assistant-drawer";
import { AssistantChat } from "../assistant-chat";

interface PromptAgentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsertToChat?: (text: string) => void;
}

export function PromptAgentDrawer({
  open,
  onOpenChange,
  onInsertToChat,
}: PromptAgentDrawerProps) {
  const handleInsert = (text: string) => {
    onInsertToChat?.(text);
    onOpenChange(false); // Close drawer after insert
  };

  return (
    <AssistantDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Prompt-агент"
      description="Помогу сформулировать эффективный запрос"
    >
      <AssistantChat
        assistantId="prompt-agent"
        onInsertToChat={handleInsert}
        initialMessage="Привет! Расскажи, что хочешь попросить у AI? Я помогу сформулировать запрос так, чтобы получить лучший результат."
      />
    </AssistantDrawer>
  );
}
