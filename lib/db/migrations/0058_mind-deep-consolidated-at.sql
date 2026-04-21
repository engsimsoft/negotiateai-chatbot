-- ТЗ-MindDeepConsolidation: cursor для ночного cron memory-deep-consolidate.
-- lastDeepConsolidatedAt: timestamp последнего прогона на пользователе.
-- Используется idempotency-гвардом (skip если <12h назад) + фильтром в
-- getUsersForDeepConsolidation (не запускать на только что обработанных).

ALTER TABLE "memory_settings" ADD COLUMN "lastDeepConsolidatedAt" timestamp;
