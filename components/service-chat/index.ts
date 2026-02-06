/**
 * ServiceChat Components
 *
 * Unified service chat system for Ben, Project Creation, and Project Manager.
 * ТЗ-09: ServiceChat унификация
 *
 * @example
 * ```tsx
 * import { ServiceChatFloating, ServiceChatTrigger, BEN_CONFIG } from "@/components/service-chat";
 *
 * <ServiceChatFloating
 *   config={BEN_CONFIG}
 *   open={open}
 *   onOpenChange={setOpen}
 * />
 * ```
 */

// Types
export type {
  ServiceChatId,
  ServiceChatShell,
  FloatingPosition,
  QuickAction,
  ServiceChatConfig,
  ServiceChatMessage,
  ServiceChatCoreProps,
  ServiceChatFloatingProps,
  ServiceChatDrawerProps,
  ServiceChatTriggerProps,
} from "./types";

// Core component
export { ServiceChatCore } from "./service-chat-core";

// Trigger button
export { ServiceChatTrigger } from "./service-chat-trigger";

// Shells
export { ServiceChatFloating } from "./service-chat-floating";
export { ServiceChatDrawer } from "./service-chat-drawer";

// Configs
export {
  BEN_CONFIG,
  PROJECT_CREATION_CONFIG,
  PROJECT_MANAGER_CONFIG,
} from "./configs";

// Ben-specific components
export { BenIntroBubble } from "./ben-intro-bubble";
