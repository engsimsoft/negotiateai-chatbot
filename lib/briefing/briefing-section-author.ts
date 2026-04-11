// ТЗ-Briefing-1: Generate a single briefing section using MiniMax M2.7
// (migrated from Claude Sonnet 4.6, generateObject → generateText + JSON.parse + Zod)

import fs from "fs";
import path from "path";
import { streamText } from "ai";
import { z } from "zod";
import type { LanguageModelUsage } from "ai";
import type { ModelCatalog } from "tokenlens/core";
import { buildAiCallTrace, type PipelineStageTrace } from "@/lib/ai/pipeline-trace";
import { retryWithLogging } from "@/lib/ai/retry-with-logging";
import {
  getModel,
  getModelIdForTask,
} from "@/lib/ai/getModel";

const BRIEFING_SECTION_TASK = "briefing:section" as const;
import type { FilteredItem } from "./briefing-filter";
import type { RawContent } from "./source-fetchers/types";
import type { BriefingArticleSection } from "./briefing-types";
import type { BriefingTopic } from "@/lib/db/schema";

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

const REFRESH_SECTION_PROMPT = `${BASE_SYSTEM_PROMPT}

---

## РЕЖИМ: ОБНОВЛЕНИЕ ОДНОЙ СЕКЦИИ

Ты обновляешь ОДНУ конкретную тему из брифинга. Остальные темы уже написаны.

Правила:
1. Пиши ТОЛЬКО одну секцию для указанной темы
2. Сохраняй тот же стиль и тон, что и в остальных секциях
3. Не пиши intro, outro или meta — только секцию
4. topicId, topicName и emoji должны совпадать с запрошенными
`;

const MAP_REDUCE_SECTION_PROMPT = `${BASE_SYSTEM_PROMPT}

---

## РЕЖИМ: НАПИСАНИЕ СЕКЦИИ ДЛЯ НОВОГО БРИФИНГА

Ты пишешь ПОЛНОЦЕННУЮ секцию для нового утреннего брифинга. Это не обновление — это первичное написание.

Правила:
1. Пиши ТОЛЬКО одну секцию для указанной темы
2. Используй ВСЕ предоставленные кандидаты — каждый должен быть отражён в тексте
3. Не пиши intro, outro или meta — только секцию
4. topicId, topicName и emoji должны совпадать с запрошенными
5. Пиши полноценную журналистскую мини-статью: контекст, цифры, аналитика
6. НЕ пропускай кандидаты. Если их 7 — все 7 должны быть упомянуты в тексте
`;

// --- JSON schema description for prompt injection ---

const SECTION_JSON_INSTRUCTION = `

Ответь строго в формате JSON. Без markdown-обёртки (\`\`\`json), без пояснений до или после JSON.

JSON-схема ответа:
{
  "topicId": "string — id темы",
  "topicName": "string — название темы",
  "emoji": "string — эмодзи темы",
  "content": "string — текст секции (markdown)",
  "newsCount": "number — количество новостей в секции",
  "sources": [
    {
      "title": "string — заголовок источника",
      "url": "string — URL источника",
      "sourceName": "string — название издания",
      "tier": "string — уровень (flagship/respected/niche/community)",
      "summary": "string — краткое описание что взято из этого источника"
    }
  ]
}`;

interface SectionAuthorInput {
  candidates: FilteredItem[];
  fullTexts: Map<string, RawContent>;
  tierMap: Map<string, string>;
  topic: BriefingTopic;
  otherTopicNames: string[];
  volume?: string;
  /** "refresh" = per-section refresh (default), "initial" = Map-Reduce new briefing */
  mode?: "refresh" | "initial";
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
 * Pattern: generateText → JSON.parse → Zod validation (MiniMax M2.7).
 */
export async function generateSection(
  input: SectionAuthorInput,
): Promise<{ section: BriefingArticleSection; tokensUsed: number; trace?: PipelineStageTrace }> {
  const { candidates, fullTexts, tierMap, topic, otherTopicNames, volume, mode = "refresh", previousTopicHeadlines, previousUrls, userId, catalog } = input;
  const systemPrompt = mode === "initial" ? MAP_REDUCE_SECTION_PROMPT : REFRESH_SECTION_PROMPT;

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

  // ТЗ-Briefing-1: generateText + JSON.parse + Zod (MiniMax M2.7)
  // JSON.parse and Zod.parse inside callback — errors trigger automatic retry
  const resolvedModelId = getModelIdForTask(BRIEFING_SECTION_TASK);

  const { result: section, usage, attempts, totalDurationMs } = await retryWithLogging(
    async () => {
      const res = streamText({
        model: getModel(BRIEFING_SECTION_TASK),
        system: systemPrompt + SECTION_JSON_INSTRUCTION,
        prompt: userMessage,
        maxOutputTokens: 8192,
        temperature: 0.7,
        maxRetries: 0,
      });
      // Consume stream to get full text (keeps connection alive for thinking models)
      const text = await res.text;
      const usage = await res.usage;
      console.log(`[Section Author] model=${resolvedModelId} usage:`, JSON.stringify(usage));

      // Clean markdown wrapper and parse JSON
      const cleaned = text.replace(/```json\s*|```\s*/g, "").trim();
      const parsed = sectionSchema.parse(JSON.parse(cleaned));

      return { result: parsed, usage };
    },
    { maxAttempts: 3, userId, modelId: resolvedModelId, chatMode: "briefing:section-author" },
  );

  const retryCount = attempts.length - 1;
  if (retryCount > 0) {
    warnings.push(`Retried ${retryCount} time(s). Errors: ${attempts.filter(a => a.error).map(a => a.error).join("; ")}`);
  }

  const ai = buildAiCallTrace(
    {
      modelId: resolvedModelId,
      usage,
      finishReason: "stop",
      promptPreview: userMessage.slice(0, 500),
      retryCount,
      durationMs: totalDurationMs,
    },
    catalog,
  );
  if (attempts.length > 1) {
    ai.attempts = attempts.map(a => ({ attempt: a.attempt, error: a.error, durationMs: a.durationMs }));
  }

  const trace: PipelineStageTrace = {
    stage: "section-refresh",
    startedAt: new Date(startTime).toISOString(),
    durationMs: totalDurationMs,
    ai,
    errors: [],
    warnings,
  };

  return { section, tokensUsed: ai.totalTokens, trace };
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
