-- ТЗ-XAI-COL-1: Библиотека — связь M:N документ ↔ коллекция.
-- Один документ может быть в нескольких коллекциях (two-step upload в xAI:
-- файл загружается один раз, привязывается к нескольким collection_id).
-- Документ БЕЗ записей в этой таблице = «без коллекции» (UI показывает в секции
-- «Все документы», см. ANALYSIS Q3 Вариант A).
-- Cascade DELETE: удаление коллекции или документа — связи чистятся автоматически.

CREATE TABLE IF NOT EXISTS "library_collection_document" (
  "collectionId" uuid NOT NULL REFERENCES "library_collection"("id") ON DELETE CASCADE,
  "documentId" uuid NOT NULL REFERENCES "library_document"("id") ON DELETE CASCADE,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("collectionId", "documentId")
);

CREATE INDEX IF NOT EXISTS "library_collection_document_document_idx"
  ON "library_collection_document" ("documentId");
