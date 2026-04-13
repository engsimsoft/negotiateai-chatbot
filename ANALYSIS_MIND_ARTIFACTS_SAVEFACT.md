# Анализ: TZ_MindArtifacts + TZ_SaveFactV2 + MiniMax Pipeline Caching — текущее состояние

**Дата:** 2026-04-12 (раздел 9 добавлен 2026-04-13 после завершения ТЗ-CacheAudit)
**Автор:** Claude Code (аудит по запросу владельца)
**Статус:** 🟡 Всё заморожено до разморозки pipeline-файлов (общий блокер)
**Адресат:** Архитектор

---

## TL;DR

**Три параллельные темы, один блокер — uncommitted changes в pipeline-файлах.**

1. **TZ_MindArtifacts** (визуализация карточек MIND) и **TZ_SaveFactV2** (metadata для задач/календаря) остановлены: инфраструктура metadata в БД/типах частично внедрена (untracked), но механизм записи `saveFact` удалён в v3.77.0. Ждём тестов Grok на instruction following — от результата зависит Путь А (автоматический) vs Путь Б (ручной).

2. **Кэширование MiniMax в pipelines** (briefing, podcast, research) — **НЕ реализовано**. ТЗ-CacheAudit (v3.85.0, 2026-04-13) решил кэш только для Simply Chat и task-expert. В pipelines нет ни `cacheControl` breakpoints, ни корректного usage logging. См. раздел 9.

**Единый блокер для всего:** pipeline-файлы (`briefing-author.ts`, `podcast/script-generator.ts` и др.) содержат uncommitted changes от замороженных ТЗ. Любая попытка трогать их сейчас → merge-конфликт. Нужно решение на уровне архитектуры: **что делаем с uncommitted — коммитить как infra prep, stash, или откатывать?** От этого решения зависит возможность двигать любую из трёх тем.

---

## 1. TZ_MindArtifacts — визуализация карточек MIND

**Папка:** `specs/TZ_MindArtifacts/`
**Создано:** 7 апреля 2026
**Структура:** три файла (V1 + V2 + отчёт о тестировании моделей для «Думать»). **Нет ROADMAP, HANDOFF, CHANGELOG, ANALYSIS** — значит работа по WORKFLOW не запускалась.

### Суть ТЗ

**Проблема:** карточки MIND на `/context` декоративны. Клик → редирект в `/simply` без фокуса. Пользователь видит «5 задач», нажимает — попадает в обычный чат вместо списка задач.

**Решение:** клик → `/context/[category]` с полным списком фактов категории, данные напрямую из БД, без AI.

### Две версии ТЗ

**V1 (TZ_MIND_ARTIFACTS.md):** простые списки карточек для всех 7 категорий. Минималистично, делается сразу, без зависимостей.

**V2 (TZ_MIND_ARTIFACTS_V2.md):** визуализации Notion-уровня для двух категорий благодаря metadata из SaveFactV2:
- **Задачи → канбан** (Новые / В работе / Сделано) по `metadata.status`. Без drag&drop, статус меняется через чат
- **Календарь → месячная сетка** по `metadata.date/time`, с навигацией ← → и секцией «Без даты»
- Решения → таймлайн, Люди → карточки с инициалами, Идеи/Заметки/Предпочтения → списки

**V2 — выбранный вариант**, но он зависит от SaveFactV2.

### Реальное состояние кода

- `app/(dashboard)/context/` — только `page.tsx`, никакого `[category]/`
- `app/(chat)/api/user/memory/context/` — только `route.ts`, никакого `[category]/`
- **Написано: ноль строк**

---

## 2. TZ_SaveFactV2 — metadata для задач и календаря

**Папка:** `specs/TZ_SaveFactV2/`
**Создано:** 7 апреля 2026
**Структура:** все 6 файлов по WORKFLOW есть (SPEC, TZ_SAVEFACT_V2_METADATA, ANALYSIS, ROADMAP, CHANGELOG, HANDOFF)

### Суть ТЗ

- Добавить JSONB колонку `metadata` в `memory_entry`
- Научить tool **saveFact** принимать metadata (task: `{status}`, calendar: `{date, time, endDate, endTime}`)
- Создать новый tool **updateFact** — чтобы «сделано: позвонить Григорию» находил задачу через semantic search и менял `metadata.status` на `"done"`
- Расширить API `/api/user/memory/context` — возвращать metadata
- Обновить DevPanel
- Целевая версия: 3.77.0

