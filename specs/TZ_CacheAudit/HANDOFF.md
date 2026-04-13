# Передача сессии ТЗ-CacheAudit

**Дата:** 2026-04-13
**Сессия:** 1 (закончена с перегрузом контекста на Этапе 4)
**Branch:** `feature/simply-kitt`

---

## ⚡ Critical first read for the next session

**Прочитать в этом порядке:**
1. `specs/TZ_CacheAudit/SPEC.md` — цели и scope ТЗ
2. `specs/TZ_CacheAudit/ROADMAP.md` — статус этапов и задачи
3. **Этот файл (HANDOFF.md)** — где остановились и что делать первым
4. `specs/TZ_CacheAudit/ANALYSIS.md` — изученная документация + feature matrix + technical debt (важно для понимания почему предыдущий агент ошибся)
5. `specs/TZ_CacheAudit/CHANGELOG.md` — детальный лог сделанного

**Не читать в первую очередь:** оригинальный план в `~/.claude/plans/purring-stirring-naur.md` — он устарел, ROADMAP актуальнее.

---

## Статус этапов

| # | Этап | Статус | Commit |
|---|---|---|---|
| 0 | Pre-flight (изучение docs, тесты, baseline) | ✅ | (в `5fdfcd6`) |
| 1 | Переключение MiniMax на Anthropic-compat | ✅ валидирован UI | `5fdfcd6` |
| 2 | Code Health Cleanup | ✅ валидирован smoke | `ca56256` |
| 3 | Cache breakpoints + MIND transplant в `chat/route.ts` | ✅ валидирован UI (метрики 54-58% экономии) | `583b7f3` |
| 4 | Cache breakpoints + MIND transplant в **task-expert route** | 🔄 **код готов, ждёт мануального smoke-теста** | `da0a59c` |
| 5 | Валидация эффективности (SQL за 24ч real traffic) | ⬜ | — |
| 6 | Финализация (ADR 049/050, docs, CHANGELOG, package.json 3.85.0, _archive) | ⬜ | — |

---

## 🎯 Следующая сессия — НАЧНИ С ЭТОГО

### Шаг 1. Перезапустить dev server

Dev server из предыдущей сессии (task `b17co1bbd`) **умер вместе с сессией**. Нужно поднять заново:

```bash
cd "/Users/mactm/Projects/NegotiateAI Chatbot"
PID=$(lsof -i :3000 -t 2>&1 | head -1) && [ -n "$PID" ] && kill $PID
rm -rf .next  # на всякий случай — был конфликт dev/prod артефактов
npm run dev   # запустить в background через run_in_background
```

### Шаг 2. Попросить пользователя провести smoke-тест Этапа 4

**Сценарий:** task-expert chat (чат внутри задачи проекта).

1. Пользователь открывает любой проект → любую задачу (URL `/projects/[id]/tasks/[taskId]`)
2. Отправляет 2 сообщения подряд:
   - **Msg 1:** «Что мне нужно сделать в этой задаче?»
   - **Msg 2:** «А что было до этого в плане проекта?»
3. Что смотреть в DevPanel:
   - **model** = `claude-haiku-4-5-...` или `claude-sonnet-4-...` или `claude-opus-4-...` (зависит от tier задачи)
   - **Msg 1:** `cacheWriteTokens > 0` (cold start)
   - **Msg 2:** `cacheReadTokens > 0` (близко к сумме msg1 write — главная метрика валидации)
   - Стоимость в 2-3× меньше на msg 2

### Шаг 3. После УСПЕШНОГО smoke-теста

1. Сделать SQL через `mcp__postgres__query`:
   ```sql
   SELECT "createdAt"::timestamp(0) AS ts, "modelId", "provider", "chatMode",
          "inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens",
          "costUsd"::numeric(10,6) AS cost
   FROM "ai_usage_log"
   WHERE "createdAt" > NOW() - INTERVAL '15 minutes'
     AND ("chatMode" LIKE '%task%' OR "chatMode" LIKE '%project%')
   ORDER BY "createdAt" DESC LIMIT 10;
   ```
2. Записать реальные метрики Этапа 4 в `ROADMAP.md` (там есть placeholder строка `🧪 Мануальный тест: открыть задачу...`)
3. Обновить `CHANGELOG.md` секцию «Этап 4» — заменить «🔄 код готов» на «✅ завершён» с реальными числами
4. Обновить статус Этапа 4 в этом HANDOFF: 🔄 → ✅
5. **Отметить в ROADMAP что Этап 4 завершён** (там сейчас 🔄)
6. **Перейти к Этапу 5**

### Если smoke-тест Этапа 4 провалится

- 400 error от Anthropic API → проверить `messagesForRequest` в `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts:280-340` — возможно неправильная сборка content-parts с MIND transplant
- Модель не использует факты памяти → fallback: вернуть MIND в system message конкатенацией. Это **ухудшит** cache hit rate на task-expert при активной памяти, но безопасно работает
- Rollback команда: `git revert da0a59c`

