# Roadmap ТЗ-COMPACTION-UNIFY

**Создан:** 2026-04-20
**Версия проекта:** 3.94.0 → 3.95.0
**Статус:** ⬜ Не начат (ждёт одобрения плана владельцем)
**Связанные документы:** [SPEC.md](TZ_COMPACTION_UNIFY.md) · [ANALYSIS.md](ANALYSIS.md) · [ARCHITECT_ANSWERS.md](ARCHITECT_ANSWERS.md)

---

## Обзор

| Метрика | Значение |
|---|---|
| Этапов | 6 (A, B1, B2, C, D, E) |
| Текущий этап | — |
| Сессий (оценка) | ~5 |
| Файлов затронуто | ~15 кода + ~10 docs |

---

## Принципы работы (напоминание)

- **После КАЖДОЙ задачи:** `npx tsc --noEmit` → 0 ошибок → только тогда `[x]`
- **После КАЖДОГО этапа:** `npm run build` → git commit → мануальный тест владельцем → СТОП до подтверждения
- **НЕ делать "скопом":** каждый этап проходит полный цикл validate → commit → test → подтверждение
- **Находки вне scope:** сразу в `FINDINGS.md`, не чинить «заодно»

⛔ **Memory-гайдам противоречит:** временные решения, костыли, `// TODO: rewrite later`, мёртвые `_varname`, `@deprecated` без удаления кода. При обнаружении компромисса — пересматриваем архитектуру, не заклеиваем.

---

## Этап A: Core Refactor — фундамент

**Статус:** ⬜ Не начат

**Цель:** Привести core layer (context-limits, model-catalog, task-assignments, memory/extract, compaction middleware) к финальному состоянию ТЗ. После этого этапа кодовая база **компилируется**, но handler'ы ещё не интегрированы — это Этап B.

**Предпосылка:** получено одобрение ROADMAP владельцем.

### Задачи

**A.1 — `lib/ai/context-limits.ts` — чистка констант**
- [ ] Удалить `CONTEXT_BUDGET` (строка 9)
- [ ] Удалить `EXTRACT_THRESHOLD_SOFT` (строка 21)
- [ ] Удалить `EXTRACT_THRESHOLD_HARD` (строка 24)
- [ ] Удалить `EXTRACT_PAUSE_MS` (строка 27)
- [ ] Обновить default `calcUsagePercent(tokens, budget = SIMPLY_CONTEXT_LIMIT)` — было `CONTEXT_BUDGET`
- [ ] Обновить header-комментарий файла: убрать упоминание sliding window budget (он остаётся в `getMessagesByChatId` на уровне БД, не в этом файле)
- [ ] Добавить комментарий к `COMPACTION_THRESHOLD_HARD`: «observability-only после ТЗ-COMPACTION-UNIFY — middleware вызывается на пороге SOFT, Hard используется для различения `action=compact` vs `action=truncate` в логах»
- [ ] `npx tsc --noEmit` — проверить что ни один файл не ломается (ожидаем ошибки в chat/route.ts — будут чиниться в Этапе B)

**A.2 — `lib/ai/model-catalog.ts` — удаление capability**
- [ ] Удалить поле `supportsCompaction` из интерфейса `ModelCapabilities` (строка 80)
- [ ] Удалить `supportsCompaction: true/false` из всех 21+ записей `ENTRIES` (CAPS_CLAUDE, CAPS_MINIMAX, CAPS_GROK, CAPS_OPENROUTER_*, per-model overrides, non-LLM providers)
- [ ] Удалить комментарий секции "Compaction strategy resolver" и функцию `getCompactionStrategy` (строки 659-706)
- [ ] Удалить тип `CompactionStrategy` (строки 674-677)
- [ ] Обновить header-комментарий файла: убрать упоминания compaction strategy
- [ ] `npx tsc --noEmit` — ждём ошибки в `prepare-messages.ts` и `chat/route.ts`

**A.3 — `lib/ai/task-assignments.ts` — удаление taskId**
- [ ] Удалить `"memory:extract"` из `TaskId` union (строка 48)
- [ ] Удалить запись `"memory:extract": "grok-4.20-0309-reasoning"` из `DEFAULT_TASK_MODELS` (строка 155)
- [ ] Удалить запись `"memory:extract": 4096` из `DEFAULT_MAX_OUTPUT_TOKENS` (строка 260)
- [ ] Обновить комментарий секции «Memory (ТЗ-XAI-4 2026-04-16)»: упомянуть что `memory:extract` удалён в COMPACTION-UNIFY, осталось 4 memory-taskId (batch, consolidate, profile, dedup-verify)
- [ ] `npx tsc --noEmit` — ждём ошибки в `lib/ai/memory/extract.ts` и `chat/route.ts`

**A.4 — `lib/ai/memory/extract.ts` — удаление per-turn функций**
- [ ] Удалить константу `MEMORY_EXTRACT_TASK` (строка 27)
- [ ] Удалить загрузку `EXTRACT_PROMPT_PATH` + `EXTRACT_SYSTEM_PROMPT` (строки 53-60)
- [ ] Удалить функцию `extractFactsFromMessages` (строки 106-165)
- [ ] Удалить функцию `extractAndStoreFacts` (строки 169-240)
- [ ] Удалить тип `ExtractFactsInput` (используется только `extractFactsFromMessages` и `extractAndStoreFacts`)
  - **Проверить:** `batchExtractFacts` и `processAndStoreFact` используют `ExtractFactsInput`? Если да — сохранить тип, обновить комментарий «только для batch flow».
- [ ] Оставить: `batchExtractFacts`, `processAndStoreFact`, `verifyDuplicatesWithLLM`, все Zod schemas

