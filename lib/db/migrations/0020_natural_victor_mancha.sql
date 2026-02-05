CREATE TABLE IF NOT EXISTS "ProjectFolder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projectId" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"emoji" varchar(10) DEFAULT '📁' NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ProjectFile" ADD COLUMN "folderId" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ProjectFolder" ADD CONSTRAINT "ProjectFolder_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_folderId_ProjectFolder_id_fk" FOREIGN KEY ("folderId") REFERENCES "public"."ProjectFolder"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
