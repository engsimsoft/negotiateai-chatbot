import "server-only";

import { generateObject } from "ai";
import { z } from "zod";

import { getModel, getMaxOutputTokensForTask } from "@/lib/ai/getModel";
import { getDocumentMetadata, searchDocuments } from "./xai-collections";
import { updateLibraryDocumentPatch } from "./db";

const SUMMARY_QUERIES = [
  "основная тема, назначение документа, целевая аудитория",
  "главные разделы, структура, оглавление документа",
  "ключевые выводы, важные тезисы, главные идеи",
];

const MAX_CHUNKS_PER_QUERY = 8;
const MIN_SUMMARY_CHARS = 150;
const MAX_SUMMARY_CHARS = 2500;
// xAI индексация большого PDF (400+ страниц) занимает 2-5 минут. Окно polling
// должно покрывать худший случай: 20 попыток × 30 сек = 10 минут. Fire-and-forget,
// поэтому долгое ожидание не блокирует пользователя.
const INDEX_WAIT_MAX_ATTEMPTS = 20;
const INDEX_WAIT_DELAY_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Собирает разнообразные chunks через librarySearch по трём запросам-срезам,
 * объединяет (deduplicated), просит LLM написать структурный обзор 300-400 слов.
 * Работает для документа любой длины — охватывает весь текст через индекс xAI,
 * а не только первые N символов (в отличие от auto-analyze).
 */
export async function generateDocumentSummary(params: {
  documentId: string;
  xaiFileId: string;
  xaiCollectionId: string;
  filename: string;
}): Promise<string | null> {
  // Ждём пока xAI доведёт документ до DOCUMENT_STATUS_PROCESSED (честнее, чем
  // пинговать search): getDocumentMetadata возвращает `status` и `chunk_count`.
  // Для 400-страничного PDF indexing идёт 2-5 минут, окно 10 минут это закрывает.
  let isReady = false;
  for (let attempt = 1; attempt <= INDEX_WAIT_MAX_ATTEMPTS; attempt++) {
    try {
      const meta = await getDocumentMetadata(
        params.xaiCollectionId,
        params.xaiFileId,
      );
      const status = meta.status;
      const chunks = Number(meta.chunks_processed_count ?? 0);
      console.log(
        `[Library summary] poll attempt=${attempt}/${INDEX_WAIT_MAX_ATTEMPTS} file=${params.xaiFileId} status=${status} chunks=${chunks}`,
      );
      if (status === "DOCUMENT_STATUS_FAILED") {
        console.warn(
          `[Library summary] xAI reports FAILED for file=${params.xaiFileId} error=${meta.error_message ?? "(none)"}`,
        );
        return null;
      }
      if (status === "DOCUMENT_STATUS_PROCESSED" && chunks > 0) {
        isReady = true;
        // Обновляем status сразу — не ждём завершения summary-генерации.
        // UI viewer-polling может прекратиться после N неудачных попыток,
        // поэтому важно прописать ready в БД как только xAI подтвердил indexing.
        await updateLibraryDocumentPatch(params.documentId, {
          status: "ready",
        }).catch((err) =>
          console.warn(
            "[Library summary] failed to set status=ready:",
            err instanceof Error ? err.message : err,
          ),
        );
        break;
      }
    } catch (error) {
      console.warn(
        `[Library summary] poll attempt=${attempt} metadata error:`,
        error instanceof Error ? error.message : error,
      );
    }
    if (attempt < INDEX_WAIT_MAX_ATTEMPTS) await sleep(INDEX_WAIT_DELAY_MS);
  }

  if (!isReady) {
    console.warn(
      `[Library summary] indexing did not complete in ${(INDEX_WAIT_MAX_ATTEMPTS * INDEX_WAIT_DELAY_MS) / 1000}s for file=${params.xaiFileId}`,
    );
    return null;
  }

  const chunksMap = new Map<string, string>();
  for (const query of SUMMARY_QUERIES) {
    const res = await searchDocuments({
      query,
      collectionIds: [params.xaiCollectionId],
      fileIds: [params.xaiFileId],
      maxNumResults: MAX_CHUNKS_PER_QUERY,
    });
    for (const chunk of res.chunks) {
      chunksMap.set(chunk.chunkId, chunk.content);
    }
  }

  if (chunksMap.size === 0) {
    console.warn(
      `[Library summary] search returned 0 chunks despite PROCESSED status for file=${params.xaiFileId}`,
    );
    return null;
  }

  console.log(
    `[Library summary] collected ${chunksMap.size} unique chunks for file=${params.xaiFileId}`,
  );

  const chunksText = Array.from(chunksMap.values()).join("\n\n---\n\n");

  const { object } = await generateObject({
    model: getModel("library:generate-summary"),
    maxOutputTokens: getMaxOutputTokensForTask("library:generate-summary"),
    schema: z.object({
      summary: z.string().min(MIN_SUMMARY_CHARS).max(MAX_SUMMARY_CHARS),
    }),
    system:
      "Ты составляешь структурный обзор документа для карточки в приложении. " +
      "Получаешь набор цитат из разных частей документа и объединяешь их в связный текст. " +
      "Пиши только на основе цитат, без общих знаний из интернета или домыслов.",
    prompt: [
      `Имя файла: ${params.filename}`,
      "",
      "Цитаты из разных частей документа:",
      "",
      chunksText,
      "",
      "Составь обзор документа на русском (300-400 слов). Структура:",
      "- Абзац 1: о чём документ, его назначение и целевая аудитория.",
      "- Абзац 2: главные разделы или темы, которые в нём раскрываются.",
      "- Абзац 3: ключевые идеи или выводы.",
      "",
      "Не начинай с фраз «Документ описывает...», «Данный документ...» — сразу по сути.",
      "Пиши плотно, без воды. Используй только факты из цитат.",
    ].join("\n"),
  });

  return object.summary;
}

/**
 * Fire-and-forget: запускает generateDocumentSummary и сохраняет в БД.
 * Любая ошибка логируется, но не пробрасывается — upload не должен падать
 * из-за проблем с summary. Запускается после успешного attach в xAI.
 */
export async function generateAndSaveSummary(params: {
  documentId: string;
  xaiFileId: string;
  xaiCollectionId: string;
  filename: string;
}): Promise<void> {
  try {
    const summary = await generateDocumentSummary({
      documentId: params.documentId,
      xaiFileId: params.xaiFileId,
      xaiCollectionId: params.xaiCollectionId,
      filename: params.filename,
    });
    if (!summary) {
      console.warn(
        `[Library summary] no chunks returned for doc=${params.documentId}`,
      );
      return;
    }
    await updateLibraryDocumentPatch(params.documentId, { autoSummary: summary });
    console.log(
      `[Library summary] saved ${summary.length} chars for doc=${params.documentId}`,
    );
  } catch (error) {
    console.warn(
      `[Library summary] generation failed for doc=${params.documentId}:`,
      error instanceof Error ? error.message : error,
    );
  }
}