**Это прямая зависимость для TZ_MindArtifacts V2.**

### Противоречие в документах ТЗ

**ROADMAP.md** утверждает что работа идёт:
- Этап 1 (БД + типы + queries) — ✅ Завершён, все чекбоксы `[x]`
- Этап 2 (saveFact metadata + updateFact + промпт) — 🔄 В работе, **все чекбоксы `[x]`**
- Этапы 3, 4 — не начаты

**HANDOFF.md** противоречит: «Сессия 0», все фазы `[ ]`, «создана только структура папки».

**CHANGELOG.md** — пустой шаблон.

### Реальное состояние кода

**Этап 1 — физически сделан, но НЕ закоммичен в git:**

| Файл | Статус |
|------|--------|
| `lib/db/migrations/0051_memory-metadata.sql` | ✅ создан, применён локально, **untracked в git** |
| `lib/ai/memory/types.ts` | ✅ добавлены `TaskMetadata`, `CalendarMetadata`, `FactMetadata`, поле `metadata?` в `NewMemoryEntry` |
| `lib/ai/memory/memory-queries.ts` | ✅ metadata проброшена в `insertMemoryEntry`, добавлена функция `updateMemoryMetadata()` |

**Этап 2 — НЕ сделан и больше не может быть сделан в исходном виде:**

| Файл | Статус |
|------|--------|
| `lib/ai/tools/save-fact.ts` | ❌ **удалён** в коммите `e21a57f` (v3.77.0 TZ-MinimaxCleanup) |
| `lib/ai/tools/update-fact.ts` | ❌ никогда не создавался |
| `lib/ai/tool-activity-config.ts` конфиг updateFact | ❌ нет |
| `lib/prompts/chat/simply-chat.md` блок про metadata | ❌ нет |

Поиск `saveFact` по всему коду: упоминается только как enum-значение в `lib/db/schema.ts` и в `lib/ai/memory/types.ts`. **Ни одного вызова tool в runtime.**

**Этапы 3, 4 — не начаты.**

---

## 3. Что произошло — хронология

| Версия | Коммит | Событие |
|--------|--------|---------|
| v3.74.0 | `a2e2dbc` | TZ-KITT: `/context` dashboard + MIND idea + quick commands |
| v3.75.0 | `5d301c1` | **TZ-SaveFact: создан tool saveFact** — guaranteed MIND memory write |
| — | (7 апреля) | Начаты TZ_SaveFactV2 и TZ_MindArtifacts: миграция 0051, типы, queries (не закоммичено) |
| v3.77.0 | `e21a57f` | **TZ-MinimaxCleanup: tool saveFact УДАЛЁН** |
| v3.78.0 | `4c00dd7` | TZ-ExtractCompression: записью в MIND занимается автоматический batch Extract (MiniMax на 60%/80% контекста) |
| v3.79.0 | `53d0b41` | TZ-SimplyToolsMinimax: 12 tools для MiniMax в Simply Chat — saveFact не возвращён |
| v3.80.0–v3.84.0 | — | Briefing/Podcast MiniMax, SlidingWindow, CoreRegistry, DevSwitchboardUI — по MIND ничего |

**Ключевая точка:** v3.77.0 удалил saveFact одновременно с тем как TZ_SaveFactV2 ждал своей реализации. В v3.78.0 подход сменился с ручного на автоматический — и оба ТЗ повисли без механизма записи metadata.

---

## 4. Почему всё на паузе

### Фундаментальная проблема

Anthropic (включая Claude Sonnet) и Google модели **не справляются с задачей аккуратного заполнения metadata** при автоизвлечении фактов. Модели не следуют инструкциям надёжно:
- Путают категории (идея vs задача vs заметка)
- Теряют структуру metadata при параллельной обработке
- Срываются на «свободный текст» вместо JSON-структуры
- Даже Sonnet не справляется стабильно

Это не баг промпта — это ограничение instruction following у моделей на многозадачном извлечении (классификация + извлечение + заполнение структурированных полей одновременно).

### Почему ждём Grok

