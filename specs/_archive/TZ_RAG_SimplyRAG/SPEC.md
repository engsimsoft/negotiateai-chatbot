# ТЗ-RAG0: Simply RAG — Инфраструктура

**Версия:** 1.0
**Дата:** 2026-04-06
**Статус:** Анализ
**Основа:** [SIMPLY_RAG_UNIFIED_CONCEPT.md](SIMPLY_RAG_UNIFIED_CONCEPT.md)
**Версия проекта:** 3.69.0 → 3.70.0

---

## Контекст

Simply строит два слоя персонального интеллекта:
- **MIND** — память из разговоров (автоматически из каждого чата)
- **Библиотека** — база знаний пользователя (загрузка файлов, ссылок, видео)

Оба слоя живут в одном vector space (pgvector + Voyage AI). RAG-0 закладывает фундамент, который переиспользуют все последующие фазы.

## Общий план фаз

| Фаза | Название | Что делает |
|------|----------|------------|
| **RAG-0** | Инфраструктура | pgvector, Voyage AI клиент, таблица, HNSW, RLS ← **ЭТО ТЗ** |
| RAG-1 | MIND Extract + Retrieve | Sonnet-извлечение, embed, semantic search, инжекция в prompt |
| RAG-2 | MIND Consolidation + Profile | Opus-консолидация, ночной профиль, UI `/settings/memory` |
| RAG-3 | Compaction | Anthropic Compaction API, замена snapshot-системы |
| RAG-4 | Библиотека MVP | Загрузка файлов, chunking, voyage-context-3, hybrid search, citations |

---

## Scope RAG-0

### Что входит

1. **pgvector extension** — `CREATE EXTENSION IF NOT EXISTS vector` в Neon PostgreSQL
2. **Таблица `memory_entry`** — хранение фактов из разговоров (Drizzle schema + миграция)
3. **HNSW-индекс** — approximate nearest neighbor search на `vector(1024)`
4. **Row Level Security (RLS)** — изоляция данных по userId
5. **Voyage AI клиент** — TypeScript модуль для embed + query (voyage-4 / voyage-4-lite)
6. **Usage logging** — трекинг токенов Voyage в существующий `aiUsageLog`
7. **Базовые query-функции** — `embedText()`, `searchSimilar()`, `upsertMemoryEntry()`
8. **Верификация** — end-to-end тест: embed → store → search → find

### Что НЕ входит

- Извлечение фактов из чатов (RAG-1)
- Инжекция в system prompt (RAG-1)
- Консолидация и профиль (RAG-2)
- Compaction API (RAG-3)
- Обработка документов (RAG-4)
- UI для памяти (RAG-2)

---

## Технические решения

### Единый провайдер: Voyage AI

| Параметр | Значение |
|----------|----------|
| Embedding (индексация) | voyage-4 (1024 dim) |
| Embedding (запросы) | voyage-4-lite (1024 dim, shared space) |
| Размерность | 1024 (дефолт Voyage 4) |
| API-ключ | `VOYAGE_API_KEY` (один новый ключ) |
| SDK | voyageai (TypeScript, официальный) |
| Data retention | Zero-day opt-out |

### Таблица `memory_entry`

```
memory_entry:
  id            uuid PK DEFAULT gen_random_uuid()
  userId        uuid FK → User, NOT NULL
  content       text NOT NULL (текст факта)
  embedding     vector(1024) NOT NULL
  category      varchar(32) NOT NULL (fact | task | preference | calendar | person | decision)
  confidence    real DEFAULT 1.0 (0.0-1.0)
  sourceType    varchar(32) NOT NULL (chat | expertise | create | project)
  sourceChatId  uuid FK → Chat (откуда извлечено)
  sourceProjectId uuid FK → Project (опционально)
  supersededBy  uuid FK → memory_entry (если заменён новым фактом)
  createdAt     timestamp DEFAULT now()
  updatedAt     timestamp DEFAULT now()

  Индексы:
    - HNSW на embedding (vector_cosine_ops, m=16, ef_construction=64)
    - userId + category
    - userId + createdAt DESC
    - supersededBy IS NULL (partial index — только активные записи)
```

