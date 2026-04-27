# Roadmap ТЗ-RAG0: Simply RAG — Инфраструктура

**Создан:** 2026-04-06
**Версия проекта:** 3.69.0 → 3.70.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 4 |
| Текущий этап | 1 |
| Сессий (оценка) | 1-2 |

---

## Этап 1: pgvector + Таблица memory_entry

**Статус:** ✅ Завершён

**Цель:** Создать таблицу `memory_entry` с vector column и HNSW-индексом в Neon PostgreSQL.

**Задачи:**
- [x] Добавить `customType` для `vector(1024)` в schema.ts
- [x] Добавить таблицу `memoryEntry` в schema.ts (id, userId, content, embedding, category, confidence, sourceType, sourceChatId, sourceProjectId, supersededBy, createdAt, updatedAt)
- [x] Добавить relations для memoryEntry (user, chat, project, supersededBy)
- [x] Создать миграцию: `CREATE EXTENSION IF NOT EXISTS vector` + таблица + HNSW-индекс + составные индексы
- [x] Применить миграцию (`npm run db:migrate`)
- [x] Проверить через SQL: extension установлен, таблица создана, индексы на месте

**Файлы:**
- `lib/db/schema.ts` — добавить customType vector + таблицу memoryEntry
- `lib/db/migrations/XXXX_memory-entry.sql` — миграция (сгенерированная Drizzle + ручные правки для extension и HNSW)

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] SQL: `SELECT * FROM pg_extension WHERE extname = 'vector'` — pgvector v0.8.0
- [x] SQL: `SELECT * FROM information_schema.tables WHERE table_name = 'memory_entry'` — есть (12 колонок)
- [x] SQL: `SELECT indexname FROM pg_indexes WHERE tablename = 'memory_entry'` — 5 индексов (PK + HNSW + 3 составных)
- [ ] 🧪 Мануальный тест: SQL-проверки выше

**Git (после валидации):**
```bash
git add lib/db/schema.ts lib/db/migrations/
git commit -m "feat(tz-rag0): pgvector extension + memory_entry table with HNSW index"
```

**Критерий готовности:** Таблица `memory_entry` с vector(1024) column и HNSW-индексом существует в production БД.

---

## Этап 2: Voyage AI клиент

**Статус:** ✅ Завершён

**Цель:** Создать клиент для Voyage AI API (embed текста, batch embed) по паттерну perplexity-client.ts.

**Задачи:**
- [x] Создать `lib/ai/memory/types.ts` — типы MemoryEntry, NewMemoryEntry, SearchOptions, MemoryCategory, VoyageEmbedResponse
- [x] Создать `lib/ai/memory/voyage-client.ts` — raw fetch к Voyage API: `embedText()`, `embedTexts()` (batch до 128), input_type document/query, модель voyage-4 / voyage-4-lite
- [x] Добавить Voyage pricing в `lib/ai/providers.ts` → MODEL_PRICING_RUB (voyage-4: $0.06/1M tokens, voyage-4-lite: $0.02/1M tokens)
- [x] Добавить chatMode конвенцию `memory:embed` — следуем паттерну при вызовах logUsage
- [x] Верифицировать: embedText() → vector(1024) ✅, cosine similarity 0.64, batch 3 items ✅

**Файлы:**
- `lib/ai/memory/types.ts` — новый
- `lib/ai/memory/voyage-client.ts` — новый
- `lib/ai/providers.ts` — добавить Voyage pricing
- `lib/ai/usage-utils.ts` — добавить комментарий к chatMode конвенции

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Ручная проверка: embedText() → 1024 dim, 21 tokens, cosine similarity 0.64
- [x] Тестовый скрипт: single + query + batch (3 items) — всё ОК

**Git (после валидации):**
```bash
git add lib/ai/memory/ lib/ai/providers.ts lib/ai/usage-utils.ts
git commit -m "feat(tz-rag0): Voyage AI client — embed + batch embed"
```

**Критерий готовности:** `embedText("любой текст")` возвращает number[] длиной 1024 через Voyage API.

---

## Этап 3: Query-функции (upsert, search, delete)

**Статус:** ✅ Завершён

**Цель:** Создать базовые CRUD + similarity search функции для memory_entry.

**Задачи:**
- [x] Создать `lib/ai/memory/memory-queries.ts`:
  - `insertMemoryEntry(entry)` / `embedAndInsertMemory(entry)` — insert с embed через voyage-client
  - `searchSimilarMemories(userId, queryText, options?)` — embed query → cosine search → top-K
  - `getMemoryEntriesByUser(userId, options?)` — list с фильтрами (category, activeOnly)
  - `supersedeMemoryEntry(oldId, newId)` — пометить как заменённый
  - `deleteMemoryEntry(id)` — удалить один факт
  - `deleteAllUserMemories(userId)` — удалить всё (для "Удалить всё обо мне")
  - `countUserMemories(userId)` — count активных фактов
- [x] Similarity search: raw SQL с `<=>` оператором (cosine distance), WHERE userId + supersededBy IS NULL
- [x] Добавить экспорт `lib/ai/memory/index.ts`
- [x] End-to-end тест: insert 3 → count=3 → search → top result correct → supersede → excluded → delete all → count=0

**Файлы:**
- `lib/ai/memory/memory-queries.ts` — новый
- `lib/ai/memory/index.ts` — новый (public exports)

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] E2E: "Встреча с Петровым 15 марта" → search "Петров" → similarity 0.64 ✅
- [x] E2E: "Бюджет проекта" → search "бюджет" → similarity 0.70 ✅
- [x] E2E: category filter (preference) → 1 result, similarity 0.60 ✅
- [x] E2E: supersede → excluded from active search ✅
- [x] E2E: deleteAllUserMemories → count = 0 ✅
- [x] SQL: записи создаются/удаляются корректно

**Git (после валидации):**
```bash
git add lib/ai/memory/
git commit -m "feat(tz-rag0): memory queries — upsert, search, delete with pgvector"
```

**Критерий готовности:** Полный цикл embed → store → search → find → delete работает корректно.

---

## Этап 4: Финализация

**Статус:** ✅ Завершён

**Задачи:**

**Документация (обязательная):**
- [x] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти чеклист
- [x] Обновить главный CHANGELOG.md (v3.70.0 — SimplyRAG Infrastructure)
- [x] Обновить SIMPLY_STATUS.md (версия + RAG инфра статус)
- [x] Обновить CLAUDE.md (секция MIND Memory / RAG, версия, завершённые ТЗ)
- [x] Обновить package.json: 3.69.0 → 3.70.0

**Документация (по чеклисту):**
- [x] ADR: `docs/decisions/039-pgvector-voyage-ai-rag-infrastructure.md`
- [x] docs/ai-providers.md — Voyage AI провайдер + модели + pricing + env key
- [x] .env.example — VOYAGE_API_KEY (сделано в Этапе 1)

**Завершение:**
- [x] SQL-проверка БД (extension, таблица, 5 индексов — проверено в Этапе 1)
- [x] E2E верификация (insert → search → supersede → delete — проверено в Этапе 3)

**Валидация:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен

**Git (после валидации):**
```bash
git add -A
git commit -m "docs(tz-rag0): finalization — ADR, CHANGELOG, STATUS, CLAUDE.md"
```
