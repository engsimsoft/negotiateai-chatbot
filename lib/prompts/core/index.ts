/**
 * Core Prompt Blocks
 *
 * Loads core prompt blocks from .md files.
 * Part of Skills + Agents architecture (v2).
 */

import fs from 'fs';
import path from 'path';

// =============================================================================
// File Loading
// =============================================================================

const CORE_DIR = path.join(process.cwd(), 'lib', 'prompts', 'core');

/**
 * Load a core markdown file
 */
function loadBlock(filename: string): string {
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

// =============================================================================
// Block Exports
// =============================================================================

/** Base rules and identity */
export const BASE_RULES = loadBlock('base.md');

/** Safety guidelines */
export const SAFETY_RULES = loadBlock('safety.md');

/** Formatting guidelines */
export const FORMATTING_RULES = loadBlock('formatting.md');

/** Russian market context */
export const RUSSIAN_MARKET = loadBlock('russian-market.md');

// Legacy aliases
export const SIMPLY_IDENTITY = BASE_RULES;
export const ANTI_PATTERNS = '';
export const RESPONSE_FORMAT = FORMATTING_RULES;
export const ARTIFACTS_RULES = '';
export const MARKDOWN_GUIDELINES = '';
export const DATA_HANDLING = '';
export const HONEST_LIMITATIONS = '';
export const RUSSIAN_CONTEXT = RUSSIAN_MARKET;
export const RUSSIAN_LANGUAGE = '';
export const LOCAL_SERVICES = '';

// =============================================================================
// Utility Functions
// =============================================================================

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
  return combineBlocks([
    BASE_RULES,
    SAFETY_RULES,
    FORMATTING_RULES,
    RUSSIAN_MARKET,
  ]);
}

/**
 * Get minimal core blocks for assistant prompts
 */
export function getMinimalCoreBlocks(): string {
  return combineBlocks([
    BASE_RULES,
    SAFETY_RULES,
  ]);
}
