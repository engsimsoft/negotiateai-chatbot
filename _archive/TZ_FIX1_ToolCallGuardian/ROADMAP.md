# Roadmap ТЗ-FIX1: Tool Call Guardian (Фаза 1 — Detection & Logging)

**Создан:** 2026-02-26
**Версия проекта:** 3.49.0 → 3.50.0
**Статус:** ✅ Завершён

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 4 |
| Текущий этап | 4 (завершён) |
| Сессий | 3 |

**Scope Фазы 1:** Только detection + logging. Без буферизации, без retry, без UI. Routes: chat + service-chat.

---

## Этап 1: Детектор галлюцинаций

**Статус:** ✅ Завершён

**Цель:** Создать shared модуль детекции tool hallucinations с паттернами для русского и английского языков.

**Задачи:**
- [x] Изучить существующие tool names в `lib/ai/tools/chat-tools.ts` и `lib/ai/tool-activity-config.ts`
- [x] Создать `lib/ai/tool-call-guardian.ts`:
  - `TOOL_PATTERNS` — regex + keyword lists (tool names, глаголы-маркеры, фейковый прогресс)
  - `detectToolHallucination(text, toolCallCount)` → `{ detected, confidence, details }`
  - `isResultClaim(text)` — отделяет "утверждение о результате" от "описания плана"
  - `GuardianStepState` — интерфейс для трекинга per-step (toolCallCount, textChunks)
  - `createStepTracker()` — фабрика для трекинга событий внутри instrumentedStream
- [x] Покрыть edge cases:
  - Легитимное упоминание: "я могу использовать deepResearch" → НЕ галлюцинация
  - Утверждение без вызова: "канал живой, 15 постов" → ГАЛЛЮЦИНАЦИЯ
  - После реального tool_call: "нашёл 5 источников" → НЕ галлюцинация (toolCallCount > 0)

**Файлы:**
- `lib/ai/tool-call-guardian.ts` — **новый**

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] 🧪 Мануальный тест не требуется (нет UI изменений)

**Git (после валидации):**
```bash
git add lib/ai/tool-call-guardian.ts
git commit -m "feat(tz-fix1): tool call guardian detector module"
```

**Критерий готовности:** Модуль экспортирует `detectToolHallucination`, `createStepTracker`, `TOOL_PATTERNS`. TypeScript компилируется без ошибок.

---

## Этап 2: Интеграция в routes

**Статус:** ✅ Завершён

**Цель:** Встроить Guardian в chat route и service-chat route. Детекция на `step-finish`, логирование в console.

**Задачи:**
- [x] **Chat route** (`app/(chat)/api/chat/route.ts`):
  - Импортировать `createStepTracker` из guardian
  - В `instrumentedStream`: создать `stepTracker`
  - На `step-start`: `stepTracker.reset()`
  - На `text-delta`: `stepTracker.addText(chunk)`
  - На `tool-input-start`: `stepTracker.addToolCall(toolName)`
  - На `step-finish`: `const result = stepTracker.analyze()` → если `result.detected` → `console.warn('[Guardian]', result)`
  - Собирать guardian results в массив для передачи в `saveAiUsageLog`
- [x] **Service-chat route** (`app/(chat)/api/service-chat/route.ts`):
  - Рефакторинг: заменить `result.toUIMessageStreamResponse()` на `createUIMessageStream` + writer + merge
  - Добавить `instrumentedStream` с Guardian логикой (аналогично chat route)
  - Убедиться что все 4 контекста (ben, project-creation, project-manager, briefing-onboarding) работают
  - Сохранить async persistence для project-manager

**Файлы:**
- `app/(chat)/api/chat/route.ts` — изменение instrumentedStream
- `app/(chat)/api/service-chat/route.ts` — рефакторинг стриминга + Guardian

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: обычный чат работает, стриминг плавный, tool calls отображаются
- [x] Браузер: service-chat (Бен) работает — открыть ❓, задать вопрос
- [x] Браузер: briefing-onboarding работает — открыть /briefing/setup, начать настройку
- [x] Console: при нормальной работе нет `[Guardian] Hallucination detected`
- [x] 🧪 Мануальный тест пользователем: чат + service-chat + briefing-onboarding

