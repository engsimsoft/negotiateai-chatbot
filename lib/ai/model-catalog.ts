/**
 * Model Catalog — SSOT для всех моделей приложения (ТЗ-1 CoreRegistry)
 *
 * Единая запись per модель содержит всё необходимое:
 *  - provider (anthropic | minimax | xai | openrouter | google | perplexity | voyage | deepgram)
 *  - modelId (физический id у провайдера)
 *  - displayName (для UI)
 *  - pricing в USD за 1M токенов (формат вендоров)
 *  - capabilities и лимиты контекста
 *
 * Добавление модели = одна запись → автоматически доступна для любой задачи через
 * task-assignments.ts + getModel().
 *
 * Pricing хранится в USD/1M, конвертация в RUB делается в providers.ts через
 * RUB_PER_USD. Non-LLM провайдеры (voyage, deepgram, gemini TTS, perplexity) тоже
 * присутствуют — они не через registry, но pricing нужен для cost tracking.
 */

export type ProviderId =
  | "anthropic"
  | "minimax"
  | "xai"
  | "openrouter"
  | "google"
  | "perplexity"
  | "voyage"
  | "deepgram";

export interface ModelCapabilities {
  streaming: boolean;
  tools: boolean;
  vision: boolean;
  documents: boolean;
  thinking: boolean;
  embeddings: boolean;
}

/** Pricing в USD за 1M токенов (формат вендоров — Anthropic, OpenAI и др.). */
export interface ModelPricingUsd {
  input: number;
  output: number;
  /** Cache read (обычно 0.1× input для Anthropic). 0 если провайдер не поддерживает. */
  cachedInput: number;
  /** Cache write (обычно 1.25× input для Anthropic). 0 если провайдер не поддерживает. */
  cacheWrite: number;
}

