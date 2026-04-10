/**
 * AI Providers — legacy compatibility layer (ТЗ-1 CoreRegistry)
 *
 * ⚠️ DEPRECATED exports — используйте `getModel(taskId)` из `./getModel.ts`.
 *
 * Этот модуль остаётся временно, пока миграция 31 AI-точки не завершена (Этапы
 * 2-4 ТЗ-1). Все экспорты ниже — тонкие обёртки над `registry` + `model-catalog`.
 * Будут удалены в Этапе 5.
 *
 * Что ОСТАЁТСЯ после Этапа 5:
 *  - `calculateCostRub` / `calculateCostBreakdownRub` / `getStepCostRub`
 *    (расчёт стоимости из catalog, публичный API для DevPanel и cost-audit)
 *  - `extractUsageForPricing`
 *  - Non-LLM cost helpers (`calculateDeepgramCostUsd`, `calculateGeminiTtsCostUsd`, `calculateTtsCostRub`)
 *  - `RUB_PER_USD`, `getContextWindow`, `MODEL_CONTEXT_WINDOW`
 */

import type { LanguageModelUsage } from "ai";
import { customProvider } from "ai";

import { isTestEnvironment } from "../constants";
import {
  getContextWindow as getContextWindowFromCatalog,
  getModelEntry,
  resolveModelEntry,
} from "./model-catalog";
import { registry } from "./registry";
import type { DebugStepData } from "./debug-events";

// Registry-returned language model type (LanguageModelV3 под капотом).
type RegistryLanguageModel = ReturnType<typeof registry.languageModel>;

// ---------------------------------------------------------------------------
// LEGACY — myProvider (customProvider с алиасами)
// ---------------------------------------------------------------------------
// Сохраняется для совместимости с ~20 call-sites `myProvider.languageModel(id)`.
// Алиасы резолвятся через каталог, физические модели — через registry.
// Будет удалено в Этапе 5 после миграции call-sites.

function langModelFromCatalog(catalogId: string): RegistryLanguageModel {
  const entry = getModelEntry(catalogId);
  if (!entry) {
    throw new Error(`[providers] Unknown catalog id: ${catalogId}`);
  }
  if (catalogId === "MiniMax-M2.7-long") {
    return registry.languageModel("minimaxLong:MiniMax-M2.7");
  }
  const resolved = resolveModelEntry(catalogId);
  if (!resolved) {
    throw new Error(`[providers] Cannot resolve catalog id: ${catalogId}`);
  }
  if (resolved.provider === "anthropic") {
    return registry.languageModel(
      `anthropic:${resolved.modelId}` as "anthropic:claude-sonnet-4-6",
    );
  }
  if (resolved.provider === "minimax") {
    return registry.languageModel(
      `minimax:${resolved.modelId}` as "minimax:MiniMax-M2.7",
    );
  }
  if (resolved.provider === "xai") {
    return registry.languageModel(
      `xai:${resolved.modelId}` as "xai:grok-4",
    );
  }
  if (resolved.provider === "openrouter") {
    return registry.languageModel(
      `openrouter:${resolved.modelId}` as "openrouter:z-ai/glm-4.6",
    );
  }
  throw new Error(
    `[providers] Provider "${resolved.provider}" not in registry for ${catalogId}`,
  );
}

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "claude-sonnet": chatModel,
          "claude-haiku": chatModel,
          "claude-opus": chatModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        "claude-sonnet": langModelFromCatalog("claude-sonnet"),
        "claude-haiku": langModelFromCatalog("claude-haiku"),
        "claude-opus": langModelFromCatalog("claude-opus"),
        "claude-sonnet-4-6": langModelFromCatalog("claude-sonnet-4-6"),
        "title-model": langModelFromCatalog("title-model"),
        "artifact-model": langModelFromCatalog("artifact-model"),
      },
    });

// Direct model exports — оставлены для совместимости с pipelines/clerks.
// Внутри резолвятся через registry (та же физическая модель, что и в customProvider выше).
export const claudeHaiku: RegistryLanguageModel = langModelFromCatalog(
  "claude-haiku-4-5-20251001",
);
export const claudeSonnet: RegistryLanguageModel = langModelFromCatalog(
  "claude-sonnet-4-6",
);
export const claudeOpus: RegistryLanguageModel = langModelFromCatalog(
  "claude-opus-4-6",
);

// MiniMax M2.7 — shared export для memory pipelines (extract, consolidate, profile).
// `includeUsage` конфигурация сохраняется для обратной совместимости.
const minimaxBase = langModelFromCatalog("MiniMax-M2.7") as unknown as {
  config?: Record<string, unknown>;
};
if (minimaxBase.config) {
  minimaxBase.config = { ...minimaxBase.config, includeUsage: true };
}
export const minimaxM27 = minimaxBase as unknown as RegistryLanguageModel;

