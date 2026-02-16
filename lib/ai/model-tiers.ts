/**
 * Project Model Tiers Configuration (ТЗ-03)
 *
 * Три уровня моделей для проектов:
 * 1. Исполнитель — Claude Haiku, быстрый, дешёвый, для простых задач
 * 2. Эксперт — Claude Sonnet, баланс, по умолчанию
 * 3. Профессор — Claude Opus, сложные задачи
 *
 * Источник правды: docs/ai-chats-map.md
 */

import type { LanguageModel } from "ai";
import { myProvider } from "./providers";

/**
 * Project model tier identifiers
 */
export type ProjectModelTier = "executor" | "expert" | "professor";

/**
 * Model tier configuration
 */
export interface ModelTierConfig {
  id: ProjectModelTier;
  name: string;
  description: string;
  model: LanguageModel;
  icon: string;
  pricing: {
    input: number;  // per 1M tokens
    output: number; // per 1M tokens
  };
}

/**
 * Project models configuration
 */
export const PROJECT_MODELS: Record<ProjectModelTier, ModelTierConfig> = {
  executor: {
    id: "executor",
    name: "Исполнитель",
    description: "Быстрый и экономичный для простых задач",
    model: myProvider.languageModel("claude-haiku"),
    icon: "⚡",
    pricing: {
      input: 1.0,
      output: 5.0,
    },
  },
  expert: {
    id: "expert",
    name: "Эксперт",
    description: "Баланс скорости и качества",
    model: myProvider.languageModel("claude-sonnet"),
    icon: "🎯",
    pricing: {
      input: 3.0,
      output: 15.0,
    },
  },
  professor: {
    id: "professor",
    name: "Профессор",
    description: "Максимальное качество, сложные задачи",
    model: myProvider.languageModel("claude-opus"),
    icon: "🎓",
    pricing: {
      input: 5.0,
      output: 25.0,
    },
  },
};

/**
 * Default model tier for new project chats
 */
export const DEFAULT_PROJECT_MODEL: ProjectModelTier = "expert";

/**
 * Get model configuration by tier
 */
export function getProjectModel(tier: ProjectModelTier): ModelTierConfig {
  return PROJECT_MODELS[tier] || PROJECT_MODELS[DEFAULT_PROJECT_MODEL];
}

/**
 * Get all model tiers as array (for UI dropdowns)
 */
export function getProjectModelTiers(): ModelTierConfig[] {
  return Object.values(PROJECT_MODELS);
}

/**
 * Validate if a string is a valid model tier
 */
export function isValidModelTier(tier: string): tier is ProjectModelTier {
  return tier in PROJECT_MODELS;
}