export interface ModelEntry {
  /** Логический id в каталоге (совпадает с modelId для физических; отдельный для алиасов). */
  id: string;
  provider: ProviderId;
  /** Физический id у провайдера. Для алиасов — указывает на реальную модель. */
  modelId: string;
  displayName: string;
  pricing: ModelPricingUsd;
  capabilities: ModelCapabilities;
  contextWindow: number;
  maxOutput: number;
  /** Параметры по умолчанию (temperature и т.д.) — читаются callers по необходимости. */
  defaultParams?: Record<string, unknown>;
  /**
   * Если запись — алиас на другую модель, здесь указывается физический catalogId.
   * getModel() резолвит алиасы в физическую модель перед обращением к registry.
   */
  aliasOf?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Capability presets
// ---------------------------------------------------------------------------

const CAPS_CLAUDE: ModelCapabilities = {
  streaming: true,
  tools: true,
  vision: true,
  documents: true,
  thinking: true,
  embeddings: false,
};

const CAPS_MINIMAX: ModelCapabilities = {
  streaming: true,
  tools: true,
  vision: false,
  documents: false,
  thinking: true,
  embeddings: false,
};

const CAPS_GROK: ModelCapabilities = {
  streaming: true,
  tools: true,
  vision: true,
  documents: false,
  thinking: true,
  embeddings: false,
};

const CAPS_OPENROUTER_TEXT: ModelCapabilities = {
  streaming: true,
  tools: true,
  vision: false,
  documents: false,
  thinking: false,
  embeddings: false,
};

// ---------------------------------------------------------------------------
// Catalog — все записи
// ---------------------------------------------------------------------------

const ENTRIES: ModelEntry[] = [
  // =========================================================================
  // Anthropic Claude (физические модели)
  // =========================================================================
  {
    id: "claude-sonnet-4-6",
    provider: "anthropic",
    modelId: "claude-sonnet-4-6",
    displayName: "Claude Sonnet 4.6",
    pricing: { input: 3, output: 15, cachedInput: 0.3, cacheWrite: 3.75 },
    capabilities: CAPS_CLAUDE,
    contextWindow: 1_000_000,
    maxOutput: 64_000,
  },
  {
    id: "claude-haiku-4-5-20251001",
    provider: "anthropic",
    modelId: "claude-haiku-4-5-20251001",
    displayName: "Claude Haiku 4.5",
    pricing: { input: 1, output: 5, cachedInput: 0.1, cacheWrite: 1.25 },
    capabilities: { ...CAPS_CLAUDE, thinking: false },
    contextWindow: 200_000,
    maxOutput: 64_000,
  },
  {
    id: "claude-opus-4-6",
    provider: "anthropic",
    modelId: "claude-opus-4-6",
    displayName: "Claude Opus 4.6",
    pricing: { input: 5, output: 25, cachedInput: 0.5, cacheWrite: 6.25 },
    capabilities: CAPS_CLAUDE,
    contextWindow: 1_000_000,
    maxOutput: 32_000,
  },
  // Legacy snapshot — остаётся в pricing для старых записей ai_usage_log
  {
    id: "claude-sonnet-4-5-20250929",
    provider: "anthropic",
    modelId: "claude-sonnet-4-5-20250929",
    displayName: "Claude Sonnet 4.5",
    pricing: { input: 3, output: 15, cachedInput: 0.3, cacheWrite: 3.75 },
    capabilities: CAPS_CLAUDE,
    contextWindow: 200_000,
    maxOutput: 64_000,
    notes: "Legacy snapshot; kept for historical ai_usage_log cost calc",
  },

  // =========================================================================
  // Anthropic — legacy алиасы (совместимость с myProvider.languageModel())
  // =========================================================================
  {
    id: "claude-sonnet",
    provider: "anthropic",
    modelId: "claude-sonnet-4-6",
    displayName: "Claude Sonnet",
    pricing: { input: 3, output: 15, cachedInput: 0.3, cacheWrite: 3.75 },
    capabilities: CAPS_CLAUDE,
    contextWindow: 1_000_000,
    maxOutput: 64_000,
    aliasOf: "claude-sonnet-4-6",
  },
  {
    id: "claude-haiku",
    provider: "anthropic",
    modelId: "claude-haiku-4-5-20251001",
    displayName: "Claude Haiku",
    pricing: { input: 1, output: 5, cachedInput: 0.1, cacheWrite: 1.25 },
    capabilities: { ...CAPS_CLAUDE, thinking: false },
    contextWindow: 200_000,
    maxOutput: 64_000,
    aliasOf: "claude-haiku-4-5-20251001",
  },
  {
    id: "claude-opus",
    provider: "anthropic",
    modelId: "claude-opus-4-6",
    displayName: "Claude Opus",
    pricing: { input: 5, output: 25, cachedInput: 0.5, cacheWrite: 6.25 },
    capabilities: CAPS_CLAUDE,
    contextWindow: 1_000_000,
    maxOutput: 32_000,
    aliasOf: "claude-opus-4-6",
  },
  {
    id: "title-model",
    provider: "anthropic",
    modelId: "claude-haiku-4-5-20251001",
    displayName: "Title Model (Haiku)",
    pricing: { input: 1, output: 5, cachedInput: 0.1, cacheWrite: 1.25 },
    capabilities: { ...CAPS_CLAUDE, thinking: false },
    contextWindow: 200_000,
    maxOutput: 64_000,
    aliasOf: "claude-haiku-4-5-20251001",
  },
  {
    id: "artifact-model",
    provider: "anthropic",
    modelId: "claude-sonnet-4-6",
    displayName: "Artifact Model (Sonnet)",
    pricing: { input: 3, output: 15, cachedInput: 0.3, cacheWrite: 3.75 },
    capabilities: CAPS_CLAUDE,
    contextWindow: 1_000_000,
    maxOutput: 64_000,
    aliasOf: "claude-sonnet-4-6",
  },

  // =========================================================================
  // MiniMax
  // =========================================================================
  {
    id: "MiniMax-M2.7",
    provider: "minimax",
    modelId: "MiniMax-M2.7",
    displayName: "MiniMax M2.7",
    pricing: { input: 0.3, output: 1.2, cachedInput: 0.06, cacheWrite: 0.375 },
    capabilities: CAPS_MINIMAX,
    contextWindow: 204_800,
    maxOutput: 32_000,
  },
  {
    id: "MiniMax-M2.7-long",
    provider: "minimax",
    modelId: "MiniMax-M2.7",
    displayName: "MiniMax M2.7 (long timeout)",
    pricing: { input: 0.3, output: 1.2, cachedInput: 0.06, cacheWrite: 0.375 },
    capabilities: CAPS_MINIMAX,
    contextWindow: 204_800,
    maxOutput: 32_000,
    aliasOf: "MiniMax-M2.7",
    notes: "Extended 180s fetch timeout — for briefing/memory pipelines",
  },

  // =========================================================================
  // xAI Grok (все 5 по ТЗ)
  // =========================================================================
  {
    id: "grok-4.20-reasoning",
    provider: "xai",
    modelId: "grok-4.20-reasoning",
    displayName: "Grok 4.20 (reasoning)",
    pricing: { input: 3, output: 15, cachedInput: 0, cacheWrite: 0 },
    capabilities: CAPS_GROK,
    contextWindow: 256_000,
    maxOutput: 16_000,
  },
  {
    id: "grok-4.20-non-reasoning",
    provider: "xai",
    modelId: "grok-4.20-non-reasoning",
    displayName: "Grok 4.20",
    pricing: { input: 3, output: 15, cachedInput: 0, cacheWrite: 0 },
    capabilities: { ...CAPS_GROK, thinking: false },
    contextWindow: 256_000,
    maxOutput: 16_000,
  },
  {
    id: "grok-4-1-fast-reasoning",
    provider: "xai",
    modelId: "grok-4-1-fast-reasoning",
    displayName: "Grok 4.1 Fast (reasoning)",
    pricing: { input: 0.2, output: 0.5, cachedInput: 0, cacheWrite: 0 },
    capabilities: CAPS_GROK,
    contextWindow: 128_000,
    maxOutput: 16_000,
  },
  {
    id: "grok-4-1-fast-non-reasoning",
    provider: "xai",
    modelId: "grok-4-1-fast-non-reasoning",
    displayName: "Grok 4.1 Fast",
    pricing: { input: 0.2, output: 0.5, cachedInput: 0, cacheWrite: 0 },
    capabilities: { ...CAPS_GROK, thinking: false },
    contextWindow: 128_000,
    maxOutput: 16_000,
  },
  {
    id: "grok-4",
    provider: "xai",
    modelId: "grok-4",
    displayName: "Grok 4",
    pricing: { input: 3, output: 15, cachedInput: 0, cacheWrite: 0 },
    capabilities: { ...CAPS_GROK, thinking: false },
    contextWindow: 256_000,
    maxOutput: 16_000,
  },

  // =========================================================================
  // OpenRouter (тестовые модели, model ID из scripts/test-think-models.ts)
  // =========================================================================
  {
    id: "z-ai/glm-4.6",
    provider: "openrouter",
    modelId: "z-ai/glm-4.6",
    displayName: "GLM 4.6 (OpenRouter)",
    pricing: { input: 0.5, output: 1.5, cachedInput: 0, cacheWrite: 0 },
    capabilities: CAPS_OPENROUTER_TEXT,
    contextWindow: 200_000,
    maxOutput: 16_000,
    notes: "ID из scripts/test-think-models.ts — уточнить при добавлении в UI",
  },
  {
    id: "qwen/qwen3-max",
    provider: "openrouter",
    modelId: "qwen/qwen3-max",
    displayName: "Qwen 3 Max (OpenRouter)",
    pricing: { input: 1, output: 4, cachedInput: 0, cacheWrite: 0 },
    capabilities: CAPS_OPENROUTER_TEXT,
    contextWindow: 256_000,
    maxOutput: 16_000,
    notes: "ID из scripts/test-think-models.ts — уточнить при добавлении в UI",
  },

  // =========================================================================
  // Non-LLM провайдеры (pricing only — не регистрируются в provider registry)
  // =========================================================================
  {
    id: "voyage-4",
    provider: "voyage",
    modelId: "voyage-4",
    displayName: "Voyage 4",
    pricing: { input: 0.06, output: 0, cachedInput: 0, cacheWrite: 0 },
    capabilities: {
      streaming: false, tools: false, vision: false,
      documents: false, thinking: false, embeddings: true,
    },
    contextWindow: 32_000,
    maxOutput: 0,
  },
  {
    id: "voyage-4-lite",
    provider: "voyage",
    modelId: "voyage-4-lite",
    displayName: "Voyage 4 Lite",
    pricing: { input: 0.02, output: 0, cachedInput: 0, cacheWrite: 0 },
    capabilities: {
      streaming: false, tools: false, vision: false,
      documents: false, thinking: false, embeddings: true,
    },
    contextWindow: 32_000,
    maxOutput: 0,
  },
  {
    id: "sonar-pro",
    provider: "perplexity",
    modelId: "sonar-pro",
    displayName: "Perplexity Sonar Pro",
    pricing: { input: 3, output: 15, cachedInput: 0, cacheWrite: 0 },
    capabilities: {
      streaming: false, tools: false, vision: false,
      documents: false, thinking: false, embeddings: false,
    },
    contextWindow: 200_000,
    maxOutput: 4_000,
    notes: "Used via deep-research tool (raw fetch)",
  },
  {
    id: "sonar-deep-research",
    provider: "perplexity",
    modelId: "sonar-deep-research",
    displayName: "Perplexity Sonar Deep Research",
    pricing: { input: 2, output: 8, cachedInput: 0, cacheWrite: 0 },
    capabilities: {
      streaming: false, tools: false, vision: false,
      documents: false, thinking: true, embeddings: false,
    },
    contextWindow: 200_000,
    maxOutput: 8_000,
  },
  {
    id: "deepgram-nova-3",
    provider: "deepgram",
    modelId: "nova-3",
    displayName: "Deepgram Nova 3",
    pricing: { input: 0, output: 0, cachedInput: 0, cacheWrite: 0 },
    capabilities: {
      streaming: false, tools: false, vision: false,
      documents: false, thinking: false, embeddings: false,
    },
    contextWindow: 0,
    maxOutput: 0,
    notes: "Per-minute pricing ($0.0043/min) — see calculateDeepgramCostUsd",
  },
  {
    id: "gemini-2.5-flash-preview-tts",
    provider: "google",
    modelId: "gemini-2.5-flash-preview-tts",
    displayName: "Gemini 2.5 Flash TTS",
    pricing: { input: 0, output: 0, cachedInput: 0, cacheWrite: 0 },
    capabilities: {
      streaming: false, tools: false, vision: false,
      documents: false, thinking: false, embeddings: false,
    },
    contextWindow: 0,
    maxOutput: 0,
    notes: "Per-character pricing ($4/1M chars) — see calculateGeminiTtsCostUsd",
  },
];

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

const CATALOG: Record<string, ModelEntry> = ENTRIES.reduce(
  (acc, entry) => {
    acc[entry.id] = entry;
    return acc;
  },
  {} as Record<string, ModelEntry>,
);

/** Получить запись каталога по id. Возвращает undefined если модель неизвестна. */
export function getModelEntry(id: string): ModelEntry | undefined {
  return CATALOG[id];
}

/** Резолвит алиас до физической модели. Для физических возвращает тот же entry. */
export function resolveModelEntry(id: string): ModelEntry | undefined {
  const entry = CATALOG[id];
  if (!entry) return;
  if (entry.aliasOf) return CATALOG[entry.aliasOf];
  return entry;
}

/** Все физические модели (без алиасов). */
export function listPhysicalModels(): ModelEntry[] {
  return ENTRIES.filter((e) => !e.aliasOf);
}

/** Все записи каталога (физические + алиасы). */
export function listAllModels(): ModelEntry[] {
  return ENTRIES;
}

/** Display name или fallback на id. */
export function getDisplayName(id: string): string {
  return CATALOG[id]?.displayName ?? id;
}

/** Context window или 200K дефолт для неизвестных моделей. */
export function getContextWindow(id: string): number {
  const entry = resolveModelEntry(id);
  return entry?.contextWindow ?? 200_000;
}
