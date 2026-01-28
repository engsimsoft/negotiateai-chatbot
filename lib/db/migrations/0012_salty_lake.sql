DO $$ BEGIN
 CREATE TYPE "public"."agent_type" AS ENUM('system', 'catalog');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Agent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(64) NOT NULL,
	"type" "agent_type" DEFAULT 'catalog' NOT NULL,
	"name" varchar(100) NOT NULL,
	"icon" varchar(10) NOT NULL,
	"description" text NOT NULL,
	"system_prompt" text NOT NULL,
	"greeting" text NOT NULL,
	"default_model" varchar(50) NOT NULL,
	"tool_access" jsonb,
	"capabilities" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "UserAgent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_agent_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"customizations" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Clear old varchar agentId values before converting to uuid (per ТЗ-1: data can be deleted)
UPDATE "Chat" SET "agentId" = NULL WHERE "agentId" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "Chat" ALTER COLUMN "agentId" TYPE uuid USING NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserAgent" ADD CONSTRAINT "UserAgent_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserAgent" ADD CONSTRAINT "UserAgent_source_agent_id_Agent_id_fk" FOREIGN KEY ("source_agent_id") REFERENCES "public"."Agent"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agent_slug_idx" ON "Agent" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_type_idx" ON "Agent" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_is_active_idx" ON "Agent" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_agent_user_id_idx" ON "UserAgent" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_agent_source_agent_id_idx" ON "UserAgent" USING btree ("source_agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_agent_user_name_idx" ON "UserAgent" USING btree ("user_id","name");--> statement-breakpoint
ALTER TABLE "User" DROP COLUMN IF EXISTS "role";