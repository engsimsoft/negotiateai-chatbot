CREATE TABLE IF NOT EXISTS "ai_usage_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatId" uuid,
	"userId" uuid NOT NULL,
	"modelId" varchar(100) NOT NULL,
	"inputTokens" integer DEFAULT 0 NOT NULL,
	"outputTokens" integer DEFAULT 0 NOT NULL,
	"thinkingTokens" integer DEFAULT 0 NOT NULL,
	"cacheWriteTokens" integer DEFAULT 0 NOT NULL,
	"cacheReadTokens" integer DEFAULT 0 NOT NULL,
	"costUsd" numeric(10, 6),
	"chatMode" varchar(50) NOT NULL,
	"durationMs" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_usage_log" ADD CONSTRAINT "ai_usage_log_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_usage_log" ADD CONSTRAINT "ai_usage_log_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_log_user_created_idx" ON "ai_usage_log" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_log_chatmode_created_idx" ON "ai_usage_log" USING btree ("chatMode","createdAt");
