// ТЗ-Briefing-1: Stage 2 — Generate article using MiniMax M2.7
// (migrated from Claude Sonnet 4.6, generateObject → generateText + JSON.parse + Zod)

import fs from "fs";
import path from "path";
import { streamText } from "ai";
import { z } from "zod";
import type { ModelCatalog } from "tokenlens/core";
import { buildAiCallTrace, type PipelineStageTrace } from "@/lib/ai/pipeline-trace";
import { retryWithLogging } from "@/lib/ai/retry-with-logging";
import type { LanguageModelUsage } from "ai";
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

// =============================================================================
// ТЗ-MapReduce: Map-Reduce Briefing Author
// =============================================================================

import { generateSection } from "./briefing-section-author";
import pLimit from "p-limit";

// --- Intro/Outro JSON schema ---

const introOutroSchema = z.object({
  title: z.string(),
  intro: z.string(),
  outro: z.string(),
});

const INTRO_OUTRO_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

---

## РЕЖИМ: INTRO И OUTRO

Ты пишешь ТОЛЬКО title, intro и outro для брифинга. Секции УЖЕ написаны другими авторами.

На основе сводки секций ниже — создай:
- **title**: заголовок брифинга в формате "Утренний брифинг · [дата на русском]"
- **intro**: вступление (2-3 предложения). Свяжи все темы, задай тон дня. Не перечисляй темы списком — напиши как журналист.
- **outro**: заключение (1-2 предложения, лёгкий тон). Пожелание хорошего дня.

НЕ пиши секции. НЕ пиши meta. ТОЛЬКО title, intro, outro.`;

const INTRO_OUTRO_JSON_INSTRUCTION = `

Ответь строго в формате JSON. Без markdown-обёртки.

{"title": "string", "intro": "string", "outro": "string"}`;

/**
 * Group candidates by topicId for per-topic section generation.
 */
function groupCandidatesByTopic(
  candidates: FilteredItem[],
  userTopics: BriefingTopic[],
): Map<string, FilteredItem[]> {
  const groups = new Map<string, FilteredItem[]>();
  for (const topic of userTopics) {
    groups.set(topic.topicId, []);
  }
  for (const c of candidates) {
    const group = groups.get(c.topicId);
    if (group) {
      group.push(c);
    } else {
      // Unknown topicId — assign to first topic
      const firstId = userTopics[0]?.topicId;
      if (firstId) groups.get(firstId)!.push(c);
    }
  }
  return groups;
}

/**
 * Extract per-topic headlines from previous briefing for dedup context.
 */
function getTopicHeadlines(
  previousBriefing: PreviousBriefing | null | undefined,
  topicId: string,
): string | null {
  if (!previousBriefing) return null;
  const section = previousBriefing.article.sections.find(
    (s) => s.topicId === topicId,
  );
  if (!section || section.sources.length === 0) return null;
  return section.sources.map((src) => `«${src.title}»`).join(", ");
}

/**
 * Collect all URLs from previous briefing for repeat candidate marking.
 */
function getPreviousUrls(
  previousBriefing: PreviousBriefing | null | undefined,
): Set<string> {
  const urls = new Set<string>();
  if (!previousBriefing) return urls;
  for (const section of previousBriefing.article.sections) {
    for (const src of section.sources) {
      if (src.url) urls.add(src.url);
    }
  }
  return urls;
}

/**
 * Generate intro/outro via a lightweight M2.7 call.
 * Input: section summaries (~2K tokens). Output: title + intro + outro.
 */
async function generateIntroOutro(
  sections: BriefingArticleSection[],
  volume: string,
  date: string,
  language: string,
  userId?: string,
  catalog?: ModelCatalog,
): Promise<{ title: string; intro: string; outro: string; tokensUsed: number; trace?: PipelineStageTrace }> {
  const sectionSummaries = sections
    .map(
      (s) =>
        `- ${s.emoji} ${s.topicName}: ${s.newsCount} новостей. ${s.content.slice(0, 150)}...`,
    )
    .join("\n");

  const dateFormatted = formatDateRussian(date);
  const userMessage = `Дата: ${dateFormatted}
Язык: ${language}
Объём: ${volume}
Количество тем: ${sections.length}

