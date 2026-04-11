"use server";

/**
 * Dev-only Server Actions for the /dev/models page (ТЗ-2 Stage 2).
 *
 * Thin wrappers around `writeOverridesFile` from `model-overrides-node`.
 * Every action re-checks the dev gate — in production each of these throws
 * and the form submission fails loudly rather than silently mutating state.
 *
 * `revalidatePath` refreshes the Server Component data on the same page so
 * the UI reflects the new state without a full reload.
 */

import { revalidatePath } from "next/cache";

import {
  readCurrentOverrides,
  writeOverridesFile,
} from "@/lib/ai/model-overrides-node";
import { isSimplyDevMode } from "@/lib/constants";

const DEV_MODELS_PATH = "/dev/models";

function assertDevMode(): void {
  if (!isSimplyDevMode) {
    throw new Error("dev overrides are disabled (SIMPLY_DEV_MODE !== 'true')");
  }
}

/** Set or update a single task override. Merges with existing entries. */
export async function setOverride(
  taskId: string,
  catalogId: string,
): Promise<void> {
  assertDevMode();
  if (!taskId || !catalogId) {
    throw new Error("taskId and catalogId are required");
  }
  const current = readCurrentOverrides();
  writeOverridesFile({ ...current, [taskId]: catalogId });
  revalidatePath(DEV_MODELS_PATH);
}

/** Remove a single task override (falls back to default on next request). */
export async function clearTaskOverride(taskId: string): Promise<void> {
  assertDevMode();
  const current = readCurrentOverrides();
  if (!(taskId in current)) return;
  const { [taskId]: _removed, ...rest } = current;
  writeOverridesFile(rest);
  revalidatePath(DEV_MODELS_PATH);
}

/** Wipe every override — the next request uses defaults for all tasks. */
export async function resetAllOverrides(): Promise<void> {
  assertDevMode();
  writeOverridesFile({});
  revalidatePath(DEV_MODELS_PATH);
}
