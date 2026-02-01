/**
 * Core Prompt Blocks
 *
 * Re-exports all core blocks for easy importing.
 */

// Base rules
export { BASE_RULES, SIMPLY_IDENTITY, ANTI_PATTERNS } from './base';

// Formatting
export { RESPONSE_FORMAT, ARTIFACTS_RULES, MARKDOWN_GUIDELINES } from './formatting';

// Safety
export { SAFETY_RULES, DATA_HANDLING, HONEST_LIMITATIONS } from './safety';

// Russian market
export { RUSSIAN_CONTEXT, RUSSIAN_LANGUAGE, LOCAL_SERVICES } from './russian-market';

/**
 * Combine selected core blocks into a single string
 */
export function combineBlocks(blocks: string[]): string {
  return blocks.filter(Boolean).join('\n\n---\n\n');
}

/**
 * Get all core blocks for main chat prompt
 */
export function getAllCoreBlocks(): string {
  const { BASE_RULES, SIMPLY_IDENTITY } = require('./base');
  const { RESPONSE_FORMAT, ARTIFACTS_RULES } = require('./formatting');
  const { SAFETY_RULES, HONEST_LIMITATIONS } = require('./safety');
  const { RUSSIAN_CONTEXT, RUSSIAN_LANGUAGE } = require('./russian-market');

  return combineBlocks([
    SIMPLY_IDENTITY,
    BASE_RULES,
    RESPONSE_FORMAT,
    ARTIFACTS_RULES,
    RUSSIAN_CONTEXT,
    RUSSIAN_LANGUAGE,
    SAFETY_RULES,
    HONEST_LIMITATIONS,
  ]);
}

/**
 * Get minimal core blocks for assistant prompts (Ben, Prompt-agent)
 */
export function getMinimalCoreBlocks(): string {
  const { BASE_RULES } = require('./base');
  const { SAFETY_RULES, HONEST_LIMITATIONS } = require('./safety');
  const { RUSSIAN_LANGUAGE } = require('./russian-market');

  return combineBlocks([
    BASE_RULES,
    RUSSIAN_LANGUAGE,
    SAFETY_RULES,
    HONEST_LIMITATIONS,
  ]);
}
