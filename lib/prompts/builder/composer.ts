/**
 * Composer — собирает финальный промпт из компонентов
 *
 * Комбинирует:
 * - Core blocks (base, safety, formatting, russian-market)
 * - Agent personality (если указан)
 * - User context (profile, memory)
 * - Skills metadata (для роутинга)
 */

import fs from 'fs';
import path from 'path';
import type { BuildContext, ModelId } from '../types';
import { buildFullUserContext } from '../contexts/user-profile';
import { buildSimpleMemoryContext } from '../contexts/chat-memory';
import { getSkillsRegistry, type SkillMetadata } from './registry';
import { loadAgent, type Agent } from './agent-loader';
import { loadSkill, type Skill } from './skill-loader';

// =============================================================================
// Types
// =============================================================================

export interface ComposedPrompt {
  systemPrompt: string;
  model: ModelId;
  greeting?: string;
  toolAccess?: string[] | null;
}

// =============================================================================
// Core Blocks Loading
// =============================================================================

const CORE_DIR = path.join(process.cwd(), 'lib', 'prompts', 'core');

/**
 * Load a core markdown file
 */
function loadCoreBlock(filename: string): string {
  const filePath = path.join(CORE_DIR, filename);

  if (!fs.existsSync(filePath)) {
    console.warn(`Core block not found: ${filename}`);
    return '';
  }

  try {
    return fs.readFileSync(filePath, 'utf-8').trim();
  } catch (error) {
    console.error(`Error loading core block ${filename}:`, error);
    return '';
  }
}

/**
 * Get all core blocks combined
 */
function getAllCoreBlocks(): string {
  const blocks = [
    loadCoreBlock('base.md'),
    loadCoreBlock('safety.md'),
    loadCoreBlock('formatting.md'),
    loadCoreBlock('russian-market.md'),
  ].filter(Boolean);

  return blocks.join('\n\n---\n\n');
}

/**
 * Get minimal core blocks (for assistants)
 */
function getMinimalCoreBlocks(): string {
  const blocks = [
    loadCoreBlock('base.md'),
    loadCoreBlock('safety.md'),
  ].filter(Boolean);

  return blocks.join('\n\n---\n\n');
}

// =============================================================================
// Skills Metadata Block
// =============================================================================

/**
 * Build skills metadata block for routing
 * Only includes name and description (Level 1)
 */
