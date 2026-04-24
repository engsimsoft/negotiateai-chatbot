/**
 * ТЗ-XAI-COL-1: tool `library_search` — поиск по Библиотеке пользователя.
 *
 * xAI Collections API (RAG из коробки). userId-scope внутри execute:
 * модель передаёт наши UUID collectionIds/fileIds, wrapper фильтрует по
 * ownership и конвертирует в xaiCollectionId/xaiFileId для вызова
 * `searchDocuments` из `lib/ai/library/xai-collections`.
 *
 * Интеграция в chat modes (A4, ANALYSIS П-3):
 *  - expertise / create / simply / project:expert:* — подключён стандартно
 *  - project task chat — подключён через `getStandardTools` (shared factory)
 *  - library-document (split-view) — отдельная factory `librarySearchForFile` (A6)
 *  - service-chats / briefing — НЕ подключать (M-1)
 */

import { tool } from "ai";
import { z } from "zod";

import {
  getDocumentCollectionIds,
  getLibraryCollectionById,
  getLibraryDocumentById,
  listCollectionsOwnedByUser,
  listDocumentsByXaiFileIds,
  listDocumentsOwnedByUser,
  listLibraryCollectionsByUser,
} from "@/lib/ai/library/db";
import { searchDocuments } from "@/lib/ai/library/xai-collections";
import type { XaiRetrievalMode } from "@/lib/ai/library/types";
import { wrapToolExecution } from "./tool-wrapper";

const DEFAULT_RETRIEVAL_MODE: XaiRetrievalMode = "hybrid";
const DEFAULT_MAX_RESULTS = 10;

export interface LibrarySearchParams {
  userId: string;
  /** При заданном — tool игнорирует collectionIds/fileIds от модели и ищет строго в этом файле (A6 split-view). */
  lockedFileId?: string;
  /**
   * A6.2: SourcePickerModal scope. Уже отвалидированные UUID нашей БД.
   * Если задан — модельные collectionIds/fileIds игнорируются, поиск
   * замыкается на эти источники. lockedFileId имеет приоритет над scope.
   */
  scopedSourceIds?: {
    collectionIds?: string[];
    documentIds?: string[];
  };
}