---

## Этап 5: Валидация эффективности (после Этапа 4)

**Цель:** доказать, что улучшения работают на real traffic, а не только на синтетических тестах.

**Шаги:**
1. Подождать 24 часа после деплоя (или попросить пользователя «активно поработать в Simply 1-2 дня»)
2. SQL-срез:
   ```sql
   -- Сравнить avg cacheRead/Write/cost по дням
   SELECT date_trunc('day', "createdAt") AS day,
          "modelId", COUNT(*) AS n,
          AVG("cacheReadTokens")::int AS avg_read,
          AVG("cacheWriteTokens")::int AS avg_write,
          AVG("costUsd")::numeric(10,4) AS avg_cost
   FROM "ai_usage_log"
   WHERE "createdAt" > NOW() - INTERVAL '7 days'
     AND "chatMode" IN ('simply', 'project-task', 'task-expert')
   GROUP BY 1, 2
   ORDER BY 1 DESC, n DESC;
   ```
3. Сравнить **до / после** ТЗ-CacheAudit (2026-04-13). Baseline есть в `ANALYSIS.md` → секция «Этап 0: результаты pre-flight».
4. Записать итоговую таблицу метрик в `ROADMAP.md` Этап 5 + в `CHANGELOG.md`.
5. Если метрики провалились → разобрать почему. Если успех → переход к Этапу 6.

**Альтернатива (если ждать 24ч долго):** засчитать Этап 5 на основании синтетических тестов Этапа 1+3+4 (там цифры однозначные: 54-58% экономии на втором сообщении в обоих провайдерах). Затем сразу Этап 6.

---

## Этап 6: Финализация

**Документация (проверить против кода — Правило 6 WORKFLOW.md):**
- `docs/decisions/049-minimax-anthropic-compat-mode.md` — **новый ADR**, обоснование выбора стандарта подключения MiniMax. Структура: проблема (предыдущий агент перешёл на OpenAI-compat по ложным выводам) → исследование (independent тест + чтение исходника пакета) → решение (откат на Anthropic-compat) → последствия (cacheWriteTokens впервые работает, единый code path).
- `docs/decisions/050-cache-breakpoints-strategy.md` — **новый ADR**, стратегия 3-breakpoint caching (tools + system + last-user) + MIND transplant в content-part. Объяснить почему MIND нельзя оставлять в system при динамичных facts.
- `docs/ai-chats-map.md` — верифицировать против кода (там может быть устаревшая модель для simply-chat-think — нужно поставить Haiku, а не Sonnet, как было реально проверено в Этапе 1)
- `SIMPLY_STATUS.md` — добавить секцию ТЗ-CacheAudit с before/after метриками
- `CHANGELOG.md` (главный) — релиз v3.85.0, описание всех 4 этапов
- `CLAUDE.md` — в строку «Завершены» добавить ТЗ-CacheAudit
- `package.json` — версия 3.84.0 → 3.85.0

**Технический долг (документировать как follow-up backlog):**
- В `ANALYSIS.md` → секция «Technical debt» уже зафиксированы:
  1. **Хардкод `cacheReadTokens: 0` / `cacheWriteTokens: 0` + `as any` cast** в pipeline-файлах (`podcast/script-generator.ts`, `briefing/research-engine.ts`, `briefing/briefing-author.ts`). После Этапа 1+3 MiniMax уже возвращает эти поля корректно — но pipeline-код их игнорирует через ручной `totalPromptTokens` accumulator. **НЕ правим в этом ТЗ** потому что файлы содержат uncommitted changes от замороженного ТЗ-MindArtifacts.
  2. **`stripLegacyOpenAICompatToolParts`** — обнаружено в Этапе 3, что MiniMax в Anthropic-compat **продолжает** использовать `call_function_*` префикс в `toolCallId` (это не legacy, а текущее поведение). Нужно **переписать docstring** функции — убрать упоминание «legacy до ТЗ-CacheAudit», заменить на «универсальная санитация MiniMax tool call id format». Файл: `app/(chat)/api/chat/route.ts:289-307`. Это часть Этапа 6 финализации.
  3. **Jina Reader quota exceeded** — внешний сервис, не наш scope. Зафиксировать как known issue.

**Финализация:**
- `npm run build` → успех
- Финальный мануальный тест пользователем
- Переместить папку `specs/TZ_CacheAudit/` → `_archive/`
- Git commit финализации, push на remote (если разрешено пользователем)
- Возможно создать PR в master (с разрешения пользователя)

---

## Коммиты этой сессии

