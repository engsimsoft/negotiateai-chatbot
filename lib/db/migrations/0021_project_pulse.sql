ALTER TABLE "Chat" ADD COLUMN "taskStatus" varchar(20) DEFAULT 'not_started';--> statement-breakpoint
ALTER TABLE "Project" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "Project" ADD COLUMN "summaryUpdatedAt" timestamp;