// MiniMax M2.7 с extended timeout — для briefing pipeline.
const minimaxLongBase = langModelFromCatalog(
  "MiniMax-M2.7-long",
) as unknown as {
  config?: Record<string, unknown>;
};
if (minimaxLongBase.config) {
  minimaxLongBase.config = { ...minimaxLongBase.config, includeUsage: true };
}
export const minimaxM27Long = minimaxLongBase as unknown as RegistryLanguageModel;

export function getClaudeModel(
  name: "haiku" | "sonnet" | "opus",
): RegistryLanguageModel {
  switch (name) {
    case "haiku":
      return claudeHaiku;
    case "opus":
      return claudeOpus;
    default:
      return claudeSonnet;
  }
}

// ---------------------------------------------------------------------------
// Exchange rate
// ---------------------------------------------------------------------------

export { RUB_PER_USD } from "@/lib/constants/pricing";
import { RUB_PER_USD } from "@/lib/constants/pricing";

// ---------------------------------------------------------------------------
// Context windows — re-exports из catalog для совместимости
// ---------------------------------------------------------------------------

/**
 * Context window size per model, in tokens. Legacy constant — SSOT теперь в
 * model-catalog.ts. Оставлено для совместимости со старыми импортами.
 */
export const MODEL_CONTEXT_WINDOW: Record<string, number> = {
  "claude-sonnet-4-6":           1_000_000,
  "claude-sonnet":               1_000_000,
  "claude-opus-4-6":             1_000_000,
  "claude-opus":                 1_000_000,
  "claude-haiku-4-5-20251001":   200_000,
  "claude-haiku":                200_000,
  "claude-sonnet-4-5-20250929":  200_000,
  "MiniMax-M2.7":                204_800,
};

/** Returns context window size for a model. Читает из catalog. */
export function getContextWindow(modelId: string): number {
  return getContextWindowFromCatalog(modelId);
}

// ---------------------------------------------------------------------------
// Pricing — все функции теперь читают из model-catalog.ts (SSOT)
// ---------------------------------------------------------------------------

/**
 * Token usage contract for pricing — all fields are DISJOINT (no overlap).
 *
 * Aligned with AI SDK v6 native fields:
 * - noCacheInputTokens ← usage.inputTokenDetails.noCacheTokens  (fresh input)
 * - cacheReadTokens    ← usage.inputTokenDetails.cacheReadTokens
 * - cacheWriteTokens   ← usage.inputTokenDetails.cacheWriteTokens
 * - outputTokens       ← usage.outputTokens
 * - reasoningTokens    ← usage.outputTokenDetails.reasoningTokens (optional)
 */
export interface TokenUsageForPricing {
  noCacheInputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
}

/**
 * Extract a disjoint TokenUsageForPricing from an AI SDK v6 usage object.
 * Client-safe (pure function).
 */
export function extractUsageForPricing(
  usage: LanguageModelUsage | undefined | null,
): TokenUsageForPricing {
  if (!usage) {
    return {
      noCacheInputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
    };
  }

  const details = usage.inputTokenDetails;
  const cacheReadTokens = details?.cacheReadTokens ?? 0;
  const cacheWriteTokens = details?.cacheWriteTokens ?? 0;
  const noCacheFromSdk = details?.noCacheTokens;
  const noCacheInputTokens =
    noCacheFromSdk != null
      ? noCacheFromSdk
      : Math.max(
          0,
          (usage.inputTokens ?? 0) - cacheReadTokens - cacheWriteTokens,
        );

  return {
    noCacheInputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    outputTokens: usage.outputTokens ?? 0,
    reasoningTokens: usage.outputTokenDetails?.reasoningTokens ?? 0,
  };
}

/**
 * Получить pricing (RUB/1K) из catalog. Конвертирует USD/1M → RUB/1K через
 * RUB_PER_USD. Возвращает null если модели нет в каталоге.
 */
interface PricingRubPer1K {
  input: number;
  output: number;
  cached: number;
  cacheWrite: number;
}

function getPricingRubPer1K(modelId: string): PricingRubPer1K | null {
  const entry = getModelEntry(modelId);
  if (!entry) return null;
  // USD/1M → RUB/1K = (usd_per_million / 1000) * RUB_PER_USD
  const factor = RUB_PER_USD / 1000;
  return {
    input:      entry.pricing.input       * factor,
    output:     entry.pricing.output      * factor,
    cached:     entry.pricing.cachedInput * factor,
    cacheWrite: entry.pricing.cacheWrite  * factor,
  };
}