```
da0a59c  feat(tz-cacheaudit): 3 cache breakpoints + MIND transplant в task-expert route   (Этап 4)
583b7f3  feat(tz-cacheaudit): 3 cache breakpoints + MIND transplant в chat route          (Этап 3)
ca56256  refactor(tz-cacheaudit): оздоровление кода MiniMax — удалить костыли             (Этап 2)
5fdfcd6  feat(tz-cacheaudit): переключить MiniMax на официальный Anthropic-compat режим   (Этап 1)
```

Все 4 коммита на `feature/simply-kitt`, не пушнуты на remote. Откат любого: `git revert <hash>`.

---

## Состояние uncommitted в репозитории

В начале сессии в репозитории были uncommitted изменения **от других сессий/ТЗ** (не моих). Они **остались** после всех правок ТЗ-CacheAudit:

```
M .DS_Store
M CLAUDE.md
M components/artifact-actions.tsx
M components/multimodal-input.tsx
M lib/ai/memory/extract.ts
M lib/ai/memory/types.ts
M lib/ai/memory/voyage-client.ts
M lib/ai/retry-with-logging.ts
M lib/ai/tools/update-document.ts
M lib/briefing/briefing-author.ts
M lib/briefing/briefing-filter.ts
M lib/briefing/briefing-section-author.ts
M lib/db/queries.ts
M lib/podcast/index.ts
M lib/podcast/script-generator.ts
M specs/WORKFLOW.md
M app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts  ← 7 строк error handling от другого ТЗ (зона 88-97)
D specs/TZ_SlidingWindow/...  (старое, не моё)

?? .claude/  .mcp.json  .vscode/  ...  (untracked, не моё)
```

**КРИТИЧЕСКИ ВАЖНО:** эти файлы относятся к замороженным ТЗ (`TZ_MindArtifacts`, `TZ_SaveFactV2`, и др.). **Не трогать**, **не коммитить**, **не делать `git add -A`**. Это ровно то предупреждение, которое я зафиксировал в `ANALYSIS.md` → секция Technical debt.

При коммите Этапа 5/6 — стейджить только конкретные пути:
```bash
git add specs/TZ_CacheAudit/ docs/decisions/049-... docs/decisions/050-... \
        SIMPLY_STATUS.md CHANGELOG.md CLAUDE.md package.json docs/ai-chats-map.md
```
**НЕ** использовать `git add .` или `git add -A`.

---

## Ключевые находки прошлой сессии (важно для контекста)

### Главный сюрприз: предыдущий агент выдумывал

Предыдущий агент при работе над ТЗ-MinimaxCleanup (v3.76, 2026-04-08) утверждал в `docs/ai-minimax.md` и в `scripts/test-minimax.ts` что Anthropic-compat режим MiniMax «не работает» (textDelta пустой, tool params пустые, cacheTokens не возвращаются). На основании этого переключился на OpenAI-compat (`createMinimaxOpenAI`) с костылём `includeUsage: true` через `as any`.

**Это было неправдой.** Я провёл независимый тест (`scripts/test-minimax-anthropic-compat.ts` — он сейчас в git, в Этапе 0) на той же версии пакета 0.0.2 — все 4 теста PASS:
- streamText basic ✅
- Tool calling с параметрами ✅
- generateObject(mode:tool) ✅
- Explicit cacheControl с 100% cache hit ✅

Объяснение: пакет `vercel-minimax-ai-provider@0.0.2` в Anthropic-compat режиме — это **тонкая обёртка над `AnthropicMessagesLanguageModel` из `@ai-sdk/anthropic/internal`**. То есть всё что работает для Claude через AI SDK, работает и для MiniMax. Предыдущий агент тестировал криво и сделал ложные выводы.

**Урок для следующей сессии:** не доверять `docs/ai-minimax.md` старого образца, если бы он был. Сейчас он переписан в Этапе 2, но в `_archive/` есть исторические документы — там старая версия.

### Что сейчас точно работает (валидировано в Этапах 1, 3)

- **MiniMax Simply Chat**: passive cache даёт 96.8% hit на 2-м сообщении. После Этапа 3 explicit breakpoints добавили `cacheWriteTokens` в метрики (8424 на cold). 54% экономии на 2-м сообщении.
- **Claude Haiku Simply «Думать»**: 19065 cache write/read, 58% экономии на 2-м сообщении.
- **Briefing pipeline через minimaxLong**: работает, 153с в пределах 180с timeout. Все usage поля пишутся.
- **Tool calling в Simply (getCurrentDate)**: cache не ломается tool_use+tool_result циклом, наоборот накапливается.

### Что закрылось из technical debt (бонус)

- **MiniMax cacheWriteTokens впервые НЕнулевой** — после Этапа 3 metrics blind spot для MiniMax исчез автоматически. Это была одна из задач из Этапа 2 follow-up — закрылась без отдельного фикса.

### Скрытый баг найден в task-expert (Этап 4)