**A.5 — `lib/ai/memory/index.ts` — чистка экспортов**
- [ ] Удалить экспорт `extractFactsFromMessages`, `extractAndStoreFacts` (строка 23)
- [ ] Оставить `batchExtractFacts`, `ExtractedFact` type
- [ ] `npx tsc --noEmit` — ждём ошибки в обоих chat handler'ах

**A.6 — Удалить `lib/prompts/memory/extract.md`**
- [ ] `rm lib/prompts/memory/extract.md`
- [ ] Проверить что единственная ссылка на этот файл — в `extract.ts:53-60`, которая уже удалена в A.4

**A.7 — `lib/ai/compaction/types.ts` — обновление контрактов**
- [ ] Удалить re-export `CompactionStrategy` (строка 15)
- [ ] Удалить импорт `CompactionStrategy` из model-catalog (строка 13)
- [ ] Удалить поле `kind` из интерфейса `CompactionEvent` (строка 59)
- [ ] Удалить комментарий о `kind: "truncation_warning"` (строки 54-56)
- [ ] Добавить поле `userId: string` в интерфейс `CompactionContext` (после `chatId`)
- [ ] Обновить doc-комментарий `CompactionContext`: объяснить зачем userId («для вызова batchExtractFacts в middleware перед compaction»)

**A.8 — `lib/ai/compaction/prepare-messages.ts` — intergrate extract + удаление strategy check**
- [ ] Удалить импорт `getCompactionStrategy` из model-catalog (строка 25)
- [ ] Удалить вызов `const strategy = getCompactionStrategy(context.modelId)` + early return (строки 54-60)
- [ ] Импортировать `batchExtractFacts` из `lib/ai/memory/extract.ts`
- [ ] После `buildVerbatimWindow` и перед `generateCompactionSummary` добавить **orchestrated extract block**:
  ```ts
  // ТЗ-COMPACTION-UNIFY: orchestrate extract → compact на одной группе сообщений.
  // Гарантия: ни одно сообщение не покидает историю без попытки извлечь факты.
  // Mem0 best practice 2026: «memory formation before summarization».
  try {
    await batchExtractFacts({
      userId: context.userId,
      chatId: context.chatId,
      messages: split.toCompact.map(m => ({
        id: m.id,
        role: m.role,
        parts: m.parts,
        createdAt: new Date(),  // для batchExtractFacts — не используется в extract-логике, только в логах
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[Compaction] Pre-compaction extract failed for chat ${context.chatId} — ` +
        `продолжаем с compaction (факты могут быть потеряны в этом окне): ${message}`,
    );
    if (dataStream) {
      emitDebugWarning(dataStream, {
        source: "compaction:extract",
        message: `Pre-compaction extract failed (non-blocking): ${message}`,
        context: { chatId: context.chatId, userId: context.userId },
      });
    }
  }
  ```
- [ ] Обновить header-комментарий файла: описать новую ответственность middleware (extract → compact orchestration)
- [ ] Обновить логирование `[Compaction]` — добавить строку про extract outcome: `extract={facts:N, stored:M}` или `extract=failed:reason`
  - **Зависимость:** `batchExtractFacts` возвращает `BatchExtractResult` с processed/extracted/stored; используем эти поля в логе
  - Принципиально: extract и compact логируются одной связанной строкой, чтобы можно было grep-нуть «что произошло с этим окном»

**A.9 — Валидация Этапа A**

⛔ **Перед коммитом**:
- [ ] `npx tsc --noEmit` — **ожидаем ошибки в 2 handler'ах** (chat/route.ts и tasks/[taskId]/chat/route.ts) — их исправим в Этапах B1/B2
- [ ] Код Этапа A (core) компилируется изолированно — verify через `npx tsc --noEmit --incremental false` и анализ списка ошибок: все ошибки должны быть ТОЛЬКО в 2 handler'ах

⛔ **Git commit Этапа A**:
```bash
git add lib/ai/context-limits.ts lib/ai/model-catalog.ts lib/ai/task-assignments.ts \
       lib/ai/memory/extract.ts lib/ai/memory/index.ts \
       lib/ai/compaction/types.ts lib/ai/compaction/prepare-messages.ts
