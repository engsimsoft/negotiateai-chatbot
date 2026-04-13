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
  /**
   * Does this model support Anthropic's server-side Compaction API
   * (`providerOptions.anthropic.contextManagement`). Only Sonnet/Opus 4+
   * support it — Haiku does not. Non-Anthropic models never support it.
   *
   * Used by chat/route.ts to decide whether Compaction options go into
   * streamText AND whether the legacy snapshot-injection fallback must
   * run instead (for models that lack both, no long-context strategy is
   * available on the provider side).
   */
  supportsCompaction: boolean;
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

// Sonnet/Opus 4+ support Anthropic Compaction API.
const CAPS_CLAUDE: ModelCapabilities = {
  streaming: true,
  tools: true,
  vision: true,
  documents: true,
  thinking: true,
  embeddings: false,
  supportsCompaction: true,
};

const CAPS_MINIMAX: ModelCapabilities = {
  streaming: true,
  tools: true,
  vision: false,
  documents: false,
  thinking: true,
  embeddings: false,
  supportsCompaction: false,
};

const CAPS_GROK: ModelCapabilities = {
  streaming: true,
  tools: true,
  vision: true,
  documents: false,
  thinking: true,
  embeddings: false,
  supportsCompaction: false,
};

const CAPS_OPENROUTER_TEXT: ModelCapabilities = {
  streaming: true,
  tools: true,
  vision: false,
  documents: false,
  thinking: false,
  embeddings: false,
  supportsCompaction: false,
};

