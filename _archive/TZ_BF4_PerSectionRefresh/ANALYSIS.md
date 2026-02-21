# Анализ ТЗ-BF4: Per-Section Refresh

**Дата:** 2026-02-21

---

## Анализ кода

### 1. Backend pipeline (`/api/briefing/generate/route.ts`)

**Текущий flow:**
```
auth → loadSettings → loadTopics/Sources
→ fetchAllSources (Promise.allSettled, ~20 sources)
→ filterContent (Gemini Flash, topicIds=[all], →30 candidates)
→ generateArticle (Claude Sonnet, all candidates → full article)
→ deleteOldBriefingHistory() ← КРИТИЧНО: удаляет ВСЁ
→ saveBriefingHistory(fullArticle)
→ stream: complete + redirectUrl
```

**Для per-section нужно:**
- НЕ вызывать `deleteOldBriefingHistory()`
- Fetch только sources для одного topicId (~3-4 вместо ~20)
- Filter с `topicIds = [topicId]` (уже поддерживается)
- Генерировать одну секцию (новый промпт)
- Patch существующего briefingJson вместо replace

### 2. Author (`briefing-author.ts`)

**`generateArticle()` — монолитная:**
- Принимает ALL candidates
- Генерирует полную статью: title + intro + sections[] + outro + meta
- Zod schema требует все поля
- Не может сгенерировать одну секцию

**Решение:** Создать `generateSection()` — отдельная функция с упрощённым промптом:
- Input: candidates для одной темы + topicName + emoji
- Output: `BriefingArticleSection` (content + sources + newsCount)
- Промпт: только одна тема, без intro/outro/meta
- Модель: та же (Claude Sonnet), но меньше tokens (compact)

### 3. Filter (`briefing-filter.ts`)

**`filterContent(items, topicIds)` — уже поддерживает subset:**
```typescript
// Можно вызвать:
filterContent(items, ["f1"]) // только F1
```
Но фильтр обрабатывает ВСЕ items через Gemini. При per-section refresh items уже будут только из sources этой темы → фильтрация будет быстрее.

### 4. DB (`queries.ts` + `schema.ts`)

**BriefingHistory table:**
- `briefingJson: jsonb` — весь BriefingArticle как blob
- `status: varchar` — "ready" | "generating" | "failed"
- Нет per-section fields

**Текущие query:**
- `saveBriefingHistory()` — INSERT new row
- `getBriefingHistory()` — SELECT по userId

**Нужно добавить:**
```typescript
updateBriefingSection(userId, topicId, newSection):
  1. SELECT latest briefing WHERE status = "ready"
  2. Parse briefingJson
  3. Replace section by topicId
  4. Recalculate meta
  5. UPDATE briefingJson
```

### 5. Frontend: ArticleSection (`briefing-article-view.tsx`)

**Текущая структура заголовка секции:**
```jsx
<h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
  <span>{section.emoji}</span>
  <span className="flex-1">{section.topicName}</span>
  <button>[Copy]</button>     // line 171-182
  <button>[Bookmark]</button>  // line 183-192
</h2>
```

**Добавить между Copy и Bookmark:**
```jsx
<Tooltip content={isRefreshing ? "Обновляем..." : "Обновить тему"}>
  <button onClick={() => onRefreshSection(topicId)} disabled={isRefreshing}>
    <RefreshCw className={isRefreshing ? "animate-spin" : ""} />
  </button>
</Tooltip>
```

### 6. State management (`briefing-page-client.tsx`)

**Проблема:** `article` — prop от сервера, не state.
```tsx
// Сейчас:
function BriefingPageClient({ article, ... }) { // article — prop
```

**Решение:** Поднять article в state с инициализацией от prop:
```tsx
const [currentArticle, setCurrentArticle] = useState(article);
// При refresh: setCurrentArticle(prev => patchedArticle)
```

---

## Оценка сложности

| Компонент | Сложность | Обоснование |
|-----------|-----------|-------------|
| API endpoint | Средняя | Новый route, но переиспользует filter/fetch |
| Section author | Средняя | Новый промпт + Zod schema, но проще чем full author |
| DB query | Низкая | JSONB patch, 1 новая функция |
| UI кнопка + Tooltip | Низкая | Паттерн уже есть (Copy, Bookmark) |
| State management | Низкая | useState + setter |
| Callback threading | Низкая | 3 компонента, props drilling |

**Общая оценка:** ~1 сессия (3-4 часа)

---

## Риски

1. **Промпт consistency:** Секция, сгенерированная отдельно, может отличаться по стилю от остальных (другой контекст промпта). Митигация: передавать остальные секции как context в промпте.

2. **Race condition:** Пользователь нажимает refresh на F1, потом на AI, пока F1 ещё загружается. Митигация: `isRefreshingTopicId` позволяет refresh только одной темы за раз.

3. **Stale data:** Если пользователь обновил F1 5 раз, а AI ни разу — intro/outro брифинга может быть неактуальным. Митигация: intro/outro не трогаем, они generic.

---

## Вопросы (решены)

| # | Вопрос | Решение |
|---|--------|---------|
| 1 | Streaming или простой POST? | Простой POST с loading state (10-20 сек для одной темы) |
| 2 | Менять ли DB schema? | Нет — JSONB patch существующей записи |
| 3 | Sidebar refresh? | Нет — только в article view (sidebar не перегружаем) |
| 4 | Обновлять ли intro/outro? | Нет — они generic, не зависят от одной темы |
| 5 | Можно ли refresh несколько тем параллельно? | Нет — одна тема за раз (UX проще, backend проще) |
