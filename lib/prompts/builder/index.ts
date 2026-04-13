/**
 * Builder API — публичный интерфейс системы сборки промптов
 *
 * Это главная точка входа для работы с промптами.
 * Использует progressive disclosure для оптимизации токенов.
 */

import type { BuildContext, ModelId, BuiltPrompt } from '../types';
import {
  getSkillsRegistry,
  getAgentsRegistry,
  getSkillMetadata,
  getAgentMetadata,
  clearRegistryCache,
  type SkillMetadata,
  type AgentMetadata,
} from './registry';
import { loadSkill, loadSkillReference, loadSkillsContent, type Skill } from './skill-loader';
import { loadAgent, getAgentGreeting, type Agent } from './agent-loader';
import {
  composeChatPrompt,
  composeExpertisePrompt,
  composeCreatePrompt,
  composeAgentPrompt,
  composeSkillPrompt,
  type ComposedPrompt,
} from './composer';

// =============================================================================
// Re-exports
// =============================================================================

export type {
  SkillMetadata,
  AgentMetadata,
  Skill,
  Agent,
  ComposedPrompt,
};

export {
  // Registry
  getSkillsRegistry,
  getAgentsRegistry,
  getSkillMetadata,
  getAgentMetadata,
  clearRegistryCache,

  // Loaders
  loadSkill,
  loadSkillReference,
  loadSkillsContent,
  loadAgent,
  getAgentGreeting,

  // Composers
  composeChatPrompt,
  composeExpertisePrompt,
  composeCreatePrompt,
  composeAgentPrompt,
  composeSkillPrompt,
};

// =============================================================================
// High-Level API
// =============================================================================

/**
 * Build prompt for main chat
 *
 * @example
 * const result = buildChatPrompt({
 *   user: { displayName: 'Владимир', occupation: 'Маркетолог' },
 * });
 */
export function buildChatPrompt(context: BuildContext = {}): BuiltPrompt {
  const composed = composeChatPrompt(context);

  return {
    systemPrompt: composed.systemPrompt,
    model: composed.model,
    greeting: composed.greeting,
    toolAccess: composed.toolAccess,
  };
}

/**
 * Build prompt for expertise chat mode
 *
 * @example
 * const result = buildExpertisePrompt({ user: { displayName: 'Владимир' } });
 */
export function buildExpertisePrompt(context: BuildContext = {}): BuiltPrompt {
  const composed = composeExpertisePrompt(context);

  return {
    systemPrompt: composed.systemPrompt,
    model: composed.model,
    greeting: composed.greeting,
    toolAccess: composed.toolAccess,
  };
}

/**
 * Build prompt for create chat mode
 *
 * @example
 * const result = buildCreatePrompt({ user: { displayName: 'Владимир' } });
 */
export function buildCreatePrompt(context: BuildContext = {}): BuiltPrompt {
  const composed = composeCreatePrompt(context);

  return {
    systemPrompt: composed.systemPrompt,
    model: composed.model,
    greeting: composed.greeting,
    toolAccess: composed.toolAccess,
  };
}

/**
 * Build prompt for agent (Ben, etc.)
 *
 * @example
 * const result = buildAgentPrompt('ben', { user }, true);
 */
export function buildAgentPrompt(
  agentId: string,
  context: BuildContext = {},
  isFirstTime: boolean = false
): BuiltPrompt {
  const composed = composeAgentPrompt(agentId, context, isFirstTime);

  return {
    systemPrompt: composed.systemPrompt,
    model: composed.model,
    greeting: composed.greeting,
    toolAccess: composed.toolAccess,
  };
}

/**
 * Build prompt for Ben (convenience wrapper)
 *
 * @example
 * const result = buildBenPrompt({ user }, true);
 */
export function buildBenPrompt(
  context: BuildContext = {},
  isFirstTime: boolean = false
): BuiltPrompt {
  return buildAgentPrompt('ben', context, isFirstTime);
}

/**
 * Build prompt for skill execution
 *
 * @example
 * const result = buildSkillPrompt('content/writing', { user });
 */
export function buildSkillPrompt(
  skillId: string,
  context: BuildContext = {}
): BuiltPrompt {
  const composed = composeSkillPrompt(skillId, context);

  return {
    systemPrompt: composed.systemPrompt,
    model: composed.model,
    toolAccess: composed.toolAccess,
  };
}

// ТЗ-LegacyChatCleanup: удалён мёртвый @deprecated compatibility layer
// (buildPrompt, getAvailablePrompts, getConfig, buildPromptAgentPrompt) —
// никто не импортировал эти функции. Если в будущем понадобится compatibility
// shim — добавить заново с реальным use case.
