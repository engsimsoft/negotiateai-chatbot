# ROADMAP: ТЗ-DevPanelErrors — секция Errors & Warnings в DevPanel

**Создан:** 2026-04-11
**План:** `/Users/mactm/.claude/plans/pure-bubbling-boole.md` (утверждён)
**Цель:** добавить постоянное диагностическое оборудование для ловли клиентских и серверных ошибок в DevPanel.

---

## Фаза 1: Типы + серверные emit-функции ✅

- [x] `lib/ai/debug-events.ts` — bump `DEBUG_EVENT_SCHEMA_VERSION` 2 → 3
- [x] Добавить типы `DebugErrorData`, `DebugWarningData`
- [x] Добавить функции `emitDebugError`, `emitDebugWarning` (обе с try/catch внутри)
- [x] `npx tsc --noEmit` → 0 ошибок

## Фаза 2: Серверная инструментация критических catch в chat/route.ts ✅

- [x] Импорт `emitDebugError`, `emitDebugWarning`
- [x] Буфер `prePromptWarnings` для pre-prompt graceful degradations (parseBatches требует прежде всего data-debug-prompt)
- [x] `getProfileBlock` catch → buffered warning (flushed after emitDebugPrompt)
- [x] `retrieveMemoryContext` catch → buffered warning
- [x] `executeProfessorPipeline` catch → `emitDebugError`
- [x] Guardian blocked → `emitDebugWarning` (обычная блокировка)
- [x] Guardian max retries exceeded → `emitDebugError` (после 2+ блокировок)
- [x] instrumentedStream top-level catch → `emitDebugError`
- [x] Общий catch в конце route.ts — НЕ добавлен: dataStream out of scope, ошибка дойдёт клиенту через HTTP error → useChat.onError (Фаза 3)
- [x] `npx tsc --noEmit` → 0 ошибок

## Фаза 3: Клиентский сбор + контекст session errors ✅

- [x] `components/dev-panel/dev-panel-provider.tsx` — `DevPanelMessageData` + `errors`/`warnings` arrays
- [x] `parseBatches` — обработка `data-debug-error` и `data-debug-warning`
- [x] `DevPanelContext` — новая форма `{ byMessage, globalErrors }`
- [x] `useDevPanelGlobalErrors()` — новый hook для глобальных ошибок
- [x] Новый файл `lib/client/error-bus.ts` — `reportClientError` + `subscribeToClientErrors` (event bus pattern вместо отдельного SessionErrorsProvider — проще для class-based Error Boundary)
- [x] Новый файл `components/dev-panel/dev-panel-error-boundary.tsx` — class component, publishes через bus
- [x] `components/dev-panel/dev-panel-provider.tsx` — window.onerror + unhandledrejection listeners + subscribe на bus + circular buffer 50 ошибок
- [x] Consumer fix: `components/dev-panel/onboarding-debug-provider.tsx` — DevPanelContextValue новой формы
- [x] Consumer fix: `hooks/use-onboarding-debug.ts` — добавлен `errors: [], warnings: []` в batch init
- [x] `components/chat.tsx` — `reportClientError` в существующем `onError` useChat
- [x] `components/chat.tsx` — обёртка `<DevPanelErrorBoundary>` вокруг ядра чата
- [x] Попутно: `setCurrentChatMode` unused → константа (Фаза 5 часть)
- [x] `npx tsc --noEmit` → 0 ошибок

## Фаза 4: UI — badge в footer + секция в drawer + session drawer ✅

- [x] `components/dev-panel/sections/errors-section.tsx` — `ErrorsSection` + `ErrorsList` (для session drawer)
- [x] `components/dev-panel/dev-panel-drawer.tsx` — секция встроена первой в список
- [x] `components/dev-panel/dev-panel-footer.tsx` — бейджи errors/warnings в chips
- [x] `components/dev-panel/session-errors-drawer.tsx` — глобальный drawer
- [x] `components/dev-panel/session-errors-indicator.tsx` — индикатор для header
- [x] `components/chat-header.tsx` — встроен `SessionErrorsIndicator`
- [x] Попутно: `sm:w-[440px]` → `sm:w-110` в drawer (IDE hint не игнорирую)
- [x] `npx tsc --noEmit` → 0 ошибок

## Фаза 5: Cleanup и побочные починки ✅

- [x] `console.log("[DEBUG-EMIT] WRITTEN successfully...")` — ранее удалён в этой же сессии
- [x] `md:mr-[380px]` → `md:mr-95` — сделано до Plan mode
- [x] `sm:w-[440px]` → `sm:w-110` в dev-panel-drawer — сделано во время Фазы 4 (IDE hint)
- [x] `setCurrentChatMode` unused → превращён в `const currentChatMode = initialChatMode`
- [x] `provider=null` регрессия — введён `resolvedTaskId: TaskId | null`, `logProvider = getProviderForTask(resolvedTaskId)`, добавлено в тип `usageLogMeta` + в вызов `saveAiUsageLog`
- [x] `npx tsc --noEmit` → 0 ошибок
- [x] `npm run build` → успешен (все роуты скомпилированы)
- [ ] SQL verify: `SELECT provider, COUNT(*) FROM ai_usage_log WHERE createdAt > NOW() - INTERVAL '1 hour' GROUP BY 1` — после мануального теста в Фазе 6

## Фаза 6: Мануальная валидация ✅ (частично, достаточно для commit)

- [x] **Реальный живой warning test** — Voyage AI 403 показывается в footer badge `⚠ 1 warning` + полная карточка в drawer секции "Errors & Warnings" (скрин от Владимира подтвердил)
- [x] **SQL verify**: свежая запись `ai_usage_log` имеет `provider: "minimax"` — регрессия `provider=null` починена
- [x] **Архитектурное улучшение найдено и применено**: `retrieveMemoryContext` теперь возвращает `error` поле вместо graceful degradation глотания. Это паттерн для всех подобных функций в будущем.
- [x] **Попутно**: аналогичный fix в `projects/[id]/tasks/[taskId]/chat/route.ts` — task chat тоже показывает warnings
- [x] **Удалены временные console.log** (`[DEBUG-EMIT-WARN]`, `[DEBUG-FLUSH]`, `[parseBatches]`)
- [x] **Voyage 403 починен Владимиром самостоятельно** — root cause: финский VPN, US Buffalo работает. Это было первое живое использование нового инструмента → нашёл и починил за минуту. Инструмент доказал свою ценность.
- [ ] Искусственные тесты Error Boundary и useChat error — опционально, не блокер для commit
- [ ] Регрессия по всем режимам — пользователь подтвердил что /expertise/project/create работают
- [ ] Prod gate check (`SIMPLY_DEV_MODE=false`) — опционально до deploy

## Post-ТЗ

- [ ] Commit
- [ ] Обновить HANDOFF.md: зафиксировать статус ТЗ-1 Этап 4 (9 файлов мигрированы, мануальный тест pipelines ещё не завершён, sanitizer fix b4bce63→current session применён)
- [ ] Вернуться к ТЗ-1 Этап 4 мануальному тесту с новым Errors инструментом
