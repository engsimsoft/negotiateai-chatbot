# Анализ ТЗ-AISDKLayerHardening

**Дата:** 2026-04-17
**Фаза:** 1 — Анализ + Код-ревью
**Статус:** ожидание ответов владельца

---

## Резюме

Три связанных долга на слое AI SDK invocations. После детального аудита кода картина изменилась относительно исходных заготовок в `_backlog/`:

- **Этап 1 (DevOverrides)** — в значительной части **уже сделан** (коммит `c4b2b63` добавил регистрацию в `instrumentation.ts`). Осталась гигиена.
- **Этап 2 (MaxOutputTokens)** — scope **больше чем в заготовке**: не ~20, а **36 call sites** (5 явных + 31 implicit).
- **Этап 3 (ProfessorPlanStreaming)** — подтверждена архитектурная верность направления, документация AI SDK v6 полностью совместима с планом.

---

## Изученная документация

### Next.js `instrumentation.ts` (v16.2.4, docs 2026-04-15)

**Источник:** https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation

Ключевые находки:
- `register()` вызывается **once when a new Next.js server instance is initiated, and must complete before the server is ready to handle requests**. Подходит для регистрации reader-ов.
- Next.js 15+ — `instrumentation.ts` стабилен by default (без experimental флага).
- Runtime split: `process.env.NEXT_RUNTIME === "nodejs"` / `"edge"` — критично, потому что `model-overrides-node.ts` использует `node:fs` и не должен грузиться в edge runtime.
- **В проекте уже применено** ([instrumentation.ts:1-10](../../instrumentation.ts#L1-L10)):
  ```ts
  export async function register() {
    registerOTel({ serviceName: "ai-chatbot" });
    if (process.env.NEXT_RUNTIME === "nodejs") {
      await import("@/lib/ai/model-overrides-node");
    }
  }
  ```

### AI SDK v6 `streamText` — usage, reasoning, text accumulation

**Источник:** https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text

Ключевые находки для Этапа 3:
- **Usage:** `await stream.usage` (последний step) / `await stream.totalUsage` (cumulative). Поля: `inputTokens`, `outputTokens`, `totalTokens`, + `reasoningTokens` для thinking моделей.
- **Text accumulation:** есть три способа — `await stream.text` (consumes stream), итерация `stream.textStream`, `onFinish` callback с полным `text`.
- **Reasoning integration:** `await stream.reasoning` (array) / `stream.reasoningText` (string). `fullStream` содержит `'reasoning'` type parts в real-time.
- **Для нашего случая (plan/route.ts):** `onFinish` с `{ text, usage }` — проще всего для парсинга `<plan_report>` / `<plan_json>`. Либо `await stream.text + await stream.usage`. Оба работают.

### Anthropic `max_tokens` streaming threshold

**Источники:**
- https://docs.aws.amazon.com/bedrock/latest/userguide/claude-messages-extended-thinking.html
- https://docs.anthropic.com/en/api/errors (раздел long-requests)

Ключевые находки:
- **Streaming required** для `max_tokens > 21333` — подтверждено в AWS Bedrock docs для extended thinking. Это жёсткий API-контракт Anthropic.
- Non-streaming запрос с бо́льшим max_tokens → таймаут на fetch (60s default) → `UND_ERR_SOCKET: other side closed`.
- Tactical cap 16000 в plan/route.ts — валидный обходной путь (16K < 21333, safe zone).
- Long-term правильно — streaming для любой long-running задачи.

### `@ai-sdk/anthropic` default `maxOutputTokens`

**Версия в проекте:** `@ai-sdk/anthropic@3.0.66` (package.json declares `^3.0.58`).

**Источники:**
- https://github.com/vercel/ai/blob/main/packages/anthropic/src/anthropic-messages-language-model.ts
- https://github.com/vercel/ai/issues/9540

Ключевые находки:
- **В 3.0.66 default берётся из model capability**, не из hardcoded 4096:
  ```ts
  const maxTokens = maxOutputTokens ?? maxOutputTokensForModel;
  // где maxOutputTokensForModel = getModelCapabilities(modelId).maxOutputTokensForModel
  ```
- Для Opus 4.6 capability = **128 000** (Anthropic поднял 2026-04-12 с 32K → 128K).
- Для Sonnet 4.6 = 64 000. Для Haiku 4.5 = 64 000.
- Issue #9540 (hardcoded 4096) — устаревший или про другой провайдер; текущая реализация это не подтверждает.
- **Эмпирика в backlog верна:** неявный max_tokens без cap → 128K → timeout-bomb для non-streaming Anthropic вызовов.

### `@ai-sdk/xai` и MiniMax — default maxOutputTokens

- `@ai-sdk/xai@3.0.82` — default также из model capability (grok-4.1-fast = 131 072 tokens).
- Non-streaming Grok call с 131K → аналогичный риск timeout, но практика показывает что Grok быстрее Opus на output и часто успевает в 60s. **Не протестирован эмпирически.**
- MiniMax provider custom (не из @ai-sdk/*), использует Chat Completions adapter — поведение defaults отличается. Briefing pipeline проставляет cap явно (8192), это хорошо.

---

## Реальное состояние Этапа 1 (DevOverrides)

### Что уже сделано

**Коммит `c4b2b63 fix(dev): register model-overrides reader in instrumentation.ts`** добавил корневой `instrumentation.ts` с `await import("@/lib/ai/model-overrides-node")`. Это **Вариант C** из заготовки `TZ_DevOverridesSideEffectImportAudit.md` — ровно рекомендованный подход. Это закрывает основную архитектурную дыру: теперь reader регистрируется **один раз при boot сервера**, до любого route.

### Что осталось

**1. 7 routes продолжают нести redundant side-effect импорт** (после instrumentation.ts они избыточны, работают как defense-in-depth но создают путаницу):

| Файл | Строка импорта |
|---|---|
| `app/(chat)/api/chat/route.ts:31` | `import "@/lib/ai/model-overrides-node";` |
| `app/(chat)/api/projects/[id]/plan/route.ts:35` | `import "@/lib/ai/model-overrides-node";` |
| `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts:21` | `import "@/lib/ai/model-overrides-node";` |
| `app/(chat)/api/briefing/generate/route.ts:15` | `import "@/lib/ai/model-overrides-node";` |
| `app/(chat)/api/briefing/refresh-section/route.ts:27` | `import "@/lib/ai/model-overrides-node";` |
| `app/api/cron/briefing/route.ts:24` | `import "@/lib/ai/model-overrides-node";` |
| `app/(chat)/api/service-chat/route.ts:69` | `import "@/lib/ai/model-overrides-node";` |

**2. ADR 048 стал stale.** L94-108 описывают устаревший контракт («один side-effect import в chat/route.ts достаточен») и содержат постскриптум от 2026-04-14 session 3 который отрицал проблему. Но в ТЗ-XAI-4 (2026-04-16) проблема была эмпирически подтверждена и instrumentation.ts фикс её закрыл. ADR не отражает текущее состояние.

**3. `specs/_backlog/README.md:40` имеет сломанную ссылку** на `TZ_DevOverridesSideEffectImportAudit.md` — файл переехал в `_backlog/_archive/`, но README не обновлён.

**4. Routes без импорта (из заготовки) — уже покрыты через instrumentation.ts.** Значит заготовочный список «ben/generate-title/analyze-file/actions.ts сломаны» — неактуален. Все они работают через boot-time register.

### Что проверить эмпирически (smoke test)

1. Временно закомментировать в `instrumentation.ts` строку `await import("@/lib/ai/model-overrides-node")` → restart dev server → проверить что override НЕ работает для routes которые удалили из side-effect → раскомментировать → проверить что работает.
2. Это подтвердит что instrumentation.ts действительно покрывает все routes и side-effect импорты действительно redundant.

---

## Реальное состояние Этапа 2 (MaxOutputTokens) — полная инвентаризация

### Call sites с явным `maxOutputTokens` (5)

| Файл | Строка | Значение | Заметка |
|---|---|---|---|
| [lib/podcast/script-generator.ts:139](../../lib/podcast/script-generator.ts#L139) | `generateText` | `4096` | podcast script — OK |
| [lib/meeting/meeting-pipeline.ts:97](../../lib/meeting/meeting-pipeline.ts#L97) | `generateText` | `8192` | meeting summary — OK |
| [lib/briefing/briefing-author.ts:214](../../lib/briefing/briefing-author.ts#L214) | `streamText` | `maxTokens` (dynamic) | briefing author — OK, динамический под размер |
| [lib/briefing/briefing-section-author.ts:192](../../lib/briefing/briefing-section-author.ts#L192) | `streamText` | `8192` | briefing section — OK |
| [app/(chat)/api/projects/[id]/plan/route.ts:196](../../app/(chat)/api/projects/[id]/plan/route.ts#L196) | `generateText` | `16000` | plan/route.ts tactical — **убирается на этапе 3 (переход на streamText)** |

### Call sites БЕЗ явного `maxOutputTokens` (31)

Группировка по taskId и типу вызова:

**Artifacts (10, все streamText):**
| Файл | Строки | Тип | taskId |
|---|---|---|---|
| [artifacts/text/server.ts](../../artifacts/text/server.ts) | 17, 79 | streamText | `artifact:text` (Sonnet) |
| [artifacts/markdown/server.ts](../../artifacts/markdown/server.ts) | 17, 76 | streamText | `artifact:markdown` (Sonnet) |
| [artifacts/excel/server.ts](../../artifacts/excel/server.ts) | 179, 274 | streamText | `artifact:excel` (Sonnet) |
| [artifacts/presentation-reveal/server.ts](../../artifacts/presentation-reveal/server.ts) | 116, 190 | streamText | `artifact:reveal` (Sonnet) |
| [artifacts/presentation-pptx/server.ts](../../artifacts/presentation-pptx/server.ts) | 134, 262 | streamText | `artifact:pptx` (Sonnet) |

**Professor pipeline (3):**
| Файл | Строка | Тип | taskId |
|---|---|---|---|
| [lib/ai/professor-pipeline.ts:217](../../lib/ai/professor-pipeline.ts#L217) | generateText | `professor:pipeline-analyze` (Grok 4.20) |
| [lib/ai/professor-pipeline.ts:307](../../lib/ai/professor-pipeline.ts#L307) | generateText | `professor:pipeline-execute` (Grok 4.1 Fast) |
| [lib/ai/professor-pipeline.ts:369](../../lib/ai/professor-pipeline.ts#L369) | streamText | `professor:pipeline-synthesize` (Grok 4.20) |

**Professors/Clerks (2):**
| Файл | Строка | Тип | taskId |
|---|---|---|---|
| [lib/ai/professors/task-reviewer.ts:136](../../lib/ai/professors/task-reviewer.ts#L136) | generateText | `professor:review` (Grok 4.20) |
| [lib/ai/clerks/task-summarizer.ts:154](../../lib/ai/clerks/task-summarizer.ts#L154) | generateText | `clerk:task-summary` (Grok 4.1 Fast) |

**Memory (5):**
| Файл | Строка | Тип | taskId |
|---|---|---|---|
| [lib/ai/memory/extract.ts:133](../../lib/ai/memory/extract.ts#L133) | generateObject | `memory:extract` (Grok 4.20) |
| [lib/ai/memory/extract.ts:314](../../lib/ai/memory/extract.ts#L314) | generateObject | `memory:extract-batch` (Grok 4.1 Fast) |
| [lib/ai/memory/extract.ts:448](../../lib/ai/memory/extract.ts#L448) | generateObject | `memory:dedup-verify` (Grok 4.1 Fast) |
| [lib/ai/memory/consolidate.ts:150](../../lib/ai/memory/consolidate.ts#L150) | generateObject | `memory:consolidate` (Grok 4.1 Fast) |
| [lib/ai/memory/profile.ts:116](../../lib/ai/memory/profile.ts#L116) | generateText | `memory:profile` (Grok 4.1 Fast) |

**Vision (2, Anthropic Haiku):**
| Файл | Строка | Тип | taskId |
|---|---|---|---|
| [lib/ai/vision-ocr.ts:59](../../lib/ai/vision-ocr.ts#L59) | generateText | `vision:ocr` (Haiku — **timeout-bomb риск если Haiku default = 64K**) |
| [lib/ai/vision-ocr.ts:112](../../lib/ai/vision-ocr.ts#L112) | generateText | `vision:ocr` (Haiku — тот же риск) |

**Backend routes (8):**
| Файл | Строка | Тип | taskId |
|---|---|---|---|
| [app/(chat)/api/chat/route.ts:132](../../app/(chat)/api/chat/route.ts#L132) | generateObject | подтвердить через чтение |
| [app/(chat)/api/chat/route.ts:1061](../../app/(chat)/api/chat/route.ts#L1061) | streamText | `simply-chat*` (Grok / Haiku vision / reasoning через override) |
| [app/(chat)/api/service-chat/route.ts:790](../../app/(chat)/api/service-chat/route.ts#L790) | streamText | `service-chat:*` (Sonnet / Haiku) |
| [app/(chat)/api/assistant/ben/route.ts:36](../../app/(chat)/api/assistant/ben/route.ts#L36) | streamText | `service-chat:ben` (Haiku) |
| [app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts:392](../../app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts#L392) | streamText | `project:expert:*` (Haiku/Sonnet/Opus) |
| [app/(chat)/api/projects/[id]/analyze-file/route.ts:130](../../app/(chat)/api/projects/[id]/analyze-file/route.ts#L130) | generateText | `clerk:file-analyzer` (Grok 4.1 Fast) |
| [app/(chat)/api/chat/[id]/generate-title/route.ts:87](../../app/(chat)/api/chat/[id]/generate-title/route.ts#L87) | generateObject | `util:title` (Grok 4.1 Fast) |
| [app/(chat)/actions.ts:33](../../app/(chat)/actions.ts#L33) | generateText | `util:title` (Grok 4.1 Fast) — **дубль?** |

**Briefing filter (1):**
| [lib/briefing/briefing-filter.ts:118](../../lib/briefing/briefing-filter.ts#L118) | streamText | `briefing:filter` (Grok 4.1 Fast) |

### Итого

- **5 явных + 31 implicit = 36 call sites** (не 20, как в заготовке)
- Из 31 implicit:
  - **8 non-streaming Anthropic** (vision-ocr × 2) — реальный timeout-bomb риск
  - **Остальные** — streaming (безопасно, но explicit cap всё равно хорошая гигиена: избыточная стоимость/latency, observability)
- Дубль `util:title`: actions.ts:33 + generate-title/route.ts:87 — оба называют одну задачу, но подают её разными способами (generateText vs generateObject). Потенциально архитектурная неясность — записать в FINDINGS как «выбрать один способ».

---

## Реальное состояние Этапа 3 (ProfessorPlanStreaming)

Задача подтверждена AI SDK v6 документацией:

- `streamText` поддерживает thinking providerOptions так же как generateText (см. [official guide](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)).
- Есть несколько паттернов получения полного текста — для парсинга `<plan_report>` / `<plan_json>` самый прямой — `await stream.text` + `await stream.usage`.
- Можно использовать `onFinish` callback — тогда парсинг и логирование в одном месте.

**Риск:** если Opus 4.6 reasoning стримится «медленно» в начале (thinking phase), streamText может долго ничего не отдавать. Но сам fetch не закрывается (в отличие от non-streaming) — Anthropic держит соединение. Проблема только в UX восприятия, не в технической надёжности. Для MVP (backend-only) — не блокер.

**Вопрос для решения:** после перехода на streamText нужно ли оставлять `maxOutputTokens` cap (через getter из этапа 2) или убирать полностью?
- **Оставить (мой выбор):** страхует от runaway adaptive thinking, explicit > implicit. Значение ~32K (больше 16K tactical, меньше 128K default). Используется getter из Этапа 2.
- Убрать: adaptive thinking сам решает, cap может усечь легитимный большой план.

---

## Рекомендации разработчика (Код-ревью)

### ✅ Согласен с умбреллой ТЗ
- Бандл трёх долгов оправдан — пересекающиеся файлы, общий слой, gate после каждого этапа обеспечивает безопасность.
- Порядок 1→2→3 правильный (этап 3 использует getter из этапа 2 если решим оставить cap в streamText).

### ⚠️ Корректировки после аудита

| # | Было (SPEC) | Рекомендация | Обоснование |
|---|---|---|---|
| 1 | Этап 1: «централизованная регистрация через instrumentation.ts» | **Уже сделано (коммит c4b2b63). Scope → гигиена: удалить 7 redundant импортов + ADR 048 update + fix backlog README** | Проверил `instrumentation.ts` — реализует Вариант C. ADR 048 L94-108 описывает устаревший контракт и содержит отрицающий постскриптум, не отражает instrumentation.ts фикс. |
| 2 | Scope Этапа 2: «~20 call sites» | **36 call sites** (5 явных + 31 implicit) | Grep-аудит всей `lib/` + `app/` + `artifacts/`. Список полный в секции выше. |
| 3 | Recommended cap table (из backlog) имеет неточности | Согласовать финальные значения в ANALYSIS перед ROADMAP. Часть taskId из backlog не существует (напр. `util:project-summary`, `util:artifact-suggestions` — их нет в task-assignments) | Читал task-assignments.ts целиком (201 строк). Из таблицы backlog часть taskId — мёртвые (не существуют) или старые названия. Нужна пересборка cap table по реальному TaskId union. |
| 4 | Этап 3: «tactical cap убирается» | **Оставить explicit cap через getter из Этапа 2** (значение ~32K) | Adaptive thinking в Opus теоретически может съесть 128K, чистая streamText без cap = риск избыточной стоимости. Explicit > implicit всегда. |
| 5 | Дубль `util:title`: actions.ts + generate-title/route.ts | Записать в **FINDINGS.md** как «выбрать один way». Не в scope этого ТЗ. | Разная механика вызова (generateText + generateObject) под одним taskId — архитектурный запах, но не блокирует Этап 2. |
| 6 | Vision OCR (2 вызова на Haiku без cap) | Приоритет в Этапе 2 — начать с этих двух + plan/route.ts как этап 3 зависимость | Единственные не-streaming Anthropic call sites без cap (кроме plan/route.ts). Timeout-bomb теоретически возможен. |

### ❓ Требует уточнения

- Стратегия cap для streaming вызовов: ставим всем 31 implicit call site явный cap, или только non-streaming Anthropic (2 vision + 1 plan)? (см. вопрос 1 ниже)
- Удалять 7 redundant side-effect imports в этапе 1, или оставить как defense-in-depth? (см. вопрос 2)
- Полный getter возвращающий значение vs optional Record с undefined для «без cap» (streaming, let SDK use model max)? (см. вопрос 3)

---

## Вопросы для уточнения

### Вопрос 1: Стратегия cap для streaming call sites — максимальное покрытие vs минимальная необходимость?

**Контекст:** из 36 call sites реально от timeout-бомбы страдают только 3 (non-streaming Anthropic без cap: vision-ocr × 2, plan/route.ts). Остальные 28 implicit — streaming, технически без риска (Anthropic/Grok держат соединение). Но explicit cap даёт:
- защиту от runaway output (лишняя стоимость),
- observability в логах (видим сколько планировали),
- единообразный код (не «почему здесь есть, здесь нет»).

**Варианты:**
- **A (максимум):** все 36 call sites проставляют cap через getter. 100% покрытие, единая гигиена.
- **B (минимум):** только 3 non-streaming + plan/route.ts. Закрывает реальный риск, минимум изменений.
- **C (гибрид):** только generateText/generateObject (non-streaming) везде — те 10 сайтов; streamText оставляем как есть, explicit cap опционально.

**Моё предложение: A.** Единая гигиена дороже всего одного разового прохода. Streamtext-cap не вредит, даёт observability «сколько модель попыталась».

### Вопрос 2: Удалять ли 7 redundant side-effect импортов на Этапе 1?

**Контекст:** после instrumentation.ts они избыточны. Но это defense-in-depth (если кто-то удалит instrumentation.ts или сломает его — routes продолжат работать).

**Варианты:**
- **A (чисто):** удалить все 7 → single source of truth в instrumentation.ts.
- **B (defense):** оставить → пусть существуют как подстраховка.
- **C (компромисс):** оставить только в `chat/route.ts` (основной продуктовый route) как явный маркер, остальные 6 удалить.

**Моё предложение: A.** Избыточный импорт → читатель видит его и думает «это обязательно» → добавляет в новые routes (это и привело к текущему разбросу). SSOT важнее защиты от гипотетического будущего удаления instrumentation.ts.

### Вопрос 3: Тип getter — обязательный number или optional с undefined?

**Контекст:** getter из Этапа 2 — `getMaxOutputTokensForTask(taskId)`. Простой вариант — всегда возвращает number. Гибкий — может возвращать `number | undefined`, где undefined = «пусть SDK использует model capability» (для задач где explicit cap не нужен).

**Варианты:**
- **A (простой):** всегда number. Для streaming задач без специфичных лимитов ставим большое значение (напр. 32K, 64K).
- **B (гибкий):** number | undefined. Getter возвращает undefined для задач где cap не нужен.

**Моё предложение: A.** Простота > гибкость. Если для задачи нужен «без cap» — ставим model capability (64K/128K) явно, это и есть декларация «бери всё что модель может». Undefined-path = implicit, что мы как раз ликвидируем.

### Вопрос 4: Значения cap table — пересобрать с нуля или взять backlog как старт?

**Контекст:** backlog cap table содержит taskId которых не существует в текущей `TaskId` union (util:project-summary, util:artifact-suggestions, memory:extract без batch-варианта, professor:pipeline-synth). Нужна сверка по реальному union.

**Предложение:** я пересоберу таблицу по реальному `TaskId` (все 36 task-ids) и покажу в ROADMAP → владелец апрувит. Это чистый аудит, не требует отдельного обсуждения если согласны с подходом «максимум покрытие» из Вопроса 1.

---

## Потенциальные риски

### Риск 1: Регрессия artifacts при добавлении maxOutputTokens cap

**Контекст:** artifact handlers (text/markdown/excel/presentation) генерируют большие документы. Если cap будет низким — документы обрежутся.

**Минимизация:** в cap table для `artifact:*` ставить щедрые значения (16-24K) — больше любого реально нужного размера артефакта. Если когда-нибудь понадобится больше — поднять в task-assignments одной строкой.

### Риск 2: generate-title дубль — два разных вызова под одним taskId

**Контекст:** actions.ts:33 и generate-title/route.ts:87 оба используют `util:title`, но разной механикой (generateText vs generateObject). При добавлении getter cap поведение может расходиться.

**Минимизация:** ставим одинаковый cap для обоих (~64 tokens — название чата). В FINDINGS записываем «унифицировать call site» как follow-up.

### Риск 3: streamText в plan/route.ts — изменение семантики result object

**Контекст:** текущий код `result.text` + `result.usage` → после streamText → `await stream.text` + `await stream.usage`. Разные promise semantics — парсинг `extractTag(result.text, ...)` должен работать одинаково, но нужен smoke test.

**Минимизация:** перед переходом — локальный smoke test с 10-задачным проектом, SQL-проверка `ai_usage_log` что thinkingTokens записываются.

### Риск 4: Side-effect import cleanup ломает dev overrides в каких-то routes

**Контекст:** instrumentation.ts работает *в теории*, но был случай session 3 (2026-04-14) когда аналогичная попытка была откачена из-за ложного диагноза. Смоук-тест обязателен.

**Минимизация:** перед удалением 7 импортов — smoke test отдельно по каждому route: закомментировать инструментацию → проверить что override не работает → раскомментировать → работает. Без этого теста удалять импорты опасно.

---

## Зависимости

- **До начала:** ответы на 4 вопроса выше
- **Этап 1 → Этап 2:** независимы по коду, но этап 1 короткий и чистит перед более крупным этапом 2
- **Этап 2 → Этап 3:** этап 3 использует getter из этапа 2 → порядок критичен
- **Инфраструктура:** `npm run build` доступен, `/dev/models` UI работает (для smoke test этапа 1), `mcp__postgres__query` доступен (для SQL проверки ai_usage_log)

---

## Оценка сложности

- [ ] Простое (1-2 сессии)
- [x] **Среднее (3-4 сессии)**
- [ ] Сложное (5+ сессий)

**Разбивка:**
- **Этап 1:** 0.5 сессии (7 import удалений + ADR 048 update + README fix + smoke test)
- **Этап 2:** 1.5-2 сессии (пересборка cap table + SSOT + getter + 36 call sites + smoke tests)
- **Этап 3:** 1-1.5 сессии (streamText rewrite + reasoning handling + smoke test адаптивного thinking)
- **Финализация:** 0.5 сессии (docs update по Правилу 6, SIMPLY_STATUS, CHANGELOG, move to _archive, backlog cleanup)

**Итого: 3.5-4.5 сессии.**
