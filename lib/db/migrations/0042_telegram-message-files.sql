ALTER TABLE "TelegramMessage" ADD COLUMN "fileName" varchar(255);
ALTER TABLE "TelegramMessage" ADD COLUMN "fileSize" integer;
ALTER TABLE "TelegramMessage" ADD COLUMN "blobUrl" text;