Секции брифинга:
${sectionSummaries}`;

  const startTime = Date.now();
  const resolvedModelId = getModelIdForTask(BRIEFING_AUTHOR_TASK);

  const { result, usage, attempts, totalDurationMs } = await retryWithLogging(
    async () => {
      const res = streamText({
        model: getModel(BRIEFING_AUTHOR_TASK),
        // ТЗ-CachePipelineMetrics: 2 cache breakpoints (ADR 050 pattern)
        messages: [
          {
            role: "system",
            content: INTRO_OUTRO_SYSTEM_PROMPT + INTRO_OUTRO_JSON_INSTRUCTION,
            providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
          },
          {
            role: "user",
            content: userMessage,
            providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
          },
        ],
        maxOutputTokens: 2048,
        temperature: 0.7,
        maxRetries: 0,
      });
      const text = await res.text;
      const usage = await res.usage;
      console.log(`[Briefing Intro/Outro] usage:`, JSON.stringify(usage));

      const cleaned = text.replace(/```json\s*|```\s*/g, "").trim();
      const parsed = introOutroSchema.parse(JSON.parse(cleaned));
      return { result: parsed, usage };
    },
    {
      maxAttempts: 3,
      userId,
      modelId: resolvedModelId,
      provider: getProviderForTask(BRIEFING_AUTHOR_TASK),
      chatMode: "briefing:intro-outro",
    },
  );

  const ai = buildAiCallTrace(
    {
      modelId: resolvedModelId,
      usage,
      finishReason: "stop",
      promptPreview: userMessage.slice(0, 300),
      retryCount: attempts.length - 1,
      durationMs: totalDurationMs,
    },
    catalog,
  );

  const trace: PipelineStageTrace = {
    stage: "intro-outro",
    startedAt: new Date(startTime).toISOString(),
    durationMs: totalDurationMs,
    ai,
    errors: [],
    warnings: [],
  };

  return {
    title: result.title,
    intro: result.intro,
    outro: result.outro,
    tokensUsed: ai.totalTokens,
    trace,
  };
}

/**
 * Assemble BriefingArticle from sections + intro/outro. Pure function.
 */
function assembleBriefingArticle(
  title: string,
  intro: string,
  sections: BriefingArticleSection[],
  outro: string,
): BriefingArticle {
  const totalNews = sections.reduce((sum, s) => sum + s.newsCount, 0);
  const totalWords = sections.reduce(
    (sum, s) => sum + s.content.split(/\s+/).length,
    0,
  );
  return {
    title,
    intro,
    sections,
    outro,
    meta: {
      totalNews,
      topicsCount: sections.length,
      readingTimeMinutes: Math.max(1, Math.round(totalWords / 200)),
    },
  };
}

/**
 * Map-Reduce Briefing Author.
 * Map: generateSection() per topic (sequential, pLimit(1))
 * Reduce: generateIntroOutro() from section summaries
 * Assemble: pure function
 */
export async function generateArticleMapReduce(
  input: AuthorInput,
  onSectionProgress?: (topicIdx: number, totalTopics: number, topicName: string) => void,
): Promise<{ article: BriefingArticle; tokensUsed: number; trace?: PipelineStageTrace }> {
  const { candidates, fullTexts, tierMap, userTopics, language, volume, date, previousBriefing, userId, catalog } = input;

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

  const startTime = Date.now();
  const groups = groupCandidatesByTopic(candidates, userTopics);
  const previousUrls = getPreviousUrls(previousBriefing);
  const allWarnings: string[] = [];
  const sectionTraces: PipelineStageTrace[] = [];

  // --- MAP: generate sections sequentially (pLimit(1) for API stability) ---
  const limit = pLimit(1);
  const topicsWithCandidates = userTopics.filter(
    (t) => (groups.get(t.topicId)?.length ?? 0) > 0,
  );

  console.log(
    `[Briefing Map-Reduce] ${topicsWithCandidates.length} topics with candidates, ${candidates.length} total candidates`,
  );

  const sectionResults = await Promise.allSettled(
    topicsWithCandidates.map((topic, idx) =>
      limit(async () => {
        // Delay between sections to avoid MiniMax API throttling
        if (idx > 0) {
          await new Promise((r) => setTimeout(r, 2000));
        }
        onSectionProgress?.(idx + 1, topicsWithCandidates.length, `${topic.emoji} ${topic.topicName}`);

        const otherTopicNames = userTopics
          .filter((t) => t.topicId !== topic.topicId)
          .map((t) => t.topicName);

        const topicHeadlines = getTopicHeadlines(previousBriefing, topic.topicId);

        const result = await generateSection({
          candidates: groups.get(topic.topicId)!,
          fullTexts,
          tierMap,
          topic,
          otherTopicNames,
          volume,
          mode: "initial",
          previousTopicHeadlines: topicHeadlines,
          previousUrls,
          userId,
          catalog,
        });

        console.log(
          `[Briefing Map-Reduce] Section "${topic.topicName}": ${result.section.newsCount} news, ${result.tokensUsed} tokens`,
        );

        return result;
      }),
    ),
  );

  // Collect successful sections, log failures
  const sections: BriefingArticleSection[] = [];
  let mapTokens = 0;

  for (let i = 0; i < sectionResults.length; i++) {
    const result = sectionResults[i];
    const topic = topicsWithCandidates[i];
    if (result.status === "fulfilled") {
      sections.push(result.value.section);
      mapTokens += result.value.tokensUsed;
      if (result.value.trace) sectionTraces.push(result.value.trace);
    } else {
      const errorMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error(`[Briefing Map-Reduce] Section "${topic.topicName}" failed: ${errorMsg}`);
      allWarnings.push(`Section "${topic.topicName}" failed: ${errorMsg}`);
    }
  }

  if (sections.length === 0) {
    throw new Error("All sections failed to generate");
  }

  // --- REDUCE: generate intro/outro ---
  const { title, intro, outro, tokensUsed: reduceTokens, trace: introOutroTrace } = await generateIntroOutro(
    sections,
    volume ?? "standard",
    date,
    language,
    userId,
    catalog,
  );

  // --- ASSEMBLE ---
  const article = assembleBriefingArticle(title, intro, sections, outro);
  const totalTokens = mapTokens + reduceTokens;
  const totalDurationMs = Date.now() - startTime;

  console.log(
    `[Briefing Map-Reduce] Done: ${sections.length} sections, ${totalTokens} tokens, ${Math.round(totalDurationMs / 1000)}s`,
  );

  // Build composite trace
  const trace: PipelineStageTrace = {
    stage: "author",
    startedAt: new Date(startTime).toISOString(),
    durationMs: totalDurationMs,
    ai: introOutroTrace?.ai ?? {
      modelId: getModelIdForTask(BRIEFING_AUTHOR_TASK),
      promptPreview: "(map-reduce)",
      noCacheInputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      totalTokens,
      costRub: 0,
      finishReason: "stop",
      retryCount: 0,
    },
    errors: [],
    warnings: allWarnings,
  };

  return { article, tokensUsed: totalTokens, trace };
}
