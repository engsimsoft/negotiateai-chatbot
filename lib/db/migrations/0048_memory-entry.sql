-- ТЗ-RAG0: pgvector extension + memory_entry table
-- Simply RAG infrastructure: vector search for MIND (chat memory)

-- Enable pgvector extension (Neon supports natively)
CREATE EXTENSION IF NOT EXISTS vector;

-- Memory entry table: stores facts extracted from conversations
CREATE TABLE IF NOT EXISTS "memory_entry" (
	"id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
	"userId" uuid NOT NULL REFERENCES "User"("id"),
	"content" text NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"category" varchar(32) NOT NULL,
	"confidence" numeric(3, 2) NOT NULL DEFAULT '1.00',
	"sourceType" varchar(32) NOT NULL,
	"sourceChatId" uuid REFERENCES "Chat"("id") ON DELETE SET NULL,
	"sourceProjectId" uuid REFERENCES "Project"("id") ON DELETE SET NULL,
	"supersededBy" uuid REFERENCES "memory_entry"("id") ON DELETE SET NULL,
	"createdAt" timestamp NOT NULL DEFAULT now(),
	"updatedAt" timestamp NOT NULL DEFAULT now()
);

-- HNSW index for approximate nearest neighbor search (cosine similarity)
CREATE INDEX IF NOT EXISTS "memory_entry_embedding_idx"
	ON "memory_entry"
	USING hnsw ("embedding" vector_cosine_ops)
	WITH (m = 16, ef_construction = 64);

-- Composite indexes for filtered queries
CREATE INDEX IF NOT EXISTS "memory_entry_user_category_idx"
	ON "memory_entry" ("userId", "category");

CREATE INDEX IF NOT EXISTS "memory_entry_user_created_idx"
	ON "memory_entry" ("userId", "createdAt");

-- Partial index: only active (non-superseded) entries
CREATE INDEX IF NOT EXISTS "memory_entry_active_idx"
	ON "memory_entry" ("userId")
	WHERE "supersededBy" IS NULL;
