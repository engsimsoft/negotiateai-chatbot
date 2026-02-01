/**
 * Simply Prompt System
 *
 * File-based prompt management with TypeScript configs.
 * Replaces database-driven agent system.
 *
 * @example
 * ```ts
 * import { buildPrompt } from '@/lib/prompts';
 *
 * // Build chat prompt with user context
 * const result = buildPrompt('chat', {
 *   user: { displayName: 'Владимир' },
 * });
 *
 * console.log(result.systemPrompt);
 * console.log(result.model); // 'gemini-3-pro'
 * ```
 */

// Main exports
export {
  buildPrompt,
  buildChatPrompt,
  buildBenPrompt,
  buildPromptAgentPrompt,
  getConfig,
  getAvailablePrompts,
} from './builder';

// Types
export type {
  PromptId,
  ModelId,
  CommunicationStyle,
  UserProfile,
  UserPersonalization,
  BuildContext,
  PromptConfig,
  BuiltPrompt,
  PromptBlock,
} from './types';

// Template utilities
export { render, hasVariable, extractVariables, conditional, joinBlocks } from './template';

// Context builders
export {
  buildUserProfileContext,
  buildPersonalizationContext,
  buildFullUserContext,
  buildMemoryContext,
  buildSimpleMemoryContext,
  type MemoryEntry,
} from './contexts';

// Core blocks (for advanced usage)
export * as core from './core';

// Individual configs (for direct access)
export { chatConfig } from './chat/config';
export { benConfig, getBenGreeting } from './ben/config';
export { promptAgentConfig } from './assistants/prompt-agent/config';
