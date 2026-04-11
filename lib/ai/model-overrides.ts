/**
 * Model Overrides — cookie-based dev-only mechanism for runtime model switching
 * (ТЗ-2 Dev Switchboard UI)
 *
 * Overrides live in a single JSON cookie `x-model-overrides` and are ignored in
 * production (`SIMPLY_DEV_MODE !== "true"`). The cookie maps taskId → catalog id:
 *
 *   { "simply-chat": "claude-opus-4-6", "util:title": "MiniMax-M2.7" }
 *
 * This module contains pure functions only (parse/serialize/gate). The actual
 * cookie read (via `next/headers`) and write (via Server Actions) happen in
 * `getModel.ts` and `app/(dev)/dev/models/actions.ts` respectively.
 *
 * Why cookie and not context threading:
 *   `getModel()` is called from 35+ sites across the app (routes, pipelines,
 *   artifact handlers, briefing, memory, meeting). Threading a `context.cookies`
 *   parameter through every caller would mean 35+ signature changes for a
 *   dev-only feature. `next/headers.cookies()` reads request-scoped cookies
 *   inside any server function with zero caller changes.
 */

import { isSimplyDevMode } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const OVERRIDES_COOKIE_NAME = "x-model-overrides";

/** Cookie attributes used when Server Actions mutate the overrides cookie. */
export const OVERRIDES_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  // httpOnly false on purpose — client code mirrors overrides to localStorage
  // for instant UI feedback without waiting for a server round-trip.
  httpOnly: false,
  // No `secure` — dev runs over http://localhost. Production ignores overrides
  // entirely via isOverridesAllowed(), so this flag is irrelevant there.
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** taskId → catalog id (physical or alias from model-catalog.ts). */
export type OverridesMap = Record<string, string>;

// ---------------------------------------------------------------------------
// Dev gate
// ---------------------------------------------------------------------------

/**
 * SSOT for "are model overrides allowed right now?".
 *
 * Used by getModel (read path), Server Actions (write path), and the /dev/models
 * page (UI gate). Changing one env var disables all three atomically.
 */
export function isOverridesAllowed(): boolean {
  return isSimplyDevMode;
}

// ---------------------------------------------------------------------------
// Parse / serialize
// ---------------------------------------------------------------------------

/**
 * Safe JSON.parse for the overrides cookie value.
 *
 * Returns an empty object on any parse failure — malformed cookies must never
 * break getModel() resolution. Also validates shape: must be an object whose
 * values are all strings.
 */
export function parseOverrides(raw: string | undefined | null): OverridesMap {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

  const result: OverridesMap = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof key === "string" && typeof value === "string" && value.length > 0) {
      result[key] = value;
    }
  }
  return result;
}

/** Inverse of parseOverrides — stable JSON (no pretty-print, used in cookie). */
export function serializeOverrides(overrides: OverridesMap): string {
  return JSON.stringify(overrides);
}
