// ТЗ-Briefing-1: Stage 2 — Generate article using MiniMax M2.7
// (migrated from Claude Sonnet 4.6, generateObject → generateText + JSON.parse + Zod)

import fs from "fs";
import path from "path";
import { streamText } from "ai";
import { z } from "zod";
import type { ModelCatalog } from "tokenlens/core";
import { buildAiCallTrace, type PipelineStageTrace } from "@/lib/ai/pipeline-trace";
import { retryWithLogging } from "@/lib/ai/retry-with-logging";
import {
  getModel,
  getModelIdForTask,
  getProviderForTask,
} from "@/lib/ai/getModel";

const BRIEFING_AUTHOR_TASK = "briefing:author" as const;
import type { FilteredItem } from "./briefing-filter";
import type { RawContent } from "./source-fetchers/types";
import type { BriefingArticle, BriefingArticleSection } from "./briefing-types";
import type { BriefingTopic } from "@/lib/db/schema";

// Load prompt template from .md file (once at module init)
const PROMPT_PATH = path.join(
  process.cwd(),
  "lib",
  "prompts",
  "briefing",
  "briefing-author.md",
);
const SYSTEM_PROMPT = fs.readFileSync(PROMPT_PATH, "utf-8");

// --- Zod schemas for BriefingArticle ---

const articleSourceSchema = z.object({
  title: z.string(),
  url: z.string(),
  sourceName: z.string(),
  tier: z.string(),
  summary: z.string(),
});

const articleSectionSchema = z.object({
  topicId: z.string(),
  topicName: z.string(),
  emoji: z.string(),
  content: z.string(),
  newsCount: z.number(),
  sources: z.array(articleSourceSchema),
});

const articleMetaSchema = z.object({
  totalNews: z.number(),
  topicsCount: z.number(),
  readingTimeMinutes: z.number(),
});

const briefingArticleSchema = z.object({
  title: z.string(),
  intro: z.string(),
  sections: z.array(articleSectionSchema),
  outro: z.string(),
  meta: articleMetaSchema,
});

// --- JSON schema description for prompt injection ---

const JSON_SCHEMA_DESCRIPTION = `{
  "title": "string — заголовок брифинга",
  "intro": "string — вступление (2-3 предложения)",
  "sections": [
    {
      "topicId": "string — id темы (из списка тем пользователя)",
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
    }
  ],
  "outro": "string — заключение (1-2 предложения)",
  "meta": {
    "totalNews": "number — общее количество новостей",
    "topicsCount": "number — количество тем",
    "readingTimeMinutes": "number — оценка времени чтения"
  }
}`;

const JSON_INSTRUCTION = `

Ответь строго в формате JSON. Без markdown-обёртки (\`\`\`json), без пояснений до или после JSON.

JSON-схема ответа:
${JSON_SCHEMA_DESCRIPTION}`;

// --- Tier mapping (old catalog names → prompt names) ---

const TIER_MAP: Record<string, string> = {
  original: "flagship",
  analytics: "respected",
  derivative: "niche",
};

function normalizeTier(tier: string): string {
  return TIER_MAP[tier] ?? tier;
}

// --- Russian day of week ---

const RUSSIAN_DAYS = [
  "воскресенье",
  "понедельник",
  "вторник",
  "среда",
  "четверг",
  "пятница",
  "суббота",
];

/** ТЗ-BF5: Previous briefing data for dedup context */
export interface PreviousBriefing {
  generatedAt: string;
  article: BriefingArticle;
}

interface AuthorInput {
  candidates: FilteredItem[];
  fullTexts: Map<string, RawContent>;
  tierMap: Map<string, string>;
  userTopics: BriefingTopic[];
  language: string;
  maxItems: number;
  volume?: string;
  date: string;
  /** ТЗ-BF5: Previous briefing for dedup (null = first generation) */
  previousBriefing?: PreviousBriefing | null;
  /** ТЗ-CACHE2: userId for usage logging */
  userId?: string;
  /** ТЗ-CACHE3: TokenLens catalog for SSOT cost calculation */
  catalog?: ModelCatalog;
}

// --- Max output tokens by volume (detailed needs room for 3000-6000 words) ---

const MAX_TOKENS_BY_VOLUME: Record<string, number> = {
  compact: 8192, // 3-5 min, default is enough
  standard: 16384, // 8-12 min
  detailed: 32768, // 15-25 min, with headroom for structured JSON
};

/**
 * Stage 2: Generate briefing article using MiniMax M2.7.
 * System prompt = persona + rules (from .md file) + JSON schema instruction.
 * User message = formatted candidates + user settings + date.
 * Pattern: generateText → JSON.parse → Zod validation (same as MIND pipeline).
 */