function buildSkillsMetadataBlock(skills: SkillMetadata[]): string {
  if (skills.length === 0) return '';

  const lines = ['## Доступные навыки (Skills)', ''];

  for (const skill of skills) {
    lines.push(`### ${skill.name}`);
    lines.push(skill.description);
    if (skill.tools.length > 0) {
      lines.push(`Инструменты: ${skill.tools.join(', ')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// =============================================================================
// Context Building
// =============================================================================

/**
 * Build request hints context block
 */
function buildRequestHintsContext(hints?: BuildContext['requestHints']): string {
  if (!hints) return '';

  const { city, country } = hints;
  if (!city && !country) return '';

  const lines: string[] = ['## Информация о запросе', ''];
  if (city) lines.push(`- Город: ${city}`);
  if (country) lines.push(`- Страна: ${country}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Combine all context blocks
 */
function combineContextBlocks(context: BuildContext): string {
  const blocks: string[] = [];

  // User context (profile + personalization)
  const userContext = buildFullUserContext(context.user, context.personalization);
  if (userContext) blocks.push(userContext);

  // Memory context
  const memoryContext = buildSimpleMemoryContext(context.memory);
  if (memoryContext) blocks.push(memoryContext);

  // Request hints
  const hintsContext = buildRequestHintsContext(context.requestHints);
  if (hintsContext) blocks.push(hintsContext);

  return blocks.join('\n\n');
}

// =============================================================================
// Composers
// =============================================================================

/**
 * Compose prompt for main chat
 *
 * Includes:
 * - All core blocks
 * - User context
 * - All skills metadata (for routing)
 */
export function composeChatPrompt(context: BuildContext = {}): ComposedPrompt {
  const parts: string[] = [];

  // Core blocks
  parts.push(getAllCoreBlocks());

  // User context
  const userContext = combineContextBlocks(context);
  if (userContext) {
    parts.push('---\n\n' + userContext);
  }

  // Skills metadata for routing
  const skills = getSkillsRegistry();
  if (skills.length > 0) {
    parts.push('---\n\n' + buildSkillsMetadataBlock(skills));
  }

  // Dev mode: inject debug instructions (controlled by SIMPLY_DEV_MODE env)
  if (process.env.SIMPLY_DEV_MODE === 'true') {
    const devBlock = loadCoreBlock('dev-mode.md');
    if (devBlock) {
      parts.push('---\n\n' + devBlock);
    }
  }

  return {
    systemPrompt: parts.join('\n\n'),
    model: context.model || 'claude-haiku',
    greeting: 'Привет! Чем могу помочь?',
    toolAccess: null, // All tools
  };
}

/**
 * Compose prompt for expertise chat mode
 *
 * Stub: delegates to composeChatPrompt, hardcodes Sonnet.
 * PE will replace with real expertise prompt later.
 */
export function composeExpertisePrompt(context: BuildContext = {}): ComposedPrompt {
  const base = composeChatPrompt(context);
  return {
    ...base,
    model: 'claude-sonnet',
  };
}

/**
 * Compose prompt for create chat mode
 *
 * Stub: delegates to composeChatPrompt, hardcodes Sonnet.
 * PE will replace with real create prompt later.
 */
export function composeCreatePrompt(context: BuildContext = {}): ComposedPrompt {
  const base = composeChatPrompt(context);
  return {
    ...base,
    model: 'claude-sonnet',
  };
}

/**
 * Compose prompt for agent
 *
 * Includes:
 * - Minimal core blocks
 * - Agent personality (AGENT.md)
 * - Agent includes (onboarding, etc.)
 * - User context
 * - Agent's skills metadata
 */
export function composeAgentPrompt(
  agentId: string,
  context: BuildContext = {},
  isFirstTime: boolean = false
): ComposedPrompt {
  const agent = loadAgent(agentId);

  if (!agent) {
    // Fallback to chat prompt if agent not found
    console.warn(`Agent ${agentId} not found, falling back to chat prompt`);
    return composeChatPrompt(context);
  }

  const parts: string[] = [];

  // Minimal core blocks
  parts.push(getMinimalCoreBlocks());

  // Agent personality
  parts.push('---\n\n' + agent.content);

  // Agent includes (like interview.md)
  for (const [filename, content] of Object.entries(agent.includes)) {
    if (!filename.startsWith('references/')) {
      parts.push('---\n\n' + content);
    }
  }

  // User context
  const userContext = combineContextBlocks(context);
  if (userContext) {
    parts.push('---\n\n' + userContext);
  }

  // Agent's skills metadata
  if (agent.availableSkills.length > 0) {
    parts.push('---\n\n' + buildSkillsMetadataBlock(agent.availableSkills));
  }

  // Get greeting
  let greeting: string;
  if (agentId === 'ben') {
    greeting = isFirstTime
      ? 'Привет! 👋 Я Бен, твой гид по Simply.\n\n**Кратко о платформе:**\n- Simply — это AI-помощник для бизнеса\n- Пишет тексты, создаёт таблицы, презентации\n- Ищет информацию в интернете\n- Работает с твоими документами\n\n**Как начать:**\nПросто напиши свою задачу в чат.\n\nЕсть вопросы? Спрашивай — я помогу разобраться!'
      : 'Привет! Я Бен. Чем могу помочь?\n\nСпрашивай о возможностях Simply или как лучше сформулировать запрос.';
  } else {
    greeting = 'Привет! Чем могу помочь?';
  }

  return {
    systemPrompt: parts.join('\n\n'),
    model: (context.model || 'claude-haiku') as ModelId,
    greeting,
    toolAccess: [], // Agents typically don't have tools
  };
}

/**
 * Compose prompt for skill execution
 *
 * Used when a skill is explicitly activated.
 * Loads full SKILL.md content.
 */
export function composeSkillPrompt(
  skillId: string,
  context: BuildContext = {}
): ComposedPrompt {
  const skill = loadSkill(skillId);

  if (!skill) {
    console.warn(`Skill ${skillId} not found, falling back to chat prompt`);
    return composeChatPrompt(context);
  }

  const parts: string[] = [];

  // Minimal core
  parts.push(getMinimalCoreBlocks());

  // Full skill content
  parts.push('---\n\n' + skill.content);

  // User context
  const userContext = combineContextBlocks(context);
  if (userContext) {
    parts.push('---\n\n' + userContext);
  }

  return {
    systemPrompt: parts.join('\n\n'),
    model: context.model || 'claude-sonnet',
    toolAccess: skill.tools.length > 0 ? skill.tools : null,
  };
}