По бенчмаркам Grok — лидер по instruction following. Сейчас в проект подключается несколько новых провайдеров через OpenRouter (см. v3.84.0 DevSwitchboardUI — `/dev/models` + per-message switcher). Как только Grok будет доступен через единый switchboard, он пройдёт тест на этой же задаче.

---

## 5. Развилка после тестов Grok

### Путь A — Grok справится → автоматический путь

- Batch Extract pipeline (`lib/ai/memory/extract.ts`) обучается заполнять metadata
- На task → автоматически ставится `{status: "new"}`
- На calendar → парсится дата/время из контекста → `{date, time}`
- TZ_MindArtifacts V2 (канбан + визуальный календарь) становится делаемым **на существующей инфраструктуре**
- Миграция 0051 коммитится, open tasks из ROADMAP Этап 3-4 проходят финализацию

### Путь B — Grok тоже ошибается → ручной путь (с переосмыслением)

**Решение владельца:** пользователь сам открывает карточку категории (`/context/task`, `/context/calendar`) и **внутри её контекста** явно говорит модели добавить запись.

**Почему это работает там, где автоизвлечение ломается:**
- Модели плохи в параллельной многозадачности
- Модели хороши в узкой задаче с явным контекстом
- Открытая карточка = явное намерение + одна фиксированная категория
- Модели не нужно решать «это задача или идея?» — решение уже принято пользователем через выбор карточки
- Одна задача за раз: только извлечь детали и заполнить metadata

**Что потребует Путь B:**
- Возврат tool уровня saveFact/updateFact — но не глобального, а **контекстного**, привязанного к открытой карточке категории
- UI карточки категории с встроенным чатом (не редирект в `/simply`)
- Промпт, привязанный к конкретной категории
- Инфраструктура metadata (которая уже есть) — используется напрямую

---

## 6. Что делать прямо сейчас

**Ничего.** Оба ТЗ остаются в `specs/` (не архивируются), ждут тестов Grok.

### Чего НЕ делать

- ❌ Не удалять колонку `metadata` из `memory_entry`
- ❌ Не удалять типы `TaskMetadata`/`CalendarMetadata`/`FactMetadata` из `lib/ai/memory/types.ts`
- ❌ Не удалять функцию `updateMemoryMetadata()` из `lib/ai/memory/memory-queries.ts`
- ❌ Не откатывать миграцию 0051 (хотя она untracked — закоммитим когда разморозим ТЗ)
- ❌ Не начинать TZ_MindArtifacts без разморозки SaveFactV2

**Причина:** вся эта инфраструктура нужна в **обоих** путях развилки. Это задел, не мусор.

### Триггер разморозки

Результаты теста Grok на задаче:
> «Извлеки из сообщения факты, классифицируй по категориям (task/calendar/idea/...), для task заполни `metadata.status`, для calendar — `metadata.date/time`. Верни строгий JSON.»

Если instruction following ≥ 95% на репрезентативной выборке — Путь A. Если ниже — Путь B.

---

## 7. Связанные ТЗ для контекста

- **TZ-SaveFact (v3.75.0, завершено):** создал оригинальный tool saveFact. В _archive.
- **TZ-MinimaxCleanup (v3.77.0, завершено):** удалил saveFact. В _archive.
- **TZ-ExtractCompression (v3.78.0, завершено):** batch Extract как основной путь записи MIND. В _archive.
- **TZ-SlidingWindow (v3.76.0, завершено):** стабилизировал контекстное окно для Simply Chat. Удалён из specs/ (висел в git status).
- **TZ-2 / DevSwitchboardUI (v3.84.0, завершено):** `/dev/models` для переключения моделей — **инструмент, через который будет тестироваться Grok.**
- **TZ-1 / CoreRegistry (v3.83.0, завершено):** `getModel(taskId)` — SSOT резолва моделей, готов принимать новые провайдеры.

---

## 8. Вопросы архитектору

