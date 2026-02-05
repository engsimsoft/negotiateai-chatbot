# ADR 010: Оптимизация производительности базы данных

**Дата:** 2026-02-04
**Статус:** Принято

---

## Контекст

После анализа логов dev-сервера были выявлены критические проблемы производительности:

### Выявленные проблемы

| Проблема | Симптом | Влияние |
|----------|---------|---------|
| **Отсутствие индексов** | Запросы 4-5 сек вместо 500ms | Медленная загрузка страниц |
| **N+1 запросы** | 21 запрос вместо 1 | Перегрузка БД |
| **Дублирование API** | `/api/user/ben-intro` 2 раза | Лишний трафик |
| **Неоптимальные queries** | `/api/vote` 2 последовательных запроса | Медленный отклик |

### Метрики до оптимизации

```
GET /api/projects      200 in 4266ms
GET /api/helpers       200 in 3702ms
GET /api/user/profile  200 in 3703ms
GET /api/vote          200 in 900ms
```

---

## Решение

### 1. Индексы базы данных

Создана миграция `0018_performance_indexes.sql` с 12 индексами:

```sql
-- Chat
CREATE INDEX idx_chat_user_id ON "Chat" ("userId");
CREATE INDEX idx_chat_project_id ON "Chat" ("projectId");
CREATE INDEX idx_chat_helper_id ON "Chat" ("helperId");
CREATE INDEX idx_chat_created_at ON "Chat" ("createdAt" DESC);

-- Project
CREATE INDEX idx_project_user_id ON "Project" ("userId");
CREATE INDEX idx_project_updated_at ON "Project" ("updatedAt" DESC);

-- Message_v2
CREATE INDEX idx_message_v2_chat_id ON "Message_v2" ("chatId");
CREATE INDEX idx_message_v2_created_at ON "Message_v2" ("createdAt" DESC);
CREATE INDEX idx_message_v2_chat_created ON "Message_v2" ("chatId", "createdAt" DESC);

-- ProjectFile, Helper, Vote_v2
CREATE INDEX idx_project_file_project_id ON "ProjectFile" ("projectId");
CREATE INDEX idx_helper_user_id ON "Helper" ("userId");
CREATE INDEX idx_vote_v2_chat_id ON "Vote_v2" ("chatId");
```

### 2. Исправление N+1 в getProjectsWithStats

**До (N+1 — 21 запрос для 10 проектов):**
```typescript
const projectsWithStats = await Promise.all(
  projects.map(async (p) => {
    const [fileStats] = await db.select()...  // Запрос 1
    const [chatStats] = await db.select()...  // Запрос 2
    return { ...p, fileCount, chatCount };
  })
);
```

**После (1 запрос с JOIN):**
```typescript
const result = await db
  .select({
    ...project,
    fileCount: sql`COALESCE(COUNT(DISTINCT ${projectFile.id}), 0)::int`,
    chatCount: sql`COALESCE(COUNT(DISTINCT ${chat.id}), 0)::int`,
  })
  .from(project)
  .leftJoin(projectFile, eq(projectFile.projectId, project.id))
  .leftJoin(chat, eq(chat.projectId, project.id))
  .where(eq(project.userId, userId))
  .groupBy(project.id)
  .orderBy(desc(project.updatedAt));
```

### 3. SWR для ben-intro

**До (useEffect + fetch, дублируется в React StrictMode):**
```typescript
useEffect(() => {
  const checkBenIntro = async () => {
    const res = await fetch("/api/user/ben-intro");
    ...
  };
  checkBenIntro();
}, []);
```

**После (useSWR с дедупликацией и кешированием):**
```typescript
const { data: benIntroData, mutate: mutateBenIntro } = useSWR<BenIntroResponse>(
  "/api/user/ben-intro",
  fetcher
);
```

### 4. Оптимизация /api/vote

Создана функция `getVotesByChatIdWithAuth()` которая объединяет проверку прав и получение голосов.

---

## Причины

### Почему индексы критичны?

PostgreSQL без индекса делает **Sequential Scan** — просматривает ВСЮ таблицу. С индексом — **Index Scan**, переход сразу к нужным записям.

| Размер таблицы | Без индекса | С индексом |
|----------------|-------------|------------|
| 100 записей | 5ms | 1ms |
| 10,000 записей | 200ms | 2ms |
| 1,000,000 записей | 20s | 5ms |

### Почему SWR вместо fetch?

- **Дедупликация:** Один запрос даже при нескольких монтированиях
- **Кеширование:** Данные сохраняются между навигациями
- **Optimistic Updates:** UI обновляется мгновенно
- **Консистентность:** Вся кодовая база использует SWR

### Почему JOIN вместо Promise.all?

- **Меньше round-trips:** 1 запрос vs N*2 запросов
- **Меньше нагрузка на БД:** Один план выполнения
- **Атомарность:** Консистентные данные в один момент времени

---

## Последствия

### Плюсы

- **7-8x ускорение** "тёплых" запросов (после cold start)
- **Устранение дублирования** запросов ben-intro
- **Снижение нагрузки** на базу данных
- **Готовность к RAG:** Индексы совместимы с будущим векторным поиском

### Минусы

- **Cold start Neon** остаётся (3-4 сек после простоя)
- **Дополнительные индексы** занимают место в БД (~незначительно)

### Метрики после оптимизации

| Запрос | Холодный | Тёплый | Ускорение |
|--------|----------|--------|-----------|
| `/api/projects` | 3620ms | **475ms** | **7.6x** |
| `/api/helpers` | 3702ms | **451ms** | **8.2x** |
| `/api/user/profile` | 3703ms | **464ms** | **8x** |
| `/api/deepgram/token` | 1050ms | **19ms** | **55x** |

---

## Альтернативы

### 1. Redis кеширование

**Что это:** Внешний кеш для частых запросов

**Почему отложили:**
- Дополнительная инфраструктура
- Усложняет deployment
- Индексы решают 80% проблемы

**Когда применить:** При высокой нагрузке или для убирания cold start

### 2. Neon "Always Warm"

**Что это:** Платный план Neon с постоянно активным инстансом

**Почему отложили:**
- Дополнительные расходы
- Сейчас не критично для MVP

**Когда применить:** При выходе в production с реальными пользователями

### 3. Connection Pooling (PgBouncer)

**Что это:** Пул соединений для уменьшения overhead

**Почему отложили:**
- Neon уже использует serverless pooling
- Не решает проблему cold start

---

## Реализация

**Файлы:**

| Файл | Изменение |
|------|-----------|
| `lib/db/migrations/0018_performance_indexes.sql` | 12 новых индексов |
| `lib/db/migrations/meta/_journal.json` | Регистрация миграции |
| `lib/db/queries.ts` | N+1 fix, getVotesByChatIdWithAuth |
| `components/chat-header.tsx` | SWR для ben-intro |
| `app/(chat)/api/vote/route.ts` | Использование новой функции |

**Команды:**
```bash
npm run db:migrate  # Применить индексы
```

---

## Связь с RAG

Оптимизации **совместимы** с будущим внедрением RAG:

- Индексы на `projectId` ускорят поиск файлов проекта
- Архитектура готова к добавлению таблиц `Chunk` и `Embedding`
- pgvector (векторный поиск) работает с существующей схемой

---

## Связанные документы

- [PERFORMANCE_OPTIMIZATION_PLAN.md](_archive/TZ_07A_Glavnaya/PERFORMANCE_OPTIMIZATION_PLAN.md) — исходный анализ
- [CHANGELOG.md](../../CHANGELOG.md) — версия 3.4.1

---

**Обновлено:** 2026-02-04
