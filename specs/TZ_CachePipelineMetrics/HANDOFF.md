# HANDOFF — ТЗ_CachePipelineMetrics v2.0

**Создано:** 2026-04-13 (session 1 — analysis done, ready for implementation)
**Для следующей сессии:** старт Этапа 0 (Pre-flight + audit)

---

## ⚡ Critical first read

**В этом порядке:**

1. **`SPEC.md`** — объединённый scope v2.0 (cache breakpoints + full usage logging coverage)
2. **`ANALYSIS.md`** — подробный аудит 38 `getModel()` call-sites + 4 открытых вопроса для Этапа 0
3. **`ROADMAP.md`** — 6 этапов с чек-листами
4. **`CHANGELOG.md`** — пустой шаблон, заполняется по ходу
5. **`docs/decisions/049-minimax-anthropic-compat-mode.md`** — контекст MiniMax Anthropic-compat
6. **`docs/decisions/050-cache-breakpoints-strategy.md`** — ⚠️ **обязательно** для Этапа 1 — паттерн cache breakpoints

**Не читать:**
- `_archive/TZ_CacheAudit/*` — основное уже в ADR 049/050, лишний контекст
- frozen `specs/TZ_MindArtifacts/`, `specs/TZ_SaveFactV2/` — не связаны
- `_backlog/TZ_OpenRouterCostTracking.md` — отдельный ТЗ, не пересекается с этим

---

## 🎯 Старт следующей сессии — НАЧНИ С ЭТОГО

### Шаг 1: Pre-flight (Этап 0)

```bash
cd "/Users/mactm/Projects/NegotiateAI Chatbot"

git status                 # baseline: clean после v3.86.1
git log --oneline -5       # последний коммит: release v3.86.1 или OpenRouter backlog
npx tsc --noEmit           # 0 ошибок
npm run build              # успех
```

Если baseline не чистый — **остановиться и разобраться**, не начинать Этап 1.

### Шаг 2: Закрыть 4 audit-вопроса из ANALYSIS.md

Эти вопросы нужно закрыть **до** написания кода Этапа 1 — они влияют на решения.

#### Audit #1 — briefing-author fallback (живой или мёртвый?)

```bash
# Прочитать контекст
Read lib/briefing/briefing-author.ts offset:540 limit:300

# Grep trigger условий
Grep "map-reduce" lib/briefing/
Grep "buildAiCallTrace.*promptPreview.*map-reduce"

# История файла
git log -p lib/briefing/briefing-author.ts | head -200
```

**Решение:** fallback dead → в Этапе 2 **удалить** блок | fallback live → fix as hardcode

Зафиксировать решение в `CHANGELOG.md` в разделе «Этап 0 — Audit #1».

#### Audit #2 — professor-pipeline logging coverage

```bash
Read lib/ai/professor-pipeline.ts  # весь файл
Grep "saveAiUsageLog" lib/db/queries.ts
```

Проверить что `saveAiUsageLog` записывает:
- noCacheInputTokens
- cacheReadTokens
- cacheWriteTokens
- outputTokens
- reasoningTokens
- costRub

Если все поля есть — **ничего не трогать** в Этапе 3. Если нет — план унификации на `logUsage`.

Зафиксировать в CHANGELOG.

#### Audit #3 — `generateText` + `cacheControl` compatibility

AI SDK v6 может не поддерживать `providerOptions.anthropic.cacheControl` с `generateText` (только с `streamText`). Если не поддерживает — podcast/script-generator переписывается на streamText.

**Быстрая проверка:**

```bash
# Найти в node_modules typing для generateText options
Read node_modules/ai/dist/index.d.ts | grep -A 3 "providerOptions"

# Или найти в репо примеры
Grep "generateText.*providerOptions" --glob '**/*.ts'
```

Если есть пример `generateText({ ..., providerOptions: ... })` живой — поддержка есть.

Если не уверены после документации — **empirical test**: маленький скрипт с 2 запросами (один с cacheControl, один без), проверить cacheWriteTokens.

Зафиксировать решение в CHANGELOG.

#### Audit #4 — `util:artifact-suggestions` taskId существует?

```bash
Grep "util:artifact-suggestions|artifact-suggestions" lib/ai/task-assignments.ts
```

Если есть — ОК, продолжаем. Если нет — нужно добавить в task-assignments.ts + выбрать модель (вероятно Claude Haiku как дешёвый общий default).

Зафиксировать в CHANGELOG.

### Шаг 3: Этап 1 (Cache breakpoints)

**ТОЛЬКО после закрытия всех 4 audit.**

Прочитать ROADMAP.md Этап 1 → правило рабочего паттерна в шапке → идти задача за задачей.

**Абсолютное правило Этапа 1:**

```
После каждой задачи (1.1, 1.2, 1.3, 1.4):
  npx tsc --noEmit
  Если ошибка → откатить последнюю правку → разобраться → повторить.
```

Никаких «сделаю все 4 за раз и потом проверю tsc». Это правило номер 1 от владельца.

### Шаг 4: Промежуточная валидация между Этапами

После Этапа 1 — **мануальный smoke briefing** в браузере перед продолжением. Это самое рискованное место (реальное изменение model input format).

