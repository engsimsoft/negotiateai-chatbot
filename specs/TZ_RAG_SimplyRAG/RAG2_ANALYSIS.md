# Анализ ТЗ-RAG2: MIND Consolidation + Profile + UI

## Резюме

RAG-2 укрепляет систему памяти из RAG-1: добавляет ревизию фактов (Sonnet), ночной профиль (Opus), и UI для пользователя. Три независимых модуля, все опираются на существующую инфраструктуру RAG-0/RAG-1.

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.
> Каждая рекомендация требует согласования с архитектором.

### ✅ Согласен с ТЗ

- **Cron Opus-профиль** — паттерн из `app/api/cron/briefing/route.ts` (CRON_SECRET, p-limit, saveCronRunLog) полностью подходит. Копируем структуру.
- **UI в `/settings`** — существующая секционная структура (`settings-page.tsx:50-65`, Section type union) легко расширяется на "memory" секцию.
- **Два слоя контекста** (профиль + retrieval) — profile inject в `retrieve.ts:formatMemoryForPrompt()` перед фактами — чистое решение.
- **Fire-and-forget паттерн** для консолидации — аналогично extract в `chat/route.ts:1103`.
- **Cost tracking** — chatMode конвенции `memory:consolidate`, `memory:profile` — согласуется с `memory:embed`, `memory:search`, `memory:extract`.

### ⚠️ Рекомендую изменить

| # | Было (ТЗ) | Рекомендация | Обоснование из кода |
|---|-----------|--------------|-------------------|
| 1 | Консолидация каждые 5-10 сообщений в chat route | **Отложить консолидацию до RAG-2.5 или сделать ночной.** Inline-триггер в chat route усложняет и без того тяжёлый файл (1130+ строк). Для 1000 пользователей batch-ревизия в cron эффективнее и предсказуемее по стоимости. | `chat/route.ts` уже содержит retrieve + extract + guardian + debug events + context management. Ещё один async fire-and-forget увеличивает risk surface. |
| 2 | `memoryEnabled` как колонка в User таблице | **Отдельная таблица `memory_settings` (userId UNIQUE)** или добавить в `briefingSettings` паттерн — отдельная таблица настроек. | `User` таблица (`schema.ts:41-55`) — это auth entity, уже 10 колонок. Прецедент: `briefingSettings` — отдельная таблица для per-feature настроек. Расширяемость: в будущем появятся categoryFilters, retentionDays и т.д. |
| 3 | Cron в 3:00 MSK (= 0:00 UTC) | **Cron в 0:00 UTC (3:00 MSK) — `"0 0 * * *"`**. Hobby plan = 1 cron slot max? Нет: Vercel Hobby поддерживает множественные cron jobs. Но нужно проверить maxDuration: Opus на 500+ фактов может занять 30-60 сек per user. | `vercel.json` сейчас имеет 1 cron (briefing 5:00 UTC). Добавляем второй: `0 0 * * *` (= 3:00 MSK). Хронология: 3:00 MSK профиль → 8:00 MSK брифинг. |
| 4 | Новая таблица `user_profile_summary` | ✅ Согласен, но уточнение: **добавить `tokenCount`** (сколько токенов в профиле — для бюджета контекста) и **`costUsd`** (стоимость генерации). | Паттерн из `cronRunLog` — сохранять cost forensics. Opus не дешёвый (50₽/профиль), нужна прозрачность. |

### ❓ Требует уточнения

1. **Консолидация — inline или batch?**
   - ТЗ: каждые 5-10 сообщений (inline trigger в chat route)
   - Рекомендация: ночной batch в том же cron что и профиль (consolidate → profile). Проще, дешевле, предсказуемее.
   - Если архитектор настаивает на inline — готов реализовать через counter в session/DB.

2. **Opus-профиль: на каких пользователей генерировать?**
   - Всех с `memoryEnabled=true`? Или только с N+ фактами?
   - Рекомендация: только пользователи с >= 10 активных фактов. На 3 фактах Opus-профиль — пустая трата.

3. **UI: отдельная страница `/settings/memory` или секция на `/settings`?**
   - ТЗ говорит `/settings/memory` (отдельная страница)
   - Текущая архитектура: `/settings` = одна страница с секциями (profile, account, connections, appearance)
   - Рекомендация: **новая секция "Память"** на той же странице. Соответствует текущему паттерну. Если список фактов длинный — внутри секции пагинация.

4. **Ссылка на чат из факта**: `sourceChatId` уже есть в `memory_entry`. Нужно построить URL (`/chat/${chatId}`). Но факты из удалённых чатов (`onDelete: "set null"`) — показывать без ссылки.

## Потенциальные риски

1. **Opus стоимость на масштабе**: 50₽/день × 1000 пользователей = 50,000₽/день. Нужен порог: только пользователи с достаточным кол-вом фактов.
2. **Cron timeout**: Opus на 1000 пользователей × 30-60 сек = потенциально 8-16 часов. p-limit(3) помогает, но maxDuration=240 (4 мин) на Hobby plan — это ограничение. Нужно: batch по N пользователей, или Pro plan.
3. **Race condition**: консолидация + extract одновременно могут supersede один и тот же факт. Нужен механизм: либо advisory lock, либо optimistic check (re-read before supersede).
4. **Большие профили**: 800-1200 слов = ~400-600 токенов. На Opus input это нормально, но нужно следить чтобы profile + retrieval + system prompt не превысили бюджет.

## Зависимости

- RAG-0 ✅ (pgvector, Voyage client)
- RAG-1 ✅ (extract, retrieve, memory_entry table)
- Existing cron pattern (briefing)
- Existing settings UI pattern

## Оценка сложности

- [x] Среднее (3-5 сессий)
  - Этап 1: DB + memory_settings + profile table — 1 сессия
  - Этап 2: Consolidation logic + prompts — 1 сессия
  - Этап 3: Opus profile cron — 1 сессия
  - Этап 4: UI секция "Память" — 1 сессия
  - Этап 5: Integration (profile inject, two-layer context) — 1 сессия
  - Этап 6: Финализация — 0.5 сессии