export const librarySearch = ({
  userId,
  lockedFileId,
  scopedSourceIds,
}: LibrarySearchParams) =>
  tool({
    description: `Поиск по Библиотеке пользователя — персональному архиву загруженных документов (договоры, отчёты, книги, статьи, презентации, таблицы).

Используй когда:
- пользователь спрашивает про свои документы, загруженные файлы, «мою библиотеку», «мой архив»
- упоминает конкретный документ по названию или описанию
- нужны точные цитаты из его материалов (например «что написано в договоре про сроки?»)
- тема связана с темой доступной коллекции (имена коллекций видны в системном контексте)

НЕ используй для:
- общих фактов из интернета (используй webSearch)
- документов проекта (используй readProjectFile)

Возвращает релевантные фрагменты текста (chunks) с цитатами в формате collections://{collection_id}/files/{file_id}.`,
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .describe("Поисковый запрос на естественном языке."),
      collectionIds: z
        .array(z.string().uuid())
        .optional()
        .describe(
          "UUID коллекций для ограничения поиска. Если не задан — поиск по всем коллекциям пользователя.",
        ),
      fileIds: z
        .array(z.string().uuid())
        .optional()
        .describe(
          "UUID конкретных документов для ограничения поиска. Взаимоисключает collectionIds.",
        ),
      maxNumResults: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .describe("Количество фрагментов (1-20, default 10)."),
    }),
    execute: wrapToolExecution(
      {
        name: "librarySearch",
        timeout: 15_000,
        enableLogging: true,
      },
      async ({ query, collectionIds, fileIds, maxNumResults }) => {
        let xaiCollectionIds: string[] | undefined;
        let xaiFileIds: string[] | undefined;
        // Map xaiFileId → наш UUID, чтобы UI-плашка citations открывала
        // /library/{docId} без отдельного round-trip.
        const xaiToDocumentId = new Map<string, string>();

        if (lockedFileId) {
          const doc = await getLibraryDocumentById(lockedFileId);
          if (!doc || doc.userId !== userId) {
            return { error: "Document is not accessible", chunks: [] };
          }
          xaiFileIds = [doc.xaiFileId];
          xaiToDocumentId.set(doc.xaiFileId, doc.id);
          // xAI требует collection_ids непустым. Берём коллекции, в которых
          // состоит документ; если документ «без коллекций» — fallback на все
          // коллекции юзера, чтобы запрос не улетал с 400.
          const ourCollectionIds = await getDocumentCollectionIds(doc.id);
          const xaiIds: string[] = [];
          for (const cid of ourCollectionIds) {
            const coll = await getLibraryCollectionById(cid);
            if (coll) xaiIds.push(coll.xaiCollectionId);
          }
          if (xaiIds.length > 0) {
            xaiCollectionIds = xaiIds;
          } else {
            const all = await listLibraryCollectionsByUser(userId);
            xaiCollectionIds = all.map((c) => c.xaiCollectionId);
          }
        } else if (
          scopedSourceIds &&
          ((scopedSourceIds.collectionIds?.length ?? 0) > 0 ||
            (scopedSourceIds.documentIds?.length ?? 0) > 0)
        ) {
          // A6.2: SourcePickerModal scope. UUID уже валидированы на route.ts,
          // но повторно резолвим в xAI-идентификаторы здесь — execute может
          // быть вызван из множества мест.
          if ((scopedSourceIds.collectionIds?.length ?? 0) > 0) {
            const owned = await listCollectionsOwnedByUser(
              userId,
              scopedSourceIds.collectionIds!,
            );
            const ids = owned.map((c) => c.xaiCollectionId);
            if (ids.length > 0) xaiCollectionIds = ids;
          }
          if ((scopedSourceIds.documentIds?.length ?? 0) > 0) {
            const owned = await listDocumentsOwnedByUser(
              userId,
              scopedSourceIds.documentIds!,
            );
            const ids: string[] = [];
            for (const doc of owned) {
              ids.push(doc.xaiFileId);
              xaiToDocumentId.set(doc.xaiFileId, doc.id);
            }
            if (ids.length > 0) xaiFileIds = ids;
          }
          // xAI требует collection_ids непустым. Если scope только из документов
          // без коллекций — добавим все коллекции юзера как обёртку.
          if (!xaiCollectionIds && xaiFileIds) {
            const all = await listLibraryCollectionsByUser(userId);
            xaiCollectionIds = all.map((c) => c.xaiCollectionId);
          }
        } else {
          if (collectionIds && collectionIds.length > 0) {
            const owned = await listCollectionsOwnedByUser(
              userId,
              collectionIds,
            );
            xaiCollectionIds = owned.map((c) => c.xaiCollectionId);
          }
          if (fileIds && fileIds.length > 0) {
            const ownedFileIds: string[] = [];
            for (const fid of fileIds) {
              const doc = await getLibraryDocumentById(fid);
              if (doc && doc.userId === userId) {
                ownedFileIds.push(doc.xaiFileId);
                xaiToDocumentId.set(doc.xaiFileId, doc.id);
              }
            }
            if (ownedFileIds.length > 0) xaiFileIds = ownedFileIds;
          }

          // Fallback: модель не указала targets → поиск по всем коллекциям пользователя
          // (xAI требует collection_ids обязательным непустым при отсутствии file_ids).
          if (!xaiCollectionIds && !xaiFileIds) {
            const all = await listLibraryCollectionsByUser(userId);
            xaiCollectionIds = all.map((c) => c.xaiCollectionId);
          }
        }

        console.log("[Library] search:", {
          query,
          xaiCollectionIds,
          xaiFileIds,
          locked: Boolean(lockedFileId),
        });

        if (
          (!xaiCollectionIds || xaiCollectionIds.length === 0) &&
          (!xaiFileIds || xaiFileIds.length === 0)
        ) {
          return { chunks: [], total: 0 };
        }

        const result = await searchDocuments({
          query,
          collectionIds: xaiCollectionIds,
          fileIds: xaiFileIds,
          retrievalMode: DEFAULT_RETRIEVAL_MODE,
          maxNumResults: maxNumResults ?? DEFAULT_MAX_RESULTS,
        });

        // A6.2: дозаполняем xaiFileId → наш documentId для chunks, чьи файлы
        // не были известны заранее (например, при поиске по всей коллекции).
        const unknownXaiIds = Array.from(
          new Set(
            result.chunks
              .map((c) => c.fileId)
              .filter((id) => !xaiToDocumentId.has(id)),
          ),
        );
        if (unknownXaiIds.length > 0) {
          const docs = await listDocumentsByXaiFileIds(userId, unknownXaiIds);
          for (const d of docs) xaiToDocumentId.set(d.xaiFileId, d.id);
        }

        console.log("[Library] search result:", {
          chunksCount: result.chunks.length,
          topScore: result.chunks[0]?.score ?? null,
          bottomScore: result.chunks[result.chunks.length - 1]?.score ?? null,
          files: Array.from(
            new Set(
              result.chunks.map(
                (c) =>
                  (typeof c.fields?.title === "string"
                    ? (c.fields.title as string)
                    : undefined) ?? c.fileId,
              ),
            ),
          ),
        });

        return {
          chunks: result.chunks.map((c) => ({
            content: c.content,
            score: c.score,
            citation: c.citation,
            fileId: c.fileId,
            // Наш UUID — для клика «открыть документ» в LibrarySourcesBadge.
            // Может быть undefined, если документ был удалён из БД, но xAI
            // ещё успел вернуть его в поиске.
            documentId: xaiToDocumentId.get(c.fileId),
            collectionId: c.collectionId,
            pageNumber: c.pageNumber,
            filename:
              typeof c.fields?.title === "string"
                ? (c.fields.title as string)
                : undefined,
          })),
          total: result.chunks.length,
        };
      },
    ),
  });
