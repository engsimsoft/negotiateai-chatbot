# Roadmap ТЗ-ExtractCompression: Extract при сжатии

**Создан:** 2026-04-08
**Версия проекта:** 3.77.0 → 3.78.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 4 |
| Текущий этап | 1 |
| Сессий (оценка) | 2-3 |

---

## Этап 1: Миграция + Загрузка истории

**Статус:** 🔄 В работе

**Цель:** Добавить `extractedAt` в message, изменить загрузку истории для simply (только неизвлечённые сообщения с safety-cap 180K).

**Задачи:**
- [x] Добавить `extractedAt: timestamp("extractedAt")` в `lib/db/schema.ts` → таблица message (Message_v2)
- [x] Создать миграцию `lib/db/migrations/0052_extract-at-column.sql` — ALTER TABLE "Message_v2" ADD COLUMN "extractedAt" TIMESTAMP
- [x] Обновить `lib/db/migrations/meta/_journal.json` (новая запись)
- [x] Добавить константу `SIMPLY_CONTEXT_LIMIT = 200_000` в `lib/ai/context-limits.ts`
- [x] Добавить константы порогов: `EXTRACT_THRESHOLD_SOFT = 0.8`, `EXTRACT_THRESHOLD_HARD = 0.95`, `EXTRACT_PAUSE_MS = 10 * 60 * 1000`
- [x] Добавить параметр `excludeExtracted?: boolean` в `getMessagesByChatId` (`lib/db/queries.ts`) — когда true, добавить `AND "extractedAt" IS NULL` в WHERE
- [x] В `app/(chat)/api/chat/route.ts` — для chatMode=simply: вызвать `getMessagesByChatId` с `{ excludeExtracted: true, maxTokens: 180000 }` вместо текущего `{ maxTokens: 140000 }`
- [x] Применить миграцию: `npm run db:migrate`
- [x] Добавить `extractedAt: null` во все конструкторы DBMessage (route.ts, task chat, service-chat)

**Файлы:**
- `lib/db/schema.ts` — добавить колонку extractedAt
- `lib/db/migrations/0052_extract-at-column.sql` — новая миграция
- `lib/db/migrations/meta/_journal.json` — обновить
- `lib/ai/context-limits.ts` — новые константы
- `lib/db/queries.ts` — параметр excludeExtracted
- `app/(chat)/api/chat/route.ts` — изменить загрузку для simply

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] SQL: `SELECT column_name FROM information_schema.columns WHERE table_name = 'Message_v2' AND column_name = 'extractedAt'` — колонка существует
- [ ] Браузер: Simply Chat работает как раньше (все сообщения extractedAt=NULL → загружаются все)
- [ ] 🧪 Мануальный тест: отправить сообщение в Simply Chat → ответ приходит нормально

**Git (после валидации):**
```bash
git add lib/db/schema.ts lib/db/migrations/ lib/ai/context-limits.ts lib/db/queries.ts app/(chat)/api/chat/route.ts
git commit -m "feat(tz-extract-compression): migration + history loading for simply"
```

**Критерий готовности:** Миграция применена, Simply Chat загружает только extractedAt IS NULL сообщения (с safety-cap 180K)

---

## Этап 2: batchExtractFacts + Триггер в route.ts

**Статус:** 🔄 В работе

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 1

**Цель:** Создать функцию batch-извлечения фактов и интегрировать триггер в chat route.

**Задачи:**
- [x] Создать промпт `lib/prompts/memory/extract-batch.md` — для batch extraction (множество пар user+assistant, один вызов Sonnet)
- [x] Создать функцию `batchExtractFacts` в `lib/ai/memory/extract.ts`:
  - Вход: `{ userId, chatId, messages: DBMessage[] }`
  - Выбрать самые старые (ASC), лимит 50 сообщений
  - Сформировать текстовый блок из пар user+assistant
  - Один вызов Sonnet (generateObject) с extract-batch.md
  - Результат → embed → dedup → store (переиспользовать существующий pipeline)
  - UPDATE message SET "extractedAt" = NOW() WHERE id IN (...)
  - Возврат: `{ processed: number, extracted: number, stored: number }`
