/**
 * ServiceChat Types
 *
 * Unified types for all service chat assistants (Ben, Project Creation, Project Manager).
 * ТЗ-09: ServiceChat унификация
 */

import type { ReactNode } from "react";

/**
 * Service chat assistant identifiers
 */
export type ServiceChatId = "ben" | "project-creation" | "project-manager";

/**
 * Shell type for the service chat
 */
export type ServiceChatShell = "floating" | "drawer";

/**
 * Position for floating modals
 */
export type FloatingPosition = "center" | "bottom-right";

/**
 * Quick action card configuration
 */
export interface QuickAction {
  icon: string;
  label: string;
  prompt: string;
}

/**
 * Service chat configuration
 */
export interface ServiceChatConfig {
  id: ServiceChatId;
  title: string;
  subtitle?: string;
  icon: string;

  // Shell configuration
  shell: ServiceChatShell;
  position?: FloatingPosition; // for floating
  size?: { width: number; height: number }; // for floating

  // AI configuration
  model: "claude-haiku" | "claude-sonnet";
  apiEndpoint?: string; // defaults to /api/service-chat

  // UX configuration
  quickActions?: QuickAction[];
  greeting?: string;
  persistMessages?: boolean;
}

/**
 * Message in service chat
 */
export interface ServiceChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

/**
 * Core component props (headless)
 */
export interface ServiceChatCoreProps {
  config: ServiceChatConfig;
  /** Additional context to send with requests (e.g., projectId) */
  context?: Record<string, unknown>;
  /** External messages state (for persistMessages) */
  messages?: ServiceChatMessage[];
  /** Callback when messages change */
  onMessagesChange?: (messages: ServiceChatMessage[]) => void;
  /** Callback when a quick action is clicked */
  onQuickAction?: (action: QuickAction) => void;
  /** Custom className for the container */
  className?: string;
  /**
   * ТЗ-A3: Pre-loaded messages from server (for persistent service chats).
   * When provided, these are used as initial messages for useChat (after greeting).
   * Format: useChat-compatible messages with id, role, parts.
   */
  loadedMessages?: Array<{
    id: string;
    role: string;
    parts: unknown;
  }>;
}

/**
 * Floating modal props
 */
export interface ServiceChatFloatingProps {
  config: ServiceChatConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: Record<string, unknown>;
  /** External messages state */
  messages?: ServiceChatMessage[];
  onMessagesChange?: (messages: ServiceChatMessage[]) => void;
}

/**
 * Drawer props
 */
export interface ServiceChatDrawerProps {
  config: ServiceChatConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: Record<string, unknown>;
  /** External messages state */
  messages?: ServiceChatMessage[];
  onMessagesChange?: (messages: ServiceChatMessage[]) => void;
}

/**
 * Trigger button props
 */
export interface ServiceChatTriggerProps {
  icon: ReactNode;
  tooltip?: string;
  onClick: () => void;
  className?: string;
}
