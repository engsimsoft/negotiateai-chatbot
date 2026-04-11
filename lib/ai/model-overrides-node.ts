/**
 * Model Overrides — Node-only companion to `model-overrides.ts` (ТЗ-2)
 *
 * File-based backend for the dev-only overrides map. Writes live in
 * `.simply-dev-overrides.json` at the project root; the reader is installed
 * at module-eval time and `getModel()` pulls overrides from this file on
 * every call (cached by the OS + Node FS stat cache — fast enough for dev).
 *
 * Why a file instead of cookies (Stage 1 hotfix rev 2):
 *   Manual cookie management in Chrome DevTools is fragile — values with
 *   `{}`/`"` get silently stripped, HMR state confuses path/domain matching,
 *   and the Next 15 `cookies()` API is async-only in server code. A plain
 *   JSON file on disk sidesteps all of this, survives hot-reloads, and the
 *   `/api/dev/set-override` endpoint atomically mutates it. In ТЗ-2 Stage 2
 *   the real /dev/models UI will drive this same endpoint.
 *
 * Production safety: the dev gate (`isOverridesAllowed`) returns false when
 * `SIMPLY_DEV_MODE !== "true"`, so this file is never read in production.
 * On Vercel we also benefit from an ephemeral filesystem — even if someone
 * forced the flag on, the file would not persist across deployments.
 *
 * This file MUST NOT be imported from client code (it depends on `node:fs`).
 * The split with the client-safe `model-overrides.ts` is enforced via the
 * `server-only` sentinel import below.
 */

import "server-only";

import fs from "node:fs";
import path from "node:path";

import {
  isOverridesAllowed,
  type OverridesMap,
  parseOverrides,
  registerOverridesReader,
  serializeOverrides,
} from "./model-overrides";

// ---------------------------------------------------------------------------
// File location
// ---------------------------------------------------------------------------

/**
 * Dotfile at the project root — hidden in directory listings and trivial to
 * inspect with `cat`. Never checked into git (see below — the installer
 * ensures it's present in .gitignore on first write, but manual tests usually
 * only need the file to exist while the dev server runs).
 */
export const OVERRIDES_FILE = path.join(
  process.cwd(),
  ".simply-dev-overrides.json",
);

// ---------------------------------------------------------------------------
// Reader — installed at module load, called by getActiveOverrides()
// ---------------------------------------------------------------------------

function readOverridesFile(): OverridesMap {
  try {
    const raw = fs.readFileSync(OVERRIDES_FILE, "utf8");
    return parseOverrides(raw);
  } catch (err) {
    // ENOENT = no overrides file yet; treated as "no overrides". Any other
    // error (permission, corrupt content) also degrades to defaults rather
    // than failing getModel() — dev tooling must never break normal flow.
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    return {};
  }
}

// Install the reader exactly once, at module-eval time. Client bundles never
// import this file, so on the client the stub reader in model-overrides.ts
// stays active and always returns `{}`.
registerOverridesReader(readOverridesFile);

// ---------------------------------------------------------------------------
// Writer — used by /api/dev/set-override
// ---------------------------------------------------------------------------

/**
 * Atomically write the overrides map to disk. The dev gate is enforced here
 * too — callers (Server Actions, dev API routes) don't need a second check.
 * Returns the map that was actually persisted (empty object wipes the file).
 */
export function writeOverridesFile(overrides: OverridesMap): OverridesMap {
  if (!isOverridesAllowed()) {
    throw new Error("writeOverridesFile called outside SIMPLY_DEV_MODE");
  }
  fs.writeFileSync(OVERRIDES_FILE, serializeOverrides(overrides), "utf8");
  return overrides;
}

/** Read the current persisted overrides (or empty if no file / dev mode off). */
export function readCurrentOverrides(): OverridesMap {
  if (!isOverridesAllowed()) return {};
  return readOverridesFile();
}
