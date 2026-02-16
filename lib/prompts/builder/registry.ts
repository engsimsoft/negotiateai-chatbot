/**
 * Registry — сканирует папки skills/ и agents/, читает metadata
 *
 * Progressive Disclosure:
 * - Level 1: Только metadata (name, description) — всегда загружено
 * - Level 2: Полный SKILL.md/AGENT.md — по требованию
 * - Level 3: References — по требованию
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

// =============================================================================
// Types
// =============================================================================

export interface SkillMetadata {
  id: string; // e.g. "utility/prompt-helper"
  name: string;
  description: string;
  tools: string[];
  category: string;
}

export interface AgentMetadata {
  id: string; // e.g. "ben"
  name: string;
  displayName: string;
  description: string;
  model: string;
  skills: string[];
  icon: string;
  category: string;
}

// =============================================================================
// Paths
// =============================================================================

const PROMPTS_DIR = path.join(process.cwd(), 'lib', 'prompts');
const SKILLS_DIR = path.join(PROMPTS_DIR, 'skills');
const AGENTS_DIR = path.join(PROMPTS_DIR, 'agents');

// =============================================================================
// Skill Registry
// =============================================================================

let skillsCache: SkillMetadata[] | null = null;

/**
 * Scan skills directory and extract metadata from SKILL.md frontmatter
 */
export function getSkillsRegistry(): SkillMetadata[] {
  if (skillsCache) return skillsCache;

  const skills: SkillMetadata[] = [];

  if (!fs.existsSync(SKILLS_DIR)) {
    return skills;
  }

  // Scan category directories
  const categories = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('_'));

  for (const category of categories) {
    const categoryPath = path.join(SKILLS_DIR, category.name);
    const skillDirs = fs.readdirSync(categoryPath, { withFileTypes: true })
      .filter(d => d.isDirectory());

    for (const skillDir of skillDirs) {
      const skillPath = path.join(categoryPath, skillDir.name, 'SKILL.md');

      if (fs.existsSync(skillPath)) {
        try {
          const content = fs.readFileSync(skillPath, 'utf-8');
          const { data } = matter(content);

          skills.push({
            id: `${category.name}/${skillDir.name}`,
            name: data.name || skillDir.name,
            description: data.description || '',
            tools: data.tools || [],
            category: category.name,
          });
        } catch (error) {
          console.error(`Error reading skill ${skillDir.name}:`, error);
        }
      }
    }
  }

  skillsCache = skills;
  return skills;
}

/**
 * Get skill metadata by ID
 */
export function getSkillMetadata(skillId: string): SkillMetadata | undefined {
  return getSkillsRegistry().find(s => s.id === skillId);
}

// =============================================================================
// Agent Registry
// =============================================================================

let agentsCache: AgentMetadata[] | null = null;

/**
 * Scan agents directory and extract metadata from config.yaml
 */
export function getAgentsRegistry(): AgentMetadata[] {
  if (agentsCache) return agentsCache;

  const agents: AgentMetadata[] = [];

  if (!fs.existsSync(AGENTS_DIR)) {
    return agents;
  }

  const agentDirs = fs.readdirSync(AGENTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('_'));

  for (const agentDir of agentDirs) {
    // Try AGENT.md first (has frontmatter)
    const agentMdPath = path.join(AGENTS_DIR, agentDir.name, 'AGENT.md');

    if (fs.existsSync(agentMdPath)) {
      try {
        const content = fs.readFileSync(agentMdPath, 'utf-8');
        const { data } = matter(content);

        agents.push({
          id: agentDir.name,
          name: data.name || agentDir.name,
          displayName: data.displayName || agentDir.name,
          description: data.description || '',
          model: data.model || 'claude-haiku',
          skills: data.skills || [],
          icon: data.icon || '🤖',
          category: data.category || 'general',
        });
      } catch (error) {
        console.error(`Error reading agent ${agentDir.name}:`, error);
      }
    }
  }

  agentsCache = agents;
  return agents;
}

/**
 * Get agent metadata by ID
 */
export function getAgentMetadata(agentId: string): AgentMetadata | undefined {
  return getAgentsRegistry().find(a => a.id === agentId);
}

// =============================================================================
// Cache Management
// =============================================================================

/**
 * Clear all caches (useful for development/hot-reload)
 */
export function clearRegistryCache(): void {
  skillsCache = null;
  agentsCache = null;
}