/**
 * Calculate cost in RUB using Anthropic billing model:
 * - fresh input tokens:   input rate (1×)
 * - cache_read tokens:    cached rate (0.1× input для Anthropic)
 * - cache_write tokens:   cacheWrite rate (1.25× input для Anthropic)
 * - output tokens:        output rate
 * - reasoning tokens:     output rate (Anthropic extended thinking)
 *
 * All input fields are disjoint — no subtraction.
 */
export function calculateCostRub(
  modelId: string,
  usage: TokenUsageForPricing,
): number {
  const pricing = getPricingRubPer1K(modelId);
  if (!pricing) return 0;

  const effectiveOutput = usage.outputTokens + (usage.reasoningTokens ?? 0);

  const inputCost      = (usage.noCacheInputTokens / 1000) * pricing.input;
  const cacheReadCost  = (usage.cacheReadTokens    / 1000) * pricing.cached;
  const cacheWriteCost = (usage.cacheWriteTokens   / 1000) * pricing.cacheWrite;
  const outputCost     = (effectiveOutput          / 1000) * pricing.output;

  return Math.round((inputCost + cacheReadCost + cacheWriteCost + outputCost) * 100) / 100;
}

/** Per-component cost breakdown in RUB — для user-facing Context popover. */
export interface CostBreakdownRub {
  freshInputRub: number;
  cacheReadRub: number;
  cacheWriteRub: number;
  outputRub: number;
  reasoningRub: number;
  totalRub: number;
}

export function calculateCostBreakdownRub(
  modelId: string,
  usage: TokenUsageForPricing,
): CostBreakdownRub {
  const pricing = getPricingRubPer1K(modelId);
  if (!pricing) {
    return {
      freshInputRub: 0,
      cacheReadRub: 0,
      cacheWriteRub: 0,
      outputRub: 0,
      reasoningRub: 0,
      totalRub: 0,
    };
  }

  const reasoningTokens = usage.reasoningTokens ?? 0;

  const freshInputRub  = round2((usage.noCacheInputTokens / 1000) * pricing.input);
  const cacheReadRub   = round2((usage.cacheReadTokens    / 1000) * pricing.cached);
  const cacheWriteRub  = round2((usage.cacheWriteTokens   / 1000) * pricing.cacheWrite);
  const outputRub      = round2((usage.outputTokens       / 1000) * pricing.output);
  const reasoningRub   = round2((reasoningTokens          / 1000) * pricing.output);

  const totalRub = round2(
    freshInputRub + cacheReadRub + cacheWriteRub + outputRub + reasoningRub,
  );

  return {
    freshInputRub,
    cacheReadRub,
    cacheWriteRub,
    outputRub,
    reasoningRub,
    totalRub,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------------------
// Client helper: use server-calculated stepCostRub, fallback to local calc
// ---------------------------------------------------------------------------

/**
 * Get cost for a debug step. Prefers server-calculated value (catalog SSOT),
 * falls back to local calculation via catalog lookup.
 */
export function getStepCostRub(step: DebugStepData): number {
  if (step.stepCostRub != null) return step.stepCostRub;
  return calculateCostRub(step.modelId, {
    noCacheInputTokens: step.noCacheInputTokens,
    cacheReadTokens: step.cacheReadTokens,
    cacheWriteTokens: step.cacheWriteTokens,
    outputTokens: step.outputTokens,
    reasoningTokens: step.reasoningTokens,
  });
}

// ---------------------------------------------------------------------------
// Non-token provider cost helpers (Deepgram, Gemini TTS)
// Per-minute / per-character pricing, not tokens — остаётся в этом файле.
// ---------------------------------------------------------------------------

/** Deepgram Nova-3: $0.0043/min batch pricing */
export function calculateDeepgramCostUsd(audioSeconds: number): number {
  const USD_PER_SECOND = 0.0043 / 60;
  return Math.round(audioSeconds * USD_PER_SECOND * 1_000_000) / 1_000_000;
}

/** Gemini TTS (gemini-2.5-flash-preview-tts): $4/1M characters */
export function calculateGeminiTtsCostUsd(charCount: number): number {
  const USD_PER_CHAR = 4 / 1_000_000;
  return Math.round(charCount * USD_PER_CHAR * 1_000_000) / 1_000_000;
}

// ---------------------------------------------------------------------------
// TTS Pricing (Gemini TTS — RUB helper для pipeline traces)
// ---------------------------------------------------------------------------

const TTS_COST_RUB_PER_SECOND = 0.006;

export function calculateTtsCostRub(durationSeconds: number): number {
  return Math.round(durationSeconds * TTS_COST_RUB_PER_SECOND * 100) / 100;
}