git rm lib/prompts/memory/extract.md
git commit -m "refactor(tz-compaction-unify): Этап A — core layer unification"
```

**Файлы этапа:**
- `lib/ai/context-limits.ts` — удалить 4 константы, обновить default `calcUsagePercent`
- `lib/ai/model-catalog.ts` — удалить `supportsCompaction` из 21+ entries, удалить `getCompactionStrategy` + `CompactionStrategy`
- `lib/ai/task-assignments.ts` — удалить `memory:extract` taskId
- `lib/ai/memory/extract.ts` — удалить `extractFactsFromMessages`, `extractAndStoreFacts`, `EXTRACT_SYSTEM_PROMPT`
- `lib/ai/memory/index.ts` — чистка экспортов
- `lib/prompts/memory/extract.md` — удалить файл
- `lib/ai/compaction/types.ts` — удалить `CompactionEvent.kind`, добавить `CompactionContext.userId`
- `lib/ai/compaction/prepare-messages.ts` — extract orchestration, убрать strategy check

**Критерий готовности Этапа A:**
- TS-ошибки ТОЛЬКО в двух handler'ах (ожидаемо, их чиним в Этапе B)
- Git commit сделан
- ⛔ Мануальный тест невозможен на этом этапе — приложение не собирается (есть dependency errors в handler'ах). Это нормально, мануальный тест будет в Этапе B1.

---

## Этап B1: Integration в `app/(chat)/api/chat/route.ts`

**Статус:** ⬜ Не начат

**Цель:** Единая compaction-интеграция для simply/expertise/create в main chat handler. Удаление Anthropic Compaction API ветки. Удаление per-turn extract.

⛔ **НЕ начинать** без успешного Этапа A + commit + одобрения владельцем.

### Задачи

**B1.1 — Удаление Anthropic Compaction API ветки**
- [ ] Удалить блок `compactionStrategy` + `compactionOptions` (строки 976-990)
- [ ] Удалить передачу `providerOptions: compactionOptions` в `streamText` (строка 1167)
- [ ] Удалить комментарий-блок про ТЗ-CacheAudit + MiniMax (строки 992-999) — он объясняет `isAnthropicProtocolModel` в контексте compaction, что больше не актуально. Оставить только объяснение `isAnthropicProtocolModel` для cacheControl (это остаётся).

**B1.2 — Удаление Simply Chat batch extract block**
- [ ] Удалить весь блок `if (isSimplyChat && isMemoryEnabled)` с batch extract (строки 805-841) — это функциональность заменяется orchestration-ом внутри compaction middleware
- [ ] Удалить импорты `EXTRACT_THRESHOLD_SOFT`, `EXTRACT_THRESHOLD_HARD`, `EXTRACT_PAUSE_MS` из context-limits (строки 42-44)
- [ ] Удалить импорт `calcUsagePercent` ЕСЛИ больше нигде не используется (проверить grep)
- [ ] Удалить импорт `batchExtractFacts` из memory/extract (он теперь вызывается из middleware, не напрямую)

**B1.3 — Удаление per-turn `extractAndStoreFacts` в onFinish**
- [ ] Удалить блок `if (isMemoryEnabled && chatMode !== "simply")` с per-turn extract (строки 1627-1651)
- [ ] Удалить импорт `extractAndStoreFacts` (строка 68)
- [ ] Если `batchExtractFacts` также не импортируется больше — убрать импорт целиком

**B1.4 — Расширение gate `prepareMessagesWithCompaction` на ВСЕ chat modes**
- [ ] Изменить условие вызова middleware: `(chatMode === "expertise" || chatMode === "create")` → `(chatMode === "simply" || chatMode === "expertise" || chatMode === "create")` (строка 1061)
  - **Professor mode НЕ включать** (отдельный handler `executeProfessorPipeline`, строки 898-965)
- [ ] Обновить комментарий: «ТЗ-COMPACTION-UNIFY: middleware применяется ко всем пользовательским chat modes. Professor pipeline — отдельный путь, не использует middleware.»

**B1.5 — Передача `userId` в `CompactionContext`**
- [ ] Добавить `userId: session.user.id` в объект context передаваемый в `prepareMessagesWithCompaction` (строка 1080-1088)

**B1.6 — Корректный `mindTokens` (retrieved facts + profile block)**
- [ ] Проверить что `mindDynamicBlock` учитывает **только retrieved facts** (inject в last user message), а profile block **включён в `systemPromptText`** (через `systemPromptText += profileBlock` на строке 730)
- [ ] Значит `mindTokensForCompaction` (строка 1068-1070) — правильно считает **только** retrieved facts. Profile tokens уже в `systemPromptTokensForCompaction`.
- [ ] **Зафиксировать** этот инвариант в комментарии: «ТЗ-COMPACTION-UNIFY: mindTokens = только retrieved facts. Profile block уже в systemPromptTokens (inject в system prompt на строке 730).»

**B1.7 — Удаление неиспользуемых импортов**
- [ ] Удалить `getCompactionStrategy` из импорта model-catalog (строка 28) — функция удалена в A.2
- [ ] Проверить grep: все ли `ModelCapabilities` импорты ещё нужны (возможно)
- [ ] `npx tsc --noEmit` — 0 ошибок в chat/route.ts (tasks/[taskId]/chat/route.ts ещё может падать)

### Валидация Этапа B1

- [ ] `npx tsc --noEmit` — 0 ошибок в chat/route.ts; ошибки остаются только в tasks/[taskId]/chat/route.ts (чинится в B2)
- [ ] `npm run build` — **НЕ запускать** пока B2 не завершён (build упадёт на task handler); если надо — закомментировать импорт task handler'а временно, **НЕ** ставить `// TODO` — восстановить к B2

⛔ **Эту валидацию можно отложить до совмещённого Этапа B2**, что более эффективно. Либо делать B1+B2 в одном этапе (решение по ходу).

### Git commit Этапа B1

```bash
git add app/(chat)/api/chat/route.ts
git commit -m "feat(tz-compaction-unify): Этап B1 — unified compaction в main chat handler"
```

**Критерий готовности Этапа B1:**
- chat/route.ts компилируется
- Per-turn extract отсутствует в onFinish для всех modes
- Simply Chat batch extract block удалён
- `prepareMessagesWithCompaction` вызывается для simply/expertise/create
- `userId` передан в CompactionContext

---

## Этап B2: Integration в `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts`

**Статус:** ⬜ Не начат

**Цель:** Удаление Anthropic Compaction API + добавление Simply Compaction middleware + удаление per-turn extract в project task chat handler.

⛔ **НЕ начинать** без успешного Этапа B1 + commit + TS-проверки.

### Задачи

**B2.1 — Удаление Anthropic Compaction API ветки**
- [ ] Удалить блок `modelSupportsCompaction` + `compactionProviderOptions` (строки 366-386)
- [ ] Удалить spread `...(compactionProviderOptions ? { providerOptions: compactionProviderOptions } : {})` в `streamText` (строка 392)
  - **Сохранить** существующий `providerOptions` если он используется для других целей (например cacheControl) — проверить

