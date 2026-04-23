/**
 * getModel — единая точка получения LanguageModel для задачи (ТЗ-1 CoreRegistry)
 *
 * Единственная функция, через которую вся 40+ AI-точка приложения получает
 * модель. Всё остальное — внутренние детали (registry, catalog, task assignments).
 *
 * Порядок разрешения:
 *   1. Overrides — dev-only cookie `x-model-overrides` (ТЗ-2)
 *   2. Test mocks — isTestEnvironment → возвращает mock модель
 *   3. Task assignment → catalog entry → registry lookup
 *
 * Сигнатура с `context?` остаётся стабильной (зарезервирована под будущее,
 * например per-user overrides из БД).
 */

import { wrapLanguageModel, type LanguageModel } from "ai";

import { isTestEnvironment } from "../constants";
import { reasoningReconciliationMiddleware } from "./middleware/reasoning-reconciliation";
import { getModelEntry, resolveModelEntry } from "./model-catalog";
import { getActiveOverrides } from "./model-overrides";
import { registry, type RegistryProviderId } from "./registry";
import {
  DEFAULT_MAX_OUTPUT_TOKENS,
  DEFAULT_TASK_MODELS,
  type TaskId,
} from "./task-assignments";

/**
 * Anthropic non-streaming threshold — при `maxOutputTokens > 21333` вызов
 * `generateText` / `generateObject` превышает default fetch timeout и падает
 * с `UND_ERR_SOCKET`. Для таких cap'ов call site ОБЯЗАН использовать
 * `streamText` / `streamObject`. См. ADR AI SDK invocation contract.
 */
const ANTHROPIC_NON_STREAMING_THRESHOLD = 21333;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Optional context for overrides lookup. Принимается уже в ТЗ-1 (сигнатура
 * стабильна), активная реализация — в ТЗ-2.
 */
export interface GetModelContext {
  /** Для user-level overrides (из БД). ТЗ-2. */
  userId?: string;
  /**
   * Request cookies для `x-model-overrides` cookie (dev-only). ТЗ-2.
   * В production этот источник игнорируется.
   */
  requestCookies?: { get(name: string): { value: string } | undefined };
}

// ---------------------------------------------------------------------------
// Overrides lookup — dev-only cookie-based mechanism (ТЗ-2)
// ---------------------------------------------------------------------------

/**
 * Lookup override catalog-id for a given task.
 *
 * Reads from the AsyncLocalStorage context installed by
 * `runWithOverridesFromRequest` (see `model-overrides-node.ts`). Returns null
 * when:
 *  - dev gate is off (production), OR
 *  - no cookie / empty cookie / malformed JSON, OR
 *  - the request handler wasn't wrapped with runWithOverridesFromRequest, OR
 *  - we're in a background (non-request) context like cron or waitUntil.
 *
 * No throws, no next/headers dependency, no threading through call-sites.
 */
function lookupOverride(
  taskId: TaskId,
  _context?: GetModelContext,
): string | null {
  const overrides = getActiveOverrides();
  return overrides[taskId] ?? null;
}

// ---------------------------------------------------------------------------
// Mock models (для тестов)
// ---------------------------------------------------------------------------

let cachedMock: LanguageModel | null = null;

function getMockModel(): LanguageModel {
  if (cachedMock) return cachedMock;
  // Lazy require — чтобы prod bundle не тянул mock
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { chatModel } = require("./models.mock") as {
    chatModel: LanguageModel;
  };
  cachedMock = chatModel;
  return chatModel;
}

// ---------------------------------------------------------------------------
// Catalog → registry id resolution
// ---------------------------------------------------------------------------

const PROVIDER_TO_REGISTRY: Record<string, RegistryProviderId | null> = {
  anthropic: "anthropic",
  minimax: "minimax", // дефолтный minimax; briefing использует minimaxLong (см. ниже)
  xai: "xai",
  openrouter: "openrouter",
  // Non-LLM провайдеры не в registry — возвращаем null
  voyage: null,
  deepgram: null,
  perplexity: null,
  google: null,
};

/**
 * Сборка строки `provider:modelId` для registry.languageModel().
 * Специальный случай: алиас `MiniMax-M2.7-long` → registry namespace `minimaxLong`.
 */
