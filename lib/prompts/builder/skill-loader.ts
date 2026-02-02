/**
 * Skill Loader — загружает полный SKILL.md по требованию
 *
 * Progressive Disclosure Level 2:
 * Загружает полное содержимое SKILL.md когда skill активирован.
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { getSkillMetadata, type SkillMetadata } from './registry';

// =============================================================================
// Types
// =============================================================================

export interface Skill extends SkillMetadata {
  /** Full content of SKILL.md (without frontmatter) */
  content: string;
  /** Raw frontmatter data */
  frontmatter: Record<string, unknown>;
}

// =============================================================================
// Paths
// =============================================================================

const SKILLS_DIR = path.join(process.cwd(), 'lib', 'prompts', 'skills');

// =============================================================================
// Loader
// =============================================================================

/**
 * Load full skill by ID
 *
 * @param skillId - Skill ID (e.g. "utility/prompt-helper")
 * @returns Full skill with content
 *
 * @example
 * const skill = loadSkill('utility/prompt-helper');
 * console.log(skill.content); // Full markdown content
 */
export function loadSkill(skillId: string): Skill | null {
  const metadata = getSkillMetadata(skillId);

  if (!metadata) {
    console.warn(`Skill not found: ${skillId}`);
    return null;
  }

  const skillPath = path.join(SKILLS_DIR, skillId, 'SKILL.md');

  if (!fs.existsSync(skillPath)) {
    console.warn(`SKILL.md not found: ${skillPath}`);
    return null;
  }

  try {
    const fileContent = fs.readFileSync(skillPath, 'utf-8');
    const { data, content } = matter(fileContent);

    return {
      ...metadata,
      content: content.trim(),
      frontmatter: data,
    };
  } catch (error) {
    console.error(`Error loading skill ${skillId}:`, error);
    return null;
  }
}

/**
 * Load reference file from skill's references/ directory
 *
 * Progressive Disclosure Level 3:
 * Load additional context files when needed.
 *
 * @param skillId - Skill ID
 * @param refName - Reference file name (e.g. "examples.md")
 */
export function loadSkillReference(skillId: string, refName: string): string | null {
  const refPath = path.join(SKILLS_DIR, skillId, 'references', refName);

  if (!fs.existsSync(refPath)) {
    return null;
  }

  try {
    return fs.readFileSync(refPath, 'utf-8');
  } catch (error) {
    console.error(`Error loading reference ${refName} for skill ${skillId}:`, error);
    return null;
  }
}

/**
 * Load skill content only (without metadata wrapper)
 *
 * Used by loadSkill tool for Progressive Disclosure.
 * Returns just the markdown content for AI to read instructions.
 *
 * @param skillId - Skill ID (e.g. "document/create-presentation")
 * @returns Markdown content string, or null if not found
 *
 * @example
 * const content = loadSkillContent('document/create-presentation');
 * // Returns full SKILL.md instructions for AI
 */
export function loadSkillContent(skillId: string): string | null {
  const skill = loadSkill(skillId);
  return skill ? skill.content : null;
}

/**
 * Load multiple skills and combine their content
 *
 * @param skillIds - Array of skill IDs
 * @returns Combined content string
 */
export function loadSkillsContent(skillIds: string[]): string {
  const contents: string[] = [];

  for (const skillId of skillIds) {
    const skill = loadSkill(skillId);
    if (skill) {
      contents.push(`## Skill: ${skill.name}\n\n${skill.content}`);
    }
  }

  return contents.join('\n\n---\n\n');
}