**B2.2 — Добавление вызова Simply Compaction middleware**
- [ ] Добавить импорты в начало файла: `prepareMessagesWithCompaction`, `emitCompactionEvent`, `CompactionEvent` type
- [ ] Перед вызовом `streamText` добавить блок (зеркало chat/route.ts:1054-1099):
  ```ts
  // ТЗ-COMPACTION-UNIFY: unified Simply Compaction для project task chat.
  // Заменяет удалённый Anthropic contextManagement API — провайдер-агностично
  // работает для Opus/Sonnet/Haiku одинаково.
  const systemPromptTokensForCompaction = estimateMessageTokens([
    { type: "text", text: systemPromptText },
  ]);
  const mindTokensForCompaction = mindDynamicBlock
    ? estimateMessageTokens([{ type: "text", text: mindDynamicBlock }])
    : 0;
  const toolsTokens = computeToolsTokens(toolsForRequest);

  const compactionResult = await prepareMessagesWithCompaction(
    activeTaskId,
    preparedHistory,
    {
      chatId,
      userId: session.user.id,
      modelId: effectiveModelId,
      systemPromptTokens: systemPromptTokensForCompaction,
      totalHistoryTokens,
      newMessageTokens,
      mindTokens: mindTokensForCompaction,
      toolsTokens,
    },
    dataStream,
  );
  const historyForStream = compactionResult.messages;
  const simplyCompactionEvent = compactionResult.compactionEvent;

  if (simplyCompactionEvent) {
    emitCompactionEvent(dataStream, simplyCompactionEvent);
  }
  ```
  - **Проверить:** переменные `totalHistoryTokens`, `newMessageTokens`, `computeToolsTokens`, `preparedHistory`, `effectiveModelId`, `activeTaskId`, `mindDynamicBlock` существуют в task handler. Если нет — считать их по аналогии с chat/route.ts.
- [ ] Заменить использование старого `coreHistory` в `messagesForRequest` на `historyForStream` → `convertToModelMessages(historyForStream)` — зеркало chat/route.ts:1101-1103

**B2.3 — Удаление per-turn `extractAndStoreFacts`**
- [ ] Удалить блок `if (isMemoryEnabled)` с per-turn extract (строки 727-754)
- [ ] Удалить импорт `extractAndStoreFacts` (строка 48)

**B2.4 — Чистка импортов**
- [ ] Убрать `getModelEntry` если больше нигде не используется (проверить grep в файле)
- [ ] Убрать `supportsCompaction`-related imports

### Валидация Этапа B2

- [ ] `npx tsc --noEmit` — **0 ошибок во всем проекте**
- [ ] `npm run build` — успешен (⚠ автоматически накатывает pending migrations — предупредить владельца, но в этом ТЗ миграций нет)
- [ ] `npm run dev` (rm -rf .next/cache && npm run dev) — сервер запускается без ошибок

### 🧪 Мануальный тест Этапов B1+B2 (владелец)

**Запросить у владельца:**

1. **Simply Chat, небольшая сессия:** открой Simply, отправь 3-5 сообщений. Убедись:
   - Ответы приходят, ничего не сломалось
   - Виджет контекста работает (показывает %)
   - В DevTools Network → `[Compaction] strategy=simply tokens={...} action=noop` — т.е. порог не превышен, middleware no-op

2. **Simply Chat, большая сессия (опционально, если есть реальная):** если есть длинный Simply-чат ≥100K токенов — проверь что сжатие происходит, виджет показывает 📦 «Разговор сжат»

3. **Expertise: короткий запрос:** отправь запрос в экспертизу, проверь что работает как раньше

4. **Create: короткое задание:** аналогично

5. **Project chat (Opus/Sonnet):** открой проект, отправь вопрос эксперту. Проверь:
   - Ответ приходит
   - Нет 400-ошибок от Anthropic (про `compact_20260112`)
   - В логах: `[Compaction] chat=... strategy=simply` — вместо прежней ветки Anthropic Compaction

6. **Мониторинг логов:** `[MIND] Extract failed` / `[MIND] Batch extract` — должны появляться ТОЛЬКО когда middleware запустил compaction (не на каждом turn)

### Git commit Этапа B1+B2

```bash
git add app/(chat)/api/chat/route.ts app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts
git commit -m "feat(tz-compaction-unify): Этапы B1+B2 — unified compaction в обоих chat handler'ах"
```

**Критерий готовности Этапов B1+B2:**
- Проект собирается (`npm run build`)
- Мануальный тест владельцем подтверждён (6 сценариев)
- Нет `memory:extract` вызовов (grep по логам `[MIND] Extracted` должен отсутствовать в expertise/create/project per-turn; появляется только в `[MIND] Batch extract` когда compaction сработал)
- Anthropic Compaction API нигде не вызывается

---

## Этап C: UI Cleanup — удаление предупреждения «Новое задание с итогом»

**Статус:** ⬜ Не начат

**Цель:** Упростить `components/elements/context.tsx` — убрать ветку `truncation_warning`, mode-aware warning labels, action button. Compaction работает молча, индикатор «📦 Разговор сжат» остаётся.

⛔ **НЕ начинать** без успешного Этапа B2 + git commit + мануального теста.

### Задачи

**C.1 — Удаление `truncation_warning` в `CompactionEvent` type**
- Уже удалено в A.7 (поле `kind` удалено целиком).

**C.2 — Упрощение `ContextIcon`**
- [ ] Изменить пропы `ContextIconProps`: удалить `compactionKind?: "compaction" | "truncation_warning"`, заменить на `isCompacted?: boolean`
- [ ] В ветке `colorClass` — удалить ветку `"truncation_warning"`, остаётся только `isCompacted ? "text-muted-foreground" : undefined`
- [ ] В `aria-label` — удалить ветку `truncation_warning`, оставить `isCompacted ? "разговор сжат" : "context used"`
- [ ] В свойствах `<circle>` — удалить условные opacity для `truncation_warning`, оставить стандартные

