# Roadmap ТЗ-BF1: Привязка контента по itemId

**Создан:** 2026-02-21
**Версия проекта:** 3.36.0 → 3.37.0
**Статус:** Завершён

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 2 |
| Текущий этап | 1 |
| Сессий (оценка) | 1 |

---

## Этап 1: Реализация itemId

**Статус:** ✅ Завершён

**Цель:** Все кандидаты получают полный текст через lookup по itemId вместо url.

**Задачи:**
- [x] 1.1 Добавить `itemId?: string` в интерфейс `RawContent` (`source-fetchers/types.ts`)
- [x] 1.2 Присвоить `itemId` каждому item + построить `fullTextsMap` по itemId (`route.ts`)
- [x] 1.3 Добавить `sourceItemId` в промпт и Zod-схему фильтра (`briefing-filter.ts`)
- [x] 1.4 Заменить lookup `c.url` → `c.sourceItemId` в авторе (`briefing-author.ts`)
- [x] 1.5 Добавить debug-лог hit rate в `route.ts`

**Файлы:**
- `lib/briefing/source-fetchers/types.ts` — добавить поле `itemId`
- `app/(chat)/api/briefing/generate/route.ts` — присвоить itemId, построить map по itemId, лог hit rate
- `lib/briefing/briefing-filter.ts` — `[${item.itemId}]` в промпте, `sourceItemId` в Zod-схеме + промпт-инструкция
- `lib/briefing/briefing-author.ts` — `fullTexts.get(c.sourceItemId)` вместо `fullTexts.get(c.url)`

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] 🧪 Мануальный тест: hit rate 29/29, качество статей подтверждено

**Git (после валидации):**
```bash
git add lib/briefing/source-fetchers/types.ts lib/briefing/briefing-filter.ts lib/briefing/briefing-author.ts "app/(chat)/api/briefing/generate/route.ts"
git commit -m "feat(tz-bf1): itemId-based lookup in briefing pipeline"
```

**Критерий готовности:** `fullTexts.get(c.sourceItemId)` возвращает контент для web/jina источников (hit rate > 0).

---

⛔ НЕ НАЧИНАТЬ Этап 2 без подтверждения Этапа 1

---

## Этап 2: Финализация

**Статус:** ✅ Завершён

**Задачи:**
- [x] 2.1 Обновить главный CHANGELOG.md
- [x] 2.2 Обновить SIMPLY_STATUS.md
- [x] 2.3 Обновить CLAUDE.md (версия + завершённые ТЗ)
- [x] 2.4 Обновить package.json (версия 3.37.0)
- [ ] 2.5 Переместить папку в _archive/

**Валидация:**
- [ ] `npm run build` — успешен
- [ ] Документация актуальна