- [x] Добавить query-helper `markMessagesExtracted(messageIds: string[])` в `lib/ai/memory/memory-queries.ts`
- [x] Добавить query `getUnextractedSimplyMessages(userId: string, limit?: number)` в `lib/db/queries.ts` — сообщения chatMode=simply, extractedAt IS NULL, ORDER BY createdAt ASC
- [x] Экспортировать `batchExtractFacts` из `lib/ai/memory/index.ts`
- [x] В `app/(chat)/api/chat/route.ts` — добавить триггер для simply перед streamText:
  - Подсчитать totalContext = systemPromptTokens + mindTokens + totalHistoryTokens + newMessageTokens
  - Определить процент: `calcUsagePercent(totalContext, SIMPLY_CONTEXT_LIMIT)`
  - Если ≥ 95% (190K) → fire-and-forget `batchExtractFacts`
  - Если ≥ 80% (160K) И пауза ≥ 10 мин → fire-and-forget `batchExtractFacts`
  - Пауза = `Date.now() - messagesFromDb[messagesFromDb.length - 1].createdAt.getTime()`

**Файлы:**
- `lib/prompts/memory/extract-batch.md` — новый промпт
- `lib/ai/memory/extract.ts` — batchExtractFacts
- `lib/ai/memory/memory-queries.ts` — markMessagesExtracted
- `lib/ai/memory/index.ts` — export
- `lib/db/queries.ts` — getUnextractedSimplyMessages
- `app/(chat)/api/chat/route.ts` — триггер

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: Simply Chat — ответ приходит без задержки (fire-and-forget)
- [ ] Логи: при приближении к порогу видно `[MIND] Batch extract triggered`
- [ ] 🧪 Мануальный тест: отправить сообщения → проверить /settings → факты появились в MIND

**Git (после валидации):**
```bash
git add lib/prompts/memory/extract-batch.md lib/ai/memory/ lib/db/queries.ts "app/(chat)/api/chat/route.ts"
git commit -m "feat(tz-extract-compression): batchExtractFacts + threshold trigger"
```

**Критерий готовности:** При достижении порога автоматически запускается batch extraction, факты появляются в MIND, старые сообщения помечаются extractedAt

---

## Этап 3: Ночной cron + Логирование

**Статус:** 🔄 В работе

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 2

**Цель:** Добавить страховочную обработку в ночной cron, логирование usage.

**Задачи:**
- [x] В `app/api/cron/memory-profile/route.ts` — перед consolidation добавить шаг: проверить необработанные simply-сообщения старше 24ч для каждого пользователя
- [x] Добавить query `getUsersWithStaleSimplyMessages(minAge: number)` — пользователи с extractedAt IS NULL + createdAt < NOW() - interval
- [x] Если есть — вызвать `batchExtractFacts` для каждого (с p-limit(3))
- [x] Добавить логирование usage для batch extraction (logUsage с chatMode = "tool:batch-extract") — уже в batchExtractFacts
- [x] Логи cron: `[cron/memory-profile] User X: batch extracted N facts from M messages`

**Файлы:**
- `app/api/cron/memory-profile/route.ts` — расширить
- `lib/db/queries.ts` — getUsersWithStaleSimplyMessages
- `lib/ai/memory/extract.ts` — logUsage внутри batchExtractFacts

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: /settings → Memory section работает
- [ ] 🧪 Мануальный тест: вызвать cron вручную (curl) → в логах видна обработка

**Git (после валидации):**
```bash
git add app/api/cron/memory-profile/route.ts lib/db/queries.ts lib/ai/memory/extract.ts
git commit -m "feat(tz-extract-compression): nightly cron safety net + usage logging"
```

**Критерий готовности:** Cron подхватывает необработанные сообщения старше 24ч

---

## Этап 4: Финализация

**Статус:** 🔄 В работе

**Задачи:**

**Документация (обязательная):**
- [x] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти чеклист
- [x] Обновить главный CHANGELOG.md
- [x] Обновить SIMPLY_STATUS.md (версия 3.78.0)
- [x] Обновить CLAUDE.md (секция MIND Memory / RAG, Context Window Management, версия)
- [x] Обновить package.json: 3.77.0 → 3.78.0

**Документация (по чеклисту):**
- [x] ADR: `docs/decisions/044-extract-on-compression.md`
- [x] docs/ai-chats-map.md — не нужно (модели не менялись)

**Завершение:**
- [x] SQL-проверка БД (extractedAt колонка — на месте)
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] Финальное мануальное тестирование (пользователь)
- [ ] Переместить папку в `_archive/`

**Валидация:**
- [x] `npm run build` — успешен
- [x] Документация актуальна