**C.3 — Упрощение `CompactionIndicator`**
- [ ] Удалить пропс `event: CompactionEvent` (заменить на минимальный набор — `squeezedTokens`, `summaryTokens`, `compactionCount`)
- [ ] Удалить флаг `isWarning = event.kind === "truncation_warning"` — `CompactionEvent.kind` не существует
- [ ] Удалить переменные `actionLabel`, `warningTitle` (mode-aware лейблы для warning)
- [ ] Удалить `handleStartNew` + импорт `useRouter`, `getChatUrl`, `generateUUID`
- [ ] Удалить импорт `Button`, `AlertTriangle`
- [ ] Удалить импорт `useRouter` из `next/navigation`
- [ ] Заменить условный icon (AlertTriangle vs Package) на статичный `Package` muted
- [ ] Удалить условный title (warningTitle vs «Разговор сжат») — всегда «Разговор сжат»
- [ ] Удалить весь блок `{isWarning && actionLabel && (<Button ...>)}` — кнопки «Новый запрос/задание с итогом» больше нет
- [ ] Удалить пропс `chatMode?: string` из `CompactionIndicator` (он был только для mode-aware warning labels)

**C.4 — Обновление `Context` компонента (parent)**
- [ ] Удалить передачу `chatMode` в `CompactionIndicator` (если больше нигде не нужен) — **осторожно:** `chatMode` может быть всё ещё нужен для других целей; проверить.
- [ ] В `Context` обновить `compactionKind={compactionEvent?.kind}` → `isCompacted={compactionEvent !== null}` (из-за удаления `kind`)

**C.5 — Опциональная правка `ContextProps`**
- [ ] Если `chatMode?: string` становится unused в `Context` — удалить пропс (обратная совместимость не важна — внутренний компонент)

**C.6 — Обновление комментариев**
- [ ] Header-комментарий файла: обновить описание («ТЗ-COMPACTION-UNIFY: compaction работает молча, индикатор «📦 Разговор сжат» показывает что цикл произошёл»)
- [ ] Удалить упоминания Фазы 3 / truncation warning / action button
- [ ] Упомянуть что handoff-кнопка перенесена в COMPACTION-3

### Валидация Этапа C

- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] `npm run dev` — сервер запускается

### 🧪 Мануальный тест Этапа C (владелец)

**Запросить у владельца:**

1. **Виджет контекста в обычной сессии:** открой любой чат, посмотри на виджет контекста (правый верхний угол рядом с инпутом). Должен показывать обычную иконку-кольцо без янтарных акцентов.

2. **Виджет после compaction (если есть сессия):** если удастся спровоцировать compaction (например, загрузить большой PDF в expertise) — виджет должен:
   - Показать иконку muted-gray (не янтарную)
   - В popover: блок «📦 Разговор сжат, X→Y токенов»
   - **НЕТ кнопки «Новый запрос/задание с итогом»**
   - **НЕТ текста «Рекомендуем начать новый...»**

3. **Симуляция warning:** ранее при 85% всплывала кнопка — теперь при 85% должно быть тихо, просто индикатор.

### Git commit Этапа C

```bash
git add components/elements/context.tsx
git commit -m "feat(tz-compaction-unify): Этап C — убрать truncation warning из UI"
```

**Критерий готовности Этапа C:**
- UI компилируется
- Кнопка «Новый запрос/задание с итогом» отсутствует в коде
- Мануальный тест владельцем подтверждён

---

## Этап D: Документация — ADR + спеки + docs/

**Статус:** ⬜ Не начат

**Цель:** Зафиксировать архитектурное решение в ADR 054 (new), супередировать ADR 042/052, обновить 050/053, синхронизировать все зависимые docs/ + архитектурные спеки.

⛔ **НЕ начинать** без успешных Этапов A/B1/B2/C + мануальных тестов.

### Задачи

**D.1 — Создать ADR 054 «Single-strategy provider-agnostic compaction»**
- [ ] Создать файл `docs/decisions/054-single-strategy-compaction.md`
- [ ] Структура: Контекст (почему 042+052 superseded), Решение (единая Simply Compaction для всех), Обоснование (4 проблемы из ТЗ), Следствия (плюсы/минусы/trade-offs), Альтернативы (рассмотрены/отклонены), Ссылки
- [ ] Явный header: «**Supersedes:** [ADR 042](042-compaction-dual-strategy.md) · [ADR 052](052-context-management-strategy-per-provider.md)»
- [ ] Указать версию внедрения: v3.95.0

**D.2 — Пометить ADR 042 superseded**
- [ ] Добавить баннер в header файла `docs/decisions/042-compaction-dual-strategy.md`:
  > **🗄️ Superseded by [ADR 054](054-single-strategy-compaction.md) (2026-04-20, v3.95.0).** Dual-strategy подход заменён на единую провайдер-агностичную Simply Compaction для всех моделей.
- [ ] **НЕ удалять** содержимое ADR — он остаётся как исторический документ

**D.3 — Пометить ADR 052 superseded**
- [ ] Добавить баннер в header `docs/decisions/052-context-management-strategy-per-provider.md` (аналогично D.2)

**D.4 — Edit ADR 053 — 5-й аспект**
- [ ] В `docs/decisions/053-aisdk-invocation-contract.md` отредактировать раздел «5. `context strategy`»:
  - Удалить упоминание `provider` variant
  - Описание: `getCompactionStrategy(modelId)` → `{kind: "simply" \| "none"}` (а лучше — упомянуть что функция удалена, strategy всегда `simply` для chat-moделей и определяется по `kind === chat-handler` inference)
  - Обновить пример: убрать `type: "auto"` pattern
