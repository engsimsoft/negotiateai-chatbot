# Анализ ТЗ-MindOnVisit

## Резюме

Заменить ночной cron `memory-profile` (покрывающий только Simply) на on-visit trigger для всех 4 chat режимов. Триггер — при отправке сообщения, если прошло > N минут с прошлой проверки (дебаунс через поле в `MemorySettings`). Обработка fire-and-forget, UI не блокируется.

## Изученная документация

**Правило 1 WORKFLOW (official docs FIRST).** Изучены актуальные источники апрель 2026.

### Next.js `after()` API — КЛЮЧЕВАЯ НАХОДКА

Официальная документация: https://nextjs.org/docs/app/api-reference/functions/after

- **Стабильный** с Next.js v15.1.0 (у нас `15.5.10`, поддерживается).
- Поддерживается в Route Handlers, Server Functions, Server Components.
- На Vercel serverless использует `waitUntil` — продлевает жизнь invocation до завершения промиса.
- Выполняется даже если response упал с ошибкой / redirect / notFound.
- Существующие импорты `from "next/server"` у нас в 24 файлах. Вызовов `after(` сейчас **0** — будет первое применение.

**Почему это важно для ТЗ:** наш текущий паттерн для фоновой обработки — `void (async () => {...})()` + `.catch()` — **не надёжен на Vercel**. Serverless invocation завершается после response, запущенная промис может быть оборвана до завершения extract. `after()` гарантированно доводит задачу до конца.

### AI Memory best practices 2026

- **Mem0 blog (State of AI Agent Memory 2026)** — «memory writes that block the response pipeline add latency the user feels, async mode became the default in v1.0.0». Extraction обязана быть async.
- **Spring AI AutoMemoryToolsAdvisor (апрель 2026, Spring blog)** — паттерн `memoryConsolidationTrigger predicate`: «when it returns true, a system reminder is injected into the next request» — индустриальный паттерн predicate-triggered консолидации. Наш дебаунс через `lastMindCheckAt` реализует ровно это.
- **Letta sleep-time compute** (уже цитировалось в родительском ТЗ MindConsolidationTriggers v2) — consolidation в idle periods. On-visit trigger = consumer-вариант того же паттерна (idle «между визитами», обработка на старте следующего визита).

### Drizzle migrations

- Workflow: `drizzle-kit generate` → файл в `lib/db/migrations/` → автоматически применяется в `npm run build` через `tsx lib/db/migrate && next build`.
- Пример аналогичной миграции (добавление колонки): `lib/db/migrations/0049_memory-settings-and-profile.sql`.

**Красных флагов нет.** Next.js 15.5 поддерживает `after()`, Drizzle workflow отработан.

## Код-ревью SPEC (Senior Dev Review)

### ✅ Согласен со SPEC
- Решение заменить cron на on-visit — правильное для consumer AI без автономных потребителей MIND.
- Не трогать `batchExtractFacts` и consolidation-цепочку — корректный scope.
- Fire-and-forget обязателен — UI блокировать нельзя.

### ⚠️ Рекомендую уточнить

