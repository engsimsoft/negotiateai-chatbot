DO $$ BEGIN
 CREATE TYPE "public"."project_task_status" AS ENUM('locked', 'pending', 'in_progress', 'review', 'issues', 'done');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ProjectTask" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projectId" uuid NOT NULL,
	"orderIndex" integer NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"goal" text,
	"input" text,
	"expectedOutput" text,
	"status" "project_task_status" DEFAULT 'locked' NOT NULL,
	"chatId" uuid,
	"inputSummary" text,
	"outputSummary" text,
	"professorVerdict" jsonb,
	"dependsOn" integer[],
	"tools" text[],
	"needsReview" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
