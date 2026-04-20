# Анализ ТЗ-COMPACTION-1

**Дата:** 2026-04-18
**Автор:** Claude Code (разработчик) — Senior Dev Review архитектурного документа v1.7
**Роль этого документа:** Фаза 1 WORKFLOW — изучить официальную документацию, прочитать кодовую базу, дать код-ревью архитектуре, задать оставшиеся вопросы архитектору. **Код не пишется в Фазе 1.**

> Архитектурный документ — [SIMPLY_COMPACTION_ARCHITECTURE.md v1.7](../Simply_xAI/SIMPLY_COMPACTION_ARCHITECTURE.md). Все 5 открытых вопросов v1.0 закрыты в v1.2-v1.7. Этот документ не оспаривает закрытые решения — только проверяет их реализуемость в текущей кодовой базе.

---

## 1. Изученная документация

> Правило 1 WORKFLOW — перед ANALYSIS.md прочитана актуальная официальная документация всех затронутых технологий. Knowledge cutoff модели = январь 2026. Сейчас апрель 2026 — проверены свежие изменения.

### 1.1 xAI API — prompt caching + structured outputs

**Источники:**
- [docs.x.ai — Prompt Caching](https://docs.x.ai/developers/advanced-api-usage/prompt-caching)
- [docs.x.ai — Maximizing Cache Hits](https://docs.x.ai/developers/advanced-api-usage/prompt-caching/maximizing-cache-hits)
- [docs.x.ai — Best Practices & FAQ](https://docs.x.ai/developers/advanced-api-usage/prompt-caching/best-practices)

**Ключевые находки:**

1. **Caching полностью автоматическое** — нет opt-in параметра, xAI кэширует все запросы сам. Это отличается от Anthropic (`cacheControl: { type: "ephemeral" }`) где нужен явный opt-in.
2. **`x-grok-conv-id` HTTP header** (для Chat Completions API, который мы используем) — **это НЕ включатель кэширования**, а **оптимизация роутинга запросов на один сервер для максимизации cache hit rate**. Без header — caching всё равно работает, но cache hit rate может быть ниже (запросы уходят на разные серверы).
3. **Архитектурный документ v1.5 формулирует неточно:** «xAI native `prompt_cache_key`». Это имя параметра для **Responses API**, которое мы **не используем** (ADR серии XAI-1 зафиксировал Chat Completions как основу). Правильно для нашего стека — `x-grok-conv-id` header. **Это не блокер**, но термин в документе v1.5 следует уточнить — в этом ANALYSIS предлагаю правку (см. §3 Finding #6).
4. **Префиксный матч.** Кэш работает «from the start of your messages array» — **никогда не модифицируй старые сообщения**. Любое редактирование/переупорядочивание старых messages ломает cache. Это **фундаментальное ограничение** для нашего rolling update (Фаза 2 compaction): previous summary должен быть **стабильным префиксом** — значит он живёт в system prompt, не в messages array, и не модифицируется append-only turn-by-turn.
5. **Cache hit reporting** в usage object — точный формат в docs не найден (fetched page обрезал). Будет уточнён в Фазе 3 при реализации через ai_usage_log.

**Следствия для архитектуры:**
- В MVP header `x-grok-conv-id` можно не добавлять — caching работает автоматически. Добавить в follow-up если метрики cache hit rate покажут что routing size важен.
- Для rolling update Фазы 2: summary блок **в system prompt**, сообщения добавляются **append-only** в messages array. Это соблюдается в архитектурном документе v1.7 (§Двухслойная история, строки 49-60) — ✅ совпадает с best practice xAI.

### 1.2 AI SDK v6 — streamText + prepareStep

**Источники:**
- [ai-sdk.dev — streamText reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)
- [Vercel AI SDK 6 blog](https://vercel.com/blog/ai-sdk-6)

**Ключевые находки:**

1. **`prepareStep` — callback, вызывается перед каждым model step, включая первый.** Может модифицировать `messages`, `system`, `toolChoice`, `activeTools` per-step. Подходит для compaction технически.
2. **Но: `prepareStep` встроен внутрь `streamText`.** Compaction-событие («сработало сжатие, summary = X, compactionIndex = Y») нужно **отправить в UI через `dataStream.write(...)`** для виджета контекста. У `prepareStep` **нет прямого доступа** к `dataStream` writer — он появляется только внутри `createUIMessageStream({ execute: async ({ writer }) => { ... streamText(...) } })`. Передача writer в `prepareStep` через closure возможна, но overкilл.
3. **`wrapLanguageModel` / `LanguageModelV2Middleware`** — для transform запросов/ответов на уровне модели. Не подходит для pre-stream message preprocessing — это ниже по stack.
4. **Рекомендация (моя, не архитектора):** использовать **explicit pre-call preprocessing** — вызвать `prepareMessagesWithCompaction(...)` **до** `streamText`, передать результат как `messages`. Причины:
   - Линейный lifecycle: `prepare → stream → persist` легче читать и отлаживать.
   - `dataStream.write(...)` доступен в том же scope что вызов `prepareMessagesWithCompaction` — событие отправляется тривиально.
   - Pure function — тестируется в изоляции без AI SDK mock.
5. Архитектурный документ v1.7 в §Техническая реализация → «Реализация через AI SDK» (примерно строка 456 оригинала v1.0, перенесена в v1.1-v1.7) упоминает оба варианта: «Кандидат: prepareStep. Альтернатива: middleware-подход в chat/route.ts до вызова streamText». **Принимаем альтернативу как финальную** — см. §3 Finding #3.

### 1.3 Drizzle ORM — миграции

**Источник:** реальный код проекта — [lib/db/migrations/](../../lib/db/migrations/) (0054_drop-snapshot-columns.sql и др.)

**Ключевая находка:**
- Проект использует **нативные SQL миграции**, последовательно пронумерованные (`NNNN_name.sql`), НЕ drizzle-kit auto-generated.
- Миграция для COMPACTION-1 будет одним файлом `NNNN_add-compaction-columns.sql`:
  ```sql
  ALTER TABLE "Chat" ADD COLUMN "compactionSummary" text;
  ALTER TABLE "Chat" ADD COLUMN "compactionIndex" integer;
  ALTER TABLE "Chat" ADD COLUMN "compactionCount" integer NOT NULL DEFAULT 0;
  ```
- Backfill не нужен — nullable колонки + default для `compactionCount`.
- `npm run build` автоматически накатит миграцию (`tsx lib/db/migrate && next build` — зафиксировано в CLAUDE.md правиле 5). **Обязательно предупредить владельца до запуска build** — это hard-to-reverse action.

### 1.4 Next.js 15 App Router — middleware в route handlers

**Источники:** Next.js 15 официальные docs + существующий паттерн в проекте.

**Ключевая находка:**
- Никаких специальных «Next.js middleware» для нашей задачи не нужно. `prepareMessagesWithCompaction` — обычная async функция, вызывается внутри handler функции `POST()` в `app/(chat)/api/chat/route.ts`. Нет требования регистрации в `middleware.ts` или special Next.js API.

---

## 2. Резюме ТЗ

**Что делаем в MVP:**
- Собственный Summary Buffer механизм compaction для chat-режимов где модель не поддерживает провайдерский compaction (`supportsCompaction: false`).
- Capability-driven архитектура: выбор стратегии по `ModelCapabilities.supportsCompaction`, handler не делает if/else по chatMode или provider.
- Phased rollout внутри одного ТЗ: Этап A (вся инфраструктура + активация в expertise) → Этап B (расширение gate на create).

**Что уже зафиксировано v1.7 и не пересматривается:**
- Пороги: Soft 50% (100K) / Hard 85% (170K) от `SIMPLY_CONTEXT_LIMIT = 200K`
- Дословное окно: 40K токенов
- Summary: target 3K / hard cap 4K, 5-секционный формат
- Модель: `grok-4-1-fast-non-reasoning`
- Scope MVP: только expertise + create

**Полная ссылка:** [SIMPLY_COMPACTION_ARCHITECTURE.md v1.7](../Simply_xAI/SIMPLY_COMPACTION_ARCHITECTURE.md).

---

## 3. Рекомендации разработчика (Код-ревью)

> Senior Dev Review архитектуры v1.7 на основе карты кодовой базы. Разделение по паттерну WORKFLOW §Фаза 1 → Код-ревью ТЗ.

### ✅ Согласен с ТЗ

- Новый taskId `compaction:summarize` + все 3 записи per ADR 053 — однозначно правильно. Существующий паттерн MIND-задач (memory:extract, memory:extract-batch etc.) подтверждает этот подход.
- Pure `CompactionStrategy` discriminated union с 3 вариантами (provider/simply/none) — правильный тип. `none` как defensive для embeddings/transcription моделей сохраняет type safety.
- Capability-driven через `ModelCapabilities.supportsCompaction` — соответствует существующему паттерну в кодовой базе (Line 952-953 chat/route.ts **уже использует** `capabilities.supportsCompaction` для выбора Anthropic Compaction API).
- 3 новые колонки в Chat таблице (отдельные, не jsonb-расширение `lastContext`) — правильно для критичного state. Типизированный доступ, возможность WHERE-фильтрации для observability, возможность индексации в будущем.
- 5-секционный структурированный формат summary — согласуется с индустриальным консенсусом (Claude Code 9-section, OpenCode 5-section, Codex CLI 2-3K). Для бизнесового Simply контента 5 секций достаточно.
- MVP scope (expertise + create) — согласуется с narrow-first best practice. Не трогать Simply Chat на этом этапе — правильно.

### ⚠️ Рекомендую изменить / уточнить

| # | Было (архитектура v1.7) | Рекомендация | Обоснование из кода / документации |
|---|---|---|---|
| 1 | В таблице «Сводка изменений кода» (v1.1) указано: «`app/(expertise)/api/.../route.ts` +вызов prepareMessagesWithCompaction», «`app/(create)/api/.../route.ts` +вызов prepareMessagesWithCompaction» | **Единый вызов в `app/(chat)/api/chat/route.ts`** с gate по chatMode | В проекте **нет** отдельных routes для expertise и create. Единый handler [app/(chat)/api/chat/route.ts](../../app/(chat)/api/chat/route.ts) с chatMode routing (Line 449-462 для prompt selection, Line 1089 для streamText). Gate: `if (chatMode === "expertise") { messages = await prepareMessagesWithCompaction(...) }` (Этап A) → `if (chatMode === "expertise" \|\| chatMode === "create")` (Этап B) |
| 2 | Phased rollout: Этап B описан как «копия вызова middleware в create route handler» (v1.6 §Phased Rollout) | Этап B = **одна строка изменения gate** | Следствие #1. Инфраструктура — вся в Этапе A, в Этапе B меняется **только условие гейта**. Это делает Этап B минут, не часов. Оценка сложности ТЗ должна это учесть (§8 ниже) |
| 3 | В §Техническая реализация → «Реализация через AI SDK» упоминается `prepareStep` как кандидат | **Explicit pre-call preprocessing** — вызвать `prepareMessagesWithCompaction` **до** `streamText`, не внутри prepareStep | `prepareStep` технически работает (вызывается перед каждым model step включая первый), но: (a) не даёт прямого доступа к `dataStream` writer для UI событий compaction; (b) lifecycle `prepare → stream → persist` понятнее для отладки; (c) pure function легче тестировать. AI SDK `prepareStep` предназначен для **динамической переконфигурации per-step в multi-step tool loop** — у нас single-step чат, overkill |
| 4 | `supportsCompaction` / `compactionOptions` логика в chat/route.ts | **Переписать существующую логику** Line 952-965 на capability-driven через `getCompactionStrategy(modelId)` | В коде **уже есть** (Line 952): `const supportsCompaction = isAnthropicModel && (modelSupportsCompaction \|\| isProjectChat);`. Это частный случай того что должна решать `getCompactionStrategy`. После внедрения — переписать: `const strategy = getCompactionStrategy(modelId); if (strategy.kind === "provider") { compactionOptions = {...anthropic...}; }`. **`isProjectChat` special case** (force-enable compaction даже для моделей без capability?) — потребует отдельного анализа, возможно это заплатка — см. §5 Вопросы |
| 5 | В §Техническая реализация → «Подсчёт токенов»: «Использовать существующий механизм... Не нужен точный подсчёт» | **Уточнить источник цифр**: pre-call tokenizer vs. `lastContext.contextWindow.used` | В проекте **нет tokenizer библиотеки** (`tiktoken` / `gpt-tokenizer` / `@anthropic-ai/tokenizer` нет в package.json). Виджет контекста берёт данные из `lastContext.contextWindow.used` ([chat/route.ts:1582-1589](../../app/(chat)/api/chat/route.ts#L1582-L1589)) — это cumulative usage из **предыдущего** streamText. Не включает новое user message. Для MVP рекомендую **использовать `lastContext.contextWindow.used` как approximation** — пользователь видит тот же счётчик, consistency гарантирована. Точный tokenizer — follow-up если понадобится. См. §5 Вопросы |
| 6 | v1.5 §Модель для сжатия: «xAI native `prompt_cache_key` с 75% скидкой» | Уточнить: в Chat Completions API — **`x-grok-conv-id` HTTP header** (НЕ `prompt_cache_key`, последнее только для Responses API). Кэширование **автоматическое**, header — только оптимизация cache hit rate | Факт из [docs.x.ai prompt caching](https://docs.x.ai/developers/advanced-api-usage/prompt-caching). **В MVP header можно не добавлять** — caching работает, но cache hit rate может быть ниже из-за routing на разные серверы. Добавить header в follow-up ТЗ если метрики покажут нужность |
| 7 | UI события для виджета контекста (v1.0 §Виджет контекста — три типа событий) | Использовать существующий dataStream protocol: `dataStream.write({ type: "data-compaction", data: {...} })` | В проекте уже есть pattern — `dataStream.write({ type: "data-research-depth", ... })` ([chat/route.ts:825](../../app/(chat)/api/chat/route.ts#L825)) + emit-helpers в [lib/ai/debug-events.ts](../../lib/ai/debug-events.ts). Добавить новые типы событий в DebugEvent enum + соответствующий emit-helper — нулевая новая инфраструктура |
| 8 | Структура папки `lib/ai/compaction/` (v1.1 §Единая middleware) | Принимаю структуру, но **добавить файл `prompt.ts`** (отдельный от summarize.ts) | Промпт для генерации summary — отдельная ответственность (контракт PE-команды, см. v1.0 §Формат Summary → Промпт). Разделение `summarize.ts` (вызов LLM через AI SDK) vs `prompt.ts` (конструирование промпта) — стандарт в проекте (см. `lib/ai/memory/extract.ts` vs `lib/prompts/professors/*.md`). Для MVP промпт можно прямо в TypeScript файле `prompt.ts`, не .md — короткий, не требует PE-владения |

### ❓ Требует уточнения (вопросы архитектору)

См. §5 Вопросы архитектору.

---

## 4. Согласованность с MIND

> Архитектурный документ v1.7 §Взаимодействие в Simply Chat + §Ordering в Simply Chat уже покрывают MIND vs Compaction в Simply Chat. Этот раздел — о взаимодействии в **expertise/create** (scope MVP).

### Текущее поведение MIND в expertise/create

Подтверждено чтением кода [app/(chat)/api/chat/route.ts:1553](../../app/(chat)/api/chat/route.ts#L1553):

```typescript
// ТЗ-MinimaxCleanup: Skip extract for simply — will be replaced by Extract-on-compaction
if (isMemoryEnabled && chatMode !== "simply") {
  // ... MIND extract (fire-and-forget, post-stream)
}
```

**Значит:** в expertise/create **MIND extract УЖЕ работает** post-stream, fire-and-forget (`void extractAndStoreFacts({...})` на Line 1567). Simply Chat — **отключён** в этом блоке (комментарий «will be replaced by Extract-on-compaction» намекает что в Simply Chat уже есть параллельный extract механизм).

### Timing compaction vs MIND extract в expertise/create

Последовательность на одном turn:

```
1. User message arrives → `app/(chat)/api/chat/route.ts` POST handler
2. [НОВОЕ, Этап A] Pre-stream: prepareMessagesWithCompaction(...) → compactedMessages
3. streamText({ messages: compactedMessages, ... }) → user получает ответ
4. onFinish → void extractAndStoreFacts({ userMessage, assistantMessage, ... }) (fire-and-forget)
```

**Ключевой вопрос:** какие messages видит MIND extract на шаге 4 — полные или compacted?

Чтение кода [route.ts:1554-1577](../../app/(chat)/api/chat/route.ts#L1554-L1577) показывает:
- `userText` строится из `message.parts` — это **новое user message** из request body, не из history. Не затрагивается compaction.
- `assistantText` строится из `messages` переменной в scope — **это uiMessages** перед streamText. Но здесь уже неясно — compacted или полные. Проверить в Фазе 3 при реализации, **это НЕ блокер для ANALYSIS**.

**Риск (документированный):** если `assistantText` строится из compacted messages — MIND extract потеряет исторические turns. Митигация: строить `assistantText` из **исходной** history (до compaction) или из **последних turns** которые не были сжаты (верхняя часть verbatim window).

**Это не критично для MVP**, потому что:
- MIND extract работает на `userMessage + assistantMessage` из **текущего turn** — compaction не трогает текущий turn, только старые. Текущий turn гарантированно в verbatim window.
- Compaction срабатывает редко (при 100K usage). В обычной expertise-сессии на 20 сообщений — не триггерится.

**Задокументировать в ROADMAP Этап A** — валидационный пункт: «MIND extract в expertise после compaction видит корректный текущий turn». Smoke test.

### Known issue: две базы расчёта (TZ_UnifyContextThresholdBase)

Зафиксировано в архитектурном документе v1.2 §Обоснование порогов → «Согласованность с существующими порогами MIND». Долг-заготовка [specs/_backlog/TZ_UnifyContextThresholdBase.md](../_backlog/TZ_UnifyContextThresholdBase.md) (Medium impact, 0.5 сессии).

**Не блокер для MVP.** Причины:
- MIND threshold-based extract (60% от CONTEXT_BUDGET) не применим в expertise/create на текущий момент — MIND в этих режимах срабатывает **только post-stream** fire-and-forget, без token threshold logic.
- MIND threshold-based актуален только в Simply Chat — MVP туда не заходит.

**Запланирован как отдельный долг** — унификация баз перед ТЗ-COMPACTION-2 (желательная подготовка перед расширением на Simply Chat).

---

## 5. Вопросы архитектору

> Три группы вопросов. Группа 1 — критичные для реализации, нужен ответ до ROADMAP. Группа 2 — можно решить в Фазе 3 при реализации. Группа 3 — закрыть мимоходом при ответе на 1-2.

### Группа 1 (блокирует ROADMAP) — нужен ответ

1. **`isProjectChat` special case в [chat/route.ts:952](../../app/(chat)/api/chat/route.ts#L952).** Текущая логика: `const supportsCompaction = isAnthropicModel && (modelSupportsCompaction || isProjectChat);`. **Вопрос:** что означает `isProjectChat`? Force-enable провайдерского Compaction для проектных чатов даже когда модель не поддерживает? Если да — это special case который потеряется при переписывании на `getCompactionStrategy(modelId)`. Варианты:
   - (a) Это баг/заплатка — убрать при переписывании (получить подтверждение через git blame/поиск commit).
   - (b) Это намеренное поведение — перенести в `getCompactionStrategy` как отдельный аргумент (`getCompactionStrategy(modelId, { isProjectChat })`).
   - (c) Это уже устарело (например, все project:expert:* модели теперь Anthropic с supportsCompaction: true) — убрать без замены.

2. **Источник `usage` для pre-call threshold check.** Текущая инфраструктура: `lastContext.contextWindow.used` = cumulative usage из **предыдущих** streamText calls. Новое user message не учтено до первого streamText. Варианты для MVP:
   - (a) Использовать `lastContext.contextWindow.used` (approximation — cheap, consistent с UI виджетом, но не учитывает текущее user message — при большом attachment может запустить compaction на один turn позже чем надо).
   - (b) Быстрая character-based эстимация (`chars × 0.25`) нового user message + lastContext — rough, но учитывает текущий turn.
   - (c) Добавить tokenizer (`gpt-tokenizer`, ~50KB npm, supports GPT-4/Claude через mapping) — точно, но +dependency.
   - **Моя рекомендация: (a)** для MVP, follow-up ТЗ если метрики покажут недостаточность. Подтвердить архитектором?

3. **Формат summary промпта — Russian или language-adaptive?** В v1.0 §Требования к Summary: «Язык: тот же что у пользователя в разговоре». **Вопрос:** как технически реализовать — (a) language detection первого user message → передать язык в промпт, (b) одна инструкция на русском + «ответь на языке разговора», (c) всегда на русском (Simply — российский продукт). Моя рекомендация: (b) — одна инструкция + автоадаптация, LLM справляется с этим тривиально.

### Группа 2 (можно решить в Фазе 3)

4. **Отправка UI события до или после сжатия?** `data-compaction` событие отправляется через dataStream.write до streamText (уведомляем пользователя что сжимаем) или после сжатия (сжали, вот новый compactionCount)? Рекомендация: **после сжатия**, одним событием на turn.

5. **Обработка ошибок при генерации summary.** Если `grok-4-1-fast-non-reasoning` вернёт ошибку (timeout, invalid JSON) — что делать? Рекомендация: **fallback на sliding window truncation** (текущее поведение) + dev-лог. Пользователь не должен видеть error.

6. **Размер verbatim window при edge case (одно сообщение > 40K).** Архитектура v1.3: «включить целиком». Но если это сообщение само > `SIMPLY_CONTEXT_LIMIT / 2 = 100K` токенов — включение сломает budget. Рекомендация: **hard upper bound на edge case = 80K токенов** (если сообщение > 80K — обрезать верхнюю часть с маркером `[...отрезано из-за размера...]`). Согласовать или оставить без bound?

### Группа 3 (закроется мимоходом)

7. Название папки `lib/ai/compaction/` — ok? (Альтернатива: `lib/ai/memory/compaction/` если хотим группировать с MIND. Моя рекомендация — отдельная папка: Simply Compaction ≠ MIND).

---

## 6. Потенциальные риски

| # | Риск | Влияние | Митигация |
|---|---|---|---|
| 1 | **Неточность оценки usage pre-call** (используем `lastContext` из предыдущего turn) | Medium | Compaction может сработать на один turn позже чем должен — отложено на +1 сообщение. Не критично для UX. Митигация: в ROADMAP Этап A smoke test на сессии с большим attachment (20K+ в одном сообщении) — убедиться что compaction срабатывает |
| 2 | **Race condition при параллельных запросах в один чат** (user отправляет два сообщения подряд, первое триггерит compaction) | Low | Currently expertise/create — пошаговые, user ждёт ответа. Race маловероятна. Митигация: pessimistic check на compactionCount в БД (ETag-like увеличение при сжатии — если при записи compactionCount не совпал, retry) |
| 3 | **Test gap — повторное сжатие (Фаза 2) не smoke-тестируется в MVP** | Medium | 40K+30K summary+150K остального = 170K hard triggers Фаза 3 раньше чем Фаза 2. Чтобы триггернуть Фазу 2 нужно 100K+30K+70K = 200K+ что = уже Hard. Реально Фаза 2 не срабатывает в MVP сценариях expertise (session < 100K). Митигация: unit test на middleware функцию с mock messages — проверить rolling update логику без manual session |
| 4 | **Структурированный output на Grok 4.1 Fast non-reasoning может не строго соблюдать 5 секций** | Low | Verified 2026-04-14 в MIND миграции (ТЗ-XAI-2) — Grok native `generateObject` работает. Митигация: использовать Zod schema для summary, fallback на `generateText + manual section extraction` если structured output ломается на длинном input |
| 5 | **Цена `prompt_cache_key` ручной header — неизвестен exact cost savings для нашего pattern** | Low | В MVP **не включаем** header (caching работает автоматически). Риск: cache hit rate ниже оптимального, +пара копеек на сжатие. Приемлемо для MVP. Добавить header в follow-up на основе метрик |
| 6 | **`npm run build` автоматически накатывает миграцию** (`tsx lib/db/migrate && next build` per CLAUDE.md правило 5) | **High** | Hard-to-reverse. Митигация: **ОБЯЗАТЕЛЬНО предупреждать владельца** перед первым `npm run build` после создания миграции. Явно в ROADMAP Этап A перед валидационным `npm run build` — checkpoint-вопрос владельцу |
| 7 | **Sliding window `CONTEXT_BUDGET = 140K` уже есть в коде и может конфликтовать** с compaction (compaction хочет 100K-threshold, но sliding window отрезает на 140K независимо) | Medium | В expertise/create sliding window применяется автоматически при загрузке history из БД. При compaction на 100K — sliding window не должен дополнительно обрезать. Проверить в Фазе 3 реализации. Митигация: в ROADMAP добавить пункт «проверить отсутствие двойной обрезки» |

---

## 7. Зависимости

**Hard dependencies (блокирующие реализацию):**
- ADR 053 (v3.93.0) — ✅ уже зафиксирован.
- `supportsCompaction: boolean` в `ModelCapabilities` — ✅ уже в коде ([model-catalog.ts:80](../../lib/ai/model-catalog.ts#L80)).
- DataStream protocol для UI событий — ✅ уже в коде ([chat/route.ts:825](../../app/(chat)/api/chat/route.ts#L825), [debug-events.ts](../../lib/ai/debug-events.ts)).

**Soft dependencies (желательно, но не блокирующие):**
- Закрытие долга [TZ_UnifyContextThresholdBase](../_backlog/TZ_UnifyContextThresholdBase.md) — желательно перед COMPACTION-2 (Simply Chat), но **не блокирует COMPACTION-1** (MVP в expertise/create, MIND threshold-based не применим).
- Закрытие долга [TZ_DevPanelFooterHidesSubCalls](../_backlog/TZ_DevPanelFooterHidesSubCalls.md) — желательно для наблюдаемости compaction-вызовов в DevPanel, но **не блокирует MVP** (ai_usage_log в БД имеет полные данные через SQL).

**Внутренние зависимости (порядок этапов внутри ТЗ):**
- Этап A завершён и провалидирован → Этап B (нельзя наоборот).
- Миграция БД накатана до интеграции в route handler.

---

## 8. Оценка сложности

**Оценка: Среднее (2-3 сессии), значительно меньше оригинальной оценки архитектора благодаря Finding #2.**

**Декомпозиция по этапам ROADMAP (будет создана в Фазе 2 после согласования этого ANALYSIS):**

| Этап | Содержание | Оценка сессий |
|---|---|---|
| **A1 — SSOT + capabilities** | Добавить `compaction:summarize` taskId в [task-assignments.ts](../../lib/ai/task-assignments.ts) (3 записи), тип `CompactionStrategy` + функция `getCompactionStrategy(modelId)` в [model-catalog.ts](../../lib/ai/model-catalog.ts), 4 константы в [context-limits.ts](../../lib/ai/context-limits.ts), tsc validation | 0.3 |
| **A2 — БД миграция** | SQL миграция для 3 колонок в Chat, соответствующие обновления в [schema.ts](../../lib/db/schema.ts), ⛔ предупреждение владельца перед build | 0.3 |
| **A3 — Middleware core** | Новая папка `lib/ai/compaction/`: `types.ts`, `prompt.ts`, `summarize.ts` (вызов LLM), `db-queries.ts` (read/write compactionSummary/Index/Count), `prepare-messages.ts` (middleware), unit tests на pure function логику | 0.7 |
| **A4 — Интеграция в route.ts** | В [app/(chat)/api/chat/route.ts](../../app/(chat)/api/chat/route.ts): переписать Line 952-965 на `getCompactionStrategy`, добавить pre-stream вызов `prepareMessagesWithCompaction` с gate `chatMode === "expertise"`, data-compaction event | 0.5 |
| **A5 — UI виджет** | [components/elements/context.tsx](../../components/elements/context.tsx): обработка `data-compaction` события, icon 📦 + «Разговор сжат», `data-truncation_warning` с кнопкой «Новый чат с итогом» (кнопка → basic action в MVP, полная реализация нового чата с итогом в COMPACTION-3) | 0.3 |
| **A6 — Smoke test expertise + финализация Этапа A** | `npx tsc --noEmit` → `npm run build` (после предупреждения владельца) → мануальный тест на сессии 20+ сообщений с 20K attachment → валидация `ai_usage_log` через mcp__postgres__query → git commit | 0.3 |
| **B1 — Расширение gate на create** | Одна строка в chat/route.ts: `chatMode === "expertise"` → `chatMode === "expertise" \|\| chatMode === "create"`. Smoke test create | 0.2 |
| **Финализация (Фаза 4)** | SQL-проверка БД, [DOCUMENTATION_GUIDE.md](../../DOCUMENTATION_GUIDE.md) чеклист, обновление `docs/ai-chats-map.md` с новым taskId, расширение ADR 053 до 5-го аспекта (context strategy — контекстно-зависим, chat-handler only), архивирование папки в `_archive/` | 0.4 |

**Итого: ~3 сессии** (при условии что ответы на Группу 1 вопросов получены и ОК).

---

## Выход Фазы 1 — закрыта

**Статус:** ✅ Фаза 1 завершена. Ответы архитектора на все вопросы получены → [ARCHITECT_ANSWERS.md](./ARCHITECT_ANSWERS.md).

Результаты Фазы 1:
- Архитектурный документ обновлён v1.7 → v1.8 (8 правок по результатам кодового ревью).
- ANALYSIS.md (этот файл) — ревью архитектуры против реальной кодовой базы.
- Группа 1 вопросов (блокировала ROADMAP) закрыта.
- Группа 2 вопросов (детали реализации) закрыта.
- 1 FINDINGS пункт добавлен (рассинхронизация project chat model resolution) — не отдельный долг, решается внутри ТЗ.

**Далее по WORKFLOW:**

1. **Фаза 2 — планирование:** создать [ROADMAP.md](./ROADMAP.md) по [ROADMAP_GUIDE.md](../ROADMAP_GUIDE.md) с этапами A1-A6 (Этап A) → B1 (Этап B) → Финализация. Создать пустые [CHANGELOG.md](./CHANGELOG.md) и [HANDOFF.md](./HANDOFF.md).
2. **СТОП после ROADMAP** — ждать одобрения владельцем.
3. **После одобрения ROADMAP:** Фаза 3 (код).

⛔ **Код не пишу до одобрения ROADMAP владельцем.**
