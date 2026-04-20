# Roadmap ТЗ-COMPACTION-1: Simply Compaction MVP

**Создан:** 2026-04-18
**Версия проекта:** 3.93.0 → 3.94.0
**Статус:** ⬜ Не начат — ждёт одобрения владельцем
**Архитектурный источник:** [SIMPLY_COMPACTION_ARCHITECTURE.md v1.8](../Simply_xAI/SIMPLY_COMPACTION_ARCHITECTURE.md)
**Ответы архитектора:** [ARCHITECT_ANSWERS.md](./ARCHITECT_ANSWERS.md)
**Анализ Фазы 1:** [ANALYSIS.md](./ANALYSIS.md)

---

## Обзор

| Метрика | Значение |
|---|---|
| Этапов | 8 (A1-A6 + B1 + Финализация) |
| Текущий этап | Pre-Start (ждёт одобрения владельца) |
| Сессий (оценка) | 2-3 |
| Phased rollout | Этап A (6 под-этапов, инфраструктура + expertise) → Этап B (1 под-этап, расширение gate) → Финализация |

---

## Принципы работы (из WORKFLOW.md)

- После **КАЖДОЙ задачи:** `npx tsc --noEmit` → 0 ошибок → только тогда `[x]`.
- После **КАЖДОГО этапа:** `npm run build` → git commit → **мануальный тест владельцем** → одобрение → следующий этап. Не скопом.
- ⛔ `npm run build` автоматически накатывает миграции (`tsx lib/db/migrate && next build`) — **предупредить владельца ДО запуска build в Этапе A6**.
- Находки вне scope → [FINDINGS.md](./FINDINGS.md) (создаётся при первой находке).
- ROADMAP.md перечитывается **перед каждой задачей** — это рабочий чеклист, не архивный план.

---

## Этап A: Инфраструктура + pilot в expertise

**Цель:** Вся инфраструктура Simply Compaction реализована и работает в expertise route.

### Этап A1: SSOT — taskId + константы

**Статус:** ✅ Завершён (2026-04-18)

**Цель:** Зафиксировать `compaction:summarize` taskId в SSOT per ADR 053 + 4 константы в `context-limits.ts`.

**Задачи:**
- [x] В [lib/ai/task-assignments.ts](../../lib/ai/task-assignments.ts): добавить `"compaction:summarize"` в `TaskId` union + запись в `DEFAULT_TASK_MODELS` (`grok-4-1-fast-non-reasoning`) + запись в `DEFAULT_MAX_OUTPUT_TOKENS` (`4096`) — 3 строки, TS compile-time гарантирует всех три.
- [x] В [lib/ai/context-limits.ts](../../lib/ai/context-limits.ts): добавить 4 константы без модификации существующих:
  ```typescript
  export const COMPACTION_THRESHOLD_SOFT = 0.5;                  // 50% от SIMPLY_CONTEXT_LIMIT = 100K
  export const COMPACTION_THRESHOLD_HARD = 0.85;                 // 85% от SIMPLY_CONTEXT_LIMIT = 170K
  export const COMPACTION_VERBATIM_WINDOW_TOKENS = 40_000;       // Дословное окно
  export const COMPACTION_SUMMARY_TARGET_TOKENS = 3_000;         // Target в промпте (cap 4096 в task-assignments)
  ```
- [x] Комментарии рядом с каждой константой: ссылка на архитектурный документ + абсолютное значение.

**Файлы:**
- `lib/ai/task-assignments.ts` — +3 записи
- `lib/ai/context-limits.ts` — +4 константы

**Валидация задачи:**
- [x] `npx tsc --noEmit` — 0 ошибок.

**Критерий готовности:** TS компилируется, SSOT готов для A2-A4.

---

### Этап A2: `getCompactionStrategy` + тип `CompactionStrategy`

**Статус:** ✅ Завершён (2026-04-18)

**Цель:** Capability-driven резолвер стратегии compaction по modelId.

