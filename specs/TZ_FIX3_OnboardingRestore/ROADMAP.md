# Roadmap ТЗ-FIX3: Восстановление инструментов create mode

**Создан:** 2026-02-27
**Версия проекта:** 3.52.0 → 3.53.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 3 |
| Текущий этап | 1 |
| Сессий (оценка) | 1 |

---

## Этап 1: route.ts — единый набор инструментов

**Статус:** ⬜ Не начат

**Цель:** Убрать разделение tools по режимам. Create и edit получают одинаковые 5 инструментов. maxSteps=30 для обоих.

**Задачи:**
- [ ] Удалить `if (isCreateMode)` блок с startResearch tool (строки ~686-717)
- [ ] Убрать `if (!isCreateMode)` обёртку — deepResearch/fetchUrl/readTelegramChannel доступны безусловно (строки ~719-729)
- [ ] Удалить объявление `progressRef` (строка ~653-655)
- [ ] Удалить присвоение `progressRef.write` внутри createUIMessageStream (строки ~887-894)
- [ ] Удалить неиспользуемые импорты (`researchTopics`, `ResearchProgressEvent`)
- [ ] Изменить maxSteps: `const maxSteps = context === "briefing-onboarding" ? 30 : 3;` (строка ~834)
- [ ] Обновить комментарий в saveBriefingProfile — убрать ссылку на startResearch (строки ~744-747)

**Файлы:**
- `app/(chat)/api/service-chat/route.ts` — единственный файл

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: /briefing/setup — чат открывается, приветствие отображается
- [ ] 🧪 Мануальный тест: create mode — AI использует deepResearch/fetchUrl (видно в DEV-бейдже), НЕ startResearch

**Git (после валидации):**
```bash
git add app/(chat)/api/service-chat/route.ts
git commit -m "fix(tz-fix3): restore unified tools for create mode"
```

**Критерий готовности:** Create mode имеет те же 5 инструментов что и edit mode, maxSteps=30.

---

⛔ НЕ НАЧИНАТЬ Этап 2 без подтверждения Этапа 1

---

## Этап 2: Промпт v11 — убрать startResearch, единый flow

**Статус:** ⬜ Не начат

**Цель:** Обновить промпт онбординга: единый набор инструментов, последовательная работа deepResearch → fetchUrl.

**Задачи:**
- [ ] Обновить заголовок: v10 → v11, описание изменений
- [ ] `<source_discovery>`: убрать разделение create/edit, единый текст — AI ищет через deepResearch и проверяет через fetchUrl/readTelegramChannel
- [ ] `<tools_usage>`: убрать секцию "startResearch (только create)", сделать единый список для обоих режимов
- [ ] Шаг 3: если пользователь дал ссылку → fetchUrl, если @username → readTelegramChannel
- [ ] Шаг 7: deepResearch по одной теме → fetchUrl каждый источник → следующая тема
- [ ] Шаг 8: презентация проверенных источников → updateBriefingPreview
- [ ] Шаг 9: корректировки через соответствующий инструмент → updateBriefingPreview
- [ ] `<tool_rules>`: добавить — один инструмент за шаг, одна тема за вызов deepResearch
- [ ] `<self_check>`: заменить startResearch на deepResearch/fetchUrl
- [ ] `<telegram_channels>`: убрать разделение create/edit
- [ ] `<source_evaluation>`: убрать "(для edit-режима при ручном отборе)" — для обоих
- [ ] `<source_accessibility>`: убрать "В create-режиме accessibility проверяется автоматически внутри startResearch"

**Файлы:**
- `lib/prompts/service-chats/briefing-onboarding.md` — единственный файл

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок (промпт — md файл, но проверяем что ничего не сломали)
- [ ] `npm run build` — успешен
- [ ] 🧪 Мануальный тест: полный цикл create mode — собеседование → deepResearch по темам → fetchUrl → презентация → "сохрани" → saveBriefingProfile (не startResearch). Проверить DEV-бейдж.
- [ ] 🧪 Проверка: источники сохранились в БД (SQL-запрос)

**Git (после валидации):**
```bash
git add lib/prompts/service-chats/briefing-onboarding.md
git commit -m "fix(tz-fix3): prompt v11 — unified tools, sequential flow"
```

**Критерий готовности:** AI в create mode ведёт диалог → deepResearch по одной теме → fetchUrl → следующая тема → сохранение. Без повторных вызовов research при "сохрани".

---

⛔ НЕ НАЧИНАТЬ Этап 3 без подтверждения Этапа 2

---

## Этап 3: Финализация

**Статус:** ⬜ Не начат

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../DOCUMENTATION_GUIDE.md) — пройти чеклист.

**Документация (обязательная):**
- [ ] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти "✅ Чек-лист при изменениях"
- [ ] Обновить главный CHANGELOG.md
- [ ] Обновить SIMPLY_STATUS.md
- [ ] Обновить CLAUDE.md (секция Briefing UI — убрать упоминание ResearchProgressCard как live progress)
- [ ] Обновить package.json: 3.52.0 → 3.53.0

**Документация (по чеклисту — оценить каждый пункт):**
- [ ] ADR нужен? → Нет (откат к предыдущей рабочей архитектуре, не новое решение)
- [ ] docs/ai-chats-map.md нужно обновить? → Проверить (maxSteps изменился)
- [ ] docs/ai-agents.md нужно обновить? → Проверить (промпт v10 → v11)

**Завершение:**
- [ ] Финальное мануальное тестирование (пользователь)
- [ ] Переместить папку в _archive/

**Валидация:**
- [ ] `npm run build` — успешен
- [ ] Документация актуальна (проверено по чеклисту выше)
