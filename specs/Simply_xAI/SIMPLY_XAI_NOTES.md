# Simply — XAI Migration Notes

> Append-only лог. Новые записи добавляются сверху. Старые не редактируются.

**Соседние документы серии:**
- [SIMPLY_XAI_ROADMAP.md](SIMPLY_XAI_ROADMAP.md) — что планируем
- [SIMPLY_XAI_CHANGELOG.md](SIMPLY_XAI_CHANGELOG.md) — что реально сделано (append-only факт-лист)
- Этот файл — почему приняли такие решения

---

## 2026-04-16 — Multi-agent reservation correction + dead code cleanup (post-2ca1ac5 follow-up)

**Контекст:** Короткая follow-up сессия после `2ca1ac5` (HANDOFF после Этапов 2+3). Владелец ревью текущего state SSOT и нашёл одну ошибку фрейминга, плюс попросил почистить мёртвые константы.

### Multi-agent НЕ deprecated, а RESERVED

В `2ca1ac5` я (предыдущая итерация Claude Code) после переключения `expertise → grok-4.20-0309-reasoning` пометил запись `grok-4.20-multi-agent-0309` в каталоге и `docs/ai-chats-map.md` как **«⚠ Не используется»**. Это была **архитектурная ошибка фрейминга** — Владелец указал:

> Multi-agent — это **не замена** expertise, а **отдельный premium-режим** рядом с ним. Toggle «Команда агентов» по паттерну кнопки «Думать». Через Responses API, не через Chat Completions. Реализация — отдельная большая работа (MCP сервер, auth layer, observability адаптер, UI прогресса агентов). Полностью расписано в `BRAINSTORM_GrokMultiAgent.md` и в ROADMAP как ТЗ-XAI-MA-1.

**Решение:** зарезервировать `expertise-multi-agent` как taskId placeholder в task-assignments.ts. Это:
1. Type-системой закрепляет имя — никто не сможет случайно переиспользовать
2. Делает namespace видимым в SSOT — будущему разработчику сразу понятно что место занято
3. Связывает запись каталога `grok-4.20-multi-agent-0309` с конкретным taskId, а не оставляет её «висеть в воздухе»
4. Соответствует архитектурному принципу — когда фича запланирована и оформлена в BRAINSTORM, её следы должны быть в SSOT, не только в документах

**Реализованные правки:**
- [lib/ai/task-assignments.ts](../../lib/ai/task-assignments.ts) — `| "expertise-multi-agent"` в TaskId union + `"expertise-multi-agent": "grok-4.20-multi-agent-0309"` в `DEFAULT_TASK_MODELS` с подробным RESERVED-комментарием
- [lib/ai/model-catalog.ts](../../lib/ai/model-catalog.ts) — переписан `notes` на записи multi-agent: вместо «expertise переведён, запись остаётся для аудита» теперь «RESERVED под taskId expertise-multi-agent, реализация в ТЗ-XAI-MA-1»
- [docs/ai-chats-map.md](../../docs/ai-chats-map.md) — добавлен row в overview-таблицу + chatMode routing + исправлен row в таблице моделей: 🔒 Reserved вместо ⚠ Не используется
- Cross-reference в ROADMAP под ТЗ-XAI-MA-1

**Валидация:** `getModel("expertise-multi-agent")` сейчас зарезолвится в каталог через registry — ничего не ломается. Call sites нет, никто не вызывает. Регистрация типа — pure documentation gesture.

**Урок:** При снятии модели с активного использования различать **«deprecated» (удалить когда чисто)** vs **«reserved» (намеренно зарезервировано под будущую фичу)**. Эти два состояния выглядят одинаково в коде (запись в каталоге без активного call site), но семантически разные. Reserved нужно явно маркировать в SSOT через placeholder taskId + комментарий, чтобы будущая сессия не пометила как мёртвый код.

### Dead briefing constants cleanup

Параллельно: в [lib/briefing/briefing-config.ts](../../lib/briefing/briefing-config.ts) удалены `FILTER_MODEL` и `AUTHOR_MODEL` — наследие от ТЗ-Briefing-1. После миграции `briefing:filter` на Grok 4.1 Fast (commit `ceadd17`) эти константы перестали импортироваться (грэп подтвердил 0 ссылок в `lib/` и `app/`), но дезинформировали будущего читателя. Удалены без последствий — `npx tsc --noEmit` 0 ошибок.

### Audit metadata bug — уже починен в 2ca1ac5

При сверке нашёл, что `app/(chat)/api/meeting/regenerate/route.ts:91` использовал хардкод `modelId: "claude-sonnet-4-6"` в audit metadata. После моего переключения `meeting:summary → Grok 4.20 reasoning` это начало бы писать лживое значение в БД. **Хорошая новость:** этот фикс уже применён в HEAD (676d50d / 2ca1ac5), мой Edit в этой сессии оказался noop. Note для будущих сессий: при переключении модели `taskId X` — обязательно грэпать на хардкод `claude-sonnet-4-6` / любой target-modelId по audit metadata блокам и заменять на `getModelIdForTask("X")`.

### DevPanel display labels для Grok моделей

В трёх компонентах ([model-section.tsx](../../components/dev-panel/sections/model-section.tsx), [dev-panel-footer.tsx](../../components/dev-panel/dev-panel-footer.tsx), [timeline-section.tsx](../../components/dev-panel/sections/timeline-section.tsx)) у `MODEL_DISPLAY` map'а не было записей для Grok моделей — fallback показывал raw modelId типа `grok-4.20-0309-reasoning`. Добавлены красивые лейблы для всех 5 Grok вариантов + MiniMax-long. Косметика, но прямо в scope текущей миграции — после переключения 11 taskId на Grok DevPanel становится главным интерфейсом наблюдения за реальной маршрутизацией для Владельца.

---

## 2026-04-16 — ТЗ-XAI-4 Этапы 2+3 + scope expansion + 4 hot-fixes

**Контекст:** Одна плотная сессия, закрывшая Этап 2 (6 taskId подсобки на Grok 4.1 Fast), Этап 3 (meeting:summary на Grok 4.20), + неожиданное расширение scope решениями Владимира в IDE по empirical-данным из тестов.

### Этап 2 — 6 taskIds подсобки (commit `ceadd17`)

- 6 taskId → `grok-4-1-fast-non-reasoning`: `briefing:filter`, `clerk:task-summary`, `clerk:file-analyzer`, `util:title`, `util:project-summary`, `util:artifact-suggestions`
- `docs/ai-chats-map.md` синхронизирован (8 правок)
- SQL confirmed 3/6: `clerk:file-analyzer` (3 calls), `util:title` (logged as `util:auto-naming`), `briefing:filter` — все на Grok 4.1 Fast ✅
- HANDOFF cleanup — убраны 2 устаревших MCP disconnection блока
- Rule №0 smoke test streamObject array mode на Grok 4.1 Fast (отдельная запись ниже) прошёл до кода

### Этап 3 + scope expansion — Владимир в IDE после empirical findings (commit `<this>`)