**Задачи:**
- [x] В [lib/ai/model-catalog.ts](../../lib/ai/model-catalog.ts): добавить тип и функцию (использована существующая `getModelEntry` — в ROADMAP была опечатка `getCatalogEntry`, реального метода с таким именем нет):
  ```typescript
  export type CompactionStrategy =
    | { kind: "provider" }
    | { kind: "simply" }
    | { kind: "none" };

  export function getCompactionStrategy(modelId: string): CompactionStrategy {
    const entry = getModelEntry(modelId);
    if (!entry) return { kind: "none" };
    if (entry.capabilities.embeddings || entry.provider === "voyage" || entry.provider === "deepgram") {
      return { kind: "none" };
    }
    if (entry.capabilities.supportsCompaction) return { kind: "provider" };
    return { kind: "simply" };
  }
  ```
- [x] Документировать в JSDoc: «capability-driven, не provider-driven. См. [SIMPLY_COMPACTION_ARCHITECTURE.md §Провайдер-агностичность](../../specs/Simply_xAI/SIMPLY_COMPACTION_ARCHITECTURE.md)».

**Файлы:**
- `lib/ai/model-catalog.ts` — +тип + функция

**Валидация задачи:**
- [x] `npx tsc --noEmit` — 0 ошибок.
- [x] Smoke test через `npx tsx -e` — все catalog entries резолвятся корректно:
  - `grok-4-1-fast-non-reasoning` / `grok-4.20-0309-reasoning` → `simply`
  - `claude-sonnet-4-6` / `claude-opus-4-6` → `provider`
  - `claude-haiku-4-5-20251001` → `simply` (Haiku не имеет provider compaction)
  - `MiniMax-M2.7` / `z-ai/glm-4.6` → `simply`
  - `voyage-4` / `voyage-4-lite` / `deepgram-nova-3` → `none`
  - `nonexistent-model-xyz` → `none`
  - `sonar-pro` / `gemini-2.5-flash-preview-tts` → `simply` (не в blacklist, но эти модели не попадают в chat/route.ts middleware архитектурно — safe no-op через threshold check).

**Критерий готовности:** функция резолвит все существующие catalog entries корректно.

---

### Этап A3: БД миграция

**Статус:** ✅ Завершён (2026-04-18)

**Цель:** Добавить 3 поля `compactionSummary` / `compactionIndex` / `compactionCount` в Chat таблицу.

**Задачи:**
- [x] В [lib/db/schema.ts](../../lib/db/schema.ts) → `chat` таблица: добавить 3 колонки:
  ```typescript
  compactionSummary: text("compactionSummary"),          // null by default
  compactionIndex: integer("compactionIndex"),           // null by default
  compactionCount: integer("compactionCount").notNull().default(0),
  ```
- [x] Создан миграционный SQL файл [lib/db/migrations/0056_add-compaction-columns.sql](../../lib/db/migrations/0056_add-compaction-columns.sql):
  ```sql
  ALTER TABLE "Chat" ADD COLUMN "compactionSummary" text;
  ALTER TABLE "Chat" ADD COLUMN "compactionIndex" integer;
  ALTER TABLE "Chat" ADD COLUMN "compactionCount" integer NOT NULL DEFAULT 0;
  ```
