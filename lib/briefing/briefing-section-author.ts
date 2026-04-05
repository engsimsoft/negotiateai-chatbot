// ТЗ-BF4 + ТЗ-DEV2: Generate a single briefing section using Claude Sonnet

import fs from "fs";
import path from "path";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import type { LanguageModelUsage } from "ai";
import type { ModelCatalog } from "tokenlens/core";
import { waitUntil } from "@vercel/functions";
import { logUsage } from "@/lib/ai/usage-utils";
import { buildAiCallTrace, type PipelineStageTrace } from "@/lib/ai/pipeline-trace";
import { AUTHOR_MODEL, AUTHOR_MODEL_FALLBACK } from "./briefing-config";
import type { FilteredItem } from "./briefing-filter";
import type { RawContent } from "./source-fetchers/types";
import type { BriefingArticleSection } from "./briefing-types";
import type { BriefingTopic } from "@/lib/db/schema";

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Zod schema for a single section
const articleSourceSchema = z.object({
  title: z.string(),
  url: z.string(),
  sourceName: z.string(),
  tier: z.string(),
  summary: z.string(),
});

const sectionSchema = z.object({
  topicId: z.string(),
  topicName: z.string(),
  emoji: z.string(),
  content: z.string(),
  newsCount: z.number(),
  sources: z.array(articleSourceSchema),
});

// Tier mapping (same as briefing-author.ts)
const TIER_MAP: Record<string, string> = {
  original: "flagship",
  analytics: "respected",
  derivative: "niche",
};

function normalizeTier(tier: string): string {
  return TIER_MAP[tier] ?? tier;
}

// Load the main author prompt for style consistency
const PROMPT_PATH = path.join(
  process.cwd(),
  "lib",
  "prompts",
  "briefing",
  "briefing-author.md",
);
const BASE_SYSTEM_PROMPT = fs.readFileSync(PROMPT_PATH, "utf-8");

const SECTION_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

---

## РЕЖИМ: ОБНОВЛЕНИЕ ОДНОЙ СЕКЦИИ

Ты обновляешь ОДНУ конкретную тему из брифинга. Остальные темы уже написаны.