- [ ] В история изменений ADR 053: добавить запись «2026-04-20 — ТЗ-COMPACTION-UNIFY: 5-й аспект упрощён, удалён provider-variant (ссылка на ADR 054)»

**D.5 — Edit ADR 050 — удалить упоминание Compaction API**
- [ ] В `docs/decisions/050-cache-breakpoints-strategy.md`:
  - Строки 112, 127, 135 — удалить упоминания `contextManagement` / Compaction API
  - Секция «Совместимость с Compaction API» (строка 205) — удалить или переписать («Compaction больше не провайдерская, работает через Simply middleware — на cache breakpoints не влияет»)
- [ ] Добавить запись в историю изменений

**D.6 — Обновить `specs/Simply_xAI/SIMPLY_COMPACTION_ARCHITECTURE.md`**
- [ ] Major update: версия v2.0
- [ ] Секция «Проблема» — переписать в контексте UNIFY: вместо «у xAI нет Compaction API» → «унифицируем управление памятью между всеми провайдерами»
- [ ] Секция «Различие с MIND и Anthropic Compaction» — полностью переписать, Anthropic ветка удалена
- [ ] Секция «Провайдер-агностичность» — переписать: `getCompactionStrategy` не существует, middleware работает для всех chat-моделей безусловно
- [ ] Обновить таблицу MVP activations: все chat modes на Simply Compaction, Anthropic/provider колонка удалена
- [ ] Секция «Фаза 3» — удалить весь блок про warning + action button (UI упрощён)
- [ ] Обновить раздел «Взаимодействие в Simply Chat» — теперь compaction работает в Simply Chat (ранее отложено в COMPACTION-2)
- [ ] История версий: добавить v2.0 запись про ТЗ-COMPACTION-UNIFY

**D.7 — Обновить `specs/Simply_xAI/MIND_ARCHITECTURE.md`**
- [ ] Удалить все упоминания `CONTEXT_BUDGET` + `EXTRACT_THRESHOLD_SOFT/HARD` + `EXTRACT_PAUSE_MS` (строки 179-183, 207-208, 224-225, 265-269, 274)
- [ ] Обновить описание extract: теперь только `memory:extract-batch` (batch), нет `memory:extract` per-turn
- [ ] Обновить секцию «Когда срабатывает extract»: «только в составе compaction cycle на пороге 50% от SIMPLY_CONTEXT_LIMIT»
- [ ] Обновить таблицу констант: `EXTRACT_*` удалены, остаётся `COMPACTION_THRESHOLD_SOFT = 0.5`

**D.8 — Обновить `specs/Simply_xAI/SIMPLY_PROMPTS_AND_MODEL_CONFIG.md`**
- [ ] Удалить строки про `CONTEXT_BUDGET`, `EXTRACT_THRESHOLD_SOFT/HARD`, `EXTRACT_PAUSE_MS` (строки 370-376)
- [ ] Добавить строки про `SIMPLY_CONTEXT_LIMIT`, `COMPACTION_THRESHOLD_SOFT`, `COMPACTION_VERBATIM_WINDOW_TOKENS`

**D.9 — Обновить `docs/ai-chats-map.md`**
- [ ] Строка 173 «Для проектных задач активирован Anthropic Compaction API» — заменить на «Для всех chat-моделей используется Simply Compaction middleware (ADR 054), провайдер-агностично»
- [ ] Удалить из таблицы taskId строку `memory:extract` (осталась только `memory:extract-batch`)

**D.10 — Обновить `docs/model-catalog-ops.md`**
- [ ] Строка 70 (`supportsCompaction: true` description) — удалить вовсе, capability удалена
- [ ] Обновить workflow audit — убрать шаг «проверить supportsCompaction для Sonnet/Opus»

**D.11 — Обновить `docs/ai-providers.md`**
- [ ] Удалить pricing entry `memory:extract` из таблицы taskId (если есть)
- [ ] Убедиться что secret pricing через `memory:extract` не упоминается

**D.12 — Обновить `docs/ai-agents.md`**
- [ ] Проверить — упоминает ли `extract.md` промпт. Если да — удалить упоминание.

### Валидация Этапа D

- [ ] `grep -rn "supportsCompaction"` в `lib/`, `app/`, `docs/decisions/054-`, `docs/ai-chats-map.md` — 0 вхождений (кроме ADR 042/052 как исторического документа)
- [ ] `grep -rn "contextManagement"` в `lib/`, `app/` — 0 вхождений
- [ ] `grep -rn "memory:extract[^-]"` в `lib/`, `app/`, `docs/` — 0 вхождений (есть только `memory:extract-batch`)
- [ ] `grep -rn "CONTEXT_BUDGET\|EXTRACT_THRESHOLD"` в `lib/`, `app/`, `docs/` — 0 вхождений
- [ ] Файлы читабельны, ссылки валидны

### Git commit Этапа D

```bash
git add docs/decisions/054-single-strategy-compaction.md \
       docs/decisions/042-compaction-dual-strategy.md \
       docs/decisions/052-context-management-strategy-per-provider.md \
       docs/decisions/053-aisdk-invocation-contract.md \
       docs/decisions/050-cache-breakpoints-strategy.md \
       specs/Simply_xAI/SIMPLY_COMPACTION_ARCHITECTURE.md \
       specs/Simply_xAI/MIND_ARCHITECTURE.md \
       specs/Simply_xAI/SIMPLY_PROMPTS_AND_MODEL_CONFIG.md \
       docs/ai-chats-map.md docs/model-catalog-ops.md docs/ai-providers.md docs/ai-agents.md
git commit -m "docs(tz-compaction-unify): Этап D — ADR 054 + супередирование + обновление спеков"
```

