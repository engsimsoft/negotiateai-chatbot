/**
 * Model Overrides — dev-only mechanism for runtime model switching
 * (ТЗ-2 Dev Switchboard UI)
 *
 * Client-safe shared module. Holds the type, parser, dev gate, and a
 * reader-registration hook. The actual storage backend (a JSON file at the
 * project root) lives in `model-overrides-node.ts` — it depends on `node:fs`
 * and must not be imported from client code.
 *
 * Architecture — why file + callback registration:
 *   `getModel()` is called from 35+ sites across the app and must stay
 *   synchronous. Next 15 turned `cookies()` into an async-only API, and
 *   threading request state through every caller would require 35+ signature
 *   changes for a dev-only feature. Instead we keep a dotfile on disk
 *   (`.simply-dev-overrides.json`) that the server reads synchronously in
 *   `getModel → lookupOverride`. A small dev endpoint mutates the file.
 *
 *   This module registers a no-op reader by default. The Node-only companion
 *   installs the real file-based reader at module-eval time via
 *   `registerOverridesReader`. Client bundles never import that companion,
 *   so `getActiveOverrides()` stays a no-op in the browser.
 *
 *   Zero changes to the 35+ getModel call-sites.
 */

import { isSimplyDevMode } from "@/lib/constants";

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
 * Used by getModel (read path), the dev endpoint (write path), and the
 * /dev/models page (UI gate in ТЗ-2 Stage 2). Changing one env var disables
 * all three atomically.
 */
export function isOverridesAllowed(): boolean {
  return isSimplyDevMode;
}

// ---------------------------------------------------------------------------
// Parse / serialize
// ---------------------------------------------------------------------------

/**
 * Safe JSON.parse for the overrides file contents.
 *
 * Returns an empty object on any parse failure — a corrupt file must never
 * break getModel() resolution. Also validates shape: must be a plain object
 * whose values are all non-empty strings.
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

/** Stable JSON serializer — compact, no pretty-print. */
export function serializeOverrides(overrides: OverridesMap): string {
  return JSON.stringify(overrides);
}

// ---------------------------------------------------------------------------
// Client-safe reader + server-side registration hook
// ---------------------------------------------------------------------------

/**
 * Default no-op reader. Used on the client (no overrides ever flow through
 * a browser process) and as a fallback on the server before the Node module
 * has installed the file-based reader.
 */
const NO_OVERRIDES_READER: () => OverridesMap = () => ({});

let activeOverridesReader: () => OverridesMap = NO_OVERRIDES_READER;

/**
 * Install a real overrides reader. Called exactly once, at module-eval time,
 * from `model-overrides-node.ts` — the Node-only companion that reads the
 * overrides file. Because that file is imported only from server entry points
 * (route handlers), it never reaches the client bundle and webpack therefore
 * never tries to resolve `node:fs`.
 */
export function registerOverridesReader(reader: () => OverridesMap): void {
  activeOverridesReader = reader;
}

/**
 * Read the active overrides map or an empty object.
 *
 * Always returns an empty map when the dev gate is off, regardless of whether
 * a reader is installed — so production behaviour is completely unaffected.
 */
export function getActiveOverrides(): OverridesMap {
  if (!isOverridesAllowed()) return {};
  return activeOverridesReader();
}
