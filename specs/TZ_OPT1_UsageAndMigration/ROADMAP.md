# Roadmap ТЗ-OPT1: Usage Logging + Миграция Sonnet 4.6

**Создан:** 2026-02-25
**Версия проекта:** 3.45.1 → 3.46.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 4 |
| Текущий этап | 2 |
| Сессий (оценка) | 1 |

---

## Этапы

### Этап 1: Usage Logging — Схема и функция записи

**Статус:** ✅ Завершён

**Цель:** Создать таблицу `ai_usage_log` и функцию `saveAiUsageLog()` в queries.ts

**Задачи:**
- [x] Добавить таблицу `aiUsageLog` в `lib/db/schema.ts` (uuid PK, chatId nullable FK → Chat, userId FK → User, modelId varchar, inputTokens/outputTokens/thinkingTokens/cacheWriteTokens/cacheReadTokens integer, costUsd numeric(10,6), chatMode varchar, durationMs integer nullable, createdAt timestamp default now; индексы: userId+createdAt, chatMode+createdAt)
- [x] Создать и применить Drizzle миграцию (`npm run db:migrate`)
- [x] Добавить функцию `saveAiUsageLog()` в `lib/db/queries.ts` (insert, без throw — тихий catch)
- [x] Проверить миграцию: SQL-запрос `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ai_usage_log'`

**Файлы:**
- `lib/db/schema.ts` — новая таблица aiUsageLog
- `lib/db/queries.ts` — новая функция saveAiUsageLog
- `drizzle/` — новая миграция

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] SQL: таблица `ai_usage_log` существует, колонки и типы верные
- [x] 🧪 Мануальный тест: не требуется (нет UI, только backend)

**Git (после валидации):**
```bash
git add lib/db/schema.ts lib/db/queries.ts drizzle/
git commit -m "feat(tz-opt1): ai_usage_log table and saveAiUsageLog function"
```

**Критерий готовности:** Таблица в БД, функция записи экспортирована и типизирована

---

### Этап 2: Usage Logging — Интеграция в эндпоинты

**Статус:** ✅ Завершён

**Цель:** Подключить логирование в 3 точки: main chat, task-chat, professor-pipeline

**Задачи:**
- [x] Интеграция в `app/(chat)/api/chat/route.ts` — в `onFinish` streamText, после блока TokenLens (fire-and-forget). Для project-чатов: chatMode = `project:${tier}`
- [x] Интеграция в `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — в `onFinish` streamText (fire-and-forget). chatMode = `project:${tier}`. costUsd = null (нет TokenLens)
- [x] Интеграция в `lib/ai/professor-pipeline.ts` — добавить `chatId`, `userId` в `ProfessorPipelineOptions`; логировать каждую из 3 фаз отдельно (chatMode = `project:professor`); использовать `.usage` из результата generateText/streamText

**Файлы:**
- `app/(chat)/api/chat/route.ts` — вызов saveAiUsageLog в onFinish
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — вызов saveAiUsageLog в onFinish
- `lib/ai/professor-pipeline.ts` — расширение интерфейса + логирование 3 фаз

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] 🧪 Мануальный тест: отправить сообщение в Экспертизе → проверить SQL `SELECT * FROM ai_usage_log ORDER BY "createdAt" DESC LIMIT 5`

**Git (после валидации):**
```bash
git add app/(chat)/api/chat/route.ts app/(chat)/api/projects/\[id\]/tasks/\[taskId\]/chat/route.ts lib/ai/professor-pipeline.ts
git commit -m "feat(tz-opt1): integrate usage logging into chat, task-chat, professor"
```

**Критерий готовности:** После отправки сообщения в чате — запись в `ai_usage_log` с заполненными полями

---

### Этап 3: Миграция Sonnet 4.5 → 4.6

**Статус:** ✅ Завершён

**Цель:** Переключить основную модель Sonnet на 4.6 и обновить документацию

**Задачи:**
- [x] В `lib/ai/providers.ts`: заменить 3 вхождения `claude-sonnet-4-5-20250929` → `claude-sonnet-4-6` (строки 37, 42, 48)
- [x] Обновить `docs/ai-providers.md`: таблицы моделей, алиасы, цены
- [x] Обновить `docs/ai-agents.md`: Sonnet 4.5 → 4.6
- [x] Обновить `docs/ai-chats-map.md`: Sonnet 4.5 → 4.6
- [x] Обновить `docs/ai-tools.md`: artifact-model Sonnet 4.5 → 4.6
- [x] Обновить `SIMPLY_STATUS.md`: 1 историческая строка (ТЗ-C4)

**Файлы:**
- `lib/ai/providers.ts` — 3 замены
- `docs/ai-providers.md` — таблицы моделей
- `docs/ai-agents.md` — упоминания модели
- `docs/ai-chats-map.md` — упоминания модели
- `docs/ai-tools.md` — artifact-model
- `SIMPLY_STATUS.md` — упоминания модели

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Grep: `lib/` — только `briefing-config.ts` (fallback)
- [x] 🧪 Мануальный тест: Экспертиза (claude-sonnet-4-6, $0.079, 4135ms) + Создание (claude-sonnet-4-6, $0.047, 4869ms)

**Git (после валидации):**
```bash
git add lib/ai/providers.ts docs/ SIMPLY_STATUS.md
git commit -m "feat(tz-opt1): migrate claude-sonnet from 4.5 to 4.6"
```

**Критерий готовности:** Все Sonnet-запросы идут на claude-sonnet-4-6, документация актуальна

---

### Этап 4: Финализация

**Статус:** ✅ Завершён

**Задачи:**
- [x] SQL-проверка БД: 13 колонок, 3 индекса, FK на Chat и User
- [x] Финальное мануальное тестирование — Экспертиза + Создание OK
- [x] Обновить главный `CHANGELOG.md` (v3.46.0)
- [x] Обновить `SIMPLY_STATUS.md` (блок ТЗ-OPT1, версия)
- [x] Обновить `CLAUDE.md` (версия, список завершённых)
- [x] Обновить `package.json` (3.46.0)
- [x] Верификация docs: ai-providers, ai-agents, ai-chats-map, ai-tools — все Sonnet 4.6
- [ ] Переместить папку в `_archive/`

**Валидация:**
- [x] `npm run build` — успешен
- [x] SQL: 3 записи в ai_usage_log (2 modes, 2 models)
- [x] Документация актуальна

**Git (после валидации):**
```bash
git add CHANGELOG.md SIMPLY_STATUS.md CLAUDE.md package.json
git commit -m "chore(tz-opt1): finalize v3.46.0 — UsageLogging + SonnetMigration"
```

**Критерий готовности:** Всё задокументировано, версия обновлена, ТЗ в архиве