Правила:
1. Пиши ТОЛЬКО одну секцию для указанной темы
2. Сохраняй тот же стиль и тон, что и в остальных секциях
3. Не пиши intro, outro или meta — только секцию
4. topicId, topicName и emoji должны совпадать с запрошенными
`;

interface SectionAuthorInput {
  candidates: FilteredItem[];
  fullTexts: Map<string, RawContent>;
  tierMap: Map<string, string>;
  topic: BriefingTopic;
  otherTopicNames: string[];
  volume?: string;
  /** ТЗ-BF5: Headlines from previous briefing for this topic (formatted string) */
  previousTopicHeadlines?: string | null;
  /** ТЗ-BF5: URLs from previous briefing section sources (for candidate marking) */
  previousUrls?: Set<string>;
  /** ТЗ-CACHE2: userId for usage logging */
  userId?: string;
  /** ТЗ-CACHE3: TokenLens catalog for SSOT cost calculation */
  catalog?: ModelCatalog;
}

/**
 * Generate a single briefing section for per-topic refresh.
 */
export async function generateSection(
  input: SectionAuthorInput,
): Promise<{ section: BriefingArticleSection; tokensUsed: number; trace?: PipelineStageTrace }> {
  const { candidates, fullTexts, tierMap, topic, otherTopicNames, volume, previousTopicHeadlines, previousUrls, userId, catalog } = input;

  if (candidates.length === 0) {
    return {
      section: {
        topicId: topic.topicId,
        topicName: topic.topicName,
        emoji: topic.emoji,
        content: "Свежих новостей по этой теме пока нет.",
        newsCount: 0,
        sources: [],
      },
      tokensUsed: 0,
    };
  }

  const userMessage = buildSectionUserMessage(
    candidates,
    fullTexts,
    tierMap,
    topic,
    otherTopicNames,
    volume,
    previousTopicHeadlines,
    previousUrls,
  );

  const startTime = Date.now();
  const warnings: string[] = [];

  let object: BriefingArticleSection;
  let usage: LanguageModelUsage | undefined;
  let finishReason = "stop";
  let usedModel = AUTHOR_MODEL;
  let retryCount = 0;
  let fallbackUsed: string | undefined;
  let primaryError: string | undefined;

  try {
    const result = await generateObject({
      model: anthropic(AUTHOR_MODEL),
      schema: sectionSchema,
      system: SECTION_SYSTEM_PROMPT,
      prompt: userMessage,
      maxOutputTokens: 8192,
    });
    object = result.object;
    usage = result.usage;
    finishReason = result.finishReason ?? "stop";
    console.log(`[Section Author] model=${AUTHOR_MODEL} usage:`, JSON.stringify(result.usage));
  } catch (err) {
    primaryError = err instanceof Error ? err.message : String(err);
    console.warn(
      `[Section Author] Primary model ${AUTHOR_MODEL} failed, trying ${AUTHOR_MODEL_FALLBACK}:`,
      primaryError,
    );
    retryCount = 1;
    fallbackUsed = AUTHOR_MODEL_FALLBACK;
    usedModel = AUTHOR_MODEL_FALLBACK;
    warnings.push(`Primary model ${AUTHOR_MODEL} failed: ${primaryError}`);

    const result = await generateObject({
      model: anthropic(AUTHOR_MODEL_FALLBACK),
      schema: sectionSchema,
      system: SECTION_SYSTEM_PROMPT,
      prompt: userMessage,
      maxOutputTokens: 8192,
    });
    object = result.object;
    usage = result.usage;
    finishReason = result.finishReason ?? "stop";
  }

  const durationMs = Date.now() - startTime;

  // ТЗ-CACHE2+TOKENS1: Usage logging — real usage from AI SDK (not fake shape)
  if (userId && usage) {
    waitUntil(logUsage({
      userId,
      usage,
      modelId: usedModel,
      chatMode: "briefing:section-author",
      durationMs,
    }));
  }

  const ai = buildAiCallTrace(
    {
      modelId: usedModel,
      usage,
      finishReason,
      promptPreview: userMessage.slice(0, 500),
      retryCount,
      fallbackUsed,
      durationMs,
    },
    catalog,
  );
  ai.error = primaryError;

  const trace: PipelineStageTrace = {
    stage: "section-refresh",
    startedAt: new Date(startTime).toISOString(),
    durationMs,
    ai,
    errors: [],
    warnings,
  };

  return { section: object, tokensUsed: ai.totalTokens, trace };
}

// --- Volume instruction for single section ---

function getSectionVolumeInstruction(volume: string): string {
  switch (volume) {
    case "compact":
      return `Объём секции: 80-150 слов (обычная), 150-250 слов (приоритетная). Кратко, только ключевые факты.`;
    case "detailed":
      return `Объём секции: МИНИМУМ 400 слов (обычная), МИНИМУМ 700 слов (приоритетная). Развёрнуто: контекст, сравнения, аналитика, цитаты.`;
    default:
      return `Объём секции: 200-400 слов (обычная), 400-600 слов (приоритетная).`;
  }
}

// --- Build user message for section generation ---

function buildSectionUserMessage(
  candidates: FilteredItem[],
  fullTexts: Map<string, RawContent>,
  tierMap: Map<string, string>,
  topic: BriefingTopic,
  otherTopicNames: string[],
  volume: string | undefined,
  previousTopicHeadlines?: string | null,
  previousUrls?: Set<string>,
): string {
  const candidatesFormatted = candidates
    .map((c, i) => {
      const full = fullTexts.get(c.sourceItemId);
      const content = full?.content ?? "";
      const rawTier = tierMap.get(c.sourceName) ?? "unknown";
      const tier = normalizeTier(rawTier);
      const truncatedContent = content.length > 12000
        ? content.slice(0, 12000) + "..."
        : content;

      const isRepeat = previousUrls?.has(c.url) ?? false;
      const repeatTag = isRepeat ? "\n- ⚠️ БЫЛ В ПРОШЛОМ ВЫПУСКЕ — используй только если есть существенное развитие" : "";

      return `[${i + 1}]
- Заголовок: ${c.title}
- URL: ${c.url}
- Источник: ${c.sourceName} (tier: ${tier})
- Краткое содержание: ${c.oneLinerSummary}${repeatTag}${truncatedContent ? `\n- Полный текст: ${truncatedContent}` : ""}`;
    })
    .join("\n\n---\n\n");

  const styleNote = topic.briefingStyle
    ? `Стиль для этой темы: "${topic.briefingStyle}"`
    : "";

  // ТЗ-BF5: Previous headlines block for dedup
  const previousBlock = previousTopicHeadlines
    ? `\nВ прошлом выпуске по этой теме было:\n${previousTopicHeadlines}\n`
    : "";

  return `## Обнови секцию: ${topic.emoji} ${topic.topicName} (topicId: ${topic.topicId})

${getSectionVolumeInstruction(volume ?? "standard")}
${styleNote}

Другие темы в брифинге: ${otherTopicNames.join(", ") || "нет"}
${previousBlock}
---

Кандидаты для этой темы (${candidates.length}):

${candidatesFormatted}`;
}
