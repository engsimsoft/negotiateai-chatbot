/**
 * Modal Assistants - Shared Types
 *
 * Types for Prompt-agent and Ben modal assistants.
 */

export type AssistantId = 'prompt-agent' | 'ben';

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export interface AssistantDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export interface AssistantChatProps {
  assistantId: AssistantId;
  onInsertToChat?: (text: string) => void;
  initialMessage?: string;
  isFirstTime?: boolean;
}

export interface TriggerButtonProps {
  onClick: () => void;
  className?: string;
}