После Этапа 2 Владимир напрямую в IDE расширил scope на основе empirical данных сессии, обошёл последовательное прохождение Этапов 3/4 и принял 5 решений сразу:

| taskId | До | Стало | Причина |
|---|---|---|---|
| `simply-chat-think` | grok-4.20-0309-**non-reasoning** | grok-4.20-0309-**reasoning** | пересмотр Q1 ТЗ-XAI-3 решения по empirical данным (reasoning variant даёт лучший результат на multi-step задачах) |
| `expertise` | grok-4.20-multi-agent-0309 | grok-4.20-0309-**reasoning** | **R-5 resolved** (было в scope XAI-5) — multi-agent через Chat Completions работает как обычный 4.20, миграция на reasoning variant |
| `create` | MiniMax-M2.7 | grok-4.20-0309-**reasoning** | **scope XAI-5 выполнен** — «зал», пользователь видит результат в реальном времени, качество важнее экономии |
| `memory:extract` | grok-4.20-0309-non-reasoning | grok-4.20-0309-**reasoning** | mission-critical task, нужен интеллект reasoning |
| `meeting:summary` | claude-sonnet-4-6 | grok-4.20-0309-**reasoning** | **Этап 3 ТЗ-XAI-4 выполнен** — длинные транскрипты встреч |

Плюс важное архитектурное добавление в `docs/ai-chats-map.md` header:

> **⚠️ Важно для разработчиков:** Этот документ описывает **чаты и UI**, а не является реестром моделей. Единственный источник правды по моделям — [`task-assignments.ts`](../lib/ai/task-assignments.ts). Если таблицы расходятся — **правда в коде**, а документ устарел.

Это ставит SSOT в коде выше документа и задаёт правило приоритета для будущих расхождений.

### SQL-подтверждение scope за сессию (включая Владимирские правки)

| taskId | Confirmed model via SQL |
|---|---|
| `simply` (simply-chat) | grok-4-1-fast-non-reasoning ✅ (было из XAI-3) |
| `clerk:file-analyzer` | grok-4-1-fast-non-reasoning ✅ (3 calls) |
| `util:title` (as `util:auto-naming`) | grok-4-1-fast-non-reasoning ✅ |
| `briefing:filter` | grok-4-1-fast-non-reasoning ✅ |
| `memory:extract` | grok-4.20-0309-non-reasoning (на момент теста, до Владимирского variant switch) |
| `project:expert` | grok-4.20-0309-non-reasoning (через dev override в проекте) |
| `professor:planner` | grok-4.20-0309-non-reasoning (hot-fix plan route + dev override) |
| `expertise` (override) | grok-4-1-fast-non-reasoning (в тестовом режиме через dev override) |
| `briefing:author` empirical test | grok-4.20-0309-non-reasoning (через dev override для URL hallucination test) |
| `service:briefing-onboarding` | claude-sonnet-4-6 (вне scope) |
| `service:project-manager` | claude-haiku-4-5 (вне scope) |
| `service:project-creation` | claude-sonnet-4-6 (вне scope) |
| `artifact:markdown` | claude-sonnet-4-6 (вне scope, остался) |

Не триггерились в тесте: `clerk:task-summary`, `util:project-summary`, `util:artifact-suggestions` — но scope принят Владельцем (Gate C Вариант A).

### Hot-fix 1: plan/route.ts (commit `d9d3488`)

**2 pre-existing бага в одном месте** — обнаружены во время тестирования professor:planning с 3× 187s timeout.

**Баг 1:** `app/(chat)/api/projects/[id]/plan/route.ts` не импортировал `@/lib/ai/model-overrides-node` → dev override `professor:planning → Haiku` молча игнорировался → все 3 попытки шли на Opus. **Identical `bytesWritten=20223` в 3 попытках** = deterministic, не сеть/VPN.

