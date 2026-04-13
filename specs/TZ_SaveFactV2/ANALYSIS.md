# Анализ ТЗ-SaveFactV2: saveFact v2 — метаданные для задач и календаря

**Дата анализа:** 2026-04-07

---

## Резюме

Расширить tool `saveFact` опциональным JSONB-полем `metadata` (status для задач, date/time для событий). Создать новый tool `updateFact` для изменения статуса задач через natural language. Обновить промпт Simply Chat, схему БД, API контекста.

---

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.

### ✅ Согласен с ТЗ

- **Пункт 1 (metadata в inputSchema saveFact)** — ОК. Zod-схема расширяется тривиально, `.optional()` не ломает обратную совместимость
- **Пункт 2 (JSONB колонка)** — ОК. Колонка `metadata` НЕ существует в `memory_entry` (проверено в `lib/db/schema.ts:757-807`). Нужна миграция. JSONB — правильный выбор для будущей индексации
- **Пункт 3 (execute saveFact)** — ОК. `insertMemoryEntry()` в `memory-queries.ts:41-60` нужно расширить параметром metadata. Минимальное изменение
- **Пункт 5 (промпт Simply)** — ОК. Блок `<memory>` в `lib/prompts/chat/simply-chat.md:104-125` легко расширяется
- **Пункт «Чего НЕ делать»** — Полностью согласен. Правильный скоуп

### ⚠️ Рекомендую изменить

| # | Было (ТЗ) | Рекомендация | Обоснование из кода |
|---|-----------|--------------|-------------------|
| 1 | `updateFact` — новый tool с `factId?` + `search?` | **Убрать `factId`** — AI никогда не знает ID факта в контексте чата. Только semantic search. factId — мёртвый параметр | Текущий `saveFact` возвращает factId в result, но AI не хранит его между сообщениями. В sliding window (20 msg) ID уже потеряется |
| 2 | `updateFact` → `updates.content` (обновить текст) | **Убрать `updates.content`** из v2 скоупа. Обновление текста = новый embedding + dedup-логика = переусложнение. Если нужно изменить текст — пользователь скажет «удали задачу X» + «задача: Y» | `saveFact` уже обрабатывает supersede при схожем content (`save-fact.ts:153-194`). Добавить изменение текста в updateFact = дублирование логики supersede |
| 3 | Порог поиска > 0.7 для updateFact | **Согласен с 0.7**, но добавить **подтверждение при 0.7-0.85**: AI показывает найденный факт и спрашивает «Вы имели в виду: "позвонить Григорию"?» | В `save-fact.ts` dedup threshold = 0.55 (грубый) + LLM verify. Для updateFact порог выше, но без подтверждения будет риск обновить не тот факт |
| 4 | ТЗ не упоминает `tool-activity-config` | **Добавить конфиг для updateFact** в `tool-activity-config.ts` | `saveFact` уже имеет конфиг (`tool-activity-config.ts:110-115`). updateFact должен тоже — иначе в UI будет generic indicator |
| 5 | ТЗ: endpoint `/api/user/memory/context/[category]` | **Такого endpoint нет** в кодовой базе. Есть только `/api/user/memory/context/route.ts` (без динамического сегмента). Вариант: расширить существующий GET endpoint, добавив metadata в `getMemorySummaryByCategory()` | `app/(chat)/api/user/memory/context/route.ts` — единственный endpoint. Вызывает `getMemorySummaryByCategory()` из `memory-queries.ts:228-265`, который возвращает `{ category, count, preview[] }` без metadata |

### ❓ Требует решения (принимаю сам, но фиксирую логику)

| # | Вопрос | Моё решение |
|---|--------|-------------|
| 1 | **updateFact: при обновлении metadata — нужно ли менять embedding?** | **Нет.** Изменение `status: "new" → "done"` не меняет семантику факта. Embedding остаётся прежним. Меняем только JSONB поле через `UPDATE ... SET metadata = jsonb_set(...)` |
| 2 | **updateFact: что если AI ошибочно вызовет updateFact для не-task категории?** | Tool принудительно фильтрует `category = 'task'` при поиске по статусу. Для calendar — аналогично. Промпт тоже ограничит |
| 3 | **Как передавать metadata в `NewMemoryEntry` / `insertMemoryEntry()`?** | Расширяю интерфейс `NewMemoryEntry` в `types.ts` опциональным полем `metadata?: Record<string, unknown>`. В `insertMemoryEntry()` пробрасываю в values |
| 4 | **context API: создавать `[category]/route.ts` или расширить существующий?** | **Расширить существующий** `/api/user/memory/context/route.ts`. Добавить query param `?category=task` для детального запроса с metadata. Так не плодим endpoints |
| 5 | **DevPanel: как показать metadata?** | Metadata будет видна через существующую RAG секцию DevPanel (`rag-section.tsx`). Факты уже показываются — добавлю metadata в вывод. Отдельной секции не нужно |

---

## Затронутые компоненты

**Изменения:**
- `lib/db/schema.ts` — +metadata JSONB колонка в memoryEntry
- `lib/db/migrations/00XX_memory-metadata.sql` — миграция
- `lib/ai/memory/types.ts` — +metadata в NewMemoryEntry, +TaskMetadata/CalendarMetadata типы
- `lib/ai/memory/memory-queries.ts` — insertMemoryEntry +metadata, новая updateMemoryMetadata(), getMemorySummaryByCategory +metadata
- `lib/ai/tools/save-fact.ts` — +metadata в inputSchema и execute
- `lib/ai/tools/update-fact.ts` — **НОВЫЙ файл** — tool updateFact
- `lib/ai/tools/chat-tools.ts` — +updateFact для chatMode="simply"
- `lib/ai/tool-activity-config.ts` — +конфиг updateFact
- `lib/prompts/chat/simply-chat.md` — расширить блок `<memory>`
- `app/(chat)/api/user/memory/context/route.ts` — +metadata в ответе, +category filter

---

## Оценка

- [x] Простое (1-2 сессии)
- [ ] Среднее (3-5 сессий)
- [ ] Сложное (5+ сессий)

**Обоснование:** Основная работа — миграция + расширение saveFact (тривиально) + новый tool updateFact (простой: semantic search + UPDATE). Нет сложных UI-изменений, нет новых страниц, нет streaming. 1 сессия.

---

## План действий

Готов приступить к созданию ROADMAP.md после твоего подтверждения рекомендаций.
