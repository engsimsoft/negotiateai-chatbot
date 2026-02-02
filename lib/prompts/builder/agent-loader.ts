/**
 * Agent Loader — загружает AGENT.md и связанные файлы
 *
 * Загружает:
 * - AGENT.md — личность и стиль
 * - Файлы из includes (config.yaml)
 * - Skills metadata для роутинга
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { getAgentMetadata, getSkillsRegistry, type AgentMetadata, type SkillMetadata } from './registry';

// =============================================================================
// Types
// =============================================================================

export interface Agent extends AgentMetadata {
  /** Full content of AGENT.md (without frontmatter) */
  content: string;
  /** Additional included files content */
  includes: Record<string, string>;
  /** Available skills metadata (for routing) */
  availableSkills: SkillMetadata[];
}

// =============================================================================
// Paths
// =============================================================================

const AGENTS_DIR = path.join(process.cwd(), 'lib', 'prompts', 'agents');

// =============================================================================
// Loader
// =============================================================================

/**
 * Load full agent by ID
 *
 * @param agentId - Agent ID (e.g. "ben")
 * @returns Full agent with content and includes
 *
 * @example
 * const agent = loadAgent('ben');
 * console.log(agent.content); // AGENT.md content
 * console.log(agent.includes['onboarding.md']); // Included file
 */
export function loadAgent(agentId: string): Agent | null {
  const metadata = getAgentMetadata(agentId);

  if (!metadata) {
    console.warn(`Agent not found: ${agentId}`);
    return null;
  }

  const agentDir = path.join(AGENTS_DIR, agentId);
  const agentMdPath = path.join(agentDir, 'AGENT.md');

  if (!fs.existsSync(agentMdPath)) {
    console.warn(`AGENT.md not found: ${agentMdPath}`);
    return null;
  }

  try {
    // Load main AGENT.md
    const fileContent = fs.readFileSync(agentMdPath, 'utf-8');
    const { content } = matter(fileContent);

    // Load included files
    const includes: Record<string, string> = {};
    const includeFiles = ['onboarding.md', 'interview.md']; // Common includes

    for (const includeFile of includeFiles) {
      const includePath = path.join(agentDir, includeFile);
      if (fs.existsSync(includePath)) {
        includes[includeFile] = fs.readFileSync(includePath, 'utf-8');
      }
    }

    // Load references if they exist
    const refsDir = path.join(agentDir, 'references');
    if (fs.existsSync(refsDir)) {
      const refFiles = fs.readdirSync(refsDir).filter(f => f.endsWith('.md'));
      for (const refFile of refFiles) {
        const refPath = path.join(refsDir, refFile);
        includes[`references/${refFile}`] = fs.readFileSync(refPath, 'utf-8');
      }
    }

    // Get available skills (if agent has specific skills, filter; otherwise all)
    const allSkills = getSkillsRegistry();
    const availableSkills = metadata.skills.length > 0
      ? allSkills.filter(s => metadata.skills.includes(s.id))
      : allSkills;

    return {
      ...metadata,
      content: content.trim(),
      includes,
      availableSkills,
    };
  } catch (error) {
    console.error(`Error loading agent ${agentId}:`, error);
    return null;
  }
}

/**
 * Get agent greeting based on context
 *
 * @param agentId - Agent ID
 * @param isFirstTime - Whether this is user's first interaction
 */
export function getAgentGreeting(agentId: string, isFirstTime: boolean = false): string {
  const agent = loadAgent(agentId);

  if (!agent) {
    return 'Привет! Чем могу помочь?';
  }

  // Check for onboarding content
  if (isFirstTime && agent.includes['onboarding.md']) {
    // Extract first greeting from onboarding.md
    const onboarding = agent.includes['onboarding.md'];
    const match = onboarding.match(/---\n\n([\s\S]*?)\n\n---/);
    if (match) {
      return match[1].trim();
    }
  }

  // Default greeting based on agent
  switch (agentId) {
    case 'ben':
      return isFirstTime
        ? 'Привет! 👋 Я Бен, твой гид по Simply.\n\n**Кратко о платформе:**\n- Simply — это AI-помощник для бизнеса\n- Пишет тексты, создаёт таблицы, презентации\n- Ищет информацию в интернете\n- Работает с твоими документами\n\nЕсть вопросы? Спрашивай — я помогу разобраться!'
        : 'Привет! Я Бен. Чем могу помочь?\n\nСпрашивай о возможностях Simply или как лучше сформулировать запрос.';
    default:
      return 'Привет! Чем могу помочь?';
  }
}
