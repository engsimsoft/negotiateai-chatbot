CREATE TABLE IF NOT EXISTS "Helper" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"emoji" varchar(10) DEFAULT '🤖' NOT NULL,
	"instruction" text,
	"skills" jsonb,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "helperId" uuid;--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "isRenamed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Helper" ADD CONSTRAINT "Helper_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Chat" ADD CONSTRAINT "Chat_helperId_Helper_id_fk" FOREIGN KEY ("helperId") REFERENCES "public"."Helper"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
