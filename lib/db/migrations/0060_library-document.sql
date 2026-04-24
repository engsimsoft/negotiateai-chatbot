-- ТЗ-XAI-COL-1: Библиотека — таблица документов.
-- Файлы хранятся в xAI (xaiFileId), у нас — метадата для UI и фильтрации.
-- status: uploading | processing | ready | error (varchar без CHECK constraint —
-- расширяемость без миграций, SSOT значений в коде).
-- autoType свободный текст (TEXT без CHECK) — расширяемость списка автотипов
-- без миграции. Список значений для LLM enforcing'ится Zod-enum'ом в коде (ANALYSIS К-3).

CREATE TABLE IF NOT EXISTS "library_document" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  "xaiFileId" text NOT NULL UNIQUE,
  "filename" varchar(512) NOT NULL,
  "mimeType" varchar(100) NOT NULL,
  "size" integer NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'uploading',
  "statusError" text,
  "autoType" text,
  "autoTags" jsonb,
  "autoDescription" text,
  "originalFileUrl" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "library_document_user_created_idx"
  ON "library_document" ("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "library_document_user_autotype_idx"
  ON "library_document" ("userId", "autoType");