function buildRegistryId(catalogId: string): string | null {
  const entry = getModelEntry(catalogId);
  if (!entry) return null;

  // Специальный случай — briefing использует MiniMax с extended timeout (180s).
  // В каталоге это алиас `MiniMax-M2.7-long` → physical `MiniMax-M2.7`, но зарегистрирован
  // под отдельным provider namespace `minimaxLong`.
  if (catalogId === "MiniMax-M2.7-long") {
    return "minimaxLong:MiniMax-M2.7";
  }

  const resolved = resolveModelEntry(catalogId);
  if (!resolved) return null;

  const registryProvider = PROVIDER_TO_REGISTRY[resolved.provider];
  if (!registryProvider) return null;

  return `${registryProvider}:${resolved.modelId}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Получить LanguageModel для задачи.
 *
 * Проходит через: overrides → test mocks → task-assignment → catalog → registry.
 *
 * @throws Error если taskId неизвестен или catalog не содержит назначенную модель
 *   (намеренно громкая ошибка — это bug в task-assignments, а не runtime-условие).
 */
export function getModel(
  taskId: TaskId,
  context?: GetModelContext,
): LanguageModel {
  // 1. Test environment → mock
  if (isTestEnvironment) {
    return getMockModel();
  }

  // 2. Overrides lookup (stub в ТЗ-1)
  const overrideId = lookupOverride(taskId, context);
  const catalogId = overrideId ?? DEFAULT_TASK_MODELS[taskId];

  if (!catalogId) {
    throw new Error(
      `[getModel] Unknown taskId "${taskId}" — not in DEFAULT_TASK_MODELS`,
    );
  }

  const registryId = buildRegistryId(catalogId);
  if (!registryId) {
    throw new Error(
      `[getModel] Cannot resolve catalog id "${catalogId}" for task "${taskId}" — ` +
        `entry missing or provider not in registry`,
    );
  }

  const model = registry.languageModel(
    // cast: registry type expects literal union; тут taskId динамический
    registryId as Parameters<typeof registry.languageModel>[0],
  );

  const resolved = resolveModelEntry(catalogId);
  if (resolved?.provider === "xai" && resolved.capabilities.thinking === true) {
    return wrapLanguageModel({
      model,
      middleware: reasoningReconciliationMiddleware,
    });
  }

  return model;
}

/**
 * Получить физический modelId для задачи (без резолва в LanguageModel).
 * Полезно для usage-logging и DevPanel.
 */
export function getModelIdForTask(
  taskId: TaskId,
  context?: GetModelContext,
): string {
  const overrideId = lookupOverride(taskId, context);
  const catalogId = overrideId ?? DEFAULT_TASK_MODELS[taskId];
  const resolved = resolveModelEntry(catalogId);
  return resolved?.modelId ?? catalogId;
}

/**
 * Получить провайдера (для записи в ai_usage_log.provider).
 */
export function getProviderForTask(
  taskId: TaskId,
  context?: GetModelContext,
): string {
  const overrideId = lookupOverride(taskId, context);
  const catalogId = overrideId ?? DEFAULT_TASK_MODELS[taskId];
  const resolved = resolveModelEntry(catalogId);
  return resolved?.provider ?? "unknown";
}

/**
 * Поддерживает ли модель для задачи extended thinking (Anthropic adaptive/enabled).
 * Используется callers чтобы условно добавлять providerOptions.anthropic.thinking.
 * Если модель Haiku / не-Anthropic → false.
 */
export function taskSupportsThinking(
  taskId: TaskId,
  context?: GetModelContext,
): boolean {
  const overrideId = lookupOverride(taskId, context);
  const catalogId = overrideId ?? DEFAULT_TASK_MODELS[taskId];
  const resolved = resolveModelEntry(catalogId);
  return resolved?.capabilities.thinking ?? false;
}

// ---------------------------------------------------------------------------
// Override introspection (ТЗ-2 — for DevPanel badges and /dev/models UI)
// ---------------------------------------------------------------------------

/**
 * Is there a dev override active for this task right now?
 *
 * Returns false in production, in background contexts, and when no cookie is
 * set. Consumers should use this only for UI affordances — getModel() already
 * handles override resolution internally.
 */
export function isTaskOverridden(taskId: TaskId): boolean {
  return lookupOverride(taskId) !== null;
}

/**
 * Read all current overrides. Intended for /dev/models page to hydrate the
 * initial UI state. Returns empty object in prod / background contexts.
 */
export function getCurrentOverrides(): Record<string, string> {
  return getActiveOverrides();
}

// ---------------------------------------------------------------------------
// maxOutputTokens getter (ТЗ-AISDKLayerHardening Этап 2)
// ---------------------------------------------------------------------------

const anthropicThresholdWarned = new Set<TaskId>();

function warnAnthropicThresholdOnce(taskId: TaskId, effective: number): void {
  if (anthropicThresholdWarned.has(taskId)) return;
  anthropicThresholdWarned.add(taskId);
  console.warn(
    `[getMaxOutputTokensForTask] ${taskId}: cap ${effective} > ${ANTHROPIC_NON_STREAMING_THRESHOLD} with Anthropic — ` +
      `call site MUST use streamText/streamObject (non-streaming will UND_ERR_SOCKET). ` +
      `See ADR "AI SDK invocation contract".`,
  );
}

/**
 * Получить `maxOutputTokens` для AI SDK вызова по задаче.
 *
 * Двухслойная safety-net:
 *  1. `Math.min(requested, capability)` — защищает от рассинхрона SSOT с
 *     каталогом при переключении модели через /dev/models или правку
 *     `DEFAULT_TASK_MODELS`. Runtime режет молча, без крахов.
 *  2. warnOnce при `cap > 21333` на Anthropic — предупреждает dev что
 *     call site ДОЛЖЕН быть на streamText/streamObject. Один раз per process.
 *
 * Источник SSOT — `DEFAULT_MAX_OUTPUT_TOKENS` в `task-assignments.ts`.
 */
export function getMaxOutputTokensForTask(taskId: TaskId): number {
  const requested = DEFAULT_MAX_OUTPUT_TOKENS[taskId];
  const modelId = getModelIdForTask(taskId);
  const entry = resolveModelEntry(modelId);
  const capability = entry?.maxOutput ?? requested;
  const effective = Math.min(requested, capability);

  if (entry?.provider === "anthropic" && effective > ANTHROPIC_NON_STREAMING_THRESHOLD) {
    warnAnthropicThresholdOnce(taskId, effective);
  }

  return effective;
}
