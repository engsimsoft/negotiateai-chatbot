-- ТЗ-XAI-COL-1: Библиотека — таблица коллекций пользователя.
-- Плоский список (без вложенности в MVP). userId-scoped. xaiCollectionId
-- хранит идентификатор от xAI Collections API (source of truth по содержимому).
-- documentCount — кэш для списка в UI без JOIN'а.

CREATE TABLE IF NOT EXISTS "library_collection" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  "xaiCollectionId" text NOT NULL UNIQUE,
  "name" varchar(255) NOT NULL,
  "emoji" varchar(10),
  "sortOrder" integer NOT NULL DEFAULT 0,
  "documentCount" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "library_collection_user_sort_idx"
  ON "library_collection" ("userId", "sortOrder");