| # | Было (SPEC) | Рекомендация | Обоснование из кода |
|---|---|---|---|
| 1 | «On-visit trigger во всех 4 chat route» | Точнее: **в 2 route handler-ах**. `app/(chat)/api/chat/route.ts` обрабатывает simply/expertise/create, `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` обрабатывает project task chat. SPEC говорит «4 route», но технически 2 файла. | [route.ts:405-663](../../app/(chat)/api/chat/route.ts#L405) — один handler, ветвление по chatMode; task-expert handler — отдельный файл. |
| 2 | «При открытии чата» | «При **отправке сообщения**, если прошло > N минут с последней проверки». Server component `page.tsx` не гарантирует свежий вызов (RSC кеширование). Client-side ping = лишний endpoint. Гарантированно срабатывает — hook в route handler, который и так вызывается при каждом сообщении. Для пользователя неотличимо — он заходит и сразу пишет. | RSC behavior; существующий pattern в chat/route.ts. |
| 3 | «Хранить `lastMindCheckAt` в `MemorySettings`» | Требует миграцию БД (новая колонка). Это hard-to-reverse change, предупредить владельца **ДО** запуска `npm run build` (правило 5 CLAUDE.md). Альтернатива in-memory Map не работает на serverless (каждый invocation = новый инстанс). | [schema.ts:840-846](../../lib/db/schema.ts#L840) — MemorySettings сейчас не содержит колонки проверки. |
| 4 | Про CRON_SECRET | **Оставить** — используется также `app/api/cron/briefing/route.ts`. В SPEC уже поправлено. | grep показал 2 consumer-а. |

### Принятые параметры (с обоснованием, без вопросов владельцу)

| Параметр | Значение | Обоснование |
|---|---|---|
| **Дебаунс `lastMindCheckAt`** | **30 минут** | Spring AI pattern — проверка при каждом вызове избыточна. 30 минут — типовая активная сессия пользователя; меньше = лишние SQL-запросы, больше = хвосты задержатся. Приемлемо 15-60, 30 — середина. |
| **Минимальный возраст сообщения («stale»)** | **0 часов** (любое с `extractedAt=NULL`) | В старом cron было 24 часа чтобы не дублировать с compaction — в on-visit конфликта нет (разные условия). Обрабатываем всё что накопилось. |
| **Механизм фона** | **Next.js `after()` из `next/server`** | Официальный стабильный API Next.js 15.1+, надёжен на Vercel serverless (waitUntil). Заменяет ненадёжный `void (async () => {...})()`. |
| **Race condition protection** | **Атомарный UPDATE с WHERE + RETURNING** | `UPDATE memorySettings SET lastMindCheckAt=NOW() WHERE userId=? AND (lastMindCheckAt IS NULL OR lastMindCheckAt < NOW() - 30min) RETURNING userId` — если RETURNING пусто, значит проверка недавно прошла, skip. Без advisory locks. |
| **Обновление `lastMindCheckAt`** | **До начала extract (lock-semantics)** | Предотвращает гонку повторного запуска. Если extract упадёт — следующая попытка через 30 минут, это приемлемо (фоновый процесс, не user-facing). |

## Потенциальные риски

1. **Нагрузка при первом визите после долгого перерыва.** Пользователь неактивен месяц → первый заход → в базе накопились сообщения возможно из Simply (у которых compaction не сработал), возможно из expertise/create/project. `batchExtractFacts` ограничен `MAX_BATCH_MESSAGES = 50` — один LLM-вызов обработает максимум 50 сообщений. Если накопилось больше 50 — остальное обработается при следующем визите. Приемлемо.
2. **Retry при ошибке extract.** Если `batchExtractFacts` упал с ошибкой — `lastMindCheckAt` уже обновлён, повторная попытка только через 30 минут. Смягчение: обновлять `lastMindCheckAt` только ПОСЛЕ успешного завершения (не в начале).
3. **Миграция БД через `npm run build`.** Владелец должен быть предупреждён перед запуском — правило 5 CLAUDE.md.
4. **Наблюдаемость cron-удалена.** `CronRunLog` перестаёт пополняться записями от memory-profile. Новые server logs `[MIND on-visit]` частично компенсируют, но суммарной статистики по дням не будет.

## Зависимости

- Миграция Drizzle (новое поле `lastMindCheckAt` в `memorySettings`)
- `lib/db/queries.ts` — новая функция `claimMindCheck(userId, debounceMs)` (атомарный check-and-update) + обобщённая `getUnextractedMessagesForUser`
- `lib/ai/memory/on-visit.ts` — новый модуль с `processStaleFactsInBackground`
- 2 route handler правки
- Удаление `app/api/cron/memory-profile/` + правка `vercel.json`

## Оценка сложности

- [x] Простое (1-2 сессии)
- [ ] Среднее
- [ ] Сложное

Один коммит в финализации (правило 7 WORKFLOW).
