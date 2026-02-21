# Roadmap ТЗ-BF4: PerSectionRefresh

**Создан:** 2026-02-21
**Версия проекта:** 3.41.0 → 3.42.0
**Статус:** ✅ Завершён

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 3 |
| Текущий этап | ✅ Все завершены |
| Сессий (оценка) | 1 |

---

## Этапы

### Этап 1: UI — кнопка ↻ + Tooltip + article state

**Статус:** ✅ Завершён

**Цель:** Добавить кнопку refresh на каждую секцию статьи, с Tooltip и loading state. Поднять `article` из prop в state для мутации.

**Задачи:**
- [x] `briefing-page-client.tsx`: поднять `article` в state (`useState(article)`) + `refreshingTopicId` state
- [x] `briefing-page-client.tsx`: создать `handleRefreshSection(topicId)` callback (реальный API call)
- [x] `briefing-issue-content.tsx`: пробросить `onRefreshSection` + `refreshingTopicId` props
- [x] `briefing-article-view.tsx`: пробросить props в `ArticleSection`
- [x] `briefing-article-view.tsx` → `ArticleSection`: добавить кнопку `↻` между Copy и Bookmark
  - `RefreshCw` icon, `size-5`, `text-muted-foreground`
  - `animate-spin` при `isRefreshing`
  - `disabled` при `isRefreshing`
- [x] `briefing-article-view.tsx` → `ArticleSection`: обернуть ↻ в `<Tooltip>` («Обновить тему» / «Обновляем...»)

**Файлы:**
- `components/briefing/briefing-page-client.tsx` — article state, callback (real API)
- `components/briefing/briefing-issue-content.tsx` — props threading
- `components/briefing/briefing-article-view.tsx` — кнопка + Tooltip в ArticleSection

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: кнопка ↻ видна на каждой секции (между Copy и Bookmark)
- [x] Браузер: hover → Tooltip «Обновить тему»
- [x] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add components/briefing/briefing-page-client.tsx components/briefing/briefing-issue-content.tsx components/briefing/briefing-article-view.tsx
git commit -m "feat(tz-bf4): refresh button UI + tooltip on article sections"
```

---

### Этап 2: Backend — API + section author + DB patch

**Статус:** ✅ Завершён

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 1

**Цель:** Создать backend pipeline для refresh одной секции: API endpoint, section author промпт, DB patch query.

**Задачи:**
- [x] `lib/briefing/briefing-section-author.ts`: создать `generateSection()` — упрощённый промпт для одной темы
  - Input: candidates, fullTexts, tierMap, topic (one), volume
  - Output: `BriefingArticleSection`
  - Промпт: контекст остальных секций (topicNames) + фокус на одну тему
- [x] `lib/db/queries.ts`: добавить `updateBriefingSection(userId, topicId, newSection)` — JSONB patch
  - SELECT latest briefing WHERE status = "ready"
  - Replace section by topicId in sections[]
  - Recalculate meta (totalNews, readingTimeMinutes)
  - UPDATE row
- [x] `app/(chat)/api/briefing/refresh-section/route.ts`: POST endpoint
  - Auth check
  - Load settings, topic, sources (только для topicId)
  - Fetch sources (~3-4)
  - Filter (Gemini Flash, topicIds=[topicId])
  - Generate section (Claude Sonnet)
  - Patch briefingJson в DB
  - Return updated `BriefingArticleSection`

**Файлы:**
- `lib/briefing/briefing-section-author.ts` — новый файл
- `lib/db/queries.ts` — новая функция `updateBriefingSection()`
- `app/(chat)/api/briefing/refresh-section/route.ts` — новый API route

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: клик ↻ → loading spin → секция обновляется → toast
- [x] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add lib/briefing/briefing-section-author.ts lib/db/queries.ts app/\(chat\)/api/briefing/refresh-section/route.ts
git commit -m "feat(tz-bf4): per-section refresh API + section author + DB patch"
```

---

### Этап 3: Интеграция + финализация

**Статус:** ✅ Завершён

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 2

**Задачи:**
- [x] `briefing-page-client.tsx`: подключить `handleRefreshSection` к реальному API
  - `fetch("/api/briefing/refresh-section", { method: "POST", body: { topicId } })`
  - `setCurrentArticle(prev => ({ ...prev, sections: patched }))`
  - toast.success / toast.error
- [x] Баг: bookmark auto-reset после refresh (content-based matching)
- [x] Tooltip унификация (Radix UI Tooltip на все icon-кнопки) + docs/design-system.md раздел 6
- [x] Финальное мануальное тестирование (пользователь)
- [x] Обновить CHANGELOG.md
- [x] Обновить SIMPLY_STATUS.md
- [x] Обновить CLAUDE.md
- [x] Обновить package.json (3.42.0)
- [x] Переместить папку в _archive/

**Валидация:**
- [x] `npm run build` — успешен
- [x] Браузер: клик ↻ на секции → loading spin → секция обновляется → toast
- [x] Браузер: остальные секции не затронуты
- [x] Браузер: bookmark status корректен (content-based matching)
- [x] Документация актуальна

**Git (после валидации):**
```bash
git add -A
git commit -m "chore(tz-bf4): finalize v3.42.0 — PerSectionRefresh"
```

**Критерий готовности:** Пользователь может обновить любую тему по отдельности. UX как в Apple News — обнови то, что нужно, прямо сейчас.
