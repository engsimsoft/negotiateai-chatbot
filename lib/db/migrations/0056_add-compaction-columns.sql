-- ТЗ-COMPACTION-1: Simply Compaction MVP — состояние сжатия истории чата.
-- compactionSummary — текст 5-секционного summary (null = ещё не сжимался).
-- compactionIndex — индекс message, начиная с которого идёт verbatim window.
-- compactionCount — счётчик циклов compaction (для Фазы 2 повторного сжатия).

ALTER TABLE "Chat" ADD COLUMN "compactionSummary" text;
ALTER TABLE "Chat" ADD COLUMN "compactionIndex" integer;
ALTER TABLE "Chat" ADD COLUMN "compactionCount" integer NOT NULL DEFAULT 0;
