# Roadmap ТЗ-BR3: Интеграция промпта аналитика

**Создан:** 2026-02-19
**Версия проекта:** 3.27.0 → 3.27.1
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 3 |
| Текущий этап | 1 |
| Сессий (оценка) | 1 |

---

## Этап 1: Backend — промпт + tier

**Статус:** ✅ Завершён

**Цель:** Аналитик получает промпт из .md файла и видит tier каждого источника

**Задачи:**
- [x] Создать `lib/prompts/briefing/` и скопировать `briefing-analyst.md`
- [x] В `briefing-analyzer.ts`: заменить `buildAnalyzerPrompt()` на загрузку из файла с подстановкой 6 плейсхолдеров
- [x] В `briefing-analyzer.ts`: добавить `tierMap` в `AnalyzerInput`, подставлять tier при формировании `candidatesText`
- [x] В `route.ts`: собрать `Map<sourceName, tier>` из `sourcesToFetch` (оба пути: userSources и defaults), передать в `analyzeContent()`

**Файлы:**
- `lib/prompts/briefing/briefing-analyst.md` — новый (копия из specs)
- `lib/briefing/briefing-analyzer.ts` — загрузка промпта, tier в candidatesText
- `app/(chat)/api/briefing/generate/route.ts` — сборка tierMap, передача в analyzeContent

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] 🧪 Мануальный тест: POST /api/briefing/generate — работает, в логах видно что промпт подгружается

**Git (после валидации):**
```bash
git add lib/prompts/briefing/briefing-analyst.md lib/briefing/briefing-analyzer.ts app/(chat)/api/briefing/generate/route.ts
git commit -m "feat(tz-br3): prompt file loading + tier propagation"
```

**Критерий готовности:** `analyzeContent()` использует промпт из .md файла, tier видна в тексте кандидатов

---

## Этап 2: UI — поддержка topicId "top"

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 1

**Статус:** ✅ Завершён

**Цель:** Блок "Главное" рендерится из `topicId: "top"` (с fallback для старых брифингов)

**Задачи:**
- [x] В `briefing-content.tsx`: если есть блок `topicId === "top"` — рендерить его напрямую как "Главное", остальные блоки как есть
- [x] Fallback: если блока "top" нет — старая логика (сборка high-items из всех блоков)

**Файлы:**
- `components/briefing/briefing-content.tsx` — логика рендера "Главное"

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] Браузер: /briefing — блок "Главное" рендерится первым
- [ ] 🧪 Мануальный тест: проверить /briefing с новым и старым брифингом

**Git (после валидации):**
```bash
git add components/briefing/briefing-content.tsx
git commit -m "feat(tz-br3): support topicId 'top' in briefing UI"
```

**Критерий готовности:** Блок "top" рендерится как "Главное", старые брифинги без "top" отображаются через fallback

---

## Этап 3: Финализация

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 2

**Статус:** 🔄 В работе

**Задачи:**
- [x] Финальное мануальное тестирование (пользователь)
- [x] Обновить главный CHANGELOG.md
- [x] Обновить SIMPLY_STATUS.md
- [x] Обновить CLAUDE.md (структура: lib/prompts/briefing/, версия 3.27.1)
- [x] Обновить package.json (версия 3.27.1)
- [ ] Переместить папку в _archive/

**Валидация:**
- [ ] `npm run build` — успешен
- [ ] Документация актуальна
