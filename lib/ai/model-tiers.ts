/**
 * Project Model Tiers Configuration (ТЗ-03)
 * ТЗ-1 CoreRegistry: thin wrapper over task-assignments.ts
 *
 * Три уровня моделей для проектов:
 * 1. Исполнитель — Claude Haiku, быстрый, дешёвый, для простых задач
 * 2. Эксперт — Claude Sonnet, баланс, по умолчанию
 * 3. Профессор — Claude Opus, сложные задачи
 *
 * Фактический выбор модели делегирован в task-assignments.ts через getModel().
 * Этот модуль предоставляет доменную метаинформацию (name/description/icon).
 *
 * Источник правды для моделей: lib/ai/task-assignments.ts
 * Источник правды для отображения: docs/ai-chats-map.md
 */

import type { LanguageModel } from "ai";
import { getModel, getModelIdForTask } from "./getModel";
import type { TaskId } from "./task-assignments";

/**
 * Project model tier identifiers
 */
export type ProjectModelTier = "executor" | "expert" | "professor";

/**
 * Model tier configuration (metadata only — actual model resolved via getModel)
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

interface ModelTierMetadata {
  name: string;
  description: string;
  icon: string;
  pricing: { input: number; output: number };
}

/**
 * ТЗ-1 CoreRegistry: map project tier → TaskId for getModel().
 */
export function getTaskIdForTier(tier: ProjectModelTier): TaskId {
  switch (tier) {
    case "executor":
      return "project:expert:haiku";
    case "expert":
      return "project:expert:sonnet";
    case "professor":
      return "project:expert:opus";
  }
}

const TIER_METADATA: Record<ProjectModelTier, ModelTierMetadata> = {
  executor: {
    name: "Исполнитель",
    description: "Быстрый и экономичный для простых задач",
    icon: "⚡",
    pricing: { input: 1.0, output: 5.0 },
  },
  expert: {
    name: "Эксперт",
    description: "Баланс скорости и качества",
    icon: "🎯",
    pricing: { input: 3.0, output: 15.0 },
  },
  professor: {
    name: "Профессор",
    description: "Максимальное качество, сложные задачи",
    icon: "🎓",
    pricing: { input: 5.0, output: 25.0 },
  },
};

/**
 * Default model tier for new project chats
 */
export const DEFAULT_PROJECT_MODEL: ProjectModelTier = "expert";

/**
 * Get model configuration by tier.
 * Model is lazily resolved via getModel(taskId) to support ТЗ-2 overrides.
 */
export function getProjectModel(tier: ProjectModelTier): ModelTierConfig {
  const effectiveTier = TIER_METADATA[tier] ? tier : DEFAULT_PROJECT_MODEL;
  const meta = TIER_METADATA[effectiveTier];
  return {
    id: effectiveTier,
    name: meta.name,
    description: meta.description,
    model: getModel(getTaskIdForTier(effectiveTier)),
    icon: meta.icon,
    pricing: meta.pricing,
  };
}

/**
 * Get the physical modelId for a project tier (without resolving LanguageModel).
 * Useful for usage logging and DevPanel display.
 */
export function getProjectTierModelId(tier: ProjectModelTier): string {
  return getModelIdForTask(getTaskIdForTier(tier));
}

/**
 * Get all model tiers as array (for UI dropdowns)
 */
export function getProjectModelTiers(): ModelTierConfig[] {
  return (Object.keys(TIER_METADATA) as ProjectModelTier[]).map((tier) =>
    getProjectModel(tier),
  );
}

/**
 * Validate if a string is a valid model tier
 */
export function isValidModelTier(tier: string): tier is ProjectModelTier {
  return tier in TIER_METADATA;
}
