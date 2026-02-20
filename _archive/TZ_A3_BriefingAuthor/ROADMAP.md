# Roadmap ТЗ-А3: Briefing Author

**Создан:** 2026-02-20
**Версия проекта:** 3.30.0 → 3.31.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 4 (объединены 1-3 в один коммит) |
| Текущий этап | 4 (ожидание теста) |
| Сессий (оценка) | 1 |

---

## Этапы 1-3: Модуль автора + pipeline + удаление старого кода

**Статус:** ✅ Завершён (объединены — build требовал атомарного переключения)

**Коммит:** `792d62b` feat(tz-a3): briefing author — article format replaces JSON cards

**Что сделано:**
- [x] Новые типы: `BriefingArticle/Section/Source/Meta` в briefing-types.ts
- [x] Промпт: `briefing-author.md` скопирован в lib/prompts/briefing/
- [x] Модуль: `briefing-author.ts` — generateArticle(), Zod-схемы, tier mapping, fallback
- [x] Config: `AUTHOR_MODEL` / `AUTHOR_MODEL_FALLBACK`, maxDuration 90
- [x] Route.ts: getBriefingTopics, user topicIds, generateArticle вместо analyzeContent
- [x] briefing-card.tsx: article.meta.totalNews вместо blocks.reduce
- [x] briefing-active-page.tsx: markdown sections + source cards + old format guard
- [x] Удалён briefing-analyzer.ts
- [x] Удалён briefing-analyst.md
- [x] Grep: ноль импортов старых файлов/типов

**Валидация:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] 🧪 Мануальный тест: сгенерировать брифинг, проверить формат статьи

---

## Этап 4: Финализация

**Статус:** ✅ Завершён

**Задачи:**
- [x] Обновить главный `CHANGELOG.md` — v3.31.0
- [x] Обновить `SIMPLY_STATUS.md`
- [x] Обновить `CLAUDE.md` (briefing-author вместо briefing-analyzer)
- [x] Обновить `package.json` — версия 3.31.0
- [x] Обновить `docs/ai-chats-map.md` — автор вместо аналитика
- [x] Финальная валидация: `npm run build`

**Git (после валидации):**
```bash
git commit -m "docs(tz-a3): finalize v3.31.0 — briefing author"
```

**Критерий готовности:** Все документы обновлены, build проходит, версия 3.31.0.