### Voyage AI клиент

```typescript
// lib/ai/memory/voyage-client.ts

export async function embedTexts(texts: string[], inputType: 'document' | 'query'): Promise<number[][]>
export async function embedText(text: string, inputType: 'document' | 'query'): Promise<number[]>
```

- Модель для индексации: `voyage-4` (input_type: "document")
- Модель для запросов: `voyage-4-lite` (input_type: "query")
- Batch support: до 128 текстов за один вызов
- Error handling: retry с exponential backoff
- Usage tracking: логирование токенов через `logUsage()`

### Базовые query-функции

```typescript
// lib/ai/memory/memory-queries.ts

export async function upsertMemoryEntry(entry: NewMemoryEntry): Promise<MemoryEntry>
export async function searchSimilarMemories(userId: string, queryEmbedding: number[], options?: SearchOptions): Promise<MemoryEntry[]>
export async function getMemoryEntriesByUser(userId: string, options?: FilterOptions): Promise<MemoryEntry[]>
export async function supersededMemoryEntry(oldId: string, newId: string): Promise<void>
export async function deleteMemoryEntry(id: string): Promise<void>
export async function deleteAllUserMemories(userId: string): Promise<void>
```

### Row Level Security

```sql
ALTER TABLE memory_entry ENABLE ROW LEVEL SECURITY;

CREATE POLICY memory_entry_user_isolation ON memory_entry
  USING (user_id = current_setting('app.current_user_id')::uuid);
```

Примечание: RLS на уровне PostgreSQL — дополнительная защита к `WHERE userId = :id` в Drizzle queries. Если запрос забудет фильтр — RLS не пропустит чужие данные.

---

## Новые зависимости

| Пакет | Версия | Зачем |
|-------|--------|-------|
| `voyageai` | latest | Voyage AI TypeScript SDK |
| `drizzle-orm/pg-core` | (уже есть) | Для `customType` vector |

Примечание: pgvector не требует npm-пакета — это extension PostgreSQL. Drizzle не имеет нативного типа `vector`, но поддерживает `customType`.

---

## Переменные окружения

| Ключ | Описание | Обязателен для RAG-0 |
|------|----------|---------------------|
| `VOYAGE_API_KEY` | API-ключ Voyage AI | Да |

---

## Файлы

### Новые
- `lib/ai/memory/voyage-client.ts` — Voyage AI клиент (embed, batch)
- `lib/ai/memory/memory-queries.ts` — Query-функции (upsert, search, delete)
- `lib/ai/memory/types.ts` — Типы (MemoryEntry, SearchOptions, категории)
- `lib/db/migrations/XXXX_memory-entry.sql` — Миграция (extension + таблица + индексы + RLS)

### Изменяемые
- `lib/db/schema.ts` — Добавить таблицу `memoryEntry` с vector column
- `lib/ai/usage-utils.ts` — Добавить chatMode конвенцию `memory:*`
- `lib/ai/providers.ts` — Добавить Voyage pricing в MODEL_PRICING_RUB
- `.env.example` — Добавить `VOYAGE_API_KEY`
- `package.json` — Добавить `voyageai` dependency

---

## Согласованные решения (из обсуждения)

1. **5 фаз вместо 2** — RAG-0 → RAG-4 инкрементально
2. **Порог дедупликации: 0.92** (не 0.85) + category match
3. **Доменные модели (law-2, finance-2) отложены** — для MVP только voyage-4 + voyage-context-3
4. **Scope MIND: все чаты** — chat, expertise, create, project task chats. Source привязан к chatId + projectId
5. **Консолидация: Sonnet по умолчанию, Opus для ночного профиля** — решение при RAG-2
6. **Ночной cron: 3:00** (до брифинга в 5:00) — решение при RAG-2
7. **UI /settings/memory: часть RAG-2** — обязательно для доверия пользователей
8. **Inngest vs Cron: решение при RAG-4** — после опыта с pgvector
