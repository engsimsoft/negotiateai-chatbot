-- TZ_FilesAPIMigration / Шаг 4 миграции на xAI Files API.
-- Phase 2.2: новая таблица chat_attachment + новая колонка ai_usage_log.server_side_tool_calls.
--
-- chat_attachment хранит пару (xaiFileId, blobUrl) для каждого вложения в чате.
-- FK cascade на Chat и Message_v2 — при удалении чата записи уходят автоматически.
-- xai_file_id nullable: если xAI upload упал, остаётся только Blob backup.
--
-- server_side_tool_calls jsonb на ai_usage_log — точная разбивка
-- response.usage.server_side_tool_usage_details из xAI Responses API
-- (Phase 1.7 R6 находка: 1-6 document_search_calls per-turn).

CREATE TABLE "chat_attachment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chat_id" uuid NOT NULL,
  "message_id" uuid NOT NULL,
  "xai_file_id" text,
  "blob_url" text NOT NULL,
  "filename" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_attachment"
  ADD CONSTRAINT "chat_attachment_chat_id_Chat_id_fk"
  FOREIGN KEY ("chat_id") REFERENCES "public"."Chat"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_attachment"
  ADD CONSTRAINT "chat_attachment_message_id_Message_v2_id_fk"
  FOREIGN KEY ("message_id") REFERENCES "public"."Message_v2"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "chat_attachment_chat_id_idx"
  ON "chat_attachment" USING btree ("chat_id");
--> statement-breakpoint
CREATE INDEX "chat_attachment_xai_file_id_idx"
  ON "chat_attachment" USING btree ("xai_file_id");
--> statement-breakpoint
ALTER TABLE "ai_usage_log"
  ADD COLUMN "server_side_tool_calls" jsonb;