- [x] Добавлена запись idx:56 в [lib/db/migrations/meta/_journal.json](../../lib/db/migrations/meta/_journal.json) (drizzle migrator использует журнал для tracking).
- [x] Доп. правка (выявлена tsc): [lib/db/queries.ts:405-428](../../lib/db/queries.ts#L405-L428) — в history select (`getChatsByUserId`) добавлены 3 compaction-колонки, иначе возвращаемый тип не соответствовал `Chat[]`. Компактный подход: compactionSummary читается (текст, сопоставимо с `summary`), lastContext остался исключён как тяжёлый JSONB.
- [x] ⛔ `npm run build` не запускался — миграция накатится в Этапе A6.

**Файлы:**
- `lib/db/schema.ts` — +3 колонки в chat
- `lib/db/migrations/0056_add-compaction-columns.sql` — новый файл
- `lib/db/migrations/meta/_journal.json` — +idx:56
- `lib/db/queries.ts` — +3 поля в history select

**Валидация задачи:**
- [x] `npx tsc --noEmit` — 0 ошибок.

**Критерий готовности:** schema + миграция готовы, ждут накатки в A6.

---

### Этап A4: Middleware `lib/ai/compaction/`

**Статус:** ✅ Завершён (2026-04-18)

**Цель:** Создать основную middleware функцию + все вспомогательные модули.

**Задачи:**
- [x] Создана папка `lib/ai/compaction/` с файлами:
  - [x] [types.ts](../../lib/ai/compaction/types.ts) — `CompactionContext`, `CompactionEvent`, `PrepareMessagesResult` + ре-экспорт `CompactionStrategy` из `model-catalog`. Существующий `DebugCompactionData` в `debug-events.ts` НЕ трогался (конфликт схем разрешим в A5 — см. FINDINGS.md Finding #2).
  - [x] [prompt.ts](../../lib/ai/compaction/prompt.ts) — константа `COMPACTION_SUMMARY_SYSTEM_PROMPT` (5-секционный формат, language adaptation директива) + функция `buildCompactionUserPrompt(conversationBlock, previousSummary)` с rolling-update паттерном.
  - [x] [summarize.ts](../../lib/ai/compaction/summarize.ts) — функция `generateCompactionSummary(input): Promise<{summary, summaryTokens, usage}>` через `generateObject` + Zod schema 5 полей. Паттерн зеркалирует MIND extract (maxRetries: 0, temperature: 0.3, logUsage через usage-utils).
  - [x] [db-queries.ts](../../lib/ai/compaction/db-queries.ts) — `getCompactionState(chatId)` / `saveCompactionState(chatId, state)`. Паттерн зеркалирует `memory-queries.ts` (собственный Neon HTTP клиент).
  - [x] [prepare-messages.ts](../../lib/ai/compaction/prepare-messages.ts) — основная middleware `prepareMessagesWithCompaction(taskId, messages, context, dataStream?): Promise<PrepareMessagesResult>`:
    - ✅ Резолв стратегии через `getCompactionStrategy(context.modelId)`.
    - ✅ `kind === "provider"` / `"none"` → no-op.
    - ✅ `kind === "simply"`: подсчёт `totalContext = systemPromptTokens + totalHistoryTokens + newMessageTokens + (mindTokens ?? 0)`, сравнение с SIMPLY_CONTEXT_LIMIT * 0.5 / 0.85.
    - ✅ Если < soft → no-op.
    - ✅ Если ≥ soft → alg buildVerbatimWindow (40K окно с edge cases A+B), генерация summary, запись в БД, возврат event.
    - ✅ Если ≥ hard → kind: "truncation_warning" (сжатие всё равно делается).
- [x] Try/catch вокруг `generateCompactionSummary` — graceful fallback: при ошибке возвращаем оригинал + `emitDebugWarning` (если dataStream передан).
- [x] Edge case A (40K < lastMsg ≤ 80K): включаем последнее сообщение целиком.
- [x] Edge case B (lastMsg > 80K): `truncateMessageTopText` обрезает верх текстовых частей с маркером `[...начало сообщения сокращено из-за большого размера...]`.

**Файлы:**
- `lib/ai/compaction/types.ts` — 72 строки
- `lib/ai/compaction/prompt.ts` — 84 строки
- `lib/ai/compaction/summarize.ts` — 202 строки
- `lib/ai/compaction/db-queries.ts` — 92 строки
- `lib/ai/compaction/prepare-messages.ts` — 337 строк
- Итого: 787 строк

**Валидация задачи:**
- [x] `npx tsc --noEmit` — 0 ошибок (прогнан после каждого из 5 файлов + финально).
- [x] Статический trace: формула подсчёта токенов совпадает с MIND extract триггером в [chat/route.ts:787-793](../../app/(chat)/api/chat/route.ts#L787-L793).
- [x] Создан [FINDINGS.md](./FINDINGS.md) с 4 находками (2 medium-impact для backlog, 2 для разрешения внутри ТЗ).

**Критерий готовности:** middleware готова к интеграции в route handler.

---

### Этап A5: Интеграция в `app/(chat)/api/chat/route.ts`

**Статус:** ✅ Завершён (2026-04-19)

**Цель:** Вызвать middleware из единого chat route handler + переписать существующую `supportsCompaction` логику через `getCompactionStrategy` с реальным modelId + эмитить user-visible compaction event.

**Задачи:**
- [x] Переписан существующий блок [chat/route.ts:952-965](../../app/(chat)/api/chat/route.ts#L952-L965):
  - Введён `const effectiveModelId = activeTaskId ? getModelIdForTask(activeTaskId) : undefined;` (рядом с `effectiveCatalogEntry`).
  - `const compactionStrategy = effectiveModelId ? getCompactionStrategy(effectiveModelId) : { kind: "none" };`
  - `const compactionOptions = compactionStrategy.kind === "provider" ? {...} : undefined;` (Anthropic contextManagement сохранён как был).
  - **Убрано** `|| isProjectChat` special case — закрывает Finding #3. Побочный эффект (project:expert:haiku больше не получает Anthropic Compaction) — корректное поведение, Haiku не умеет Compaction API; полная оценка регрессии в FINDINGS.md.
  - Удалены неиспользуемые `isAnthropicModel` и `modelSupportsCompaction` — оставались только для старой заплатки. Устаревший комментарий в блоке `isAnthropicProtocolModel` актуализирован.
- [x] Добавлен pre-stream вызов middleware **до** `convertToModelMessages` (Finding #4: middleware работает на `ChatMessage[]`). Конкретная точка интеграции — после `uiMessages` формирования (~line 504), **до** `coreHistory = sanitizeCoreMessages(await convertToModelMessages(preparedHistory))` (~line 1027):
  ```typescript
  let historyForCompaction = preparedHistory;  // ChatMessage[]
  let compactionEvent: CompactionEvent | undefined;

  // MVP Этап A: gate на expertise. Этап B расширит на "create".
  if (chatMode === "expertise") {
    const result = await prepareMessagesWithCompaction(
      activeTaskId,
      preparedHistory,
      {
        chatId: id,
        modelId: effectiveModelId,
        systemPromptTokens,
        totalHistoryTokens,
        newMessageTokens,
        mindTokens: mindDynamicBlock ? estimateMessageTokens([{ type: "text", text: mindDynamicBlock }]) : 0,
      },
      dataStream,
    );
    historyForCompaction = result.messages;
    compactionEvent = result.compactionEvent;
  }

  const coreHistory = sanitizeCoreMessages(
    await convertToModelMessages(historyForCompaction),
  );
  // ... далее messagesForRequest = [system, ...coreHistory] как и раньше

  // ПОСЛЕ streamText (или сразу после подготовки, до стрима — решается в реализации):
  if (compactionEvent) {
    emitCompactionEvent(dataStream, compactionEvent);
  }
  ```
- [x] ~~Добавить `DebugCompactionData` тип + `emitDebugCompaction` helper в `lib/ai/debug-events.ts`~~ — **ОТМЕНЕНО** решением архитектора 2026-04-19. Вместо этого создан [lib/ai/compaction/events.ts](../../lib/ai/compaction/events.ts) с `emitCompactionEvent` (раздельный event channel `data-compaction`, без `isSimplyDevMode` gating, user-visible). См. FINDINGS.md Finding #2.

**Файлы:**
- `app/(chat)/api/chat/route.ts` — 4 правки: imports (+4), `effectiveModelId` declaration, рерайт Line 952-965, вставка middleware + emit перед `convertToModelMessages`.
- ~~`lib/ai/debug-events.ts`~~ — не трогаем (решение архитектора 2026-04-19).
- `lib/ai/compaction/events.ts` — ✅ создан в рамках подготовки A5 (после разрешения Finding #2).

**Валидация задачи:**
- [x] `npx tsc --noEmit` — 0 ошибок.
- [x] Static trace по 6 chat paths:
  - **simply:** gate false → middleware не вызывается; strategy=simply → `compactionOptions=undefined` → unchanged.
  - **expertise:** gate TRUE → middleware вызывается; strategy=simply → `compactionOptions=undefined` → Simply Compaction активен.
  - **create:** gate false (Этап A — только expertise); B добавит.
  - **project:expert:opus/sonnet:** gate false; strategy=provider → Anthropic Compaction API enabled → unchanged.
  - **project:expert:haiku:** gate false; strategy=simply (Haiku.supportsCompaction=false) → `compactionOptions=undefined` → behavior change (корректно, Haiku не умеет Compaction API; см. FINDINGS #3).
  - **service-chat:*:** gate false; strategy resolves per model, Haiku → simply, Sonnet → provider → unchanged.

**Критерий готовности:** вся backend-инфраструктура работает, компилируется, готова к UI-интеграции + smoke test.

---

### Этап A6: UI виджет + Smoke test expertise + финализация Этапа A

**Статус:** 🟡 Частично завершён (UI виджет готов, ждёт `npm run build` + smoke test + git commit)

**Цель:** UI обработка события compaction, мануальный smoke test expertise с большой сессией, git commit Этапа A.

**Задачи (UI):**
- [x] В [components/elements/context.tsx](../../components/elements/context.tsx): добавлена подписка на `data-compaction` через `useDataStream`-паттерн (как `data-research-depth` в message.tsx). Новый `CompactionIndicator` рендерит Lucide `Package`/`AlertTriangle` + текст в popover. Срок MVP basic action для `truncation_warning`: каноническая механика `generateUUID() + getChatUrl(newId, chatMode) + router.push + refresh` (паттерн app-sidebar.tsx:79-86).
- [x] **Терминология (правка v1.10 архитектуры, 2026-04-19):** вместо «Новый чат с итогом» — mode-aware labels. expertise → «Новый запрос с итогом» / «Рекомендуем начать новый запрос»; create → «Новое задание с итогом» / «Рекомендуем начать новое задание»; fallback → кнопка скрыта. Добавлены: `chatMode` prop в Context component, проброс из `components/multimodal-input.tsx:445`, тип `compaction: CompactionEvent` в `lib/types.ts` CustomUIDataTypes, убран `"server-only"` из `lib/ai/compaction/types.ts` (чистые типы, безопасно для client import). Добавлена секция §1.5 Терминология режимов в `docs/design-system.md` (UI-закон). Зафиксирована memory `project_mode_terminology.md`.

**Задачи (валидация):**
- [ ] `npx tsc --noEmit` — 0 ошибок.
- [ ] ⛔ **ПРЕДУПРЕДИТЬ ВЛАДЕЛЬЦА** перед запуском `npm run build`: «Этап A6, сейчас запустим `npm run build` — накатится миграция Chat (3 новых колонки). Hard-to-reverse action. ОК?». Ждать подтверждения.
- [ ] `npm run build` — успешен, миграция накатилась.
- [ ] SQL-верификация через `mcp__postgres__query`:
  ```sql
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_name = 'Chat' AND column_name LIKE 'compaction%';
  ```
  Ожидаемо: 3 строки — compactionSummary (text, YES, null), compactionIndex (integer, YES, null), compactionCount (integer, NO, 0).
- [ ] `npm run dev` — сервер запускается без warnings по нашим правкам.

**Задачи (🧪 Мануальный тест владельцем — expertise):**

Попросить владельца:
1. Открыть expertise режим, загрузить крупный PDF (20K+ токенов) в начале.
2. Продолжить диалог на 15+ сообщений, обсуждая содержимое PDF.
3. Наблюдать: когда usage достигает ~100K токенов (≥50% от SIMPLY_CONTEXT_LIMIT) — должен сработать compaction:
   - В UI виджете появляется иконка 📦 «Разговор сжат».
   - Модель продолжает отвечать корректно, ссылаясь на содержимое PDF (которое ушло в summary).
4. SQL-проверка: `SELECT compactionCount, compactionIndex FROM "Chat" WHERE id = '[chatId]';` — count ≥ 1, index не null.
5. SQL-проверка ai_usage_log: есть запись с `taskId = 'compaction:summarize'` для этого chatId.
6. **Дополнительная проверка MIND extract (Риск #7 из ANALYSIS):** после compaction — MIND extract всё ещё работает (fire-and-forget post-stream). Проверить через SQL: `SELECT * FROM "memory_entry" WHERE "sourceChatId" = '[chatId]' ORDER BY "createdAt" DESC LIMIT 5;` — свежие записи появляются.
7. **Регрессионная проверка Simply Chat vision + project:expert:* (Риск переписывания Line 952-965):** отдельный smoke test:
   - Simply Chat vision: загрузить картинку/PDF, убедиться что Haiku отвечает как прежде (нет провайдерского compaction — ok, он там не поддерживался никогда).
   - Project:expert:opus: открыть любой проект, послать сообщение — Anthropic Compaction API должен работать (видно в DevPanel что модель отвечает на Opus, не падает).

**Критерии успеха мануального теста:**
- Compaction сработал в expertise (UI event + SQL записи).
- MIND extract продолжает работать в expertise post-stream.
- Simply Chat vision + project:expert:opus — регрессии нет.

**Git (после валидации и одобрения владельца):**
```bash
git add lib/ai/task-assignments.ts lib/ai/context-limits.ts lib/ai/model-catalog.ts \
        lib/ai/compaction/ lib/ai/debug-events.ts \
        lib/db/schema.ts lib/db/migrations/NNNN_add-compaction-columns.sql \
        app/\(chat\)/api/chat/route.ts \
        components/elements/context.tsx \
        specs/TZ_COMPACTION_1/CHANGELOG.md
git commit -m "feat(tz-compaction-1): Этап A — инфраструктура + pilot expertise"
```

**Критерий готовности Этапа A:** expertise работает с compaction, регрессий нет, владелец подтвердил.

⛔ **Этап B не начинать** без подтверждения Этапа A.

---

## Этап B: Расширение gate на create

### Этап B1: Одна строка изменения gate + smoke test create

**Статус:** ⬜ Не начат (ждёт завершения Этапа A)

**Цель:** Активировать compaction в create режиме через расширение gate.

**Задачи:**
- [ ] В `app/(chat)/api/chat/route.ts` изменить gate:
  ```typescript
  // Было (Этап A): if (chatMode === "expertise") { ... }
  // Стало (Этап B): if (chatMode === "expertise" || chatMode === "create") { ... }
  ```

**Файлы:**
- `app/(chat)/api/chat/route.ts` — одна строка gate расширения

**Валидация задачи:**
- [ ] `npx tsc --noEmit` — 0 ошибок.
- [ ] `npm run build` — успешен (миграций нет в этом этапе, build быстрый).
- [ ] `npm run dev` — работает.

**🧪 Мануальный тест (create):**

Попросить владельца:
1. Открыть create режим, дать задание на создание документа (что-то большое, 15+ turn-ов диалога).
2. Наблюдать: compaction срабатывает так же как в expertise (UI indicator + SQL).
3. Регрессионная проверка expertise — ещё работает (Этап A не сломался).

**Git (после валидации):**
```bash
git add app/\(chat\)/api/chat/route.ts specs/TZ_COMPACTION_1/CHANGELOG.md
git commit -m "feat(tz-compaction-1): Этап B — расширение compaction на create"
```

**Критерий готовности Этапа B:** compaction работает в expertise+create, регрессий нет.

---

## Этап Финализация

⛔ **ПЕРВЫМ ДЕЛОМ:** прочитать [DOCUMENTATION_GUIDE.md](../../DOCUMENTATION_GUIDE.md) — пройти чеклист.

**Задачи (БД + FINDINGS):**
- [ ] Финальная SQL-проверка Chat таблицы (см. Этап A6 запрос).
- [ ] Просмотреть [FINDINGS.md](./FINDINGS.md) (если создан). Каждую находку medium/high оформить как `TZ_<name>.md` в `specs/_backlog/`, обновить `specs/_backlog/README.md`.

**Документация (обязательная):**
- [ ] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти «✅ Чек-лист при изменениях».
- [ ] Локальный `CHANGELOG.md` этого ТЗ → перенести в главный [CHANGELOG.md](../../CHANGELOG.md) (запись о ТЗ живёт там).
- [ ] Обновить [SIMPLY_STATUS.md](../../SIMPLY_STATUS.md) — snapshot состояния, добавить Simply Compaction в активные механизмы.
- [ ] ⛔ **`CLAUDE.md` — НЕ редактировать.** Запустить `wc -l CLAUDE.md` → если > 220, STOP. История → CHANGELOG, пофайловая карта → `docs/architecture.md`.
- [ ] Обновить [package.json](../../package.json) версию: 3.93.0 → 3.94.0.

**Документация (по чеклисту Правило 6 WORKFLOW):**
- [ ] **ADR 053 расширить до 5-го аспекта** (context strategy — контекстно-зависим, chat-handler only) — см. [SIMPLY_COMPACTION_ARCHITECTURE.md §5-й аспект ADR 053](../Simply_xAI/SIMPLY_COMPACTION_ARCHITECTURE.md). Расширение в [docs/decisions/053-aisdk-invocation-contract.md](../../docs/decisions/053-aisdk-invocation-contract.md).
- [ ] [docs/ai-chats-map.md](../../docs/ai-chats-map.md) — добавить `compaction:summarize` taskId в таблицу (триггер: изменения в `task-assignments.ts`).
- [ ] [docs/architecture.md](../../docs/architecture.md) — если структурно изменилась папка `lib/ai/` (новая `lib/ai/compaction/`) — добавить строку.
- [ ] Решить по остальным docs/ через таблицу-триггеры WORKFLOW §Правило 6.

**Завершение:**
- [ ] Финальное мануальное тестирование (пользователь) — 1 час использования expertise + create в реальных сессиях без регрессий.
- [ ] Переместить папку `specs/TZ_COMPACTION_1/` → `specs/_archive/TZ_COMPACTION_1/`.

**Валидация финализации:**
- [ ] `npm run build` — успешен.
- [ ] Production URL (https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app) работает после deploy.
- [ ] Документация актуальна по чеклисту.
- [ ] Vercel deploy: `vercel --prod` (запросить у владельца).

**Git (финальный коммит):**
```bash
git add [все документационные изменения]
git commit -m "docs(tz-compaction-1): финализация ТЗ — v3.94.0"
```

**Критерий готовности ТЗ:** Simply Compaction работает в production для expertise + create, документация обновлена, папка в архиве.

---

## Критерии выхода MVP (для будущего ТЗ-COMPACTION-2)

После закрытия ТЗ-COMPACTION-1 — см. [SIMPLY_COMPACTION_ARCHITECTURE.md §Критерии выхода MVP](../Simply_xAI/SIMPLY_COMPACTION_ARCHITECTURE.md):

1. Stable smoke test 1+ неделю реального использования в expertise + create.
2. Observability проверена (`ai_usage_log`, DevPanel).
3. Качество summary валидировано на 3-5 реальных длинных сессиях.
4. Edge cases выявлены (массивные вложения > 80K, повторные сжатия Фазы 2).

**Если 4 критерия выполнены** → поднимается ТЗ-COMPACTION-2 (расширение на Simply Chat). Желательно перед этим закрыть долг [TZ_UnifyContextThresholdBase](../_backlog/TZ_UnifyContextThresholdBase.md) для унификации баз расчёта.

---

## Git-стратегия

Per WORKFLOW §Правило 7 — коммит после каждого этапа:

```bash
# Этап A6 (завершает Этап A целиком — A1-A6 идут как одна инкрементальная работа перед validation+commit):
git commit -m "feat(tz-compaction-1): Этап A — инфраструктура + pilot expertise"

# Этап B1:
git commit -m "feat(tz-compaction-1): Этап B — расширение compaction на create"

# Финализация:
git commit -m "docs(tz-compaction-1): финализация ТЗ — v3.94.0"
```

---

## Риски и митигации (из ANALYSIS §6)

| # | Риск | Митигация в ROADMAP |
|---|---|---|
| 1 | Неточность оценки usage pre-call | Этап A6 smoke test с большим attachment (20K+) |
| 2 | Race condition параллельных запросов | Low priority, observe в production |
| 3 | Test gap Фазы 2 (повторное сжатие) | Unit test middleware с mock messages (опционально в A4) |
| 4 | Structured output на Grok 4.1 Fast | Verified MIND (ТЗ-XAI-2), Zod schema fallback |
| 5 | Cost savings header `x-grok-conv-id` | В MVP не включаем, follow-up по метрикам |
| 6 | `npm run build` авто-миграция | ⛔ **Checkpoint-вопрос владельцу в Этапе A6** |
| 7 | Двойная обрезка sliding + compaction | Static проверка в Этапе A5, smoke test A6 |

---

## Git-workflow и зависимости

**Hard:** ADR 053 ✅, `supportsCompaction` в catalog ✅, DataStream protocol ✅.

**Soft (не блокируют):** [TZ_UnifyContextThresholdBase](../_backlog/TZ_UnifyContextThresholdBase.md), [TZ_DevPanelFooterHidesSubCalls](../_backlog/TZ_DevPanelFooterHidesSubCalls.md).

**Внутренние:** A1→A2→A3→A4→A5→A6→B1→Финализация, строго последовательно.

---

**Обновлено:** 2026-04-18 — создание ROADMAP после одобрения ANALYSIS + ARCHITECT_ANSWERS.