export async function generateArticle(
  input: AuthorInput,
): Promise<{ article: BriefingArticle; tokensUsed: number; trace?: PipelineStageTrace }> {
  const { candidates, fullTexts, tierMap, userTopics, language, maxItems, volume, date, previousBriefing, userId, catalog } =
    input;

  if (candidates.length === 0) {
    return {
      article: {
        title: `Утренний брифинг · ${formatDateRussian(date)}`,
        intro: "Сегодня без новостей — все источники молчат.",
        sections: [],
        outro: "Хорошего дня!",
        meta: { totalNews: 0, topicsCount: 0, readingTimeMinutes: 0 },
      },
      tokensUsed: 0,
    };
  }

  const userMessage = buildUserMessage(
    candidates,
    fullTexts,
    tierMap,
    userTopics,
    language,
    maxItems,
    volume,
    date,
    previousBriefing,
  );

  const maxTokens = MAX_TOKENS_BY_VOLUME[volume ?? "standard"] ?? MAX_TOKENS_BY_VOLUME.standard;
  const startTime = Date.now();
  const warnings: string[] = [];
  const resolvedModelId = getModelIdForTask(BRIEFING_AUTHOR_TASK);

  // ТЗ-Briefing-1: generateText + JSON.parse + Zod (briefing:author task)
  // JSON.parse and Zod.parse inside callback — errors trigger automatic retry via retryWithLogging
  const { result: article, usage, attempts, totalDurationMs } = await retryWithLogging(
    async () => {
      const res = streamText({
        model: getModel(BRIEFING_AUTHOR_TASK),
        // ТЗ-CachePipelineMetrics: 2 cache breakpoints (static system + last user).
        // Паттерн из ADR 050. MiniMax после v3.85.0 Anthropic-compat режиме
        // поддерживает providerOptions.anthropic.cacheControl нативно.
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT + JSON_INSTRUCTION,
            providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
          },
          {
            role: "user",
            content: userMessage,
            providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
          },
        ],
        maxOutputTokens: maxTokens,
        temperature: 0.7,
        maxRetries: 0,
      });
      // Consume stream to get full text (keeps connection alive for thinking models)
      const text = await res.text;
      const usage = await res.usage;
      console.log(`[Briefing Author] model=${resolvedModelId} maxOutputTokens=${maxTokens} usage:`, JSON.stringify(usage));

      // Clean markdown wrapper and parse JSON
      const cleaned = text.replace(/```json\s*|```\s*/g, "").trim();
      const parsed = briefingArticleSchema.parse(JSON.parse(cleaned));

      // Deduplicate sections by topicId — M2.7 may create multiple sections for same topic
      const seen = new Map<string, number>();
      const deduped = parsed.sections.filter((section, idx) => {
        if (seen.has(section.topicId)) {
          // Merge content into first occurrence
          const firstIdx = seen.get(section.topicId)!;
          parsed.sections[firstIdx].content += "\n\n" + section.content;
          parsed.sections[firstIdx].newsCount += section.newsCount;
          parsed.sections[firstIdx].sources.push(...section.sources);
          return false;
        }
        seen.set(section.topicId, idx);
        return true;
      });
      parsed.sections = deduped;
      parsed.meta.topicsCount = deduped.length;

      return { result: parsed, usage };
    },
    {
      maxAttempts: 3,
      userId,
      modelId: resolvedModelId,
      provider: getProviderForTask(BRIEFING_AUTHOR_TASK),
      chatMode: "briefing:author",
    },
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
  // ТЗ-PIPELINE1: Attach per-attempt history for DevPanel retry visibility
  if (attempts.length > 1) {
    ai.attempts = attempts.map(a => ({ attempt: a.attempt, error: a.error, durationMs: a.durationMs }));
  }

  const trace: PipelineStageTrace = {
    stage: "author",
    startedAt: new Date(startTime).toISOString(),
    durationMs: totalDurationMs,
    ai,
    errors: [],
    warnings,
  };

  return { article, tokensUsed: ai.totalTokens, trace };
}

// --- Volume instruction block (pressure point #2: top of user message) ---

function getVolumeInstruction(volume: string): string {
  switch (volume) {
    case "compact":
      return `## ТРЕБОВАНИЕ К ОБЪЁМУ: COMPACT
Общий объём: 600-1200 слов (3-5 минут чтения).
Каждая секция: 80-150 слов (обычная), 150-250 слов (приоритетная).
Стиль: кратко, только ключевые факты.`;

    case "detailed":
      return `## ТРЕБОВАНИЕ К ОБЪЁМУ: DETAILED
Общий объём: 3000-6000 слов (15-25 минут чтения).
Каждая секция: МИНИМУМ 400 слов (обычная), МИНИМУМ 700 слов (приоритетная).
Используй ВСЕ факты и цифры из полных текстов. Пиши развёрнуто: контекст, сравнения, аналитика, цитаты.
НЕ ОСТАНАВЛИВАЙСЯ пока не набрал минимум 3000 слов суммарно.`;

    default: // standard
      return `## ТРЕБОВАНИЕ К ОБЪЁМУ: STANDARD
Общий объём: 1500-3000 слов (8-12 минут чтения).
Каждая секция: 200-400 слов (обычная), 400-600 слов (приоритетная).`;
  }
}

