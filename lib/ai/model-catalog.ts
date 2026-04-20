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

/**
 * Document input support — discriminated union по `supported`.
 *
 * Заменил булевый `documents: boolean` (TZ_ModelCatalogDocumentFlags, 2026-04-14).
 * Прежний флаг был слишком грубым для роутера: `false` мог означать «провайдер
 * не умеет», «провайдер умеет но мы не интегрировали», «модель не для текста»
 * — три разных решения для роутера.
 *
 * Семантика — РЕАЛЬНАЯ поддержка в Simply, не декларативная у провайдера.
 * Если xAI умеет PDF через Files API, но мы не интегрировали — `supported: false`.
 * Это нужно чтобы будущий document router не направлял PDF в модель,
 * которая фактически не сможет его обработать в нашей кодовой базе.
 *
 * `method`:
 *  - "native" — PDF передаётся inline в messages (base64 или URL)
 *  - "files-api" — нужен предварительный upload через Files API провайдера
 */
export type DocumentSupport =
  | {
      supported: false;
      /** Почему `false` — для DevPanel и для будущих решений (поднять флаг или нет). */
      reason: string;
    }
  | {
      supported: true;
      method: "native" | "files-api";
      /** Лимит страниц на запрос. Зависит от context window для Claude. */
      maxPages?: number;
      /** Лимит размера запроса/файла в мегабайтах. */
      maxSizeMb?: number;
      /** Дополнительные оговорки или зависимости. */
      notes?: string;
    };

