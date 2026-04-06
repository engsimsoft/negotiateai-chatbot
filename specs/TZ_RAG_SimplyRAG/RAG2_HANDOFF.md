# Передача сессии ТЗ-RAG2: MIND Consolidation + Profile + UI

**Дата:** 2026-04-06
**Сессия:** 1

## Статус этапов
- [ ] Этап 1: DB — memory_settings + user_profile_summary ← ТЕКУЩИЙ
- [ ] Этап 2: Consolidation — Sonnet ревизия фактов
- [ ] Этап 3: Opus-профиль + Cron
- [ ] Этап 4: API памяти
- [ ] Этап 5: UI секция «Память» на /settings
- [ ] Этап 6: Финализация

## Решения архитектора (согласованы)
1. Консолидация — гибрид: ночной batch cron + event-triggered мини-ревизия каждые 20 фактов
2. Мини-консолидация: триггер в extract.ts через fire-and-forget, НЕ в chat/route.ts
3. Opus-профиль — >= 10 активных фактов + есть новые факты с последней генерации
4. UI — секция «Память» на `/settings`, не отдельная страница
5. `memory_settings` — отдельная таблица по паттерну `briefingSettings` (включает factsSinceConsolidation счётчик)

## Следующая сессия: начни с
1. Прочитать RAG2_ROADMAP.md → Этап 1
2. Создать таблицы memory_settings + user_profile_summary
3. Создать миграцию и применить
4. Добавить query-функции

## Ключевые файлы
- `lib/db/schema.ts:395-418` — паттерн briefingSettings (для memory_settings)
- `lib/db/schema.ts:754-807` — existing memory_entry table
- `lib/db/queries.ts` — existing query patterns
- `lib/ai/memory/extract.ts` — нужно добавить factsUpdatedSince update
- `app/api/cron/briefing/route.ts` — паттерн для cron (этап 3)
- `app/(dashboard)/settings/settings-page.tsx:50-65` — Section type union (этап 5)
