CREATE TABLE IF NOT EXISTS "TelegramConnection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"telegramUserId" bigint NOT NULL,
	"telegramUsername" text,
	"telegramFirstName" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"linkedAt" timestamp NOT NULL,
	CONSTRAINT "TelegramConnection_userId_unique" UNIQUE("userId"),
	CONSTRAINT "TelegramConnection_telegramUserId_unique" UNIQUE("telegramUserId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TelegramLinkToken" (
	"token" text PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"createdAt" timestamp NOT NULL,
	"expiresAt" timestamp NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TelegramConnection" ADD CONSTRAINT "TelegramConnection_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TelegramLinkToken" ADD CONSTRAINT "TelegramLinkToken_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
