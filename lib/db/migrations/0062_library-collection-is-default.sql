-- ТЗ-XAI-COL-1: default коллекция «Мои документы» — lazy-create при upload
-- без явного collectionIds. Причина: xAI Collections индексирует файлы только
-- внутри коллекций, файл без коллекции выпадает из search index.
-- Partial unique index гарантирует одну default коллекцию на пользователя.

ALTER TABLE "library_collection"
  ADD COLUMN "isDefault" boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "library_collection_user_default_unique"
  ON "library_collection" ("userId")
  WHERE "isDefault" = true;
