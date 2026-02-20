# Roadmap ТЗ-А3: Briefing Author

**Создан:** 2026-02-20
**Версия проекта:** 3.30.0 → 3.31.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 4 |
| Текущий этап | 1 |
| Сессий (оценка) | 1-2 |

---

## Этап 1: Новые типы + промпт + модуль автора

**Статус:** ✅ Завершён

**Цель:** Создать новый backend-модуль `briefing-author.ts` с типами и Zod-схемами. Ничего пока не ломается — старый код продолжает работать.

**Задачи:**
- [x] Заменить типы в `lib/briefing/briefing-types.ts` — удалить `BriefingJSON/BriefingBlock/BriefingItem`, добавить `BriefingArticle/BriefingArticleSection/BriefingArticleSource/BriefingArticleMeta`
- [x] Скопировать промпт `briefing-author.md` из specs → `lib/prompts/briefing/briefing-author.md` (поле `sources` уже в промпте)
- [x] Создать `lib/briefing/briefing-author.ts` — функция `generateArticle()`, Zod-схемы, паттерн из analyzer (Google AI, fallback model, tier mapping)
- [x] Добавить в `briefing-config.ts` константу `AUTHOR_MODEL` (вместо `ANALYZER_MODEL`) + обновить fallback

**Файлы:**
- `lib/briefing/briefing-types.ts` — замена типов
- `lib/prompts/briefing/briefing-author.md` — новый (из specs)
- `lib/briefing/briefing-author.ts` — новый
- `lib/briefing/briefing-config.ts` — переименование констант

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок (⚠️ ОЖИДАЕМЫ ошибки в файлах, импортирующих старые типы — briefing-active-page.tsx, briefing-card.tsx, briefing-analyzer.ts. Это ОК, они будут исправлены в Этапах 2-3)
- [ ] Модуль `briefing-author.ts` компилируется без ошибок

**Git (после валидации):**
```bash
git add lib/briefing/briefing-types.ts lib/briefing/briefing-author.ts lib/briefing/briefing-config.ts lib/prompts/briefing/briefing-author.md
git commit -m "feat(tz-a3): briefing author module + new types + prompt"
```

**Критерий готовности:** Новый модуль готов к подключению в route.ts.

---

## Этап 2: Переключение pipeline + адаптация UI

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без завершения Этапа 1

**Цель:** Атомарное переключение: route.ts вызывает `generateArticle()` вместо `analyzeContent()`, UI адаптирован под `BriefingArticle`.

**Задачи:**
- [ ] Обновить `route.ts`: загрузка `getBriefingTopics()`, замена `getTopicIds()` на user topics, замена `analyzeContent()` → `generateArticle()`, `maxDuration` 60 → 90, подсчёт items через `article.meta.totalNews`
- [ ] Адаптировать `briefing-card.tsx` — `BriefingJSON` → `BriefingArticle`, `blocks.reduce(...)` → `article.meta.totalNews`
- [ ] Адаптировать `briefing-active-page.tsx` — рендер `sections` вместо `blocks`, markdown-контент + sources-список под каждой секцией
- [ ] Обработка edge case: старые записи в БД (формат BriefingJSON) — graceful fallback или показ только новых

**Файлы:**
- `app/(chat)/api/briefing/generate/route.ts` — переключение pipeline
- `components/briefing/briefing-card.tsx` — новые типы
- `components/briefing/briefing-active-page.tsx` — новый рендер секций

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: `/briefing` показывает статью (если есть новые данные) или "нет выпусков"
- [ ] Браузер: карточка на дашборде работает
- [ ] 🧪 Мануальный тест: сгенерировать новый брифинг, проверить формат статьи

**Git (после валидации):**
```bash
git add app/(chat)/api/briefing/generate/route.ts components/briefing/briefing-card.tsx components/briefing/briefing-active-page.tsx
git commit -m "feat(tz-a3): switch pipeline to author + adapt UI"
```

**Критерий готовности:** Генерация создаёт `BriefingArticle`, UI отображает секции с markdown-текстом и источниками.

---

## Этап 3: Удаление старого кода

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 2

**Цель:** Убрать мёртвый код аналитика.

**Задачи:**
- [ ] Удалить `lib/briefing/briefing-analyzer.ts`
- [ ] Удалить `lib/prompts/briefing/briefing-analyst.md`
- [ ] Проверить что нигде не осталось импортов старых файлов/типов (grep)

**Файлы:**
- `lib/briefing/briefing-analyzer.ts` — удалить
- `lib/prompts/briefing/briefing-analyst.md` — удалить

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Grep: ноль импортов `briefing-analyzer`, `briefing-analyst`, `analyzeContent`, `BriefingJSON`

**Git (после валидации):**
```bash
git add -u lib/briefing/briefing-analyzer.ts lib/prompts/briefing/briefing-analyst.md
git commit -m "chore(tz-a3): remove deprecated analyzer + analyst prompt"
```

**Критерий готовности:** Проект компилируется без старого кода.

---

## Этап 4: Финализация

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 3

**Задачи:**
- [ ] Обновить главный `CHANGELOG.md` — v3.31.0
- [ ] Обновить `SIMPLY_STATUS.md`
- [ ] Обновить `CLAUDE.md` (briefing-author вместо briefing-analyzer)
- [ ] Обновить `package.json` — версия 3.31.0
- [ ] Обновить `docs/ai-chats-map.md` — автор вместо аналитика
- [ ] Финальная валидация: `npm run build`

**Git (после валидации):**
```bash
git commit -m "docs(tz-a3): finalize v3.31.0 — briefing author"
```

**Критерий готовности:** Все документы обновлены, build проходит, версия 3.31.0.
