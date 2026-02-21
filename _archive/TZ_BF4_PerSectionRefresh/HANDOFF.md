# Handoff ТЗ-BF4: PerSectionRefresh

**Последнее обновление:** 2026-02-21
**Статус:** Фаза 2 завершена, начинаем разработку

---

## Текущее состояние

- [x] SPEC.md — написан
- [x] ANALYSIS.md — глубокий анализ pipeline
- [x] ROADMAP.md — 3 этапа
- [ ] Этап 1: UI
- [ ] Этап 2: Backend
- [ ] Этап 3: Интеграция

## Контекст для следующей сессии

### Ключевые файлы:
- `components/briefing/briefing-article-view.tsx` — ArticleSection (line ~166), кнопки Copy/Bookmark
- `components/briefing/briefing-page-client.tsx` — article prop (нужно поднять в state)
- `app/(chat)/api/briefing/generate/route.ts` — текущий pipeline (reference)
- `lib/briefing/briefing-author.ts` — текущий author (reference для section author)
- `lib/db/queries.ts` — `saveBriefingHistory()`, `getBriefingHistory()`

### Архитектурные решения:
- Не streaming (простой POST + loading state)
- Не менять DB schema (JSONB patch)
- Одна тема за раз
- Tooltip на кнопке refresh
