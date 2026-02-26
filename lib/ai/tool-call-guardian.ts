/**
 * ТЗ-FIX1: Tool Call Guardian — Detection & Logging (Phase 1)
 *
 * Detects when the model describes tool calls in text without actually calling them.
 * Analyses each step on step-finish: if text mentions tools but toolCallCount === 0,
 * checks whether the text claims results (hallucination) vs describes a plan (legitimate).
 *
 * Phase 1: detection + console.warn + guardianFlags in ai_usage_log. No buffering, no retry.
 */

// ============================================================================
// Types
// ============================================================================

export interface HallucinationDetail {
  /** Step number where hallucination was detected */
  step: number;
  /** 0.0–1.0 confidence score */
  confidence: number;
  /** Which tool name was mentioned */
  toolMentioned: string;
  /** Which pattern matched: "result_claim" | "fake_progress" | "tool_action_verb" */
  pattern: string;
  /** Short text snippet that triggered detection (max 120 chars) */
  textSnippet: string;
}

export interface GuardianResult {
  /** Whether hallucination was detected in this step */
  detected: boolean;
  /** Confidence score (highest among all matches) */
  confidence: number;
  /** Details of each detection */
  details: HallucinationDetail[];
}

export interface GuardianFlags {
  /** Whether any hallucination was detected across all steps */
  detected: boolean;
  /** Total number of hallucinated steps */
  count: number;
  /** Details per detection */
  details: HallucinationDetail[];
}

// ============================================================================
// Tool Patterns
// ============================================================================

/**
 * Tools that fetch external data — most prone to hallucination.
 * Internal/UI tools (createDocument, getCurrentDate) are excluded
 * because the model rarely hallucinates their results.
 */
const EXTERNAL_TOOL_NAMES = [
  "deepResearch",
  "fetchUrl",
  "readTelegramChannel",
  "webSearch",
] as const;

/**
 * Tools that startResearch calls internally.
 * After startResearch completes, the model legitimately presents results
 * that reference these tools — this is NOT hallucination.
 */
const START_RESEARCH_INTERNAL_TOOLS = new Set<string>([
  "deepResearch",
  "fetchUrl",
  "readTelegramChannel",
  "startResearch",
]);

/**
 * Service-chat specific tools that can be hallucinated.
 */
const SERVICE_TOOL_NAMES = [
  "updateBriefingPreview",
  "saveBriefingProfile",
  "startResearch",
] as const;

/** All tool names we monitor for hallucination */
const MONITORED_TOOLS = [
  ...EXTERNAL_TOOL_NAMES,
  ...SERVICE_TOOL_NAMES,
] as const;

/**
 * Regex patterns for tool name mentions in natural language (case-insensitive).
 * Matches both camelCase originals and natural language references.
 */
const TOOL_NAME_PATTERNS: Array<{ regex: RegExp; toolName: string }> =
  MONITORED_TOOLS.map((name) => ({
    regex: new RegExp(name, "i"),
    toolName: name,
  }));

/** Additional natural language patterns for tool references (Russian + English) */
const TOOL_ALIAS_PATTERNS: Array<{ regex: RegExp; toolName: string }> = [
  // deepResearch
  { regex: /deep\s*research/i, toolName: "deepResearch" },
  { regex: /перплексити|perplexity/i, toolName: "deepResearch" },
  // fetchUrl
  { regex: /fetch\s*url/i, toolName: "fetchUrl" },
  { regex: /jina\s*reader/i, toolName: "fetchUrl" },
  // readTelegramChannel
  { regex: /read\s*telegram/i, toolName: "readTelegramChannel" },
  { regex: /telegram[- ]?канал/i, toolName: "readTelegramChannel" },
  // webSearch
  { regex: /web\s*search/i, toolName: "webSearch" },
  { regex: /поиск(?:овый|овой)?\s+(?:в\s+)?(?:интернет|сет)/i, toolName: "webSearch" },
  // startResearch
  { regex: /start\s*research/i, toolName: "startResearch" },
  { regex: /исследовани[еяю]\s+источник/i, toolName: "startResearch" },
  { regex: /поиск\s+источник/i, toolName: "startResearch" },
];

