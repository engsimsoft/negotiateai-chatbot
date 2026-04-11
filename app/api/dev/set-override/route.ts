/**
 * Dev-only endpoint for setting model overrides via URL.
 *
 * Usage:
 *   /api/dev/set-override?task=simply-chat&model=claude-haiku-4-5-20251001
 *   /api/dev/set-override?clear=1   — wipe all overrides
 *
 * Writes to `.simply-dev-overrides.json` in the project root via
 * `writeOverridesFile`. `getModel()` reads the same file on every call.
 *
 * Disabled entirely in production (SIMPLY_DEV_MODE !== "true").
 *
 * TEMPORARY — ТЗ-2 Stage 2 replaces this with the /dev/models UI + Server
 * Actions. The file-based backend in `model-overrides-node.ts` stays.
 */

import { NextResponse } from "next/server";

import {
  readCurrentOverrides,
  writeOverridesFile,
} from "@/lib/ai/model-overrides-node";
import { isSimplyDevMode } from "@/lib/constants";

export async function GET(request: Request) {
  if (!isSimplyDevMode) {
    return new NextResponse("dev mode off", { status: 404 });
  }

  const url = new URL(request.url);
  const clear = url.searchParams.get("clear");
  const task = url.searchParams.get("task");
  const model = url.searchParams.get("model");

  const current = readCurrentOverrides();

  if (clear) {
    writeOverridesFile({});
    return textResponse(
      "All overrides cleared.",
      {},
      "Next step: send a message in Simply Chat — it should go back to defaults.",
    );
  }

  if (!task || !model) {
    return textResponse(
      `Dev Override Endpoint

Usage:
  /api/dev/set-override?task=<taskId>&model=<catalogId>
  /api/dev/set-override?clear=1

Examples:
  /api/dev/set-override?task=simply-chat&model=claude-haiku-4-5-20251001
  /api/dev/set-override?task=simply-chat&model=claude-sonnet-4-6
  /api/dev/set-override?task=simply-chat&model=MiniMax-M2.7
  /api/dev/set-override?clear=1`,
      current,
      null,
      400,
    );
  }

  const next = { ...current, [task]: model };
  writeOverridesFile(next);
  return textResponse(
    `Set override: ${task} -> ${model}`,
    next,
    "Next step: open Simply Chat and send a message. Footer should show the overridden model + OVERRIDE badge.",
  );
}

function textResponse(
  summary: string,
  overrides: Record<string, string>,
  nextStep: string | null,
  status = 200,
): NextResponse {
  const lines = [summary, "", `Active overrides: ${JSON.stringify(overrides, null, 2)}`];
  if (nextStep) lines.push("", nextStep);
  return new NextResponse(lines.join("\n") + "\n", {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
