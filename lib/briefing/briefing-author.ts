// ТЗ-А3: Stage 2 — Generate article using Gemini 3 Pro
// Replaces briefing-analyzer.ts (JSON cards → narrative article)

import fs from "fs";
import path from "path";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
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

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
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

interface AuthorInput {
  candidates: FilteredItem[];
  fullTexts: Map<string, RawContent>;
  tierMap: Map<string, string>;
  userTopics: BriefingTopic[];
  language: string;
  maxItems: number;
  volume?: string;
  date: string;
}

// --- Max output tokens by volume (detailed needs room for 3000-6000 words) ---

const MAX_TOKENS_BY_VOLUME: Record<string, number> = {
  compact: 8192, // 3-5 min, default is enough
  standard: 16384, // 8-12 min
  detailed: 32768, // 15-25 min, with headroom for structured JSON
};

/**
 * Stage 2: Generate briefing article using Gemini 3 Pro.
 * System prompt = persona + rules (from .md file).
 * User message = formatted candidates + user settings + date.
 */
export async function generateArticle(
  input: AuthorInput,
): Promise<{ article: BriefingArticle; tokensUsed: number }> {
  const { candidates, fullTexts, tierMap, userTopics, language, maxItems, volume, date } =
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
  );

  const maxTokens = MAX_TOKENS_BY_VOLUME[volume ?? "standard"] ?? MAX_TOKENS_BY_VOLUME.standard;

  let object: BriefingArticle;
  let tokensUsed = 0;

  try {
    const result = await generateObject({
      model: google(AUTHOR_MODEL),
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
      model: google(AUTHOR_MODEL_FALLBACK),
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

  return `## Дата выпуска
${dateFormatted}

## Настройки пользователя
- Объём выпуска: ${volume ?? "standard"}
- Темы:
${topicsFormatted}
- Язык: ${language}
- Целевое количество: ${maxItems}

## Кандидаты (${candidates.length} шт.)

${candidatesFormatted}`;
}

// --- Format date in Russian ---

function formatDateRussian(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
}
