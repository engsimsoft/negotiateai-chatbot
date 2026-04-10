# Roadmap ТЗ-MapReduce: Briefing Author → Map-Reduce

**Создан:** 2026-04-09
**Версия проекта:** 3.81.0 → 3.82.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 3 |
| Текущий этап | 1 |
| Сессий (оценка) | 1 |

---

## Этап 1: Map-Reduce Author

**Статус:** ✅ Завершён

**Цель:** Заменить монолитный `generateArticle()` на Map-Reduce pipeline.

**Задачи:**

**Новые функции в `briefing-author.ts`:**
- [x] `generateArticleMapReduce(input: AuthorInput)` — оркестратор (Map → Reduce → Assemble)
- [x] `groupCandidatesByTopic(candidates, userTopics)` — группировка кандидатов по topicId
- [x] `generateIntroOutro(sections, volume, date, language, userId, catalog)` — reduce-шаг M2.7
- [x] `assembleBriefingArticle(title, intro, sections, outro)` — чистая функция
- [x] `getTopicHeadlines()` + `getPreviousUrls()` — extract per-topic dedup context

**Обновить `briefing-pipeline.ts`:**
- [x] Заменить `generateArticle()` → `generateArticleMapReduce()`
- [x] Per-section progress callback: "Пишем секцию 1/4: 🏎 F1"

**Partial failure:**
- [x] `Promise.allSettled` — failed sections пропускаются с warning
- [x] Throw только если ВСЕ секции упали

**Файлы:**
- `lib/briefing/briefing-author.ts` — новые функции + промпт intro/outro
- `lib/briefing/briefing-pipeline.ts` — замена вызова + progress events

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] 🧪 Мануальный тест: аккаунт с 1 темой → брифинг генерируется
- [ ] 🧪 Мануальный тест: аккаунт с 5+ темами → брифинг генерируется БЕЗ disconnect
- [ ] 🧪 Мануальный тест: intro/outro связывают все темы

**Git (после валидации):**
```bash
git add lib/briefing/briefing-author.ts lib/briefing/briefing-pipeline.ts
git commit -m "feat(tz-map-reduce): Briefing Author Map-Reduce pipeline — v3.82.0"
```

**Критерий готовности:** Брифинг генерируется на аккаунте с любым количеством тем без disconnect

---

## Этап 2: Cleanup + Trace

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 1

**Цель:** Удалить старый монолитный путь. Агрегация trace для DevPanel.

**Задачи:**
- [ ] Удалить старую `generateArticle()` из briefing-author.ts (или переименовать в `_legacyGenerateArticle` если нужен fallback)
- [ ] Убрать topicId deduplication из author (Map-Reduce не создаёт дубли — каждая тема генерируется отдельно)
- [ ] Trace: агрегировать per-section traces в composite trace `"author-map-reduce"`
- [ ] Добавить usage logging суммарно для Map-Reduce

**Файлы:**
- `lib/briefing/briefing-author.ts` — cleanup
- `lib/ai/pipeline-trace.ts` — optional: composite trace support

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] 🧪 DevPanel показывает trace per-section

**Git:**
```bash
git add lib/briefing/briefing-author.ts lib/ai/pipeline-trace.ts
git commit -m "refactor(tz-map-reduce): cleanup monolithic author + composite trace"
```

---

## Этап 3: Финализация

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 2

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../DOCUMENTATION_GUIDE.md) — пройти чеклист.

**Задачи:**

**Документация (обязательная):**
- [ ] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти чеклист
- [ ] Обновить главный CHANGELOG.md
- [ ] Обновить SIMPLY_STATUS.md
- [ ] Обновить CLAUDE.md (Briefing секция — Map-Reduce)
- [ ] Обновить package.json: 3.81.0 → 3.82.0

**Документация (по чеклисту):**
- [ ] ADR: `docs/decisions/046-briefing-map-reduce.md`
- [ ] docs/ai-chats-map.md → обновить briefing architecture
- [ ] docs/ai-minimax.md → обновить секцию про briefing pipeline

**Завершение:**
- [ ] Финальное мануальное тестирование (пользователь)
- [ ] Переместить папку в _archive/

**Валидация:**
- [ ] `npm run build` — успешен
- [ ] Документация актуальна

**Git:**
```bash
git add -A
git commit -m "chore(tz-map-reduce): finalize docs + version bump — v3.82.0"
```
