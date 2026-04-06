# Анализ ТЗ-RAG0: Simply RAG — Инфраструктура

## Резюме

RAG-0 закладывает фундамент для всей RAG-системы Simply: pgvector extension, таблица `memory_entry` с HNSW-индексом, Voyage AI клиент, RLS, базовые query-функции. Чистый инфраструктурный этап — без бизнес-логики, без UI.

---

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.
> Каждая рекомендация требует согласования с архитектором.

### ✅ Согласен с концептом

- **pgvector в Neon** — Neon поддерживает нативно, `CREATE EXTENSION vector` работает
- **HNSW-индекс** — правильный выбор для approximate search при наших объёмах (до ~1M записей)
- **Единая размерность 1024** — дефолт Voyage 4, совместим с Matryoshka (можно уменьшить позже)
- **Voyage AI как единый провайдер** — shared space для voyage-4 / voyage-4-lite подтверждён
- **RLS** — дополнительный уровень защиты, Neon поддерживает
- **Структура `lib/ai/memory/`** — вписывается в существующий паттерн (`lib/ai/tools/`, `lib/ai/clerks/`)

### ⚠️ Рекомендую изменить

| # | Было (концепт) | Рекомендация | Обоснование из кода |
|---|---------------|--------------|---------------------|
| 1 | `decayScore float` в таблице | **Убрать из RAG-0** | Decay score — это логика консолидации (RAG-2). В RAG-0 не нужен и не будет использоваться. Добавить миграцией когда реально понадобится. Принцип: не создавать колонки для будущих фич |
| 2 | `category enum` (pgEnum) | **Использовать `varchar(32)` с валидацией в Zod** | В проекте нет ни одного pgEnum в schema.ts (проверено). Паттерн проекта: varchar + Zod-валидация на уровне приложения. Enum в PG требует миграции при добавлении нового значения — varchar гибче |
| 3 | RLS через `current_setting('app.current_user_id')` | **Начать с WHERE-фильтра, RLS добавить позже** | Drizzle ORM не имеет встроенной поддержки `SET app.current_user_id` per-request. Потребуется raw SQL на каждый запрос. В проекте 48 миграций — ни одна не использует RLS. Рекомендую: WHERE-фильтр (как везде в queries.ts) + RLS как отдельная задача в RAG-0, после проверки что basic flow работает |
| 4 | Voyage TypeScript SDK (`voyageai` npm) | **Проверить зрелость SDK** | SDK может быть unstable. Альтернатива: прямой `fetch()` к REST API (как сделано с Perplexity в `perplexity-client.ts:37-72`). Проект уже использует этот паттерн для Perplexity, Jina, Deepgram — raw fetch + типизация. Рекомендую: если SDK стабилен → SDK. Если нет → raw fetch по паттерну Perplexity |
| 5 | `accessCount int` в таблице | **Убрать из RAG-0** | accessCount — это оптимизация для ранжирования (RAG-2). В RAG-0 не используется. Добавить когда реально понадобится |

### ❓ Требует уточнения

1. **vector column в Drizzle** — Drizzle не имеет нативного типа `vector`. Нужен `customType`:
   ```typescript
   const vector = customType<{ data: number[] }>({
     dataType() { return `vector(1024)` },
     toDriver(value) { return JSON.stringify(value) },
     fromDriver(value) { return value as number[] },
   });
   ```
   Это работающий паттерн, но требует тестирования с pgvector-специфичными операторами (`<=>` для cosine distance). Возможно потребуется raw SQL для similarity search.

2. **HNSW параметры** — концепт предлагает `m=16, ef_construction=64`. Это conservative defaults. При < 100K записей разница с дефолтами pgvector (`m=16, ef_construction=64` — совпадает) минимальна. Оставляем?

3. **Neon pgvector лимиты** — Neon Free/Hobby может иметь ограничения на размер HNSW-индекса. Нужно проверить план Neon у проекта.

---

## Потенциальные риски

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| Voyage AI SDK нестабильный или неполный | Средняя | Fallback: raw fetch по паттерну perplexity-client.ts |
| Drizzle customType vector не работает с pgvector операторами | Средняя | Fallback: raw SQL через `db.execute(sql`...`)` для search |
| Neon Free plan не поддерживает pgvector/HNSW | Низкая | Neon анонсировал pgvector support на всех планах |
| RLS конфликтует с Drizzle connection pooling | Средняя | Начать без RLS, добавить после проверки |
| Миграция с vector extension ломает существующие миграции | Низкая | Extension создаётся IF NOT EXISTS, изолированная таблица |

---

## Зависимости

### Внешние
- Voyage AI API-ключ (`VOYAGE_API_KEY`) — нужен до начала разработки
- Neon PostgreSQL с поддержкой pgvector — проверить перед стартом

### Внутренние (код)
- `lib/db/schema.ts` — добавление таблицы (паттерн: 25+ таблиц, uuid PK, jsonb metadata)
- `lib/db/queries.ts` — добавление query-функций (паттерн: async, try/catch, ChatSDKError)
- `lib/ai/usage-utils.ts` — расширение chatMode конвенции (паттерн: `memory:embed`, `memory:search`)
- `lib/ai/providers.ts` — pricing для Voyage (паттерн: MODEL_PRICING_RUB)

---

## Оценка сложности

- [x] Простое (1-2 сессии)
- [ ] Среднее (3-5 сессий)
- [ ] Сложное (5+ сессий)

RAG-0 — чистая инфраструктура: миграция БД, API-клиент, query-функции. Нет UI, нет сложной бизнес-логики. Основной риск — совместимость Drizzle + pgvector, но это решается raw SQL fallback.

---

## Вопросы для уточнения

1. **Voyage AI API-ключ** — уже получен или нужно зарегистрироваться? Free tier (200M токенов) хватит для разработки.

2. **Neon plan** — на каком плане Neon сейчас проект? Free поддерживает pgvector, но есть ли ограничения по storage?

3. **Voyage SDK vs raw fetch** — предпочтение? SDK проще в использовании, raw fetch — полный контроль (как с Perplexity). Моя рекомендация: проверить SDK, если зрелый → SDK.

4. **HNSW параметры** — оставить дефолтные (`m=16, ef_construction=64`) или кастомизировать? Для < 100K записей разница минимальна.

5. **Готовность к старту** — после согласования этого анализа я создам ROADMAP.md и начнём разработку. Ожидаемый scope: 1-2 сессии.
