/**
 * Server-only Prompt System API
 *
 * This module contains functions that use Node.js 'fs' module
 * and can only be used in API routes and server components.
 *
 * @example
 * ```ts
 * import { buildChatPrompt, buildAgentPrompt } from '@/lib/prompts/server';
 *
 * // In API route
 * const result = buildChatPrompt({
 *   user: { displayName: 'Владимир' },
 * });
 * ```
 */

import 'server-only';

// =============================================================================
// Re-export everything from builder
// =============================================================================

export {
  // High-level builders
  buildChatPrompt,
  buildExpertisePrompt,
  buildCreatePrompt,
  buildAgentPrompt,
  buildBenPrompt,
  buildSkillPrompt,

  // Registry
  getSkillsRegistry,
  getAgentsRegistry,
  getSkillMetadata,
  getAgentMetadata,
  clearRegistryCache,

  // Loaders
  loadSkill,
  loadAgent,
  getAgentGreeting,

  // Composers
  composeChatPrompt,
  composeExpertisePrompt,
  composeCreatePrompt,
  composeAgentPrompt,
  composeSkillPrompt,

  // Compatibility layer
  buildPrompt,
  getAvailablePrompts,
  getConfig,

  // Types
  type SkillMetadata,
  type AgentMetadata,
  type Skill,
  type Agent,
  type ComposedPrompt,
} from './builder';

// =============================================================================
// Re-export client-safe utilities
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

export { render, hasVariable, extractVariables, conditional, joinBlocks } from './template';

export {
  buildUserProfileContext,
  buildPersonalizationContext,
  buildFullUserContext,
  buildMemoryContext,
  buildSimpleMemoryContext,
  type MemoryEntry,
} from './contexts';
