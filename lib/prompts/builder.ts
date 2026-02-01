/**
 * Prompt Builder
 *
 * Main logic for assembling prompts from configs and context.
 * This is the core of the new prompt system.
 */

import type {
  PromptId,
  PromptConfig,
  BuildContext,
  BuiltPrompt,
  ModelId,
} from './types';
import { render } from './template';
import { buildFullUserContext } from './contexts/user-profile';
import { buildSimpleMemoryContext } from './contexts/chat-memory';

// Import configs
import { chatConfig } from './chat/config';
import { benConfig, getBenGreeting } from './ben/config';
import { promptAgentConfig } from './assistants/prompt-agent/config';

// =============================================================================
// Config Registry
// =============================================================================

/**
 * Registry of all prompt configs
 */
const configs: Record<PromptId, PromptConfig> = {
  chat: chatConfig,
  ben: benConfig,
  'prompt-agent': promptAgentConfig,
};

/**
 * Get prompt config by ID
 */
export function getConfig(id: PromptId): PromptConfig {
  const config = configs[id];
  if (!config) {
    throw new Error(`Unknown prompt ID: ${id}`);
  }
  return config;
}

/**
 * Get all available prompt IDs
 */
export function getAvailablePrompts(): PromptId[] {
  return Object.keys(configs) as PromptId[];
}

// =============================================================================
// Context Building
// =============================================================================

/**
 * Build request hints context block
 */
function buildRequestHintsContext(
  hints?: BuildContext['requestHints']
): string {
  if (!hints) return '';

  const { latitude, longitude, city, country } = hints;

  // Skip if no meaningful data
  if (!city && !country) {
    return '';
  }

  const lines: string[] = ['## Информация о запросе', ''];

  if (city) lines.push(`- Город: ${city}`);
  if (country) lines.push(`- Страна: ${country}`);
  if (latitude && longitude) {
    lines.push(`- Координаты: ${latitude}, ${longitude}`);
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Combine all context blocks into single string
 */
function combineContextBlocks(context: BuildContext): string {
  const blocks: string[] = [];

  // User context (profile + personalization)
  const userContext = buildFullUserContext(
    context.user,
    context.personalization
  );
  if (userContext) blocks.push(userContext);

  // Memory context
  const memoryContext = buildSimpleMemoryContext(context.memory);
  if (memoryContext) blocks.push(memoryContext);

  // Request hints
  const hintsContext = buildRequestHintsContext(context.requestHints);
  if (hintsContext) blocks.push(hintsContext);

  return blocks.join('\n');
}

// =============================================================================
// Main Builder
// =============================================================================

/**
 * Build a prompt from config and context
 *
 * @param id - Prompt identifier ('chat', 'ben', 'prompt-agent')
 * @param context - Context data (user, memory, etc.)
 * @returns Built prompt ready for use
 *
 * @example
 * ```ts
 * const result = buildPrompt('chat', {
 *   user: { displayName: 'Владимир', occupation: 'Маркетолог' },
 * });
 *
 * console.log(result.systemPrompt); // Contains "Владимир"
 * console.log(result.model); // 'gemini-3-pro'
 * ```
 */
export function buildPrompt(id: PromptId, context: BuildContext = {}): BuiltPrompt {
  const config = getConfig(id);

  // Build all context blocks
  const userContext = combineContextBlocks(context);

  // Prepare template variables
  const variables: Record<string, string> = {
    userContext,
    userName: context.user?.displayName || '',
    userOccupation: context.user?.occupation || '',
    ...context.variables,
  };

  // Render system prompt with variables
  const systemPrompt = render(config.systemPrompt, variables);

  // Determine model (context override > config default)
  const model: ModelId = context.model || config.defaultModel;

  // Get greeting (special handling for Ben)
  let greeting = config.greeting;
  if (id === 'ben' && context.variables?.isFirstTime === 'true') {
    greeting = getBenGreeting(true);
  }

  return {
    systemPrompt,
    model,
    greeting,
    toolAccess: config.toolAccess,
  };
}

/**
 * Build prompt for chat (convenience wrapper)
 */
export function buildChatPrompt(context: BuildContext = {}): BuiltPrompt {
  return buildPrompt('chat', context);
}

/**
 * Build prompt for Ben (convenience wrapper)
 */
export function buildBenPrompt(
  context: BuildContext = {},
  isFirstTime: boolean = false
): BuiltPrompt {
  return buildPrompt('ben', {
    ...context,
    variables: {
      ...context.variables,
      isFirstTime: isFirstTime ? 'true' : 'false',
    },
  });
}

/**
 * Build prompt for Prompt-agent (convenience wrapper)
 */
export function buildPromptAgentPrompt(context: BuildContext = {}): BuiltPrompt {
  return buildPrompt('prompt-agent', context);
}
