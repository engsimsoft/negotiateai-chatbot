// ТЗ-BRIEFING-AUTHOR-CLAUDE: Stage 2 — Generate article using Claude Sonnet 4.6
// Replaces briefing-analyzer.ts (JSON cards → narrative article)

import fs from "fs";
import path from "path";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { AUTHOR_MODEL, AUTHOR_MODEL_FALLBACK } from "./briefing-config";
import type { FilteredItem } from "./briefing-filter";
import type { RawContent } from "./source-fetchers/types";
import type { BriefingArticle } from "./briefing-types";
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

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
}

// --- Max output tokens by volume (detailed needs room for 3000-6000 words) ---

const MAX_TOKENS_BY_VOLUME: Record<string, number> = {
  compact: 8192, // 3-5 min, default is enough
  standard: 16384, // 8-12 min
  detailed: 32768, // 15-25 min, with headroom for structured JSON
};

/**
 * Stage 2: Generate briefing article using Claude Sonnet 4.6.
 * System prompt = persona + rules (from .md file).
 * User message = formatted candidates + user settings + date.
 */
export async function generateArticle(
  input: AuthorInput,
): Promise<{ article: BriefingArticle; tokensUsed: number }> {
  const { candidates, fullTexts, tierMap, userTopics, language, maxItems, volume, date, previousBriefing } =
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

  let object: BriefingArticle;
  let tokensUsed = 0;

  try {
    // Note: thinking/effort not used here — Anthropic prohibits thinking when
    // tool_choice is forced (generateObject uses tool_choice internally)
    const result = await generateObject({
      model: anthropic(AUTHOR_MODEL),
      schema: briefingArticleSchema,
      system: SYSTEM_PROMPT,
      prompt: userMessage,
      maxOutputTokens: maxTokens,
    });
    object = result.object;
    tokensUsed = result.usage?.totalTokens ?? 0;
    console.log(`[Briefing Author] model=${AUTHOR_MODEL} maxOutputTokens=${maxTokens} usage:`, JSON.stringify(result.usage));
    console.log(`[Briefing Author] finishReason=${result.finishReason}`);
  } catch (err) {
    console.warn(
      `[Briefing] Primary model ${AUTHOR_MODEL} failed, trying ${AUTHOR_MODEL_FALLBACK}:`,
      err instanceof Error ? err.message : err,
    );
    const result = await generateObject({
      model: anthropic(AUTHOR_MODEL_FALLBACK),
      schema: briefingArticleSchema,
      system: SYSTEM_PROMPT,
      prompt: userMessage,
      maxOutputTokens: maxTokens,
    });
    object = result.object;
    tokensUsed = result.usage?.totalTokens ?? 0;
  }

  return { article: object, tokensUsed };
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

  // Format candidates
  const candidatesFormatted = candidates
    .map((c, i) => {
      const full = fullTexts.get(c.sourceItemId);
      const content = full?.content ?? "";
      const rawTier = tierMap.get(c.sourceName) ?? "unknown";
      const tier = normalizeTier(rawTier);
      const truncatedContent = content.length > 12000
        ? content.slice(0, 12000) + "..."
        : content;

      return `[${i + 1}]
- Заголовок: ${c.title}
- URL: ${c.url}
- Источник: ${c.sourceName} (tier: ${tier})
- Тема: ${c.topicId}
- Краткое содержание: ${c.oneLinerSummary}${truncatedContent ? `\n- Полный текст: ${truncatedContent}` : ""}`;
    })
    .join("\n\n---\n\n");

  // ТЗ-BF5: Build previous briefing block for dedup
  const previousBlock =
    previousBriefing && previousBriefing.article.sections.length > 0
      ? `\n---\n\n## Предыдущий выпуск (${formatDateRussian(previousBriefing.generatedAt)})\n\nВчера читатель уже видел:\n${buildPreviousHeadlines(previousBriefing.article)}\n`
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