const ALL_TOOL_PATTERNS = [...TOOL_NAME_PATTERNS, ...TOOL_ALIAS_PATTERNS];

/**
 * Russian action verbs indicating the model PERFORMED an action (past tense / active).
 * These combined with a tool mention suggest the model claims it did something.
 */
const RESULT_CLAIM_VERBS_RU = [
  /проверил[аи]?\b/i,
  /нашёл|нашл[аи]\b/i,
  /обнаружил[аи]?\b/i,
  /получил[аи]?\b/i,
  /загрузил[аи]?\b/i,
  /прочитал[аи]?\b/i,
  /исследовал[аи]?\b/i,
  /проанализировал[аи]?\b/i,
  /извлёк|извлекл[аи]\b/i,
  /выяснил[аи]?\b/i,
  /определил[аи]?\b/i,
  /увидел[аи]?\b/i,
  /установил[аи]?\b/i,
];

/**
 * English action verbs (past tense / present perfect).
 */
const RESULT_CLAIM_VERBS_EN = [
  /\bfound\b/i,
  /\bchecked\b/i,
  /\bverified\b/i,
  /\bretrieved\b/i,
  /\bfetched\b/i,
  /\bsearched\b/i,
  /\bdiscovered\b/i,
  /\banalyzed\b/i,
];

const RESULT_CLAIM_VERBS = [...RESULT_CLAIM_VERBS_RU, ...RESULT_CLAIM_VERBS_EN];

/**
 * Patterns for fake progress / result claims without a real tool call.
 */
const FAKE_PROGRESS_PATTERNS = [
  // "найдено N источников/результатов/статей"
  /найден[оы]?\s+\d+\s+(?:источник|результат|стат|пост|канал|ссылк)/i,
  // "N источников/результатов" without prior tool
  /\d+\s+(?:источник|результат|стат|пост|ссылк)(?:ов|а|ей|и|ов)?\s+(?:найден|получен|загружен)/i,
  // "канал живой/активный/доступен"
  /канал\s+(?:живой|активн|доступен|работает|существует)/i,
  // "RSS найден/доступен"
  /RSS\s+(?:найден|доступен|работает|есть)/i,
  // "источник доступен/работает"
  /источник\s+(?:доступен|работает|живой|активн)/i,
  // "результат:" or "результаты:" as fake output header
  /результат[ыа]?\s*:/i,
  // "страница загружена/прочитана"
  /страниц[аы]\s+(?:загружен|прочитан|получен)/i,
  // "постов за неделю/день/месяц"
  /\d+\s+пост(?:ов|а|ы)?\s+за\s+(?:недел|ден|месяц|последн)/i,
];

/**
 * Plan/intent patterns — if these match, the text is a legitimate plan, NOT hallucination.
 * These override result claim detection.
 */
