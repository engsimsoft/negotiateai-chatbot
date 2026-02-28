CREATE TABLE IF NOT EXISTS "TelegramGroup" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telegramChatId" bigint NOT NULL,
	"title" varchar(255) NOT NULL,
	"type" varchar(20) NOT NULL,
	"isForum" boolean DEFAULT false NOT NULL,
	"ownerUserId" uuid,
	"isActive" boolean DEFAULT true NOT NULL,
	"memberCount" integer,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	CONSTRAINT "TelegramGroup_telegramChatId_unique" UNIQUE("telegramChatId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TelegramGroupTopic" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"groupId" uuid NOT NULL,
	"telegramTopicId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TelegramMessage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"groupId" uuid NOT NULL,
	"topicId" uuid,
	"telegramMessageId" integer NOT NULL,
	"fromUserId" bigint NOT NULL,
	"fromUsername" varchar(255),
	"fromFirstName" varchar(255),
	"text" text NOT NULL,
	"hasMedia" boolean DEFAULT false NOT NULL,
	"mediaType" varchar(20),
	"sentAt" timestamp NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TelegramGroup" ADD CONSTRAINT "TelegramGroup_ownerUserId_User_id_fk" FOREIGN KEY ("ownerUserId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TelegramGroupTopic" ADD CONSTRAINT "TelegramGroupTopic_groupId_TelegramGroup_id_fk" FOREIGN KEY ("groupId") REFERENCES "public"."TelegramGroup"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TelegramMessage" ADD CONSTRAINT "TelegramMessage_groupId_TelegramGroup_id_fk" FOREIGN KEY ("groupId") REFERENCES "public"."TelegramGroup"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TelegramMessage" ADD CONSTRAINT "TelegramMessage_topicId_TelegramGroupTopic_id_fk" FOREIGN KEY ("topicId") REFERENCES "public"."TelegramGroupTopic"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tg_group_topic_unique_idx" ON "TelegramGroupTopic" USING btree ("groupId","telegramTopicId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tg_message_group_sent_idx" ON "TelegramMessage" USING btree ("groupId","sentAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tg_message_group_topic_sent_idx" ON "TelegramMessage" USING btree ("groupId","topicId","sentAt");