**Критерий готовности Этапа D:**
- 4 grep-теста пройдены
- ADR 054 создан, 042/052 помечены superseded, 050/053 отредактированы
- Архитектурные спеки отражают новое состояние

---

## Этап E: Финализация

**Статус:** ⬜ Не начат

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../../../DOCUMENTATION_GUIDE.md) — пройти чеклист. Не по памяти.

### Задачи

**E.1 — SQL-верификация `ai_usage_log` (Claude Code через `mcp__postgres__query`)**
- [ ] Запрос 1: `SELECT DISTINCT "chatMode" FROM ai_usage_log WHERE "chatMode" LIKE 'memory:%' AND "createdAt" >= NOW() - INTERVAL '24 hours';`
  - **Ожидается:** `memory:extract-batch`, `memory:consolidate`, `memory:profile`, `memory:dedup-verify`, `memory:embed`
  - **НЕ должно быть:** `memory:extract`
- [ ] Запрос 2: `SELECT COUNT(*), "chatMode" FROM ai_usage_log WHERE "chatMode" = 'memory:extract' AND "createdAt" >= NOW() - INTERVAL '1 hour' GROUP BY "chatMode";`
  - **Ожидается:** пустой результат (0 rows)
- [ ] Запрос 3 (positive control): `SELECT COUNT(*), "chatMode" FROM ai_usage_log WHERE "chatMode" = 'compaction:summarize' AND "createdAt" >= NOW() - INTERVAL '24 hours' GROUP BY "chatMode";`
  - **Ожидается:** ненулевое число если была хотя бы одна compaction-итерация в тестах
- [ ] Запрос 4 (compaction state):
  ```sql
  SELECT id, "compactionCount", "compactionIndex", LENGTH("compactionSummary") AS summary_len
  FROM chat
  WHERE "compactionCount" > 0
  ORDER BY "compactionCount" DESC
  LIMIT 10;
  ```
  - **Ожидается:** список чатов где сжатие сработало, `summary_len` > 1000 символов, `compactionIndex` > 0
- [ ] Задокументировать результаты в CHANGELOG (в разделе «Валидация»)

**E.2 — `package.json` — версия**
- [ ] Обновить `"version": "3.94.0"` → `"version": "3.95.0"`

**E.3 — `CHANGELOG.md` главный**
- [ ] Добавить запись ТЗ-COMPACTION-UNIFY в главный `CHANGELOG.md` (дата 2026-04-XX, версия 3.95.0)
- [ ] Структура: проблема → решение → что сделано (4 проблемы) → затронутые файлы → SQL verification результаты

**E.4 — `SIMPLY_STATUS.md` — snapshot**
- [ ] Обновить раздел «Активные механизмы»: Anthropic Compaction API → удалить, Simply Compaction → расширен scope на все chat modes
- [ ] Таблица компонентов: memory:extract удалён, остался memory:extract-batch
- [ ] Метрики: после недели production — добавить sanity-check compaction invocations (ссылка на `TZ_CompactionActualCalibration` в backlog)

**E.5 — `CLAUDE.md` — проверка лимита (НЕ редактировать)**
- [ ] `wc -l CLAUDE.md` → если > 220, **STOP и доложить владельцу**
- [ ] НЕ добавлять записи про compaction — история ТЗ живёт в CHANGELOG, пофайловые детали — в docs/architecture.md

**E.6 — `docs/architecture.md` — новый SSOT**
- [ ] Проверить раздел compaction layer — обновить описание если есть
- [ ] Удалить упоминания Anthropic Compaction API

**E.7 — Закрытие backlog-долга `TZ_UnifyContextThresholdBase`**
- [ ] Перенести `specs/_backlog/TZ_UnifyContextThresholdBase.md` → `specs/_backlog/_archive/TZ_UnifyContextThresholdBase.md`
- [ ] Обновить `specs/_backlog/README.md`: удалить строку Medium impact про `TZ_UnifyContextThresholdBase`
- [ ] Обновить `_archive/BACKLOG_CLOSED.md`: добавить запись «2026-04-20 — `TZ_UnifyContextThresholdBase` закрыт в составе ТЗ-COMPACTION-UNIFY (v3.95.0). Все пороги унифицированы на `SIMPLY_CONTEXT_LIMIT = 200K`, константы `CONTEXT_BUDGET`/`EXTRACT_THRESHOLD_*`/`EXTRACT_PAUSE_MS` удалены.»

**E.8 — FINDINGS.md → backlog (WORKFLOW Правило 8+9)**
- [ ] Если в процессе ТЗ создавался `FINDINGS.md` — просмотреть, значимые medium/high impact findings оформить как файлы-заготовки `TZ_<name>.md` в `specs/_backlog/`
- [ ] Обновить `specs/_backlog/README.md` (индекс по impact)

**E.9 — Финальный мануальный тест (владелец, расширенный)**

**Запросить у владельца:**

Пройти полную регрессию основных сценариев:

1. **Simply Chat — лёгкая сессия:** 10 turns простого диалога. Никаких compaction-сообщений не должно быть.
2. **Simply Chat — сессия с attachment:** загрузить PDF 30-50 страниц, работать с ним. Проверить что при приближении к 100K токенов compaction срабатывает (индикатор 📦).
3. **Expertise — длинный запрос:** провести экспертизу на реальной задаче, 10+ turns.
4. **Create — задание с артефактом:** создать презентацию/таблицу, 5-8 turns.
5. **Project chat на Opus:** открыть реальный проект, 10+ turns. Проверить что нет ошибок Anthropic API, compaction работает через Simply middleware.
6. **Project chat на Sonnet (tier 2):** аналогично.
7. **Project chat на Haiku (tier 1):** аналогично. Раньше Haiku не имел никакого compaction (не поддерживал Anthropic, не был в Simply gate). После ТЗ получает Simply Compaction.
8. **Виджет контекста:** compaction отображается молча, нет кнопки «Новый запрос/задание с итогом».
9. **DevPanel:** проверить что события compaction приходят корректно (`[Compaction] strategy=simply`, `[MIND] Batch extract` в составе compaction)
10. **Cost monitoring:** через неделю production — проверить `ai_usage_log` что `memory:extract` больше нет, `memory:extract-batch` срабатывает реже (раз на ~50 сообщений), `compaction:summarize` присутствует.