1. **Приоритет разморозки:** после подключения Grok, какое ТЗ выше в очереди — эти два или новый cost coverage для pipelines?
2. **Путь B (ручной):** если Grok не справится — согласна ли архитектура с концепцией контекстных tools, привязанных к открытой карточке категории? Или это переусложнение и лучше вернуть глобальный saveFact с простым промптом?
3. **Миграция 0051 untracked:** коммитить сейчас (как «инфраструктурный задел») или ждать разморозки и коммитить в одном PR с завершением ТЗ?
4. **V1 vs V2 MindArtifacts:** если Путь B, есть смысл сначала сделать V1 (простые списки для всех 7 категорий, быстро) как промежуточный шаг — а канбан/календарь из V2 добавить после? Или идти сразу на V2?

---

## 9. Кэширование MiniMax в pipelines — незавершённая часть ТЗ-CacheAudit

**Добавлено:** 2026-04-13 после завершения ТЗ-CacheAudit (v3.85.0)
**Статус:** ❌ Не реализовано. Заблокировано теми же uncommitted changes от TZ_MindArtifacts / TZ_SaveFactV2

### Что сделал ТЗ-CacheAudit

ТЗ-CacheAudit решил две из трёх подзадач MiniMax кэширования:

1. **Этап 1 — переключение провайдера** (`lib/ai/registry.ts`):
   - `createMinimaxOpenAI` → `createMinimax` (default Anthropic-compat режим)
   - Теперь MiniMax через `vercel-minimax-ai-provider@0.0.2` возвращает стандартные поля AI SDK v6: `inputTokenDetails.cacheReadTokens` и `inputTokenDetails.cacheWriteTokens` — идентично Claude через `@ai-sdk/anthropic`
   - **Возможность кэширования появилась**, но это только фундамент

2. **Этап 3 — breakpoints в Simply Chat** (`app/(chat)/api/chat/route.ts`):
   - 3 breakpoints: static system, tools (через `withCacheControlOnLastTool`), last user text-part
   - MIND transplant: динамический блок памяти вынесен в trailing content-part, не ломает кэш статического префикса
   - **Валидировано UI-тестом:** 54% экономии на 2-м сообщении (MiniMax Simply), 58% на Claude Haiku «Думать»

3. **Этап 4 — те же breakpoints в task-expert** — но это Claude, не MiniMax (executor/expert/professor tier = Haiku/Sonnet/Opus).

### Что НЕ сделал ТЗ-CacheAudit — и почему

**В pipelines нет ни одного `providerOptions.anthropic.cacheControl`.** Подтверждено grep'ом:

```bash
$ grep -l "cacheControl\|providerOptions" lib/**/*.ts
lib/ai/tools/chat-tools.ts
lib/ai/getModel.ts
lib/ai/registry.ts
lib/ai/model-catalog.ts
lib/ai/professors/task-reviewer.ts
```

Ни одного pipeline-файла. Значит:

- **briefing-author.ts** — генерирует статью из большого system prompt + fetched articles dump. Кэш выключен.
- **briefing-section-author.ts** — генерирует одну секцию. Кэш выключен. (Критично для per-section refresh: пользователь нажимает ↻ на 5 секциях подряд — тот же system prompt отправляется 5 раз «сырым».)
- **briefing-filter.ts** — фильтрация кандидатов AI'ем. Кэш выключен.
- **podcast/script-generator.ts** — генерирует скрипт подкаста. Кэш выключен. Для multi-topic подкаста — system prompt сценариста отправляется N раз.
- **research-engine.ts** — использует Perplexity, к нему Anthropic cacheControl не применим. Исключено из scope.

**Плюс двойная слепота в usage logging.** Даже если бы passive cache случайно где-то сработал (5-min TTL), мы бы его не видели:

```ts
// lib/podcast/script-generator.ts:97-98, 118-119, 162-171, 187-195
totalPromptTokens += result.usage?.inputTokens ?? 0;
totalCompletionTokens += result.usage?.outputTokens ?? 0;
// ↑ теряет inputTokenDetails.cacheReadTokens / cacheWriteTokens

// Затем:
logUsage({
  usage: {
    inputTokens: totalPromptTokens,
    outputTokens: totalCompletionTokens,
    cacheReadTokens: 0,   // ← хардкод
    cacheWriteTokens: 0,  // ← хардкод
  } as any                // ← обход типизации
});
```

Идентичный паттерн в `briefing/research-engine.ts:308-316` и `briefing/briefing-author.ts:762-763` (fallback trace).