**Баг 2:** Claude Opus 4.6 `maxOutputTokens` по умолчанию = **128_000** (из `@ai-sdk/anthropic/dist/index.mjs:4544` + `model-catalog.ts:254`). 128K легитимно (Anthropic поднял с 32K → 128K 2026-04-12), но **Anthropic требует streaming для `max_tokens > 21333`** (docs.anthropic.com/en/api/errors#long-requests). `generateText` non-streaming → first chunk не успевает за 60s fetch timeout → socket close × 3 retry = 180s fail.

**Фикс:** 1 import line + `maxOutputTokens: 16000`. После этого + override на Grok 4.20 non-reasoning: планирование прошло за 26.6s / $0.028.

**Бонусная валидация:** Grok 4.20 non-reasoning справился с multi-step reasoning + structured JSON output на professor:planning task. Это повлияло на Владимирский IDE edit `simply-chat-think` на reasoning variant — empirical данные о способностях Grok 4.20 reasoning в multi-step задачах.

### Hot-fix 2: briefing routes (commit `<this>`)

Та же архитектурная дыра в 3 briefing backend routes:

- [app/(chat)/api/briefing/generate/route.ts](../../app/(chat)/api/briefing/generate/route.ts)
- [app/(chat)/api/briefing/refresh-section/route.ts](../../app/(chat)/api/briefing/refresh-section/route.ts)
- [app/api/cron/briefing/route.ts](../../app/api/cron/briefing/route.ts)

Ни один не импортировал `model-overrides-node` → override для `briefing:author` в dev panel игнорировался. Это блокировало empirical test альтернативной модели (был бы фейковый тест).

**Фикс:** по 1 import line в каждый. После этого override `briefing:author → grok-4.20-0309-non-reasoning` сработал, SQL подтвердил, empirical данные получены.

**Известная global issue:** `_archive/TZ_DeadModelSelectors/FINDINGS.md:36` говорит «reader в 4 местах». Hot-fix Этапа 2 закрыл 4 места (plan + 3 briefing). `app/(chat)/api/service-chat/route.ts` **точно не имеет** (grep подтвердил). Нужен глобальный audit — хвост `TZ_DevOverridesSideEffectImportAudit` на Этапе 4.

### Empirical test briefing:author — модель НЕ решает URL hallucination (важно!)

**Симптом:** DevPanel Pipeline Trace показал **10 из 11 URL в статье как Fabricated** (MiniMax).

**Моя ошибочная первая диагностика:** написал «это MiniMax-specific weakness на structured URL attribution». **Владелец немедленно поправил:** «эту роль раньше выполняли Sonnet и Gemini — они тоже галлюцинировали, именно поэтому метрика `fabricated` была добавлена как детектор в принципе, не model-specific».

**Empirical test (возможен благодаря hot-fix briefing routes):**

| Run | Модель | Duration | Cost | Fabricated |
|---|---|---|---|---|
| 19:06 | MiniMax-M2.7 | 137.3s | $0.010 | **10/11 (91%)** |
| 19:16 | grok-4.20-0309-non-reasoning | **15.6s** | $0.044 | **9/11 (82%)** |

Marginal 9% улучшение при 4.4× цене. Plus Sonnet и Gemini исторически тоже. **4 разные модели (Sonnet, Gemini, MiniMax, Grok 4.20) одинаково плохо** — это не model issue, это architectural (prompt + presentation + lack of schema enforcement).

**Новое правило в memory** (`feedback_empirical_test_before_model_blame.md`): не диагностировать AI-output проблему как «model weakness» без empirical теста на 2+ моделях.

**Хвост:** [TZ_BriefingAuthorUrlHallucination](../_backlog/TZ_BriefingAuthorUrlHallucination.md) **High impact**. Рекомендованное решение — **structured output через `generateObject` с `z.enum([...allowedUrlsFromFilter])`** (URL физически не могут быть сгенерированы вне списка). 1-2 сессии.

### 4 новых хвоста в backlog (все найдены в этой сессии, все pre-existing)

1. 🟥 **[TZ_BriefingAuthorUrlHallucination](../_backlog/TZ_BriefingAuthorUrlHallucination.md)** — 82-91% fabricated URLs, architectural, empirical confirmed across 4 models
2. 🟧 **[TZ_ServiceChatNotOverridable](../_backlog/TZ_ServiceChatNotOverridable.md)** — 3 дыры: UI coverage + backend import gap + docs briefing-onboarding/pipeline confusion
3. 🟧 **[TZ_DevPanelFooterHidesSubCalls](../_backlog/TZ_DevPanelFooterHidesSubCalls.md)** — DevPanel footer скрывает nested subcalls cost
4. 🟧 **[TZ_TaskExpertChatInputMissingOnFirstOpen](../_backlog/TZ_TaskExpertChatInputMissingOnFirstOpen.md)** — useChat state bug, требует hard reload

Плюс **3 запланированных хвоста** для создания на финализации (после полного audit'а):
- `TZ_DevOverridesSideEffectImportAudit` — global audit backend routes
- `TZ_ProfessorPlanStreaming` — переход plan route на streamText (long-term fix max_tokens timeout)
- `TZ_MaxOutputTokensAudit` — явный `maxOutputTokens` для всех generateText/streamText вызовов

### Уроки этой сессии для серии

1. **xAI prompt caching автоматически** (смола тест streamObject, 160/405 tokens cached без `providerOptions.xai.cacheControl`). Не нужна ручная настройка, сервер кэширует system prompt сам.
2. **Grok 4.20 reasoning = сильная модель для multi-step tool-calling** — подтверждено empirically на professor:planning, project:expert, briefing:author. Этот empirical bar повлиял на Владимирские IDE edits `simply-chat-think` и `memory:extract` на reasoning variants.
3. **Override mechanism global gap** — не все backend routes импортируют reader. Требует systemic audit + архитектурное решение (middleware? auto-register? instrumentation.ts?). Хот-фикс закрыл 4 routes, но это не решение a-la-permanent.
4. **Empirical test перед model-blame** — новое правило в memory. Sonnet/Gemini/MiniMax/Grok 4.20 все 4 одинаково плохо справляются с URL attribution = архитектура, не модели.
5. **Scope consolidation snap** — весь session закрылся 3 коммитами по паттерну v3.91.0: feat(scope) + fix(hot-fix) + docs(backlog). Плюс session-closing commit с Владимирскими IDE edits и NOTES entry. HANDOFF отдельно.
6. **Документация ≠ SSOT** — Владимир добавил в `ai-chats-map.md` header warning что правда в коде. Правильный architectural stance для быстро меняющихся mapping-документов.
7. **Scope expansion в IDE** — Владелец как product owner может расширить scope ТЗ напрямую в коде, обходя формальные этапы, когда empirical данные дают достаточно уверенности. Scope ТЗ-XAI-4 после Этапа 2+3 расширился с 7 точек на ~12 реально изменённых taskIds.

---

## 2026-04-16 — ТЗ-XAI-4 Этап 1: streamObject smoke test PASSED (Grok 4.1 Fast)

**Контекст:** В ANALYSIS обсуждения по ТЗ-XAI-4 вылез риск для `util:artifact-suggestions` — это единственная точка в scope ТЗ, которая использует **`streamObject` с `output: "array"` mode** ([lib/ai/tools/request-suggestions.ts:49](../../lib/ai/tools/request-suggestions.ts#L49)). docs.x.ai заявляет «structured outputs», но явно не специфицирует streamObject array mode в AI SDK v6. Решение — изолированный smoke test до любых правок task-assignments (Rule №0 «семь раз отмерь»).

### Результат: PRIMARY PASS на первой попытке

**Тест:** [scripts/test-grok-streamObject.ts](../../scripts/test-grok-streamObject.ts) (удалён после прохождения per паттерн v3.91.0)

**Схема — копия реальной из requestSuggestions:**
```ts
z.object({
  originalSentence: z.string(),
  suggestedSentence: z.string(),
  description: z.string(),
})
```

**Prompt:** короткий текст с 4 грамматическими ошибками (grew/grown, has/have, is make/is to make, did/achieved).

**Результат через `registry.languageModel("xai:grok-4-1-fast-non-reasoning")`:**
- ✅ `elementStream` yielded **4 элемента**, все 4 — корректные исправления грамматики
- ✅ Все элементы прошли Zod `safeParse` без ошибок
- ✅ `usage` promise резолвится: `inputTokens: 405`, `outputTokens: 210`, `totalTokens: 615`
- ✅ Duration: **3304ms** (приемлемо для UX streaming)

### Бонусная находка: xAI делает prompt caching автоматически

В usage resolved объекте увидели:
```
cachedInputTokens: 160
inputTokenDetails: { noCacheTokens: 245, cacheReadTokens: 160 }
```

Из 405 input tokens **160 закэшированы автоматически** на стороне xAI — без каких-либо `providerOptions.xai.cacheControl` с нашей стороны. Это поведение сервера, не клиентская оптимизация. В `request-suggestions.ts` text документа + system prompt частично хитятся при последующих вызовах в пределах окна провайдера.

**Следствие:** усилия на explicit caching для xAI в нашем коде — не нужны. Сервер сам кэширует повторяющийся system prompt. Заметно упрощает миграцию (не надо тянуть `cacheReadTokens` в `logUsage`, он просто доступен в usage объекте как есть).

**TODO backlog:** возможно добавить логирование `cachedInputTokens` в `ai_usage_log` для xAI-моделей, чтобы `/admin/cost-audit` видел реальную стоимость с учётом caching. Это отдельная задача, вне scope ТЗ-XAI-4.

### Решение для Этапа 2

- `util:artifact-suggestions` → `grok-4-1-fast-non-reasoning` (**primary, не fallback**)
- Q-A fallback (Вариант 3 — Grok 4.20) не потребовался
- Scope ТЗ-XAI-4 остаётся 7 точек без изменений
- Этап 2 можно запускать с confidence

### Урок для серии

**streamObject array mode на xAI работает out-of-the-box через AI SDK v6.** Для будущих ТЗ серии (XAI-5: create + expertise, XAI-6: cleanup) — аналогичные `streamObject` вызовы миграции не должны требовать smoke test. ТЗ-XAI-2 подтвердил `generateObject` (MIND pipeline), ТЗ-XAI-4 подтвердил `streamObject` (request-suggestions). Структурированные outputs через AI SDK v6 xAI provider — проверенный паттерн.

**Memento:** если в будущем смотреть на docs.x.ai и видеть только «structured outputs» без упоминания `streamObject` — это нормально. AI SDK v6 xAI provider реализует весь spectrum structured output APIs (generateObject, streamObject с object/array modes) через base Chat Completions + JSON mode.

---

## 2026-04-16 — ТЗ-ATTACH-1 завершён (v3.91.0)

**Что сделано кратко:** Слой 0 из SIMPLY_ATTACHMENT_ARCHITECTURE.md реализован для PDF. Текстовые PDF извлекаются через pdf-parse v2 в `text/plain` при upload, сканы остаются как `application/pdf` → Haiku. Shared helper `lib/pdf/extract-pdf-text.ts` + интеграция в upload route + починка сломанного v1-API legacy call в project files route.

### Решения по 5 открытым вопросам (все ответы от Владимира в один шаг)

Q1 pdf-parse v2 — уже установлена, mehmet-kozan pure TS rewrite с breaking API change от v1 → v2 (`new PDFParse({data}).getText()`). Prior к этому ТЗ [projects/[id]/files/route.ts:86-96](../../app/(chat)/api/projects/[id]/files/route.ts#L86) использовала **v1 signature на v2 package** → `pdfParse(buffer)` как function call на класс → throw → silent catch → `metadata.extractedContent` всегда undefined → **месяцы молчаливой деградации**. Нашлось во время ANALYSIS, починено в том же коммите (Q5 решение = A).

Q2 эвристика — `pageCount >= 2 ? avgCharsPerPage < 30 : text.length < 100`. Специальный случай для 1-page потому что avg на одной странице ненадёжен. Порог 30 chars/page как старт, логирование для эмпирической калибровки.

Q3 truncate — 200 KB (~50K chars) симметрично project files cap. **Маркер обрезания показывается только если реально обрезали** — Владимир прямо указал «не пугать пользователя на 90% документов». 45K документ проходит без маркера, 110K — с ним.

Q4 encrypted/corrupt — graceful catch → fall-through на native PDF upload → Haiku нативно. Без red errors в UX.

Q5 чинить project files в этом же ТЗ — Владимир выбрал A (связанный scope). Обоснование: обе проблемы (новая PDF extraction + сломанный v1 call) — один клубок «capability-agnostic PDF upload», разделение на два коммита удвоило бы тесты без пользы.

### Серия багов в процессе реализации — три разных webpack/ESM мины

**Мина 1: `import { PDFParse } from "pdf-parse"` top-level → crash.** pdf-parse v2 `type: "module"` ESM-first. Next.js RSC webpack bundler пытается статически проанализировать named imports и падает с `Object.defineProperty called on non-object` при eval модуля на первом запросе. Dev server не красный флажок на build, ломается только в runtime первой загрузки.

**Мина 2: `await import("pdf-parse")` dynamic import тоже crash.** Переделал helper на паттерн проекта (mammoth/xlsx style): dynamic import внутри async функции. Логика: webpack не бандлит статически → резолвит на runtime. **Не помогло.** Webpack всё равно пытается включить pdf-parse в bundle даже через dynamic import и ломается на тех же internals. Ошибка та же, но теперь поймана try/catch в upload route → graceful fallback на Haiku → **вылез Second Hand Crash**.

**Мина 3 (уже pre-existing, не моя):** graceful fallback отправил PDF на Haiku как native → Haiku API `A maximum of 100 PDF pages may be provided` → AI_APICallError → стрим onError → UI висяк без ошибки. Pre-existing gap в UX защите для больших scan-PDF. Не блокер v3.91.0, но зафиксирован как edge case в NOTES: 100+ page scan PDF → Haiku crash. Защита добавляется либо cap в upload route, либо `adaptHistoryToCapabilities` check на page count в Haiku branch — отдельный stage/ТЗ.

### Правильный фикс — `serverExternalPackages`

Решение — добавить `"pdf-parse"` в `serverExternalPackages` в `next.config.ts` рядом с `lamejs` (который уже там по той же причине). Это говорит Next **не бандлить вовсе**, резолвить через Node `require` на runtime. После этого **top-level static import снова работает** — webpack видит package external, пропускает.

**Урок:** `mammoth`/`xlsx` паттерн «dynamic import внутри функции» работает только для CJS packages или ESM-lite. Для полноценных ESM packages с worker-dependencies (как pdf-parse v2 который тянет `pdfjs-dist/legacy`) — нужен именно `serverExternalPackages`. Я потратил одну итерацию на неверное предположение что dynamic import универсален.

### Stale .next cache → DevPanel пропал

После цикла правок next.config.ts + kill -9 dev server + restart, при тестах на уже рабочей реализации Владимир заметил что **DevPanel footer перестал показываться** под новыми сообщениями (старые сообщения сохраняли footer из localStorage). Симптом: visually DevPanel «исчез» после моих последних изменений.

Root cause — **stale webpack chunks в `.next/`**. Серия restart с изменяющейся конфигурацией оставила в кэше частично невалидные manifests/chunks. Client bundle был частично pre-my-changes, серверный — post. В логах все Chat API calls были 200 OK, emit через dataStream тоже происходил, но client-side парсер batches либо не запускался, либо крашился тихо на десериализации, которую я не мог увидеть без F12.

**Фикс:** `rm -rf .next/` + `npm run dev` с нуля + hard reload в браузере. Всё вернулось. Multi-PDF в одном сообщении тоже работает.

**Урок:** после изменения `next.config.ts` (особенно `serverExternalPackages`, `env`, `outputFileTracingIncludes`) — **обязательно** чистый rebuild. Dev server HMR не пересобирает эти секции чисто, оставляет скрытый state drift. Правило в backlog не фиксирую как «блокер», но держу в голове как default при любой будущей next.config правке.

**Анти-паттерн который я чуть не сделал:** в момент паники про пропавший DevPanel я начал читать client-side код `dev-panel-provider.tsx` → `parseBatches` → `debug-events.ts` в поиске регрессии моего кода. Ничего там не менялось, и грепы подтвердили что регрессии нет. **Правильная эскалация была простая** — `rm -rf .next && restart`, проверка 30 секунд, которая либо доказывает либо исключает cache. Сделал бы это первым — сэкономил бы шаг чтения кода.

### Scope consolidation — правильный выбор (опять)

Два разных бага в одном ТЗ (новая PDF extraction + фикс project files v1→v2) — скоуп-консолидация снова окупилась. Разделение: два коммита, два мануальных теста, два CHANGELOG-записи, разная user-invocation. Связанный скоуп: один helper, один commit, один тест, одна история. Паттерн работает когда обе задачи по сути одна инженерная идея (здесь — «все PDF идут через SSOT extractor»).

### Связь с архитектурным документом

v3.90.2 закрыл history adaptation через `adaptHistoryToCapabilities` (Decision 3). v3.91.0 закрыл upload extraction через Слой 0 (Decision 4). Вместе они дают **capability-agnostic через SSOT** для всей attachment зоны: и upload pipeline, и history pipeline читают capabilities из model-catalog и не знают про конкретные модели/провайдеры. Следующее место где SSOT нужен — routing layer (`simply-chat` vs `simply-chat-vision` taskId selection) — там всё ещё есть хардкод на типы. Но это уже ТЗ-XAI-5 или отдельное.

---

## 2026-04-15 — ТЗ-XAI-3 завершён (v3.90.0)

**Что сделано кратко:** KITT + Think перешли на xAI Grok (4.1 Fast + 4.20 соответственно), удалено 80 строк R-6 зоопарка strip-функций, зафиксированы два backlog-айтема (error recovery UI, readDocument tool quality).

### Расширение scope: Think тоже в XAI-3

Первоначальный план (до сессии): XAI-3 трогает только `simply-chat`, Think уходит в XAI-5. Владимир поймал мою экономически-слабую логику: «а зачем Sonnet на переходный период? Мы же только тестируем, никаких продуктивных задач не решаем, зачем жечь деньги». Правильный довод. Scope расширен: Think default → `grok-4.20-0309-non-reasoning` прямо в XAI-3. ТЗ-XAI-5 сузилось до Create + Expertise + R-5.

### Variant A vs B для Think: принят A (non-reasoning)

Из двух вариантов `grok-4.20-0309-non-reasoning` vs `grok-4.20-0309-reasoning` Владимир выбрал **A**. Обоснование продуктовое: пользователь нажимает «Думать» → ожидает умный ответ, а не UX-паузу с bubble «модель размышляет». Мгновенный умный ответ > отложенный умный ответ. Variant B остаётся доступным через `/dev/models` без коммита — если после эксплуатации захочется dramaturgy паузы, одна запись в override файле.

**Подтверждение на smoke-тесте:** Владимир после Think-теста написал «разница была невероятно крутая». Non-reasoning вариант даёт достаточно ощутимый tier upgrade от 4.1 Fast без добавления reasoning paused tokens.

### Compaction/caching блоки — живы для Haiku vision, не трогаем

Владимир спросил «что за проблема в Compaction/prompt caching блоках, почему ты их не трогаешь». Объяснение пошло по-человечески без жаргона: эти фичи — Anthropic-специфичные, мы включаем флажки через `providerOptions.anthropic.*`, xAI их игнорирует (как китайская открытка в русском письме). Но они **живы для vision-маршрута** — simply-chat-vision всё ещё использует Haiku 4.5, для которого эти фичи дают реальную экономию (кэшированный системный промпт ~3000 токенов не оплачивается на каждый photo-запрос). Удаление этого блока возможно **только когда vision уйдёт с Claude полностью** — это ТЗ-XAI-6 или отдельное решение.

Владимир согласился: «мы теперь не используем автоматическое сжатие из коробки от Anthropic для Grok, но оно работает для Haiku — ок, не трогаем».

### Регрессия на шаге 5 — урок про дубликат функции

Первый Think-тест упал с `AI_UnsupportedFunctionalityError: 'file part media type text/plain' functionality not supported`. Root cause двойной:

1. `saveMessages` сохраняла оригинальные `message.parts` (с file part для text/plain), а не уже-сконвертированные `processedMessage.parts`. Баг существовал давно — но маскировался тем что под Sonnet (think default) Anthropic принимал file parts. Grok не принимает → баг вылез
2. Моя initial `inlineTextFileParts` была **дубликатом уже существующей `convertTextFilesInAllMessages`** в том же файле. Diagnostic hint `"declared but never read"` про готовую функцию был прямо перед глазами при каждом Edit — я его проигнорировал как "pre-existing noise". Оказалось это готовый async helper который умеет fetch'ить Vercel Blob URL → инлайнить text content. Моя самодельная функция проверяла `typeof p.text === "string"` которое не срабатывало для rehydrated из БД parts (у них был только `.url`, не `.text`)

**Фикс (30 минут debug):**
- Удалён мой дубликат
- `preparedHistory` → `await convertTextFilesInAllMessages(cleanedHistory)` (async переход через await)
- `saveMessages` → `processedMessage.parts` + `estimateMessageTokens(processedMessage.parts)`

**Правило на будущее (зафиксировать в feedback memory?):** при добавлении helper'а в целевой файл — grep на типовые имена функций + **внимательно** смотреть diagnostic hints про `"declared but never used"`. Они часто указывают на готовый dead-but-useful код. Выигрыш 2 минуты grep + 2 минуты анализа hint = экономия 30 минут debug.

### Процессный урок — дисциплина бэклога

Владимир поднял **9-кратный** упрёк про проблему «error state в useChat блокирует следующее сообщение, нужна перезагрузка страницы». Каждый раз обещано «починим», не чинилось, воспроизводилось. Это **не забывчивость, а системный фейл дисциплины бэклога** — проблема откладывалась устно без записи → забывалась.

Исправлено: создан [specs/_backlog/TZ_ErrorRecoveryUI.md](../_backlog/TZ_ErrorRecoveryUI.md) **прямо в сессии**, до технического фикса регрессии. Внутри — история, стадии, Владимир'ов минимальный фикс как Stage 1 («показать в красном флаге текст про перезагрузку страницы»), root cause как Stage 2.

**Правило на будущее:** любая повторяющаяся не-блокер-проблема = немедленно в backlog, даже если фикс откладывается. Устные «потом починим» = сигнал к немедленной backlog-записи.

### xAI implicit caching — приятный бонус

На MIND retrieve тесте DevPanel показал `Cache read: 6520 tokens` при `Input (fresh): 300`. Это **implicit cache у xAI** — OpenAI-совместимые провайдеры эмитят `prompt_tokens_details.cached_tokens` автоматически без нашей конфигурации. Мы отказались от Anthropic cache через `isAnthropicProtocolModel` гейт под Grok, но xAI даёт свой кэш **бесплатно и автоматически**. Наш cost calculator (`extractUsageForPricing`) уже парсит это поле и применяет cached pricing ($0.05/1M вместо $0.20/1M). Итоговая стоимость запроса ₽0.04 отражает экономию.

Не требует никаких правок — просто наблюдение которое хорошо документировать.

### `readDocument` tool путает Grok с attached файлами

На смоук-тестах 4 и 4b Grok вызывал `readDocument` tool на имя attached файла (`API_CHANGES.txt`, `test-valenok.txt`), получал `Access denied: Only files in knowledge/ directory can be read`, но параллельно инлайн-содержимое файла уже было в промпте → ответ всё равно корректный. Quality issue tool-selection у Grok, не блокер миграции.

Backlog: [TZ_SimplyReadDocumentTool.md](../_backlog/TZ_SimplyReadDocumentTool.md). Три подхода: (а) убрать из active tools для simply, (б) научить tool различать knowledge/ vs attached, (в) правка промпта. Решение — в отдельной сессии после серии Simply_xAI.

---

## 2026-04-14 — Workflow серии: три документа вместо шести локальных CHANGELOG

Владимир: предложил один CHANGELOG на всю серию миграции вместо локальных `CHANGELOG.md` внутри каждой папки `TZ_xai_N/`. Для одиночных ТЗ локальный changelog избыточен (есть глобальный проектный), а для серии из 6 ТЗ ценность факт-листа высока: передача смены, оформление документации, аудит без перебора commit history.

**Принятое решение:** три документа на всю серию, не на каждое ТЗ:
- `SIMPLY_XAI_ROADMAP.md` — forward-looking план (живой)
- `SIMPLY_XAI_CHANGELOG.md` — что реально сделано per ТЗ (append-only факт-лист) ← **новый**
- `SIMPLY_XAI_NOTES.md` — почему решили так (append-only лог решений)

Локальных `CHANGELOG.md` внутри `TZ_xai_N/` папок **не создаём** — дублирование ухудшает читаемость серии. В папке ТЗ остаются только SPEC / ANALYSIS / ROADMAP.

**Это нарушение стандартного шаблона `specs/_template/`** (там есть `CHANGELOG.md` и `HANDOFF.md` на каждое ТЗ) — но для серии эти файлы агрегируются вверх. Стандартный шаблон применяется к одиночным ТЗ без изменений.

**Workflow будущего Claude Code при входе в серию:**
1. `SIMPLY_XAI_CHANGELOG.md` (5 сек → знает что уже сделано)
2. `SIMPLY_XAI_ROADMAP.md` прогресс-таблица (5 сек → знает что следующее)
3. `SIMPLY_XAI_NOTES.md` последние 2-3 записи (30 сек → понимает контекст)
4. `TZ_xai_N/ANALYSIS.md` + `ROADMAP.md` текущего ТЗ (1 мин → детали)

---

## 2026-04-14 — Кнопка «Думать» в Simply Chat — продуктовая семантика

Владимир уточнил смысл кнопки «Думать» — я был неправ в своём последнем объяснении, когда интерпретировал её как «переключение reasoning режима той же модели».

**Правильное понимание:**
- **Без кнопки** → дефолтная модель (после миграции: `grok-4-1-fast-non-reasoning`, $0.20/$0.50 per 1M)
- **С кнопкой** → сильная модель (после миграции: Grok 4.20, $2/$6 per 1M — в 10 раз дороже, заметно сильнее)

Это **тировый апгрейд модели**, не технический reasoning mode. Имя «Думать» — продуктовая метафора для пользователя («используй умную модель»).

**Зачем так:** пользователь сразу видит разницу в качестве ответа, value proposition кнопки очевиден.

**Открытый вопрос (решим при старте ТЗ-XAI-5):** какой вариант Grok 4.20 для кнопки «Думать»?
- **A. `grok-4.20-0309-non-reasoning`** — чистый tier upgrade, быстрый ответ, только input/output токены
- **B. `grok-4.20-0309-reasoning`** — tier upgrade + физическое чувство паузы на reasoning, дополнительно тратит reasoning tokens (по ставке output, $6/1M)

Оба стоят одинаково за input/output. Разница в дополнительных reasoning tokens у варианта B + в UX (пользователь видит задержку «модель думает» у B, практически мгновенный ответ у A).

**Зафиксировано в памяти:** `project_think_button_semantics.md` — чтобы будущий Claude Code не интерпретировал кнопку как reasoning toggle.

---

## 2026-04-14 — Verified Grok parameter reference (источник правды для всех ТЗ серии)

Сводка проверенных параметров xAI Grok моделей. Используем как SSOT при планировании и реализации любого ТЗ серии Simply_xAI. Опровергнутые утверждения (в том числе из внешних AI-консультаций и брейнсторма) помечены явно.

### Семейства моделей и их варианты

| Family | Reasoning variant | Non-reasoning variant | Multi-agent variant |
|---|---|---|---|
| Grok 4.20 | `grok-4.20-0309-reasoning` | `grok-4.20-0309-non-reasoning` | `grok-4.20-multi-agent-0309` |
| Grok 4.1 Fast | `grok-4-1-fast-reasoning` | `grok-4-1-fast-non-reasoning` | — |

### providerOptions для AI SDK v6 `@ai-sdk/xai`

| Параметр | Reasoning variant | Non-reasoning variant | Multi-agent variant |
|---|---|---|---|
| `xai.reasoningEffort: "low" \| "high"` | ❌ **Bad Request** (empirical 2026-04-14) | ❌ **Bad Request** (empirical 2026-04-14) | ✅ Принимает `low/medium/high/xhigh` — управляет числом агентов (low/medium = 4, high/xhigh = 16) |
| `temperature` (0–2) | ✅ | ✅ | ✅ |
| `top_p` | ✅ | ✅ | ✅ |
| `presence_penalty` | ❌ не поддерживается reasoning-моделями | ✅ | ❌ |
| `frequency_penalty` | ❌ не поддерживается reasoning-моделями | ✅ | ❌ |
| Автоматические reasoning tokens в `usage.outputTokenDetails.reasoningTokens` | ✅ emitted без конфигурации (empirical: ~93 tokens на простом тесте) | `0` | ✅ |

### Эмпирический тест 2026-04-14 (через @ai-sdk/xai напрямую)

Скрипт `scripts/test-grok-reasoning-effort.ts` (удалён после, одноразовый). 4 вызова × минимальный промпт «2+2=?»:

```
1. grok-4-1-fast-reasoning     БЕЗ reasoningEffort  → ✅ text="4", in=166, out=94, reasoning=93
2. grok-4-1-fast-reasoning     С reasoningEffort    → ❌ Bad Request
3. grok-4-1-fast-non-reasoning БЕЗ reasoningEffort  → ✅ text="4", in=178, out=1,  reasoning=0
4. grok-4-1-fast-non-reasoning С reasoningEffort    → ❌ Bad Request
```

**Заключение:** формулировка docs.x.ai «`reasoning_effort` is not supported by `grok-4.20` or `grok-4-1-fast`» означает **целые семейства** (оба варианта). Чтобы настроить глубину reasoning — **нет способа** для этих моделей. Либо принимаешь автоматический reasoning, либо берёшь non-reasoning variant.

### Опровергнутые утверждения

| Источник | Утверждение | Реальность |
|---|---|---|
| BRAINSTORM_GrokMultiAgent.md §10.1 | «Reasoning-варианты grok-4.20 и grok-4.1 Fast принимают `reasoning.effort: low/medium/high`» | ❌ Empirical: оба варианта возвращают Bad Request |
| Внешняя AI-консультация | «`presence_penalty = 0.1` для KITT / `frequency_penalty = 0.2` для «Создать»» | ❌ Для reasoning-моделей параметры не работают. Для non-reasoning работают, но эмпирический эффект не проверен |
| Внешняя AI-консультация | «Имена агентов Harper/Benjamin/Lucas/Grok-капитан с ролями креатив/аналитика/проверка/синтез» | ❌ Галлюцинация. В docs.x.ai таких имён и ролей нет — только абстрактные «leader agent» и «sub-agents» |
| BRAINSTORM §10.1 | «`max_tokens` до 30 000 для Grok 4.20» | ❌ Не подтверждено. `max_tokens` deprecated → `max_completion_tokens`. Потолок в docs.x.ai не раскрыт. Каталог держит 16K как консервативный дефолт |

### Следствия для ТЗ серии

- **ТЗ-XAI-2 (MIND → grok-4-1-fast-non-reasoning):** не передавать `reasoningEffort`, `presence_penalty` и `frequency_penalty` можем использовать но незачем
- **ТЗ-XAI-3 (KITT + Think):** simply-chat → non-reasoning, simply-chat-think → reasoning; в обоих случаях **не передавать** `reasoningEffort` — кнопка «Думать» просто использует reasoning-variant, глубина reasoning'а автоматическая
- **ТЗ-XAI-5 (Create/Expertise):** та же история — не передаём `reasoningEffort`
- **ТЗ-XAI-MA-1 (будущее):** multi-agent variant — единственное место где `reasoningEffort` валиден; `low/medium` = 4 агента, `high/xhigh` = 16

### Уроки методологии

1. **Брейнсторм от AI-модели — черновик**, не спецификация. Даже если в нём есть секция «verified against docs» с цитатами — цитаты могут быть вырваны из двусмысленного контекста
2. **Эмпирический тест за $0.01 спасает недели** неправильного ТЗ. 30 секунд в терминале > долгий спор с документацией
3. **Ирония:** брейнсторм в §10.2 корректно разоблачил галлюцинации про имена агентов и `presence_penalty`, но в §10.1 допустил аналогичную ошибку про reasoning-варианты. Никто не застрахован от собственных blind spots

---

## 2026-04-15 — ТЗ-XAI-2 завершён (v3.89.0)

**Split strategy для MIND:** Владимир поймал мою лень в первоначальной оценке (я предложил все 5 задач на Grok 4.1 Fast, ссылаясь на IFBench флагмана). Ответил корректно: «нельзя приписывать рейтинги 4.20 модели Fast; извлечение фактов это не простая задача». Принятая стратегия: mission-critical `memory:extract` на сильной Grok 4.20, механические задачи на Grok 4.1 Fast. Экономия vs Sonnet ~15× при сохранении качества входа в память.

**Native generateObject на xAI подтверждён** — smoke test 2 кейсов (базовая schema + `.nullable()` поле) оба прошли. Бонус-рефакторинг `batchExtractFacts` и `runConsolidation` возможен: убрали legacy `generateText + JSON.parse + Zod` workaround, заменили на native `generateObject`. Удалилось ~28 строк legacy парсинг-логики.

**End-to-end smoke test через Simply Chat (5 сообщений при временно пониженных EXTRACT_THRESHOLD_SOFT=0.001, EXTRACT_PAUSE_MS=0):**
- 13 фактов извлечено Grok 4.1 Fast, 10 active + 3 superseded
- Dedup-verify на русском работает: semantic match «работает над проектом Simply» ≈ «разработчик приложения Simply» (similarity 0.715)
- Категоризация корректная (`fact/decision/preference/task`), confidence 0.8-1.0
- Возврат к production defaults (0.6 / 10 мин) перед коммитом

**Side-effects от тестирования:**
1. `getOrCreateSimplyChat` race condition (SELECT+INSERT без unique constraint) — проявился после `TRUNCATE CASCADE` тестовой БД. 3 параллельных запроса из дашборда создали 3 simply chats. Зафиксирован в [specs/_backlog/TZ_SimplyChatRaceCondition.md](../../specs/_backlog/TZ_SimplyChatRaceCondition.md) — чиним после завершения серии Simply_xAI, строгий фокус держим
2. **One-message lag** в Simply Chat MIND extract подтверждён Владимиром как known behavior (не баг). Причина: `batchExtractFacts` вызывается до `saveMessages` в том же request handler'е → messagesFromDb не содержит текущую пару. Зафиксировано в [MIND_ARCHITECTURE.md §2](MIND_ARCHITECTURE.md) — чтобы будущие сессии не гонялись за несуществующим багом

**Что НЕ было живьём проверено (и почему):**
- `memory:extract` (Grok 4.20) — в simply chatMode отключён by design (ТЗ-MinimaxCleanup v3.77.0). Триггерится в expertise/create/project, проверится при обычной эксплуатации
- `memory:consolidate` и `memory:profile` event chain не дошёл до ≥10 фактов подряд за один batch extract — проверится при нормальной нагрузке или через test script по сценариям C/D в MIND_ARCHITECTURE.md

**Защита через /dev/models:** любой из 5 memory-taskId можно переключить на другую модель через switchboard за секунды, без коммитов. Defaults в task-assignments — стартовые точки, не финальный выбор. Это снимает давление «правильного выбора» в момент миграции.

**Workflow новшества подтверждены:**
- Smoke test перед рефакторингом — must-have (повторил паттерн ТЗ-XAI-1 с reasoningEffort)
- Очистка dev-БД перед живым тестом — полезно (даёт чистый сигнал работает/не работает), но надо учитывать что это обнажает скрытые race conditions (см. R-5)
- MIND_ARCHITECTURE.md как living reference — инвестиция на всю серию, не одноразовый артефакт

---

## 2026-04-14 — ТЗ-XAI-1 завершён (v3.88.0)

**Что сделано:**
- Удалена deprecated запись `grok-4` из `lib/ai/model-catalog.ts` (SQL-аудит подтвердил 0 исторических записей в ai_usage_log)
- Обновлён header xAI секции каталога — зафиксировано архитектурное решение что `contextWindow` задаётся под рабочий бюджет качества, не под провайдерский потолок
- Добавлены `notes` на `grok-4.20-multi-agent-0309` — multi-agent variant не поддерживает client-side function calling через Chat Completions, expertise будет переключён в ТЗ-XAI-5
- Обновлены `docs/ai-providers.md` и `docs/model-catalog-ops.md`
- Закрыт backlog `TZ_GrokContextWindowAudit` (перемещён в `specs/_backlog/_archive/`)
- Обновлены `SIMPLY_STATUS.md` и `CHANGELOG.md`

**Что НЕ сделано (и почему):**
- `contextWindow` у xAI записей НЕ изменён — 256K/128K заведомо больше рабочего бюджета 140K, провайдерский потолок архитектурно иррелевантен
- Эмпирический тест контекста НЕ проведён — отменён как отвечающий на неправильный вопрос
- `task-assignments.ts` НЕ тронут — переключение taskId это ТЗ-XAI-2+

**Валидация:**
- `npx tsc --noEmit` — 0 ошибок
- `grep grok-4` по коду — нет живых ссылок
- `grok-4` в SQL-аудите ai_usage_log — 0 записей

**Следующий шаг:** ТЗ-XAI-2 — MIND pipeline (5 call sites в `lib/ai/memory/*`) переключить на Grok 4.1 Fast non-reasoning. Бонус-рефакторинг: 2 call sites (`batchExtractFacts`, `runConsolidation`) сейчас используют `generateText + JSON.parse + Zod` как MiniMax workaround — под Grok можно переписать на native `generateObject`.

---

## 2026-04-14 — Новая схема работы: без внешнего архитектора

Владимир: внешний архитектор делает много ошибок, а в WORKFLOW мы часто воспринимаем написанные ТЗ как источник правды и просто внедряем. Этого больше не делаем.

**Новая схема:**
1. Владимир словами описывает цель
2. Claude Code читает код + документацию → пишет ANALYSIS.md
3. Владимир отвечает на вопросы, корректирует допущения
4. Claude Code пишет SPEC и ROADMAP сам, на основе согласованного понимания
5. Grok 4.20 Multi-Agent (веб-подписка Владимира) используется как факт-чекер для узких xAI-вопросов, НЕ как архитектурный консультант

**Принцип:** Grok для фактов, Claude Code для архитектуры и кода, Владимир для продукта и смысла.

**Фокус:** строго идём по серии Simply_xAI до полного завершения миграции. Не отвлекаемся на другие проекты, другие баги, другие ТЗ. Зафиксировано в memory.

---

## 2026-04-14 — Коррекция архитектурного допущения (Владимир)

ТЗ-XAI-1 ANALYSIS предлагал эмпирический тест контекстного окна Grok за ~$10 чтобы подтвердить 2M и обосновать отказ от Compaction в ТЗ-XAI-3.

**Владимир поймал ошибку:** допущение «2M окно → компрессия не нужна» неверно само по себе, независимо от результата теста. Причины:

1. **Вечный чат** заполнит любое окно — 256K за неделю, 2M за пару месяцев. Защита нужна всегда
2. **Модели деградируют** на ~30-50% заявленного окна (Lost in the Middle, Liu et al. 2023). Реальный рабочий бюджет при 2M окне ≈ 400-600K, а не 2M
3. **Будущие модели** могут иметь 256K окно и быть лучше по качеству. Привязывать архитектуру к размеру окна → переделывать каждый раз

**Правильная архитектура для ТЗ-XAI-3:**

| Слой | Статус | Обоснование |
|---|---|---|
| Sliding window (CONTEXT_BUDGET) | **Оставить** (140-180K) | Рабочий бюджет качества, провайдер-независимый |
| Extract-on-compression (60%/80%) | **Оставить без изменений** | Основной механизм обработки вечного чата |
| Compaction API (Anthropic server) | Уже no-op для xAI через `isAnthropicProtocolModel` проверку — **не трогать, это мёртвый но безвредный код под Grok** |

`SIMPLY_CONTEXT_LIMIT` **не привязываем** к провайдерскому окну. Она должна быть там, где модель ещё думает хорошо.

**Следствия:**
- Эмпирический тест отменён — он отвечал на неправильный вопрос
- `contextWindow` в catalog у xAI записей НЕ трогаем в ТЗ-XAI-1 — текущие 256K/128K заведомо больше рабочего бюджета
- ТЗ-XAI-3 SPEC переформулирован: вместо «убрать Compaction потому что 2M» — «Compaction уже мёртвый код под Grok, основная работа — R-6 (убрать `isSimplyNonAnthropicModel`)»

---

## 2026-04-14 — Коррекция R-6 (ревью Claude Code)

Claude Code указал: архитектор недооценил риск R-6. Фраза «strip не должен помешать, потому что vision идёт на Haiku» — хрупкая логика, ломается при любом рефакторинге маршрутизации.

**Правильное решение для ТЗ-XAI-3:** Полностью убрать `isSimplyNonAnthropicModel` + все strip-функции. Заменить на проверку `capabilities.vision` из model-catalog (SSOT). Не надеяться на маршрутизацию — убрать причину проблемы.

**Урок:** Не оправдывать костыль тем что "другой код его обойдёт". Убирать причину, не симптом.

---

## 2026-04-14 — Аудит ТЗ-XAI-1 (Claude Code)

**Вывод:** ТЗ-XAI-1 на ~60% уже сделано в предыдущих ТЗ (CoreRegistry, DevSwitchboardUI). Реальной работы мало — удалить мёртвый `grok-4`, проверить pricing.

### Открытые вопросы

**Q1. contextWindow 2M или 256K?**  
Каталог: 256K. xAI docs: 2M. ТЗ-XAI-3 опирается на 2M для отказа от Compaction.  
→ Решение: эмпирический тест перед ТЗ-XAI-3 (~30 мин, ~$6-10).  
→ Статус: ожидает тест.

**Q2. grok-4 deprecated** — 0 потребителей, мёртвая запись.  
→ Решение: удалить сейчас в ТЗ-XAI-1.

**Q3. maxOutput 16000** — не подтверждено документацией.  
→ Решение: оставить, поправим если упрёмся.

### Критические находки

**🚨 R-5: expertise → multi-agent = нерабочий маршрут**  
`expertise` указывает на `grok-4.20-multi-agent-0309`, вызывается через Chat Completions. Multi-agent работает ТОЛЬКО через Responses API → сейчас работает как обычный Grok 4.20. В ai_usage_log — 1 вызов за всю историю.  
→ Решение для ТЗ-XAI-5: явно переключить на `grok-4.20-0309`. Multi-agent — отдельная будущая ветка.

**🚨 R-6: isSimplyNonAnthropicModel стрипает изображения**  
chat/route.ts:919 стрипает image/file parts для любого не-Anthropic провайдера. При переключении KITT на Grok — начнёт молча стрипать.  
→ Контекст: Vision-маршрут остаётся на Haiku, запросы с вложениями пойдут на Haiku. Но проверить маршрутизацию.  
→ Решение для ТЗ-XAI-3: убрать `isSimplyNonAnthropicModel`, заменить на capabilities.vision из каталога.

### Бонусы для будущих ТЗ

- **ТЗ-XAI-2:** Grok `generateObject` native → упростить 2 call sites, убрать `JSON.parse` workaround
- **ТЗ-XAI-4:** `professor:review` — убрать `anthropic.thinking.adaptive` (Grok reasoning автоматический)
- **ТЗ-XAI-4:** `podcast-script` — `cacheControl: ephemeral` напрямую → обернуть в провайдер-проверку

---

## 2026-04-14 — Стратегическая сессия (начало серии)

### Принятые решения

1. **Chat Completions — основа.** Responses API только для multi-agent. Портабельность, tools без изменений.
2. **Compaction не нужен при 2M окне.** Sliding window (140K) + Extract-on-compression достаточны.
3. **Qwen отменён.** Галлюцинации на изображениях через OpenRouter. Vision остаётся на Haiku 4.5.
4. **Два провайдера:** xAI (фундамент) + Anthropic (vision + Opus). Чёткие роли.
5. **Grok 4.1 Fast non-reasoning для KITT.** $0.20/$0.50, без reasoning tokens.
6. **`reasoning_effort` не передавать** для Grok 4.20 и 4.1 Fast — ошибка. Только для multi-agent.
7. **Маленькие ТЗ.** Изолированные, тестируемые шаги.

### Исследования проведены

- Документация `@ai-sdk/xai@3.0.82` — полностью изучена
- Документация xAI API (models, pricing, tools, multi-agent, reasoning, Responses API) — изучена
- Два аудита от Claude Code: (1) архитектура моделей, (2) контекст-менеджмент — получены и проанализированы
- Brainstorm Multi-Agent + MCP — проанализирован, решения зафиксированы
