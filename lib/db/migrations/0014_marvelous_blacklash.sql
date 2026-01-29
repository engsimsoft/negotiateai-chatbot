ALTER TABLE "User" ADD COLUMN "display_name" varchar(100);--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "pronouns" varchar(10);--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "occupation" varchar(100);--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "theme" varchar(20);