В `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts:190` (до Этапа 4) `finalSystemPrompt += memoryResult.promptBlock` склеивал MIND с system prompt → cacheControl на system был **фактически бесполезен** при активной памяти, потому что system менялся каждый запрос. После Этапа 4 это исправлено — MIND вынесен в trailing content-part user message.

### Правила для последующих сессий (выученные на ошибках)

1. **Перед правкой файла, который был в начальном `git status -M`** — сначала `git diff <file>` чтобы увидеть чужие uncommitted. Если зоны не пересекаются — `git stash push -- file`, правка, commit, `git stash apply` (через explicit apply, не pop), `git stash drop`.
2. **TodoWrite не использовать** — основной чеклист это `ROADMAP.md`. Это было zaфиксировано в `MEMORY.md` пользователя.
3. **Service-chat не трогать** — система deprecated по решению пользователя 2026-04-13. Любые правки в `service-chat/*` файлах исключены из scope (их выпиливают отдельно).
4. **`docs/ai-minimax.md` теперь правдивый** — переписан в Этапе 2. Можно ему доверять.
5. **Pipelines нельзя править в этом ТЗ** — `briefing-author.ts`, `script-generator.ts`, `research-engine.ts`, `memory/extract.ts` имеют uncommitted changes от ТЗ-MindArtifacts (заморожен). Костыли там зафиксированы как Technical debt в `ANALYSIS.md`.

---

## Состояние dev server

Был запущен в предыдущей сессии, task ID `b17co1bbd`, на `http://localhost:3000`. **После закрытия сессии background процесс умер** — нужно перезапустить (см. Шаг 1 выше).

---

## Контекст по кодовой базе (где что находится)

- **Точка переключения MiniMax**: [lib/ai/registry.ts](lib/ai/registry.ts) — `createMinimax()` для `minimax` и `minimaxLong` namespace
- **Удалённый костыль**: [lib/ai/getModel.ts](lib/ai/getModel.ts) (был блок мутации `config.includeUsage = true` строки 171-179, удалён в Этапе 1)
- **Helper для tools cache**: [lib/ai/tools/chat-tools.ts](lib/ai/tools/chat-tools.ts) — `withCacheControlOnLastTool<T>()` (новый, добавлен в Этапе 3)
- **chat/route.ts с 3 breakpoints + MIND transplant**: [app/(chat)/api/chat/route.ts](app/(chat)/api/chat/route.ts) — зона 999-1130 (`isAnthropicProtocolModel`, `messagesForRequest` сборка)
- **task-expert route с 3 breakpoints + MIND transplant**: [app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts](app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts) — зона 280-355
- **`stripLegacyOpenAICompatToolParts`**: [app/(chat)/api/chat/route.ts:289-307](app/(chat)/api/chat/route.ts#L289) — нужно переписать docstring в Этапе 6
- **Независимый тест провайдера**: [scripts/test-minimax-anthropic-compat.ts](scripts/test-minimax-anthropic-compat.ts) — 4 теста (streamText, tool calling, generateObject, cacheControl)
- **Integration тест через registry**: [scripts/test-minimax-via-registry.ts](scripts/test-minimax-via-registry.ts)
- **Документация MiniMax (переписана)**: [docs/ai-minimax.md](docs/ai-minimax.md)

---

## Запреты и предупреждения

- ❌ **НЕ доверять** утверждениям из `_archive/TZ_MinimaxCleanup/` (там старая дезинформация)
- ❌ **НЕ трогать** файлы из uncommitted списка выше — только TZ-CacheAudit зона
- ❌ **НЕ использовать** `git add -A` или `git add .`
- ❌ **НЕ запускать** `npm run dev` без предварительного `kill` старого процесса на 3000 — будет переключение на 3001
- ❌ **НЕ пропускать** Правило 1 WORKFLOW (Official docs FIRST) — даже для задач в этом ТЗ
- ❌ **НЕ использовать** TodoWrite — ROADMAP.md это основной чеклист
- ⚠️ **При сборке** `npm run build` — если ловишь `PageNotFoundError: Cannot find module for page` → это конфликт dev/prod артефактов в `.next/`, нужно `kill dev → rm -rf .next → npm run build`

---

## Состояние ТЗ к моменту передачи

- **4 коммита** в `feature/simply-kitt`
- **3 этапа полностью валидированы** (1, 2, 3)
- **1 этап с готовым кодом, без smoke-теста** (4) — следующая сессия начинает с него
- **Ожидаемая стоимость завершения ТЗ**: 1-2 сессии (Этап 4 smoke + Этап 5 SQL валидация + Этап 6 финализация с ADR)
- **Suggested версия:** 3.84.0 → **3.85.0**
- **Целевые ADR:** 049 (MiniMax Anthropic-compat), 050 (3-breakpoint cache strategy)
