# Передача сессии ТЗ-OPT1

**Дата:** 2026-02-25
**Сессия:** 1 (анализ + планирование)

## Статус этапов
- [ ] Этап 1: Схема и функция записи ← НАЧНИ ЗДЕСЬ
- [ ] Этап 2: Интеграция в эндпоинты
- [ ] Этап 3: Миграция Sonnet 4.5 → 4.6
- [ ] Этап 4: Финализация

## Что сделано в этой сессии
- Прочитан и проанализирован SPEC.md
- Изучены все затронутые файлы в кодовой базе (providers.ts, chat/route.ts, task-chat/route.ts, professor-pipeline.ts, service-chat/route.ts, schema.ts, queries.ts, model-tiers.ts, chat-mode-config.ts, briefing-config.ts, ai-providers.md)
- Проведён код-ревью ТЗ, выявлены 4 рекомендации
- Все рекомендации согласованы с архитектором
- Создана полная документация: SPEC.md, ANALYSIS.md, ROADMAP.md, CHANGELOG.md, HANDOFF.md

## Согласованные решения (ВАЖНО для реализации)

| # | Решение | Детали |
|---|---------|--------|
| 1 | `costUsd` → `numeric(10,6)` | Вместо `real` из ТЗ. Float теряет точность при агрегации |
| 2 | `chatId` nullable | FK → Chat, но nullable. На будущее (briefing/clerks без chatId) |
| 3 | Task-chat route включён в scope | `api/projects/[id]/tasks/[taskId]/chat/route.ts` — добавить logging в onFinish |
| 4 | Обновить ВСЮ документацию | ai-providers.md + ai-agents.md + ai-chats-map.md + SIMPLY_STATUS.md |

## Следующая сессия: начни с

1. Прочитать `specs/TZ_OPT1_UsageAndMigration/ROADMAP.md` → Этап 1
2. **Этап 1 — Схема и функция:**
   - Добавить таблицу `aiUsageLog` в `lib/db/schema.ts`
   - Создать и применить Drizzle миграцию
   - Добавить `saveAiUsageLog()` в `lib/db/queries.ts`
   - Проверить SQL: таблица существует
   - `npx tsc --noEmit` + `npm run build`
3. **Этап 2 — Интеграция (3 точки):**
   - `app/(chat)/api/chat/route.ts` — onFinish streamText (строка ~622), fire-and-forget
   - `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — onFinish streamText (строка ~300)
   - `lib/ai/professor-pipeline.ts` — расширить ProfessorPipelineOptions (chatId, userId), логировать 3 фазы
4. **Этап 3 — Миграция Sonnet:**
   - `lib/ai/providers.ts` строки 37, 42, 48: `claude-sonnet-4-5-20250929` → `claude-sonnet-4-6`
   - Обновить 4 файла документации

## Ключевые файлы для чтения

| Файл | Зачем |
|------|-------|
| `specs/TZ_OPT1_UsageAndMigration/ROADMAP.md` | Рабочий чеклист — читать перед каждой задачей |
| `specs/TZ_OPT1_UsageAndMigration/ANALYSIS.md` | Согласованные решения и обоснования |
| `lib/db/schema.ts` | Добавить таблицу (конец файла) |
| `lib/db/queries.ts` | Добавить функцию saveAiUsageLog |
| `app/(chat)/api/chat/route.ts:622` | onFinish — основная точка интеграции |
| `lib/ai/professor-pipeline.ts` | Расширить интерфейс + логирование фаз |
| `lib/ai/providers.ts:37,42,48` | 3 замены для миграции Sonnet |

## Блокеры / Вопросы
- (нет — все вопросы решены)