// Vision-capable OpenRouter models (GLM V-series and similar multimodal).
// Documents stay false — OpenRouter v1 doesn't route PDFs through these models
// directly; images/video are the supported media types.
const CAPS_OPENROUTER_VISION: ModelCapabilities = {
  streaming: true,
  tools: true,
  vision: true,
  documents: false,
  thinking: false,
  embeddings: false,
  supportsCompaction: false,
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
    // Haiku 4.5 supports Extended Thinking per Anthropic docs (2026-04-12),
    // but we keep thinking:false as a deliberate cost-control choice — enabling
    // thinking on Haiku would increase token usage without clear benefit for
    // the utility tasks it handles (title gen, file analysis, OCR, snapshots).
    capabilities: { ...CAPS_CLAUDE, thinking: false, supportsCompaction: false },
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
    maxOutput: 128_000, // Updated 2026-04-12: Anthropic increased from 32K to 128K
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
  // Anthropic — alias entries (short names that resolve to physical models,
  // used by task-assignments.ts and cost lookups)
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
    capabilities: { ...CAPS_CLAUDE, thinking: false, supportsCompaction: false },
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
    maxOutput: 128_000,
    aliasOf: "claude-opus-4-6",
  },
  {
    id: "title-model",
    provider: "anthropic",
    modelId: "claude-haiku-4-5-20251001",
    displayName: "Title Model (Haiku)",
    pricing: { input: 1, output: 5, cachedInput: 0.1, cacheWrite: 1.25 },
    capabilities: { ...CAPS_CLAUDE, thinking: false, supportsCompaction: false },
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
  // xAI Grok — pricing verified against docs.x.ai/docs/models (2026-04-12).
  // All 4.20 variants share $2/$6, Fast tier $0.20/$0.50. Cached input ~10%.
  //
  // Context window: docs.x.ai reports 2M for all models, but this may be
  // aspirational. Using conservative values (256K/128K) until confirmed via
  // actual API testing. Re-check at next audit.
  // =========================================================================
  {
    id: "grok-4.20-0309-reasoning",
    provider: "xai",
    modelId: "grok-4.20-0309-reasoning",
    displayName: "Grok 4.20 (reasoning)",
    pricing: { input: 2, output: 6, cachedInput: 0.2, cacheWrite: 0 },
    capabilities: CAPS_GROK,
    contextWindow: 256_000,
    maxOutput: 16_000,
  },
  {
    id: "grok-4.20-0309-non-reasoning",
    provider: "xai",
    modelId: "grok-4.20-0309-non-reasoning",
    displayName: "Grok 4.20",
    pricing: { input: 2, output: 6, cachedInput: 0.2, cacheWrite: 0 },
    capabilities: { ...CAPS_GROK, thinking: false },
    contextWindow: 256_000,
    maxOutput: 16_000,
  },
  {
    id: "grok-4.20-multi-agent-0309",
    provider: "xai",
    modelId: "grok-4.20-multi-agent-0309",
    displayName: "Grok 4.20 Multi-Agent",
    // Multi-agent uses the same $2/$6 per xAI docs — no ensemble markup.
    pricing: { input: 2, output: 6, cachedInput: 0.2, cacheWrite: 0 },
    capabilities: CAPS_GROK,
    contextWindow: 256_000,
    maxOutput: 16_000,
  },
  {
    id: "grok-4-1-fast-reasoning",
    provider: "xai",
    modelId: "grok-4-1-fast-reasoning",
    displayName: "Grok 4.1 Fast (reasoning)",
    pricing: { input: 0.2, output: 0.5, cachedInput: 0.05, cacheWrite: 0 },
    capabilities: CAPS_GROK,
    contextWindow: 128_000,
    maxOutput: 16_000,
  },
  {
    id: "grok-4-1-fast-non-reasoning",
    provider: "xai",
    modelId: "grok-4-1-fast-non-reasoning",
    displayName: "Grok 4.1 Fast",
    pricing: { input: 0.2, output: 0.5, cachedInput: 0.05, cacheWrite: 0 },
    capabilities: { ...CAPS_GROK, thinking: false },
    contextWindow: 128_000,
    maxOutput: 16_000,
  },
  {
    id: "grok-4",
    provider: "xai",
    modelId: "grok-4",
    displayName: "Grok 4",
    // Not in docs.x.ai/docs/models as of 2026-04-12 — retained for backward
    // compatibility with earlier tests. Pricing borrowed from 4.20 tier; may
    // be inaccurate. Prefer grok-4.20-0309-* or grok-4-1-fast-* for new work.
    pricing: { input: 2, output: 6, cachedInput: 0.2, cacheWrite: 0 },
    capabilities: { ...CAPS_GROK, thinking: false },
    contextWindow: 256_000,
    maxOutput: 16_000,
    notes: "DEPRECATED — not in docs.x.ai models list (2026-04-12). Pricing is an educated guess. Prefer grok-4.20-0309-* or grok-4-1-fast-*.",
  },

  // =========================================================================
  // OpenRouter — verified against https://openrouter.ai/api/v1/models
  // (fetched 2026-04-12). Per-token values converted from raw $/token to $/M.
  // =========================================================================
  {
    id: "z-ai/glm-4.6",
    provider: "openrouter",
    modelId: "z-ai/glm-4.6",
    displayName: "GLM 4.6 (OpenRouter)",
    pricing: { input: 0.39, output: 1.9, cachedInput: 0, cacheWrite: 0 },
    capabilities: CAPS_OPENROUTER_TEXT,
    contextWindow: 204_800,
    maxOutput: 204_800,
  },
  {
    id: "z-ai/glm-5.1",
    provider: "openrouter",
    modelId: "z-ai/glm-5.1",
    displayName: "GLM 5.1 (OpenRouter)",
    // First non-Anthropic entry in the catalog with cache reads — OpenRouter
    // exposes $0.475/M for cached input, so cost tracking respects it.
    pricing: { input: 0.95, output: 3.15, cachedInput: 0.475, cacheWrite: 0 },
    capabilities: CAPS_OPENROUTER_TEXT,
    contextWindow: 202_752,
    maxOutput: 65_535,
  },
  {
    id: "qwen/qwen3.6-plus",
    provider: "openrouter",
    modelId: "qwen/qwen3.6-plus",
    displayName: "Qwen 3.6 Plus (OpenRouter)",
    // Tiered pricing on OpenRouter: ≤256K tokens is $0.325/$1.95, >256K is
    // $1.30/$3.90. ModelPricingUsd has no tier support yet, so we store the
    // base ≤256K tier. Cost tracking underestimates for requests >256K input.
    pricing: { input: 0.325, output: 1.95, cachedInput: 0, cacheWrite: 0 },
    capabilities: CAPS_OPENROUTER_VISION, // Verified 2026-04-12: OpenRouter reports modality text+image+video→text
    contextWindow: 1_000_000,
    maxOutput: 65_536,
    notes: "Tiered pricing: >256K input tokens cost 4× base ($1.30/$3.90). Catalog stores base tier only.",
  },
  // --- OpenRouter vision models ------------------------------------------
  {
    id: "z-ai/glm-4.6v",
    provider: "openrouter",
    modelId: "z-ai/glm-4.6v",
    displayName: "GLM 4.6V (vision)",
    // Verified via openrouter.ai/api/v1/models — smaller/cheaper vision tier
    // than 5V Turbo. No cache read price exposed.
    pricing: { input: 0.3, output: 0.9, cachedInput: 0, cacheWrite: 0 },
    capabilities: CAPS_OPENROUTER_VISION,
    contextWindow: 131_072,
    maxOutput: 131_072,
  },
  {
    id: "z-ai/glm-5v-turbo",
    provider: "openrouter",
    modelId: "z-ai/glm-5v-turbo",
    displayName: "GLM 5V Turbo (vision)",
    // Multimodal (image + video + text). Cache read supported at $0.24/M.
    pricing: { input: 1.2, output: 4, cachedInput: 0.24, cacheWrite: 0 },
    capabilities: CAPS_OPENROUTER_VISION,
    contextWindow: 202_752,
    maxOutput: 131_072,
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
      supportsCompaction: false,
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
      supportsCompaction: false,
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
      supportsCompaction: false,
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
      supportsCompaction: false,
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
      supportsCompaction: false,
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
      supportsCompaction: false,
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

/**
 * Получить запись каталога по id. Возвращает undefined если модель неизвестна.
 *
 * Tolerant lookup: exact match первый → fallback стрипит trailing segments
 * разделённые `-` пока не найдёт match. Это нужно для providers (OpenRouter),
 * которые возвращают в `response.modelId` versioned form:
 *   - SEND:     "qwen/qwen3.6-plus"
 *   - RECEIVE:  "qwen/qwen3.6-plus-04-02" (pinned snapshot version)
 *   - CATALOG:  "qwen/qwen3.6-plus"
 * Без tolerant lookup cost calculation для OpenRouter-models ломается
 * (getModelEntry возвращает undefined → calculateCostRub возвращает 0).
 * См. ТЗ_OpenRouterCostTracking.
 *
 * Loop безопасен: срабатывает ТОЛЬКО когда exact match провалился, и идёт
 * от длинного id к короткому по одному сегменту за раз. Для catalog entry
 * с явной версией в id (например `claude-haiku-4-5-20251001`) exact match
 * срабатывает первым — fallback не активируется.
 */
export function getModelEntry(id: string): ModelEntry | undefined {
  const direct = CATALOG[id];
  if (direct) return direct;
  let trimmed = id;
  while (true) {
    const lastDash = trimmed.lastIndexOf("-");
    if (lastDash === -1) return undefined;
    trimmed = trimmed.slice(0, lastDash);
    const found = CATALOG[trimmed];
    if (found) return found;
  }
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
