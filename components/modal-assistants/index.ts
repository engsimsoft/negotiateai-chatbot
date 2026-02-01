/**
 * Modal Assistants
 *
 * Prompt-agent and Ben (help) modal assistants.
 * Uses Vaul for iOS-style drawers and Framer Motion for animations.
 */

// Types
export type { AssistantId, AssistantMessage, AssistantDrawerProps, AssistantChatProps, TriggerButtonProps } from "./types";

// Shared components
export { AssistantDrawer } from "./assistant-drawer";
export { AssistantChat } from "./assistant-chat";

// Prompt-agent
export { PromptAgentTrigger, PromptAgentDrawer } from "./prompt-agent";

// Ben (help assistant)
export { BenTrigger, BenDrawer } from "./ben";