**Без подтверждения владельца Этап E не завершён.**

**E.10 — Архивация папки ТЗ**
- [ ] `mv specs/Simply_xAI/TZ_compaction_unify/ _archive/TZ_COMPACTION_UNIFY/`
- [ ] Обновить `SIMPLY_XAI_ROADMAP.md` — пометить ТЗ завершённым

### Валидация Этапа E

- [ ] `npm run build` — успешен
- [ ] Production URL работает: https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app
- [ ] 4 SQL-запроса выполнены с ожидаемыми результатами
- [ ] CHANGELOG, SIMPLY_STATUS, package.json обновлены
- [ ] ADR 054, супередирование 042/052, edit 050/053 — в репо
- [ ] `CLAUDE.md` не превышает 220 строк
- [ ] Backlog-долг `TZ_UnifyContextThresholdBase` в `_archive/`
- [ ] FINDINGS.md обработан (если создавался)
- [ ] Финальный мануальный тест владельцем пройден
- [ ] Папка в `_archive/`

### Git commit Этапа E

```bash
git add CHANGELOG.md SIMPLY_STATUS.md package.json docs/architecture.md \
       specs/_backlog/README.md specs/_backlog/_archive/TZ_UnifyContextThresholdBase.md \
       _archive/BACKLOG_CLOSED.md specs/Simply_xAI/SIMPLY_XAI_ROADMAP.md
git mv specs/Simply_xAI/TZ_compaction_unify _archive/TZ_COMPACTION_UNIFY
git commit -m "chore(tz-compaction-unify): финализация v3.95.0 — архивация + CHANGELOG"
```

**Критерий готовности Этапа E (финальный):**
- Все SQL-проверки пройдены
- Версия 3.95.0 в package.json
- Deploy на production успешен
- Владелец подтвердил финальный мануальный тест
- Папка в архиве

---

## Сводка критериев приёмки (из SPEC.md + дополнения)

| # | Критерий | Где проверяется |
|---|---|---|
| 1 | Предупреждение «Новое задание с итогом» не показывается | Этап C мануальный тест |
| 2 | Per-turn extract удалён во всех режимах, код чистый | Этапы A4, B1.3, B2.3 + E.1 SQL |
| 3 | Все пороги считаются от `SIMPLY_CONTEXT_LIMIT` = 200K, старые MIND-константы удалены | Этап A1 + grep-тесты Этапа D |
| 4 | При достижении 100K в любом chatMode: сначала extract, потом compact, на одной группе сообщений | Этап A8 orchestration + мануальный тест Этап B |
| 5 | Единственный extract-taskId — `memory:extract-batch`, старый удалён | Этап A3 + E1 SQL |
| 6 | Capability `supportsCompaction` удалена, `getCompactionStrategy` не существует | Этап A2 + grep Этап D |
| 7 | `providerOptions.anthropic.contextManagement` не используется нигде | Этап B1.1 + B2.1 + grep Этап D |
| 8 | Smoke test Simply Chat >100K: extract + compact срабатывают вместе | Этап E9 (пункт 2) |
| 9 | Smoke test expertise >100K | Этап E9 (пункт 3) |
| 10 | Smoke test expertise >170K: второй compact молча | Этап E9 (при наличии реальной длинной сессии) |
| 11 | Smoke test project chat на Claude Opus: наша логика работает | Этап E9 (пункт 5) |
| 12 | TypeScript компилируется, все тесты проходят | Этапы A9, B1, B2, C валидации |
| 13 | `TZ_UnifyContextThresholdBase.md` перемещён в `_backlog/_archive/` + запись в `BACKLOG_CLOSED.md` | Этап E7 |
| 14 (новое) | SQL-верификация `ai_usage_log` | Этап E1 |
| 15 (новое) | ADR 054 создан, 042/052 superseded | Этап D1-D3 |

---

## Gate-keeping между этапами

```
Этап A (core) ─ tsc validate ─ commit ─ ⛔ СТОП
                                          │
                                          ▼ одобрение владельца
Этап B1 (chat handler) ─ tsc validate ─ НЕ commit пока B2 не готов
                                          │
                                          ▼
Этап B2 (task handler) ─ build ─ commit ─ мануальный тест ─ ⛔ СТОП
                                          │
                                          ▼ одобрение владельца
Этап C (UI) ─ build ─ commit ─ мануальный тест ─ ⛔ СТОП
                                          │
                                          ▼ одобрение владельца
Этап D (docs) ─ grep-тесты ─ commit ─ ⛔ СТОП
                                          │
                                          ▼ одобрение владельца
Этап E (финализация) ─ SQL ─ financial тест ─ archive
```

---

## Риски и митигация

См. [ANALYSIS.md §4](ANALYSIS.md). Архитектор подтвердил:
- R1 (regression project chat) — принимаем, smoke test обязателен
- R2 (Simply cost) — SQL-мониторинг первую неделю
- R3 (mindTokens) — retrieved + profile, задача B1.6
- R6 (latency) — await extract, не parallel (семантика > скорость)
- R7 (dev overrides) — ничего не делаем

---

**Готов к старту.** ⛔ Жду одобрения владельцем этого ROADMAP перед началом Этапа A.