**Почему не чинили в ТЗ-CacheAudit:** scope ТЗ чётко ограничен ключевыми chat-routes (`chat/route.ts` + `task-expert`). Pipeline-файлы находятся в uncommitted состоянии от замороженного TZ_MindArtifacts / TZ_SaveFactV2 — попытка править их создаст merge-конфликт при разморозке. Технический долг зафиксирован в `specs/TZ_CacheAudit/ANALYSIS.md` → секция «Technical debt (follow-up, вне scope)».

### Финансовое влияние

**Briefing (ежедневный cron + ручной refresh):**
- Per-section author: ~6K токенов system + ~3K tools + ~5-15K article content на вызов
- При refresh 5 секций подряд: 5 × 9-24K input токенов = 45-120K tokens, из которых 6K+ статического system повторяется каждый раз → экономия при правильном кэшировании: ~25-30K read из кэша вместо write (≈ $0.03-0.05 на сессию)

**Podcast (генерация подкаста из 3-5 тем):**
- System prompt сценариста ~3K + topic content ~8-15K на каждую тему
- Сегодня: 3-5 × 11-18K = 33-90K input tokens
- С кэшем: system (3K) пишется 1 раз на всю сессию, читается 2-4 раза → экономия ~6-12K write токенов на сессию (≈ $0.006-0.015)

**Billing observability:** гораздо важнее денежной экономии. Сейчас `ai_usage_log` показывает 0 cacheRead/Write для всех MiniMax pipelines → Cost Audit Dashboard (`/admin/cost-audit`) показывает искажённую картину, невозможно принимать решения по оптимизации вслепую. Занижение стоимости относительно MiniMax Balance оценено в 10-25% для briefing/podcast pipelines.

### Что должно быть сделано — полный план

**Фаза 1. Расстановка cache breakpoints в pipelines**

Требуется изучить структуру каждого вызова `streamText/generateText/generateObject` и применить стандартный AI SDK v6 паттерн Anthropic prompt caching (работает для MiniMax через Anthropic-compat).

1. **briefing-author.ts** (`generateArticle`):
   - Breakpoint 1 (system): вынести static `promptText` как отдельный role:system message с `providerOptions.anthropic.cacheControl`
   - Breakpoint 2 (tools): если передаются tools — `withCacheControlOnLastTool()`
   - Breakpoint 3 (last user text-part): на последнем message inline cacheControl
   - Если есть большой переиспользуемый блок (например, manifest/contextDump) — split на static+dynamic как мы сделали с MIND в Simply Chat
2. **briefing-section-author.ts**: то же что briefing-author, но для per-section. Главный profit — при refresh нескольких секций подряд кэш system prompt переиспользуется.

3. **briefing-filter.ts**: оценить целесообразность. Это one-shot вызов на весь batch кандидатов — кэш эффективен только если filter вызывается несколько раз подряд в рамках одного briefing. Если cron вызывает его 1 раз на весь выпуск — breakpoint не даст выгоды. **Решение:** отложить до замеров, возможно не делать.

4. **podcast/script-generator.ts** (multi-section generation):
   - Breakpoint 1 на static system prompt сценариста (`scriptwriter.md`)
   - Breakpoint 2 на первом topic content (опционально — если topic content переиспользуется между секциями)
   - Главный profit — multi-section podcast запускает N последовательных generateText с тем же system

5. **research-engine.ts** — **исключён**, использует Perplexity, не Anthropic/MiniMax.

**Фаза 2. Фикс pipeline usage logging**

Удалить хардкод `cacheReadTokens: 0` + `as any` cast во всех pipeline-файлах. Заменить на правильное аккумулирование через существующий helper `extractUsageForPricing()` из `lib/ai/usage-utils.ts`:

```ts
// БЫЛО:
totalPromptTokens += result.usage?.inputTokens ?? 0;
totalCompletionTokens += result.usage?.outputTokens ?? 0;
// ...
logUsage({
  usage: {
    inputTokens: totalPromptTokens,
    outputTokens: totalCompletionTokens,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  } as any,
});

// СТАНЕТ:
const total = {
  noCacheInputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  outputTokens: 0,
  reasoningTokens: 0,
};

// В каждой итерации:
const fields = extractUsageForPricing(result.usage);
total.noCacheInputTokens += fields.noCacheInputTokens;
total.cacheReadTokens += fields.cacheReadTokens;
total.cacheWriteTokens += fields.cacheWriteTokens;
total.outputTokens += fields.outputTokens;
total.reasoningTokens += fields.reasoningTokens ?? 0;

// В конце:
logUsage({
  usage: {
    inputTokens:
      total.noCacheInputTokens +
      total.cacheReadTokens +
      total.cacheWriteTokens,
    outputTokens: total.outputTokens,
    totalTokens: /* sum */,
    inputTokenDetails: {
      cacheReadTokens: total.cacheReadTokens,
      cacheWriteTokens: total.cacheWriteTokens,
    },
    outputTokenDetails: {
      reasoningTokens: total.reasoningTokens,
    },
  } satisfies LanguageModelUsage,
  // ... остальные поля
});
```

Файлы для правки:
- `lib/podcast/script-generator.ts` (строки 97-98, 118-119, 162-171, 187-195)
- `lib/briefing/research-engine.ts` (строки 308-316)
- `lib/briefing/briefing-author.ts` (fallback trace, строки 762-763)
- `lib/briefing/briefing-section-author.ts` (аналогично — проверить)
- `lib/briefing/briefing-filter.ts` (аналогично — проверить)

**Фаза 3. Валидация**

1. Запустить briefing pipeline вручную через `/briefing/setup` (мануальный тест)
2. Запустить per-section refresh 3-5 раз подряд в одной сессии
3. SQL-проверка:

```sql
SELECT
  "createdAt"::timestamp(0) AS ts,
  "chatMode",
  "modelId",
  "inputTokens",
  "cacheReadTokens",
  "cacheWriteTokens",
  "costUsd"::numeric(10,6) AS cost
FROM "ai_usage_log"
WHERE "chatMode" LIKE 'briefing:%'
  AND "createdAt" > NOW() - INTERVAL '30 minutes'
ORDER BY "createdAt" DESC;
```

Ожидание: `cacheWriteTokens > 0` на первом вызове, `cacheReadTokens > 0` на последующих в той же сессии.

4. То же для podcast:

```sql
WHERE "chatMode" LIKE 'podcast:%'
```

5. Сравнить baseline pre/post через `/admin/cost-audit`.

### Блокер и путь решения

> ✅ **Блокер СНЯТ** — ТЗ-UnfreezePipelines (v3.85.1), 2026-04-13.
> Working tree приведён в чистое состояние. Infra prep закоммичен (метаданные SaveFactV2, voyage pricing, provider field, error handling). Podcast-файлы откатаны как WIP на ошибочном диагнозе. TZ_SlidingWindow v3.76.0 перенесён в `_archive/`. Следующий ТЗ — объединённый `TZ_CachePipelineMetrics` (cache breakpoints + usage logging coverage, бывш. backlog/TZ_UsageLoggingCoverage).

**Блокер (исторический):** все файлы из Фазы 1 и Фазы 2 находились в uncommitted state от замороженного TZ_MindArtifacts / TZ_SaveFactV2.

Текущее состояние uncommitted в этих файлах (по `git diff --stat`):

| Файл | Изменений |
|---|---|
| `lib/briefing/briefing-author.ts` | +15 -2 |
| `lib/briefing/briefing-section-author.ts` | +8 -1 |
| `lib/briefing/briefing-filter.ts` | +8 -1 |
| `lib/podcast/script-generator.ts` | +5 -16 |
| `lib/podcast/index.ts` | **+124 -8** |
| `lib/briefing/research-engine.ts` | (нет) |

Плюс дополнительные uncommitted в смежных файлах: `lib/ai/memory/extract.ts` (+2 -1), `lib/ai/memory/types.ts` (+21), `lib/ai/memory/voyage-client.ts` (+15), `lib/ai/retry-with-logging.ts` (+9 -1), `lib/ai/tools/update-document.ts` (+8 -1), `lib/db/queries.ts` (+6 -6).

Большинство правок мелкие (≤ 15 строк). Значимый только `lib/podcast/index.ts` (+124 строки).

### Рекомендация senior dev — Варианты разморозки

Три варианта решения, в порядке предпочтения:

**Вариант А (рекомендую) — Аудит и коммит uncommitted как infrastructure prep**

