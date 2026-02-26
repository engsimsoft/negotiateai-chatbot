/**
 * DEV Mode Injection Utility
 *
 * Extracted from composer.ts for reuse across chat routes (main chat, service-chat).
 * Loads dev-mode.md + appends <dev_reminder> tag.
 *
 * ТЗ-FIX2 Этап 4: shared DEV mode utility
 */

import fs from "fs";
import path from "path";

const CORE_DIR = path.join(process.cwd(), "lib", "prompts", "core");

let devBlockCache: string | null = null;

function loadDevBlock(): string {
  if (devBlockCache !== null) return devBlockCache;

  const filePath = path.join(CORE_DIR, "dev-mode.md");
  try {
    devBlockCache = fs.existsSync(filePath)
      ? fs.readFileSync(filePath, "utf-8").trim()
      : "";
  } catch {
    devBlockCache = "";
  }
  return devBlockCache;
}

/**
 * Inject DEV mode block + reminder into system prompt.
 *
 * If SIMPLY_DEV_MODE !== 'true', returns the prompt unchanged.
 *
 * @param systemPrompt - the assembled system prompt
 * @param context - chat context label for the [DEV] line (e.g. "chat", "briefing-onboarding")
 */
export function injectDevMode(
  systemPrompt: string,
  context: string,
): string {
  if (process.env.SIMPLY_DEV_MODE !== "true") {
    return systemPrompt;
  }

  const devBlock = loadDevBlock();
  const parts: string[] = [systemPrompt];

  if (devBlock) {
    parts.push("---\n\n" + devBlock);
  }

  parts.push(
    `<dev_reminder>DEV-РЕЖИМ: каждый ответ НАЧИНАЕТСЯ с блока [DEV]. Контекст: ${context}</dev_reminder>`,
  );

  return parts.join("\n\n");
}