**Git (после валидации):**
```bash
git add app/(chat)/api/chat/route.ts app/(chat)/api/service-chat/route.ts
git commit -m "feat(tz-fix1): integrate guardian into chat and service-chat routes"
```

**Критерий готовности:** Guardian работает в обоих routes. Логи появляются при детекции. Нет регрессий в стриминге и UI.

---

## Этап 3: Миграция БД + запись в ai_usage_log

**Статус:** ✅ Завершён

**Цель:** Добавить `guardianFlags jsonb` в `ai_usage_log`, записывать результаты детекции.

**Задачи:**
- [x] Добавить колонку `guardianFlags` в схему (`lib/db/schema.ts` → `aiUsageLog`)
- [x] Создать миграцию: `ALTER TABLE ai_usage_log ADD COLUMN "guardianFlags" jsonb DEFAULT NULL`
- [x] Применить миграцию: `npm run db:migrate`
- [x] Обновить `saveAiUsageLog` в `lib/db/queries.ts` — добавить optional параметр `guardianFlags`
- [x] В chat route: передать guardian results в `saveAiUsageLog` через `createUIMessageStream.onFinish`
- [ ] В service-chat route: нет usage logging (будет добавлен при необходимости)
- [x] Проверить SQL: колонка `guardianFlags` jsonb существует

**Файлы:**
- `lib/db/schema.ts` — +колонка guardianFlags
- `lib/db/migrations/XXXX_guardian-flags.sql` — новая миграция
- `lib/db/queries.ts` — обновить saveAiUsageLog
- `app/(chat)/api/chat/route.ts` — передать guardianFlags
- `app/(chat)/api/service-chat/route.ts` — передать guardianFlags (если есть usage logging)

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] SQL: колонка `guardianFlags` существует в `ai_usage_log`
- [x] SQL: после тестового чата запись с `guardianFlags = null` (нет галлюцинаций) или json (если были)
- [x] 🧪 Мануальный тест пользователем: отправить сообщение в чат, проверить что запись в БД создаётся

**Git (после валидации):**
```bash
git add lib/db/schema.ts lib/db/migrations/ lib/db/queries.ts app/(chat)/api/chat/route.ts app/(chat)/api/service-chat/route.ts
git commit -m "feat(tz-fix1): guardian flags in ai_usage_log"
```

**Критерий готовности:** Колонка существует, записи создаются, можно query-ть по `guardianFlags IS NOT NULL`.

---

## Этап 4: Финализация

**Статус:** ✅ Завершён

**Цель:** Документация, версия, архивация. Убедиться что всё работает в production-ready состоянии.

**Задачи:**
- [x] Финальное мануальное тестирование (пользователь):
  - Обычный чат — стриминг, tools работают
  - Service-chat (Бен) — отвечает
  - Briefing onboarding — настройка тем, deepResearch вызывается реально
  - Проверить console logs при нормальной работе
- [x] Обновить главный CHANGELOG.md
- [x] Обновить SIMPLY_STATUS.md
- [x] Обновить CLAUDE.md (добавить `lib/ai/tool-call-guardian.ts` в структуру)
- [x] Обновить package.json: 3.49.0 → 3.50.0
- [ ] Переместить папку в _archive/

**Файлы:**
- `CHANGELOG.md` — главный changelog
- `SIMPLY_STATUS.md` — статус проекта
- `CLAUDE.md` — структура кода
- `package.json` — версия

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] SQL: `SELECT COUNT(*) FROM ai_usage_log WHERE "guardianFlags" IS NOT NULL` → 0 (нет галлюцинаций в тестах — корректно)
- [x] Все routes работают без регрессий
- [x] Документация актуальна
- [x] 🧪 Мануальный тест пользователем: финальная проверка всех routes

**Git (после валидации):**
```bash
git add CHANGELOG.md SIMPLY_STATUS.md CLAUDE.md package.json
git commit -m "chore(tz-fix1): finalize v3.50.0 — Tool Call Guardian"
```

**Критерий готовности:** Все документы обновлены, версия 3.50.0, папка в _archive/.
