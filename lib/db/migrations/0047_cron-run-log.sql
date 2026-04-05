CREATE TABLE IF NOT EXISTS "CronRunLog" (
	"id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
	"cronName" varchar(64) NOT NULL,
	"startedAt" timestamp NOT NULL,
	"finishedAt" timestamp NOT NULL,
	"usersProcessed" integer NOT NULL DEFAULT 0,
	"usersSkipped" integer NOT NULL DEFAULT 0,
	"usersFailed" integer NOT NULL DEFAULT 0,
	"results" jsonb,
	"durationMs" integer NOT NULL
);
