/**
 * Modal Assistants
 *
 * Ben (help) modal assistant.
 * Uses Vaul for iOS-style drawers and Framer Motion for animations.
 *
 * Note: Prompt-agent removed in ТЗ-09 (archived for future use).
 */

// Types
export type { AssistantId, AssistantMessage, AssistantDrawerProps, AssistantChatProps, TriggerButtonProps } from "./types";

// Shared components
export { AssistantDrawer } from "./assistant-drawer";
export { AssistantChat } from "./assistant-chat";

// Ben (help assistant)
export { BenTrigger, BenDrawer, BenIntroBubble } from "./ben";
