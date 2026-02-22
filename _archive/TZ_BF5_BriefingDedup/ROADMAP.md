# Roadmap ТЗ-BF5: Дедупликация контента между брифингами

**Создан:** 2026-02-22
**Версия проекта:** 3.44.0 → 3.45.0
**Статус:** ✅ Завершён

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 3 |
| Текущий этап | 3 (завершён) |
| Сессий (оценка) | 1 |

---

## Этапы

### Этап 1: Backend — queries + prompt + author

**Статус:** ✅ Завершён

**Цель:** Реализовать хранение предыдущего брифинга, извлечение headlines, обновить промпт Author и функцию генерации.

**Задачи:**

- [x] 1.1. Изменить `deleteOldBriefingHistory()` в `queries.ts` — добавить параметр `keepLast: number = 1`. Логика: оставить последние N ready-записей, удалить остальные (с Blob-очисткой только для удаляемых)
- [x] 1.2. Добавить `getPreviousBriefing()` в `queries.ts` — загрузить последний ready-брифинг, вернуть `{ generatedAt: string, article: BriefingArticle } | null`
- [x] 1.3. Обновить `briefing-author.md` — добавить секцию "Предыдущий выпуск" после "Приоритеты при отборе из candidates", перед "Структура выпуска" (текст из PE: briefing-author-dedup-v6.md)
- [x] 1.4. Добавить `buildPreviousHeadlines()` в `briefing-author.ts` — форматирование `BriefingArticle.sections[].sources[].title` в строку для промпта. Fallback: первые 10 слов content если sources пусты
- [x] 1.5. Расширить `generateBriefingArticle()` в `briefing-author.ts` — новый опциональный параметр `previousBriefing: { generatedAt: string, article: BriefingArticle } | null`
- [x] 1.6. Расширить `buildUserMessage()` в `briefing-author.ts` — вставить блок "Предыдущий выпуск" между темами пользователя и кандидатами (если previousBriefing !== null)

**Файлы:**
- `lib/db/queries.ts` — изменить deleteOldBriefingHistory, добавить getPreviousBriefing
- `lib/briefing/briefing-author.ts` — buildPreviousHeadlines, расширить generateBriefingArticle + buildUserMessage
- `lib/prompts/briefing/briefing-author.md` — секция "Предыдущий выпуск"

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] 🧪 Мануальный тест: сгенерировать брифинг → проверить что предыдущий не удалился из БД → сгенерировать ещё раз → проверить что Author получил контекст (через логи/console)

**Git (после валидации):**
```bash
git add lib/db/queries.ts lib/briefing/briefing-author.ts lib/prompts/briefing/briefing-author.md
git commit -m "feat(tz-bf5): dedup queries, prompt, and author integration"
```

**Критерий готовности:** `generateBriefingArticle()` принимает previousBriefing и формирует корректный промпт с headlines предыдущего выпуска. `deleteOldBriefingHistory(keepLast:1)` сохраняет последний ready-брифинг.

---

### Этап 2: Интеграция в routes (generate + refresh-section)

**Статус:** ✅ Завершён

**Цель:** Подключить дедупликацию в оба endpoint-а: полная генерация и посекционное обновление.

**Задачи:**

- [x] 2.1. Интегрировать в `generate/route.ts` — загрузить `getPreviousBriefing()` ПЕРЕД `deleteOldBriefingHistory()`, вызвать `deleteOldBriefingHistory({ userId, keepLast: 1 })`, передать previousBriefing в `generateBriefingArticle()`
- [x] 2.2. Интегрировать в `refresh-section/route.ts` — загрузить предыдущий брифинг, передать headlines конкретной темы в `generateSection()`
- [x] 2.3. Расширить `generateSection()` в `briefing-section-author.ts` — принять previousHeadlines (строка), вставить в user message

**Файлы:**
- `app/(chat)/api/briefing/generate/route.ts` — интеграция pipeline
- `app/(chat)/api/briefing/refresh-section/route.ts` — интеграция per-section refresh
- `lib/briefing/briefing-section-author.ts` — расширить generateSection + buildSectionUserMessage

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] 🧪 Мануальный тест:
  1. Сгенерировать брифинг (первый раз — без дедупа, работает как раньше)
  2. Сгенерировать повторно — проверить что новый выпуск отличается от предыдущего (не те же заголовки)
  3. Обновить одну секцию (↻) — проверить что обновлённая секция не повторяет предыдущую

**Git (после валидации):**
```bash
git add app/(chat)/api/briefing/generate/route.ts app/(chat)/api/briefing/refresh-section/route.ts lib/briefing/briefing-section-author.ts
git commit -m "feat(tz-bf5): integrate dedup into generate and refresh-section routes"
```

**Критерий готовности:** При повторной генерации Author получает headlines предыдущего выпуска. При per-section refresh section-author получает headlines конкретной темы. Первая генерация (без предыдущего) работает без изменений.

---

### Этап 3: Финализация

**Статус:** ✅ Завершён

**Задачи:**
- [x] 3.1. Финальное мануальное тестирование (пользователь) — дедупликация подтверждена: совпадение headlines ~60% → <15%
- [x] 3.2. Обновить главный CHANGELOG.md
- [x] 3.3. Обновить SIMPLY_STATUS.md
- [x] 3.4. Обновить CLAUDE.md (версия 3.45.0, +ТЗ-BF5 в завершённые)
- [x] 3.5. Обновить package.json (версия 3.45.0)
- [x] 3.6. ADR 018: Prompt Engineering Lessons (живой документ)
- [x] 3.7. Переместить папку в _archive/ (после коммита)

**Валидация:**
- [x] `npm run build` — успешен
- [x] Все функции работают в браузере
- [x] Документация актуальна и верифицирована

**Git (после валидации):**
```bash
git add -A
git commit -m "chore(tz-bf5): finalize v3.45.0 — BriefingDedup"
```
