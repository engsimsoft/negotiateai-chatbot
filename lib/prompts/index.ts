/**
 * Simply Prompt System v2
 *
 * Skills + Agents architecture based on Anthropic Agent Skills standard.
 *
 * IMPORTANT: Server-side functions (buildChatPrompt, loadAgent, etc.) that use
 * Node.js 'fs' module should be imported from '@/lib/prompts/server'.
 *
 * This file only exports types and client-safe utilities.
 *
 * @example Server-side (API routes, server components):
 * ```ts
 * import { buildChatPrompt, buildAgentPrompt } from '@/lib/prompts/server';
 * ```
 *
 * @example Client-side (React components):
 * ```ts
 * import type { BuildContext, BuiltPrompt } from '@/lib/prompts';
 * ```
 */

// =============================================================================
// Types (safe for client and server)
// =============================================================================

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

// =============================================================================
// Template utilities (safe for client and server)
// =============================================================================

export { render, hasVariable, extractVariables, conditional, joinBlocks } from './template';

// =============================================================================
// Context builders (safe for client and server)
// =============================================================================

export {
  buildUserProfileContext,
  buildPersonalizationContext,
  buildFullUserContext,
  buildMemoryContext,
  buildSimpleMemoryContext,
  type MemoryEntry,
} from './contexts';

// =============================================================================
// Server-only note
// =============================================================================

/**
 * Server-only functions have been moved to '@/lib/prompts/server'.
 *
 * Moved functions:
 * - buildChatPrompt, buildAgentPrompt, buildBenPrompt, buildSkillPrompt
 * - getSkillsRegistry, getAgentsRegistry
 * - loadSkill, loadAgent, getAgentGreeting
 * - composeChatPrompt, composeAgentPrompt, composeSkillPrompt
 *
 * Import them from server module:
 * ```ts
 * import { buildChatPrompt } from '@/lib/prompts/server';
 * ```
 */
