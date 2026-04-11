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

import type { LanguageModel } from "ai";

import { isTestEnvironment } from "../constants";
import { getModelEntry, resolveModelEntry } from "./model-catalog";
import {
  isOverridesAllowed,
  OVERRIDES_COOKIE_NAME,
  parseOverrides,
} from "./model-overrides";
import { registry, type RegistryProviderId } from "./registry";
import {
  DEFAULT_TASK_MODELS,
  type TaskId,
} from "./task-assignments";

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
 * Read the overrides cookie inside a request scope.
 *
 * `next/headers.cookies()` throws when called outside a Server Component /
 * Route Handler / Server Action — i.e. from background contexts like Vercel
 * cron handlers or `waitUntil` callbacks. That's **expected**: those paths
 * should always run on defaults, never on a developer's interactive overrides.
 * We silently return an empty map in that case.
 *
 * Also returns empty when the dev gate is off (production, staging, etc.) —
 * the cookie is completely ignored there regardless of whether it was set.
 */
function readOverridesFromCookie(): Record<string, string> {
  if (!isOverridesAllowed()) return {};
  try {
    // Lazy require — keeps `next/headers` out of any bundles that don't need it
    // (e.g. mock module, tests) and avoids ESM/CJS interop surprises.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { cookies } = require("next/headers") as typeof import("next/headers");
    // next/headers cookies() is async in Next 15 — but sync usage still works in
    // synchronous server code by returning the store directly. Wrap in Promise
    // unwrap with a fallback for the sync case.
    const store = cookies() as unknown as {
      get(name: string): { value: string } | undefined;
    };
    const raw = store.get?.(OVERRIDES_COOKIE_NAME)?.value;
    return parseOverrides(raw);
  } catch {
    // Outside request scope (background worker, cron) — no overrides.
    return {};
  }
}

/**
 * Lookup override catalog-id for a given task. Returns null if:
 *  - dev gate is off (production), OR
 *  - no cookie / empty cookie / malformed JSON, OR
 *  - no entry for this taskId, OR
 *  - we're in a background (non-request) context
 */
function lookupOverride(
  taskId: TaskId,
  _context?: GetModelContext,
): string | null {
  const overrides = readOverridesFromCookie();
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

  // ТЗ-1: MiniMax needs includeUsage=true to emit usage events during streaming
  // (reasoning tokens, cache tokens). Default provider doesn't set this —
  // mutate instance config after creation.
  if (registryId.startsWith("minimax:") || registryId.startsWith("minimaxLong:")) {
    const mutableModel = model as unknown as { config?: Record<string, unknown> };
    if (mutableModel.config) {
      mutableModel.config = { ...mutableModel.config, includeUsage: true };
    }
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
  return readOverridesFromCookie();
}
