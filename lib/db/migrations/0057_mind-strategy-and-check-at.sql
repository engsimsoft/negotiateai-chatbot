-- ТЗ-MindOnVisit: выбор стратегии обработки хвостов памяти + поле дебаунса on-visit.
-- factExtractionStrategy: 'always' | 'on-visit' | 'cron' (default 'always').
-- lastMindCheckAt: timestamp последней on-visit проверки (для 30-мин дебаунса).

ALTER TABLE "memory_settings" ADD COLUMN "factExtractionStrategy" text NOT NULL DEFAULT 'always';
ALTER TABLE "memory_settings" ADD COLUMN "lastMindCheckAt" timestamp;
