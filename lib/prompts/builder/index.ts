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
 * const result = buildSkillPrompt('utility/prompt-helper', { user });
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

/**
 * Build prompt for Prompt-agent (convenience wrapper)
 *
 * @example
 * const result = buildPromptAgentPrompt({ user });
 */
export function buildPromptAgentPrompt(context: BuildContext = {}): BuiltPrompt {
  return buildSkillPrompt('utility/prompt-helper', context);
}

// =============================================================================
// Compatibility Layer
// =============================================================================

// These functions maintain backward compatibility with the old builder

/**
 * @deprecated Use buildChatPrompt instead
 */
export function buildPrompt(
  id: 'chat' | 'ben' | 'prompt-agent',
  context: BuildContext = {}
): BuiltPrompt {
  switch (id) {
    case 'chat':
      return buildChatPrompt(context);
    case 'ben':
      const isFirstTime = context.variables?.isFirstTime === 'true';
      return buildBenPrompt(context, isFirstTime);
    case 'prompt-agent':
      return buildPromptAgentPrompt(context);
    default:
      return buildChatPrompt(context);
  }
}

/**
 * @deprecated Use getSkillsRegistry or getAgentsRegistry instead
 */
export function getAvailablePrompts(): ('chat' | 'ben' | 'prompt-agent')[] {
  return ['chat', 'ben', 'prompt-agent'];
}

/**
 * @deprecated Access configs through registry instead
 */
export function getConfig(id: string): { id: string; name: string; description: string } | null {
  if (id === 'chat') {
    return { id: 'chat', name: 'Simply', description: 'Универсальный AI-помощник' };
  }

  const agent = getAgentMetadata(id);
  if (agent) {
    return { id: agent.id, name: agent.displayName, description: agent.description };
  }

  const skill = getSkillMetadata(id);
  if (skill) {
    return { id: skill.id, name: skill.name, description: skill.description };
  }

  return null;
}
