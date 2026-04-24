/**
 * ТЗ-XAI-COL-1: auto-analyze при upload документа в Библиотеку.
 *
 * Один вызов Grok 4.1 Fast (`library:auto-analyze`) через `generateObject`.
 * Zod enum для `autoType` — LLM возвращает одно из фиксированных значений
 * (ANALYSIS К-3). БД хранит как TEXT — список расширяется без миграции.
 */

import { generateObject } from "ai";
import { z } from "zod";

import {
  getMaxOutputTokensForTask,
  getModel,
  getModelIdForTask,
  getProviderForTask,
} from "@/lib/ai/getModel";
import { logUsage } from "@/lib/ai/usage-utils";

const LIBRARY_AUTO_ANALYZE_TASK = "library:auto-analyze" as const;

export const AUTO_TYPES = [
  "договор",
  "отчёт",
  "книга",
  "статья",
  "презентация",
  "инструкция",
  "таблица",
  "письмо",
  "заметка",
  "изображение",
  "другое",
] as const;

export type AutoType = (typeof AUTO_TYPES)[number];

const AUTO_ANALYZE_PROMPT = 3_000;

const schema = z.object({
  autoType: z.enum(AUTO_TYPES),
  autoTags: z.array(z.string().min(2).max(40)).min(3).max(5),
  autoDescription: z.string().min(10).max(200),
});

export interface AutoAnalyzeInput {
  userId: string;
  filename: string;
  mimeType: string;
  extractedText?: string;
  /** `pdf-scan` / изображение — текст недоступен */
  contentUnavailable?: boolean;
}

export interface AutoAnalyzeOutput {
  autoType: AutoType;
  autoTags: string[];
  autoDescription: string;
}

export async function autoAnalyzeDocument(
  input: AutoAnalyzeInput,
): Promise<AutoAnalyzeOutput> {
  const contentBlock = input.contentUnavailable
    ? "(содержимое недоступно — отсканированный PDF или изображение, делай вывод только из имени файла и MIME)"
    : (input.extractedText ?? "").slice(0, AUTO_ANALYZE_PROMPT);

  const prompt = [
    `Имя файла: ${input.filename}`,
    `MIME: ${input.mimeType}`,
    "",
    "Содержимое (первые символы):",
    contentBlock,
  ].join("\n");

  const system = [
    "Ты классификатор пользовательских документов в Библиотеке.",
    "По имени файла, MIME и фрагменту содержимого определи:",
    "- autoType: один из фиксированного списка категорий",
    "- autoTags: 3–5 коротких тегов на русском языке (существительные или фразы до 2 слов), раскрывающих содержание",
    "- autoDescription: одна фраза (до 200 символов) — о чём этот документ.",
    "Возвращай только JSON по schema, без пояснений.",
  ].join("\n");

  const startTime = Date.now();
  const { object, usage } = await generateObject({
    model: getModel(LIBRARY_AUTO_ANALYZE_TASK),
    maxOutputTokens: getMaxOutputTokensForTask(LIBRARY_AUTO_ANALYZE_TASK),
    maxRetries: 1,
    schema,
    system,
    prompt,
    temperature: 0.1,
  });

  logUsage({
    userId: input.userId,
    usage,
    modelId: getModelIdForTask(LIBRARY_AUTO_ANALYZE_TASK),
    provider: getProviderForTask(LIBRARY_AUTO_ANALYZE_TASK),
    chatMode: "library:auto-analyze",
    durationMs: Date.now() - startTime,
  });

  return object;
}