После Этапа 1 spoke test должен подтвердить:
- Страница `/briefing/setup` не падает
- Кнопка «Сгенерировать» работает
- Статья появляется корректно (базовая regression)

Если smoke прошёл — продолжаем Этап 2. Если нет — stash изменений и разбираемся.

---

## Контекст из предыдущей работы (важен)

### Что дал ТЗ-CacheAudit (v3.85.0)

1. **MiniMax Anthropic-compat** — MiniMax через `createMinimax()` эмитит нативные `inputTokenDetails.cacheReadTokens/cacheWriteTokens` — тот же класс что Anthropic. **Это значит cache strategy одинакова для Claude и MiniMax pipelines.**
2. **3-breakpoint strategy** — validated pattern для `chat/route.ts` и `task-expert/route.ts`. 54-74% экономии. Паттерн работает для любого streamText.
3. **MIND transplant** — dynamic memory block выносится в trailing content-part за breakpoint 3. **Pipelines MIND не используют** — этот уровень сложности не требуется.

### Что дал ТЗ-UnfreezePipelines (v3.86.1)

1. **Working tree чистый** — pipeline-файлы можно править без конфликтов
2. **Provider field** в retryWithLogging уже required → 3 briefing pipeline файлов передают `provider: getProviderForTask(...)` — `ai_usage_log.provider` не NULL для briefing
3. **Voyage pricing SSOT** — `calcVoyageCostUsd()` helper готов
4. **Метаданные SaveFactV2** закоммичены — не активны, но не мешают
5. **Podcast files откачены до HEAD** — удалены experimental TTS chunking и MIN_SCRIPT_LINES removal. Работаем на стабильной v3.85.0 базе для podcast.

### Что мы **НЕ делали** в ТЗ-UnfreezePipelines

- Никаких cache breakpoints в pipelines — намеренно оставлено для этого ТЗ
- Никаких usage logging fixes в pipelines — тоже намеренно
- Никаких новых feature flags или conditionals

---

## Ожидаемый масштаб изменений

| Этап | Файлов затронуто | Строк изменено (оценка) |
|---|---|---|
| Этап 0 (audit, read-only) | 0 | 0 |
| Этап 1 (cache breakpoints) | 3-4 | ~80-120 (преимущественно messages[] reformatting) |
| Этап 2 (hardcode fix) | 1-2 | ~30-50 (script-generator accumulator rewrite) |
| Этап 3 (full coverage) | 1-2 | ~15-30 |
| Этап 4 (JSDoc) | 3 | ~30 (только комментарии) |
| Этап 5 (validation) | 0 | 0 |
| Этап 6 (финализация) | ~5 (docs) | ~150 (ADR + CHANGELOG + STATUS) |

**Total prod code:** ~125-200 строк (преимущественно reformat existing logic под messages[] format)
**Total docs:** ~180 строк

---

## Известные сложности

### 1. podcast/script-generator использует generateText

Cache breakpoint pattern в ADR 050 применяется к `streamText`. Для `generateText` нужен Audit #3. Если compat есть — едем как есть. Если нет — переписываем на streamText с небольшими изменениями (`const res = streamText(...); const text = await res.text; const usage = await res.usage;`). Тестировал этот паттерн в briefing-author.ts (line 215-216) — работает.

### 2. Возможный ворох `as any` в trace build

`buildAiCallTrace()` в pipeline-trace.ts может тоже принимать `usage` без типизации и прикидывать cache fields как 0. Проверить в Этапе 2 не нужно ли его тоже обновить.

### 3. Фоновые вызовы from cron (briefing/podcast/memory-profile)

Cron-handlers не видят `userId` через request — берут из БД. Это уже работает (validated в TZ_CACHE2). Не трогать при внесении cache breakpoints — контекст `userId` уже пробрасывается через pipeline функции.

---

## Запреты и предупреждения

- ❌ **НЕ** начинать Этап 1 до закрытия всех 4 audit из Этапа 0
- ❌ **НЕ** использовать `git add -A` или `git add .`
- ❌ **НЕ** объединять cache breakpoints + hardcode fix в один commit — это разные logical changes
- ❌ **НЕ** править research-engine.ts hardcodes (они math correct для Perplexity)
- ❌ **НЕ** править tts-gemini.ts `as any` (legit для non-token pricing)
- ❌ **НЕ** забыть `npx tsc --noEmit` после каждой задачи Этапа 1
- ❌ **НЕ** коммитить без smoke-тест briefing после Этапа 1
- ⚠️ При сомнении в cache работе → проверить SQL, не скриншот DevPanel
- ⚠️ Если Подход B (middleware) выглядит заманчиво во время Этапа 3 → STOP, подход A принят в ANALYSIS и обоснован (95% покрытие уже есть)

---

## Целевая версия

3.86.1 → **3.87.0** (minor — pipeline observability + caching)

---

## Estimated effort

**2-3 сессии** (оценка после аудита, была 3-4 в SPEC). Экономия 1 сессия за счёт того что Approach A решает 95% задачи без middleware.

- Сессия 1 (следующая): Этап 0 + Этап 1 + начало Этапа 2
- Сессия 2: Этап 2 + Этап 3 + Этап 4 + Этап 5
- Сессия 3 (если нужна): финализация Этап 6