1. По каждому из uncommitted файлов сделать быстрый `git diff` review — понять что именно там лежит
2. Разделить на три категории:
   - (a) **Infra prep для frozen TZs** — коммитим отдельным коммитом `chore(tz-frozen): infra prep for TZ_MindArtifacts/TZ_SaveFactV2 pipeline changes`. Это в первую очередь `memory/types.ts` (metadata types), `memory-queries.ts` (updateMemoryMetadata), migration 0051
   - (b) **Orphaned WIP, не используется** — откат через `git checkout <file>`
   - (c) **Spike / exploration от других ТЗ** — stash в named stash с явным названием: `git stash push -m "WIP: TZ_MindArtifacts podcast pipeline exploration" -- lib/podcast/index.ts`
3. После этого working tree чистое → создаём ТЗ_CachePipelineMetrics, работаем на чистой базе без merge-конфликтов
4. При разморозке TZ_MindArtifacts вытаскиваем stash обратно

**Плюсы:** минимум технического долга, чистая база для следующего ТЗ
**Минусы:** требует ~1 час аудита 12 файлов перед стартом нового ТЗ

**Вариант Б — Worktree изоляция**

1. `git worktree add ../simply-cache-pipelines feature/cache-pipelines` от чистого `master`
2. В новом worktree работаем над Фазой 1+2+3, не трогая uncommitted на основном branch
3. Когда Фаза 3 валидирована → PR из worktree в master через обычный merge
4. Конфликты с TZ_MindArtifacts решаются на момент его разморозки (но по другому branch'у)

**Плюсы:** полная изоляция, uncommitted не трогается
**Минусы:** два worktree параллельно требует дисциплины; риск расхождения базы если TZ_MindArtifacts параллельно коммитится в master

**Вариант В — Откладывать до разморозки**

Ничего не делать, дождаться теста Grok → разморозки TZ_MindArtifacts → закрытия его работы → свободного working tree → старт ТЗ_CachePipelineMetrics.

**Плюсы:** нулевой риск
**Минусы:** неопределённый timeline (Grok может быть через месяц), billing observability остаётся искажённой, `/admin/cost-audit` показывает неверные цифры

### Моя рекомендация как senior dev

**Вариант А.** Основания:

1. **Billing observability важнее денег.** 10-25% занижение стоимости pipelines — это blind spot для любых будущих решений по оптимизации. Ты не можешь принимать решения по ценообразованию MiniMax/briefing пока не видишь настоящие цифры
2. **Uncommitted WIP — технический долг в самой опасной форме.** Файлы в uncommitted состоянии неделями — это не «сохранённая работа», это кодо-мусор, который блокирует любые улучшения и у которого нет шансов дождаться разморозки без конфликтов
3. **Аудит 12 файлов занимает час, не день.** Большинство правок ≤15 строк, быстро понять намерение
4. **Stash с явным названием ≠ потеря работы.** Named stash восстанавливается по `git stash apply stash@{<name>}` без риска
5. **CoreRegistry (v3.83.0) + DevSwitchboard (v3.84.0) создают правильный ландшафт** для нового ТЗ по кэшу — SSOT резолва моделей и UI для переключения уже есть, не нужно ничего досоздавать

**Последовательность действий:**

1. **Сейчас:** завершить и заархивировать ТЗ-CacheAudit (v3.85.0) — по текущим задачам всё готово
2. **Следующее ТЗ:** `TZ_UnfreezePipelines` — 1-2 сессии, **только аудит + разделение uncommitted**, без нового кода. Результат: чистое working tree + named stashes + коммит infra prep
3. **После этого:** `TZ_CachePipelineMetrics` — реализация Фазы 1, 2, 3. 2-3 сессии. Целевая версия 3.86.0
4. **Параллельно** (когда Grok появится): разморозка TZ_MindArtifacts / TZ_SaveFactV2 на чистой базе, без pipeline-конфликтов

Важное уточнение: ТЗ_UnfreezePipelines — это **не рефакторинг**. Это **дисциплинарная работа по git hygiene**: аудит, классификация, коммит/откат/stash. Она критически нужна перед любыми рефакторами pipeline-кода, о которых ты упоминаешь.

---

**Конец анализа.**
