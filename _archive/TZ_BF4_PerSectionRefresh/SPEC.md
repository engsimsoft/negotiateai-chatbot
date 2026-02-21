# ТЗ-BF4: Per-Section Refresh (Обновление темы по отдельности)

**Автор:** Разработчик (Claude)
**Дата:** 2026-02-21
**Версия проекта:** 3.41.0 → 3.42.0
**Приоритет:** Высокий (UX / Apple-подход)

---

## Контекст

Сейчас генерация брифинга — **всё или ничего**. 5 тем → 5 тем каждый раз. Но реальное поведение пользователя иное:

- **Обычный день:** 1 брифинг утром по всем темам — работает
- **Гоночный weekend F1:** 5× за день обновить ТОЛЬКО F1 — приходится перегенерировать ВСЁ
- **Breaking news в AI:** быстро обновить ТОЛЬКО AI — приходится перегенерировать ВСЁ

**Философия:** Apple-подход. Пользователь НЕ хочет «настроить генерацию». Он хочет: «обнови мне ВОТ ЭТУ тему прямо сейчас».

---

## Требования

### Req-1: Кнопка `↻` на заголовке секции в статье

**Где:** `briefing-article-view.tsx` → `ArticleSection` → заголовок `<h2>` (рядом с Copy и Bookmark)

```
🏎️ Формула-1                    [📋] [↻] [🔖]
```

- Иконка: `RefreshCw` (lucide-react) — `size-5`, `text-muted-foreground`
- Tooltip: `<Tooltip>` с текстом **«Обновить тему»**
- Loading state: `animate-spin` на иконке, `disabled`
- После обновления: `toast.success("Тема обновлена")`
- Ошибка: `toast.error("Не удалось обновить тему")`

### Req-2: Backend API — refresh одной секции

**Endpoint:** `POST /api/briefing/refresh-section`

```typescript
// Request
{ topicId: string }

// Response (success)
BriefingArticleSection  // обновлённая секция

// Response (streaming, как текущий generate)
// Step 1: fetching → fetch ТОЛЬКО sources для этого topicId
// Step 2: filtering → filter ТОЛЬКО для этого topicId
// Step 3: writing → generate ТОЛЬКО одну секцию
// Step 4: complete → вернуть обновлённую секцию
```

**Pipeline (упрощённый по сравнению с полной генерацией):**
1. Загрузить settings + sources → отфильтровать ТОЛЬКО по `topicId`
2. Fetch sources (только для этой темы, ~3-4 источника вместо ~20)
3. AI filter (Gemini Flash) — только эта тема
4. AI author (Claude Sonnet) — сгенерировать ОДНУ секцию
5. Patch `briefingJson.sections[]` — заменить секцию по `topicId`
6. Сохранить обновлённый briefingJson в БД

### Req-3: Merge-логика (не ломать остальные секции)

- Текущий брифинг загружается из БД
- Обновляется ТОЛЬКО одна секция (по `topicId`)
- Остальные секции остаются без изменений
- `meta` (totalNews, readingTimeMinutes) пересчитывается
- НЕ вызывать `deleteOldBriefingHistory()` — это для полной генерации

### Req-4: Обновление state на клиенте

- `article` — mutable state (нужно поднять из prop в state)
- После refresh: `setArticle(prev => ({ ...prev, sections: prev.sections.map(...) }))`
- Sidebar scroll spy продолжает работать (topicId не меняется)
- Bookmark status сохраняется (savedTopics привязаны по topicId)

### Req-5: Tooltip на кнопке

- Использовать shadcn/ui `<Tooltip>` (уже в проекте)
- Текст: **«Обновить тему»**
- Во время loading: **«Обновляем...»**

---

## Текущая архитектура (что есть)

### Backend pipeline (монолитный)
```
POST /api/briefing/generate
  → deleteOldBriefingHistory()     ← удаляет ВСЁ
  → fetch ALL sources (~20)
  → filter ALL items (Gemini)
  → generate FULL article (Claude)  ← ВСЕ секции за один вызов
  → save ENTIRE briefingJson        ← один JSONB blob
```

### Что НЕ поддерживает per-section:
| Компонент | Проблема |
|-----------|----------|
| `generate/route.ts` | `deleteOldBriefingHistory()` удаляет всё |
| `briefing-author.ts` | Генерирует ВСЕ секции одним вызовом |
| DB schema | `briefingJson` — один JSONB blob, нет per-section CRUD |
| Client hook | Линейная state machine (5 шагов), no per-section mode |

### Что УЖЕ поддерживает:
| Компонент | Возможность |
|-----------|-------------|
| `briefing-filter.ts` | Принимает `topicIds[]` — можно передать `["f1"]` |
| `topics-catalog.ts` | Sources сгруппированы по topicId |
| `briefing-types.ts` | `BriefingArticleSection` — самостоятельная структура |
| ArticleSection UI | Паттерн кнопок (Copy, Bookmark) — добавить ↻ тривиально |

---

## Ключевые решения

### Не streaming, а простой POST/response

Полная генерация (5 тем, ~20 источников) = 30-60 сек → нужен streaming.
Refresh одной темы (~3 источника) = 10-20 сек → можно обойтись простым POST с loading state на кнопке.

**Но:** если >15 сек, пользователь может подумать что зависло. Решение: `animate-spin` + toast «Обновляем тему...» при старте.

### Промпт для одной секции

Текущий `briefing-author.md` генерирует полную статью. Для одной секции нужен **упрощённый промпт** — только одна тема, без intro/outro, без meta.

### Не менять DB schema

`briefingJson` остаётся JSONB blob. При refresh:
1. `getBriefingHistory({ userId, status: "ready" })` → текущий брифинг
2. Заменить одну секцию в `briefingJson.sections[]`
3. `saveBriefingHistory()` или UPDATE существующей записи

---

## Файлы (оценка)

### Новые:
- `app/(chat)/api/briefing/refresh-section/route.ts` — API endpoint
- `lib/briefing/briefing-section-author.ts` — генерация одной секции (отдельный промпт)

### Изменяемые:
- `components/briefing/briefing-article-view.tsx` — кнопка ↻ + Tooltip в ArticleSection
- `components/briefing/briefing-page-client.tsx` — `handleRefreshSection` callback, article state
- `components/briefing/briefing-issue-content.tsx` — threading callback
- `lib/db/queries.ts` — `updateBriefingSection()` (JSONB patch)

### Без изменений:
- `briefing-sidebar.tsx` — sidebar не трогаем (refresh только в article view)
- `briefing-filter.ts` — уже поддерживает `topicIds` subset
- `lib/db/schema.ts` — schema не меняется
- `hooks/use-briefing-generation.ts` — для полной генерации, не для refresh