const PLAN_PATTERNS = [
  // "я могу/можно использовать/проверить/поискать"
  /(?:могу|можно|можем|стоит|нужно|попробу[юем])\s+(?:использовать|проверить|поискать|посмотреть|найти|загрузить|прочитать)/i,
  // "давай/давайте проверю/поищу/посмотрю"
  /давай(?:те)?\s+(?:я\s+)?(?:проверю|поищу|посмотрю|загружу|прочитаю|исследую)/i,
  // "сейчас проверю/поищу/посмотрю"
  /сейчас\s+(?:проверю|поищу|посмотрю|загружу|прочитаю|исследую)/i,
  // "для этого использую/вызову/применю"
  /для\s+(?:этого|начала)\s+(?:использую|вызову|применю|запущу)/i,
  // "let me check/search/look"
  /let\s+me\s+(?:check|search|look|find|fetch|read|verify)/i,
  // "I'll/I will use/check/search"
  /I(?:'ll|\s+will)\s+(?:use|check|search|look|find|fetch|read|verify)/i,
  // "если использовать/через"
  /если\s+(?:использовать|проверить|поискать)/i,
  // "можно через deepResearch" etc
  /(?:можно|стоит)\s+через\s+/i,
];

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Find all tool name mentions in the text.
 * Returns unique tool names mentioned.
 *
 * Exported for use in smart buffering (tool-mention-gated flush).
 */
export function findToolMentions(text: string): string[] {
  const found = new Set<string>();
  for (const { regex, toolName } of ALL_TOOL_PATTERNS) {
    if (regex.test(text)) {
      found.add(toolName);
    }
  }
  return Array.from(found);
}

/**
 * Check if text contains result claims (past tense actions / fake outputs).
 * Returns matching patterns with confidence.
 */
function findResultClaims(
  text: string
): Array<{ pattern: string; confidence: number; snippet: string }> {
  const claims: Array<{
    pattern: string;
    confidence: number;
    snippet: string;
  }> = [];

  // Check result claim verbs
  for (const verbRegex of RESULT_CLAIM_VERBS) {
    const match = text.match(verbRegex);
    if (match) {
      const idx = match.index ?? 0;
      const snippet = text.slice(Math.max(0, idx - 20), idx + 80).trim();
      claims.push({
        pattern: "result_claim",
        confidence: 0.7,
        snippet: snippet.slice(0, 120),
      });
      break; // one verb match is enough
    }
  }

  // Check fake progress patterns (higher confidence)
  for (const progressRegex of FAKE_PROGRESS_PATTERNS) {
    const match = text.match(progressRegex);
    if (match) {
      const idx = match.index ?? 0;
      const snippet = text.slice(Math.max(0, idx - 10), idx + 80).trim();
      claims.push({
        pattern: "fake_progress",
        confidence: 0.9,
        snippet: snippet.slice(0, 120),
      });
      break; // one fake progress match is enough
    }
  }

  return claims;
}

/**
 * Check if text is a legitimate plan/intent (overrides result claim detection).
 */
function isPlanDescription(text: string): boolean {
  return PLAN_PATTERNS.some((regex) => regex.test(text));
}

/**
 * Main detection function.
 *
 * Analyses step text for tool hallucinations:
 * 1. If toolCallCount > 0 → no hallucination (real tools were called)
 * 2. If no tool mentions in text → no hallucination
 * 3. If text is a plan description → no hallucination
 * 4. If text has tool mentions + result claims → HALLUCINATION
 */
export function detectToolHallucination(
  text: string,
  toolCallCount: number
): GuardianResult {
  const noDetection: GuardianResult = {
    detected: false,
    confidence: 0,
    details: [],
  };

  // Step had real tool calls → model is behaving correctly
  if (toolCallCount > 0) {
    return noDetection;
  }

  // No text to analyse
  if (!text || text.trim().length < 10) {
    return noDetection;
  }

  // Find tool mentions
  const toolMentions = findToolMentions(text);
  if (toolMentions.length === 0) {
    return noDetection;
  }

  // Check if this is a plan description (legitimate)
  if (isPlanDescription(text)) {
    return noDetection;
  }

  // Check for result claims
  const resultClaims = findResultClaims(text);
  if (resultClaims.length === 0) {
    return noDetection;
  }

  // Hallucination detected: tool mentioned + result claimed + no real tool calls
  const details: HallucinationDetail[] = [];
  for (const toolName of toolMentions) {
    for (const claim of resultClaims) {
      details.push({
        step: 0, // Will be set by step tracker
        confidence: claim.confidence,
        toolMentioned: toolName,
        pattern: claim.pattern,
        textSnippet: claim.snippet,
      });
    }
  }

  const maxConfidence = Math.max(...details.map((d) => d.confidence));

  return {
    detected: true,
    confidence: maxConfidence,
    details,
  };
}

// ============================================================================
// Step Tracker (for instrumentedStream integration)
// ============================================================================

export interface StepTracker {
  /** Call on step-start event: reset step state */
  reset(): void;
  /** Call on text-delta: accumulate text */
  addText(chunk: string): void;
  /** Call on tool-input-start: register a tool call */
  addToolCall(toolName: string): void;
  /** Call on step-finish: analyze the step and return result */
  analyze(): GuardianResult;
  /** Get all detections across all steps */
  getAllDetections(): GuardianFlags | null;
}

/**
 * Factory: creates a step tracker for use inside instrumentedStream.
 *
 * Usage:
 * ```ts
 * const tracker = createStepTracker({ context: 'chat' });
 * // Inside instrumentedStream:
 * // on step-start → tracker.reset()
 * // on text-delta → tracker.addText(chunk)
 * // on tool-input-start → tracker.addToolCall(toolName)
 * // on step-finish → const result = tracker.analyze()
 * //   if (result.detected) console.warn('[Guardian]', result)
 * // After stream ends:
 * // const flags = tracker.getAllDetections() // → for ai_usage_log
 * ```
 */
export function createStepTracker(options?: {
  context?: string;
}): StepTracker {
  const context = options?.context ?? "unknown";

  let stepNumber = 0;
  let stepText = "";
  let stepToolCallCount = 0;
  let hadStartResearch = false; // ТЗ-FIX2: startResearch calls tools internally
  const allDetections: HallucinationDetail[] = [];

  return {
    reset() {
      stepNumber++;
      stepText = "";
      stepToolCallCount = 0;
    },

    addText(chunk: string) {
      stepText += chunk;
    },

    addToolCall(toolName: string) {
      stepToolCallCount++;
      if (toolName === "startResearch") {
        hadStartResearch = true;
      }
    },

    analyze(): GuardianResult {
      const result = detectToolHallucination(stepText, stepToolCallCount);

      if (result.detected) {
        // ТЗ-FIX2: After startResearch completed in a previous step, the model
        // legitimately presents results that reference internal tools (deepResearch,
        // fetchUrl, readTelegramChannel). Filter out these false positives.
        if (hadStartResearch && stepToolCallCount === 0) {
          result.details = result.details.filter(
            (d) => !START_RESEARCH_INTERNAL_TOOLS.has(d.toolMentioned)
          );
          if (result.details.length === 0) {
            console.log(
              `[Guardian:${context}] Suppressed false positive after startResearch in step ${stepNumber}`
            );
            return { detected: false, confidence: 0, details: [] };
          }
          result.confidence = Math.max(
            ...result.details.map((d) => d.confidence)
          );
        }

        // Set step number on all details
        for (const detail of result.details) {
          detail.step = stepNumber;
        }
        allDetections.push(...result.details);

        console.warn(
          `[Guardian:${context}] Hallucination detected in step ${stepNumber}:`,
          {
            confidence: result.confidence,
            toolCallCount: stepToolCallCount,
            details: result.details.map((d) => ({
              tool: d.toolMentioned,
              pattern: d.pattern,
              snippet: d.textSnippet,
            })),
          }
        );
      }

      return result;
    },

    getAllDetections(): GuardianFlags | null {
      if (allDetections.length === 0) {
        return null;
      }
      return {
        detected: true,
        count: allDetections.length,
        details: allDetections,
      };
    },
  };
}

// ============================================================================
// Exports (for reference / testing)
// ============================================================================

export const TOOL_PATTERNS = {
  MONITORED_TOOLS,
  EXTERNAL_TOOL_NAMES,
  SERVICE_TOOL_NAMES,
  ALL_TOOL_PATTERNS,
  RESULT_CLAIM_VERBS,
  FAKE_PROGRESS_PATTERNS,
  PLAN_PATTERNS,
} as const;
