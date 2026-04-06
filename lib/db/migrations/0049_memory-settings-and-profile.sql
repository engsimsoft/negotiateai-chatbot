-- ТЗ-RAG2: Memory settings + User profile summary tables

-- Memory settings: per-user MIND configuration + consolidation tracking
CREATE TABLE IF NOT EXISTS "memory_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  "memoryEnabled" boolean NOT NULL DEFAULT true,
  "factsUpdatedSince" timestamp,
  "factsSinceConsolidation" integer NOT NULL DEFAULT 0,
  "lastConsolidatedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "memory_settings_userId_unique" UNIQUE("userId")
);

CREATE INDEX IF NOT EXISTS "memory_settings_user_idx" ON "memory_settings" ("userId");

-- User profile summary: Opus-generated narrative profile
CREATE TABLE IF NOT EXISTS "user_profile_summary" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  "content" text NOT NULL,
  "factCount" integer NOT NULL,
  "tokenCount" integer,
  "costUsd" numeric(10, 6),
  "modelId" varchar(64),
  "generatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "user_profile_summary_userId_unique" UNIQUE("userId")
);

CREATE INDEX IF NOT EXISTS "user_profile_summary_user_idx" ON "user_profile_summary" ("userId");