// --- Build user message with all data ---

function buildUserMessage(
  candidates: FilteredItem[],
  fullTexts: Map<string, RawContent>,
  tierMap: Map<string, string>,
  userTopics: BriefingTopic[],
  language: string,
  maxItems: number,
  volume: string | undefined,
  date: string,
  previousBriefing?: PreviousBriefing | null,
): string {
  // Format date with Russian day of week
  const dateObj = new Date(date);
  const dayOfWeek = RUSSIAN_DAYS[dateObj.getUTCDay()];
  const dateFormatted = `${date} (${dayOfWeek})`;

  // Format topics with briefingStyle
  const topicsFormatted = userTopics
    .map((t) => {
      const base = `- ${t.emoji} ${t.topicName} (id: ${t.topicId})`;
      return t.briefingStyle ? `${base}: "${t.briefingStyle}"` : base;
    })
    .join("\n");

  // ТЗ-BF5: Collect URLs from previous briefing to mark repeat candidates
  const previousUrls = new Set<string>();
  if (previousBriefing) {
    for (const section of previousBriefing.article.sections) {
      for (const src of section.sources) {
        if (src.url) previousUrls.add(src.url);
      }
    }
  }

  // Format candidates (with repeat marking for dedup)
  let repeatCount = 0;
  const candidatesFormatted = candidates
    .map((c, i) => {
      const full = fullTexts.get(c.sourceItemId);
      const content = full?.content ?? "";
      const rawTier = tierMap.get(c.sourceName) ?? "unknown";
      const tier = normalizeTier(rawTier);
      const truncatedContent = content.length > 12000
        ? content.slice(0, 12000) + "..."
        : content;

      const isRepeat = previousUrls.has(c.url);
      if (isRepeat) repeatCount++;
      const repeatTag = isRepeat ? "\n- ⚠️ БЫЛ В ПРОШЛОМ ВЫПУСКЕ — используй только если есть существенное развитие" : "";

      return `[${i + 1}]
- Заголовок: ${c.title}
- URL: ${c.url}
- Источник: ${c.sourceName} (tier: ${tier})
- Тема: ${c.topicId}
- Краткое содержание: ${c.oneLinerSummary}${repeatTag}${truncatedContent ? `\n- Полный текст: ${truncatedContent}` : ""}`;
    })
    .join("\n\n---\n\n");

  if (repeatCount > 0) {
    console.log(`[Briefing Author] Dedup: ${repeatCount}/${candidates.length} candidates marked as repeats`);
  }

  // ТЗ-BF5: Build previous briefing block for dedup
  const repeatSummary = repeatCount > 0
    ? `\n⚠️ ${repeatCount} из ${candidates.length} кандидатов помечены как повторы (совпадение URL). Приоритет — оставшимся ${candidates.length - repeatCount} НОВЫМ кандидатам.\n`
    : "";
  const previousBlock =
    previousBriefing && previousBriefing.article.sections.length > 0
      ? `\n---\n\n## Предыдущий выпуск (${formatDateRussian(previousBriefing.generatedAt)})\n\nВчера читатель уже видел:\n${buildPreviousHeadlines(previousBriefing.article)}\n${repeatSummary}`
      : "";

  return `${getVolumeInstruction(volume ?? "standard")}

Дата: ${dateFormatted}
Язык: ${language}
Целевое количество новостей: ${maxItems}

Темы пользователя:
${topicsFormatted}
${previousBlock}
---

Кандидаты (${candidates.length}):

${candidatesFormatted}`;
}

// --- ТЗ-BF5: Format previous briefing headlines for dedup context ---

/**
 * Build a formatted list of headlines from the previous briefing.
 * Uses sources[].title (structured data) with fallback to first 10 words of content.
 * Exported for reuse in briefing-section-author.ts.
 */
export function buildPreviousHeadlines(article: BriefingArticle): string {
  return article.sections
    .map((s) => {
      const headlines =
        s.sources.length > 0
          ? s.sources.map((src) => `«${src.title}»`).join(", ")
          : `«${s.content.split(/\s+/).slice(0, 10).join(" ")}…»`;
      return `- ${s.emoji} ${s.topicName}: ${headlines}`;
    })
    .join("\n");
}

// --- Format date in Russian ---

function formatDateRussian(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
}