export interface ModelCapabilities {
  streaming: boolean;
  tools: boolean;
  vision: boolean;
  documentSupport: DocumentSupport;
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

// documentSupport дефолт = native PDF, лимит страниц 600 (для 1M-моделей Sonnet 4.6/Opus 4.6).
// Модели с 200K context (Haiku 4.5, Sonnet 4.5 legacy) override на maxPages: 100 — это
// official Anthropic limit (источник platform.claude.com/.../pdf-support).
const CAPS_CLAUDE: ModelCapabilities = {
  streaming: true,
  tools: true,
  vision: true,
  documentSupport: {
    supported: true,
    method: "native",
    maxPages: 600,
    maxSizeMb: 32,
    notes: "PDF inline base64/URL/Files API. 600 страниц для 1M-моделей, 100 для 200K (см. override).",
  },
  thinking: true,
  embeddings: false,
};

const CAPS_MINIMAX: ModelCapabilities = {
  streaming: true,
  tools: true,
  vision: false,
  documentSupport: {
    supported: false,
    reason: "Anthropic-compat endpoint не поддерживает image/document inputs (verified 2026-04-13)",
  },
  thinking: true,
  embeddings: false,
};

const CAPS_GROK: ModelCapabilities = {
  streaming: true,
  tools: true,
  vision: true,
  documentSupport: {
    supported: false,
    // xAI Files API существует и работает для agentic-моделей (grok-4, grok-4.20,
    // grok-4-fast), но в Simply мы не реализовали интеграцию upload → file_id →
    // input_file content type. Декларативная истина (провайдер умеет) ≠ фактическая
    // (Simply не интегрирует). Будущее ТЗ-XAIFilesIntegration поднимет флаг для
    // reasoning вариантов.
    reason: "xAI Files API не интегрирован в Simply (требует upload + input_file content type)",
  },
  thinking: true,
  embeddings: false,
};

const CAPS_OPENROUTER_TEXT: ModelCapabilities = {
  streaming: true,
  tools: true,
  vision: false,
  documentSupport: {
    supported: false,
    reason: "OpenRouter proxy — document support не валидирован, не для production",
  },
  thinking: false,
  embeddings: false,
};

// Vision-capable OpenRouter models (GLM V-series and similar multimodal).
// Documents stay unsupported — OpenRouter v1 doesn't route PDFs through these models
// directly; images/video are the supported media types.
const CAPS_OPENROUTER_VISION: ModelCapabilities = {
  streaming: true,
  tools: true,
  vision: true,
  documentSupport: {
    supported: false,
    reason: "OpenRouter proxy — vision модели обрабатывают image/video, не PDF",
  },
  thinking: false,
  embeddings: false,
};

// Override для Claude моделей с 200K context (Haiku 4.5, Sonnet 4.5 legacy).
// Anthropic docs: 100 страниц для 200K-моделей, 600 — для 1M-моделей.
// Используется через spread: `{ ...CAPS_CLAUDE, documentSupport: CAPS_CLAUDE_200K_DOCS }`.
const CAPS_CLAUDE_200K_DOCS: DocumentSupport = {
  supported: true,
  method: "native",
  maxPages: 100,
  maxSizeMb: 32,
  notes: "PDF inline base64/URL/Files API. 200K context → 100 страниц лимит.",
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
    capabilities: {
      ...CAPS_CLAUDE,
      thinking: false,
      documentSupport: CAPS_CLAUDE_200K_DOCS,
    },
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
  // Note on removed legacy entry: `claude-sonnet-4-5-20250929` had only 2
  // historical records in ai_usage_log (both Feb-Apr 2026), and its pricing
  // is identical to claude-sonnet-4-6 ($3/$15/$0.3/$3.75). Tolerant lookup in
  // getModelEntry walks back the trailing `-20250929`/`-4-5` segments and
  // resolves via the `claude-sonnet` alias → claude-sonnet-4-6, so historical
  // cost calc stays accurate. Removed in v3.87.5 (TZ_AnthropicAliasCleanup).

  // =========================================================================
  // Anthropic — alias entries (short semantic names used by UI layer:
  // service-chat configs, DevPanel labels, component default props).
  // Task-assignments uses physical IDs for cost precision; aliases insulate
  // UI from snapshot version changes (bump catalog once → UI untouched).
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
    capabilities: {
      ...CAPS_CLAUDE,
      thinking: false,
      documentSupport: CAPS_CLAUDE_200K_DOCS,
    },
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
  // Note: `title-model` and `artifact-model` aliases removed in v3.87.5
  // (TZ_AnthropicAliasCleanup). Both had 0 consumers after ТЗ-1 CoreRegistry
  // (v3.83.0) — task-assignments.ts uses physical IDs directly:
  //   util:title       → "claude-haiku-4-5-20251001"
  //   artifact:*       → "claude-sonnet-4-6"
  // Dead aliases left behind during ТЗ-1 migration, cleaned up during
  // catalog audit discovery.

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
  // contextWindow: docs.x.ai заявляет 2M для всех Grok 4.x, но наш
  // architectural invariant — защита контекста (sliding window + Extract-on-
  // compression) остаётся независимо от провайдерского окна. Вечный чат
  // заполнит любое окно; модели деградируют на 30-50% заявленного (Lost in
  // the Middle). Текущие 256K/128K = заведомо безопасный нижний край,
  // достаточный для рабочего бюджета качества (CONTEXT_BUDGET 140K).
  // Привязывать архитектуру к размеру окна провайдера = антипаттерн.
  // См. specs/Simply_xAI/SIMPLY_XAI_NOTES.md (2026-04-14).
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
    notes: "Multi-agent variant НЕ поддерживает client-side function calling через Chat Completions — только built-in tools (web_search, x_search) и remote MCP (docs.x.ai/developers/model-capabilities/text/multi-agent). С ТЗ-XAI-4 (2026-04-16) обычная expertise переведена на grok-4.20-0309-reasoning. Эта запись каталога RESERVED под taskId `expertise-multi-agent` (placeholder в task-assignments.ts) — Premium-режим «Команда агентов» рядом с обычной Экспертизой, toggle в UI по паттерну кнопки «Думать». Реализация в отдельной ветке ТЗ-XAI-MA-1: Responses API + MCP сервер для наших tools, auth layer, observability адаптер, UI прогресса агентов. Полное обоснование архитектуры — specs/Simply_xAI/BRAINSTORM_GrokMultiAgent.md.",
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
  // Note: legacy `grok-4` entry removed in v3.88.0 (ТЗ-XAI-1). It was not in
  // docs.x.ai/docs/models, had 0 consumers in task-assignments, and SQL audit
  // against ai_usage_log (2026-04-14) confirmed 0 historical records for bare
  // modelId "grok-4". Tolerant walk-back in getModelEntry() returns undefined
  // for "grok-4" (stripping lands on "grok" with no match), but that's a
  // non-issue — there's nothing to resolve. Pricing for "grok-4" was always
  // an educated guess borrowed from the 4.20 tier.

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
      documentSupport: { supported: false, reason: "Embedding model" },
      thinking: false, embeddings: true,
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
      documentSupport: { supported: false, reason: "Embedding model" },
      thinking: false, embeddings: true,
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
      // Perplexity API сам по себе поддерживает file_url (PDF/DOC/DOCX/TXT/RTF до 50MB),
      // но в Simply мы зовём sonar-pro ТОЛЬКО через tool deepResearch — это поисковый
      // инструмент, файлы туда не передаются. Если будущий refactor добавит file inputs
      // в deepResearch — поднимем флаг.
      documentSupport: {
        supported: false,
        reason: "Используется только через tool deepResearch — файлы не передаются в текущей интеграции",
      },
      thinking: false, embeddings: false,
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
      documentSupport: {
        supported: false,
        reason: "Deep Research agent — не используется для прямых файловых запросов в Simply",
      },
      thinking: true, embeddings: false,
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
      documentSupport: { supported: false, reason: "Audio transcription — input is audio, not text/documents" },
      thinking: false, embeddings: false,
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
      documentSupport: { supported: false, reason: "TTS model — generates audio from text, not document analysis" },
      thinking: false, embeddings: false,
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

