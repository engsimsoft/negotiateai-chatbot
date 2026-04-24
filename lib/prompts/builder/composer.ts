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
import { buildLibraryContext } from '../contexts/library';
import { getSkillsRegistry, type SkillMetadata } from './registry';
import { loadAgent, type Agent } from './agent-loader';
import { loadSkill, type Skill } from './skill-loader';
import type { ChatMode } from '@/lib/ai/chat-mode-config';
import { getTaskIdForChatMode } from '@/lib/ai/chat-mode-config';
import type { TaskId } from '@/lib/ai/task-assignments';
import { getModelIdForTask } from '@/lib/ai/getModel';
import { getModelEntry } from '@/lib/ai/model-catalog';
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

  // Library context (user's xAI Collections for RAG discovery)
  const libraryContext = buildLibraryContext(
    context.library,
    context.librarySourcesScope,
  );
  if (libraryContext) blocks.push(libraryContext);

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
 * - Simply Chat role & behavior (simply-chat.md)
 * - User context
 * - All skills metadata (for routing)
 * - Dev mode + dev_reminder (if SIMPLY_DEV_MODE=true)
 */
export function composeChatPrompt(
  context: BuildContext = {},
  chatMode: ChatMode = 'simply',
  activeTaskId?: TaskId,
): ComposedPrompt {
  const parts: string[] = [];

  // Core blocks
  parts.push(getAllCoreBlocks());

  // Simply Chat role & behavior
  const chatPromptPath = path.join(process.cwd(), 'lib', 'prompts', 'chat', 'simply-chat.md');
  try {
    const chatPrompt = fs.readFileSync(chatPromptPath, 'utf-8').trim();
    if (chatPrompt) {
      // Display name read from SSOT (model-catalog). If activeTaskId is not
      // provided, fall back to the default taskId for chatMode. This keeps
      // <current_model> accurate even when Simply Chat routes to Grok/Haiku
      // via think/vision overrides resolved in chat/route.ts.
      const resolvedTaskId = activeTaskId ?? getTaskIdForChatMode(chatMode);
      const modelId = getModelIdForTask(resolvedTaskId);
      const displayModel = getModelEntry(modelId)?.displayName ?? 'AI';

      // Regex replace is tolerant to whatever default the .md file holds —
      // editing simply-chat.md's placeholder values never breaks injection.
      const promptWithInjections = chatPrompt
        .replace(/<current_mode>[^<]*<\/current_mode>/, `<current_mode>${chatMode}</current_mode>`)
        .replace(/<current_model>[^<]*<\/current_model>/, `<current_model>${displayModel}</current_model>`);
      parts.push('---\n\n' + promptWithInjections);
    }
  } catch (e) {
    console.warn('Simply Chat prompt not found, using core blocks only');
  }

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

  return {
    systemPrompt: parts.join('\n\n'),
    // Dead field: `.model` on the builder result is not read at runtime
    // (see app/(chat)/api/assistant/ben/route.ts:32 — "no longer used").
    // Actual model resolution happens via getModel(taskId) in chat/route.ts.
    // Field kept until TZ_PromptsDeadCodeCleanup removes ModelId type entirely.
    model: 'claude-sonnet',
    greeting: 'Привет! Чем могу помочь?',
    toolAccess: null,
  };
}

/**
 * Compose prompt for expertise chat mode
 *
 * Structure: core blocks → expertise.md → user context → skills metadata.
 * Single-agent режим на Grok 4.20 reasoning, без подмены current_mode/current_model.
 */
export function composeExpertisePrompt(
  context: BuildContext = {},
  _activeTaskId?: TaskId,
): ComposedPrompt {
  const parts: string[] = [];

  parts.push(getAllCoreBlocks());

  const expertisePromptPath = path.join(process.cwd(), 'lib', 'prompts', 'chat', 'expertise.md');
  try {
    const expertisePrompt = fs.readFileSync(expertisePromptPath, 'utf-8').trim();
    if (expertisePrompt) {
      parts.push('---\n\n' + expertisePrompt);
    }
  } catch (e) {
    console.warn('Expertise prompt not found, falling back to core blocks only');
  }

  const userContext = combineContextBlocks(context);
  if (userContext) {
    parts.push('---\n\n' + userContext);
  }

  const skills = getSkillsRegistry();
  if (skills.length > 0) {
    parts.push('---\n\n' + buildSkillsMetadataBlock(skills));
  }

  return {
    systemPrompt: parts.join('\n\n'),
    model: 'claude-sonnet',
    greeting: 'Привет! Чем могу помочь?',
    toolAccess: null,
  };
}

/**
 * Compose prompt for create chat mode
 *
 * Delegates to composeChatPrompt with chatMode='create'.
 * PE will replace with real create prompt later.
 */
export function composeCreatePrompt(
  context: BuildContext = {},
  activeTaskId?: TaskId,
): ComposedPrompt {
  return composeChatPrompt(context, 'create', activeTaskId);
}

/**
 * Compose prompt for library-document chat mode (split-view, single-doc chat).
 *
 * Isolation requirements (ANALYSIS П-2):
 *  - MIND не подключается (gated выше в chat/route.ts)
 *  - Tool set = только `librarySearch` с hardcoded lockedFileId
 *  - Ничего не подмешивается: ни профиль, ни память, ни список коллекций
 *  - «Нет в документе» = правильный ответ
 */
export function composeLibraryDocumentPrompt(
  documentName: string,
  _activeTaskId?: TaskId,
): ComposedPrompt {
  const parts: string[] = [];

  parts.push(getMinimalCoreBlocks());

  parts.push(
    `---\n\n## Режим работы — Помощник по одному документу\n\n` +
      `Ты отвечаешь ТОЛЬКО на основе содержимого одного документа пользователя: **«${documentName}»**.\n\n` +
      `### Правила\n\n` +
      `- Перед ответом всегда вызывай инструмент \`librarySearch\` с запросом на естественном языке (на русском). ` +
      `Не передавай параметры \`collectionIds\` или \`fileIds\` — tool сам ограничен этим документом.\n` +
      `- Отвечай строго на основе фрагментов, которые вернул \`librarySearch\`. Цитируй конкретные фразы.\n` +
      `- Если информации в документе нет — прямо скажи: «В документе нет такой информации.» Не дополняй из общих знаний.\n` +
      `- У тебя НЕТ доступа к интернету, к другим документам пользователя, к его профилю или памяти.\n` +
      `- Отвечай коротко и по делу. Без приветствий и воды.\n`,
  );

  return {
    systemPrompt: parts.join("\n\n"),
    model: "claude-sonnet",
    greeting: `Готов отвечать по документу «${documentName}». Задай вопрос.`,
    toolAccess: ["librarySearch"],
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
