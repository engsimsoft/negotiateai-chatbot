# Changelog ТЗ-LegacyChatCleanup

## Сессия 1 — 2026-04-13

### Этап 1: Реестр моделей и API (commit 620730b)

#### Removed
- `lib/ai/task-assignments.ts`: удалены taskId `chat:haiku`, `chat:sonnet`, `chat:opus` из union и из `DEFAULT_TASK_MODELS`
- `lib/ai/chat-mode-config.ts`: удалена ветка `"chat"` из zod enum, `CHAT_MODE_CONFIG.chat`, `case "chat"` в `getTaskIdForChatMode`
- `app/(chat)/api/chat/route.ts`: удалён весь блок snapshot fallback (~120 строк) — `isHaikuChat`, `needsSnapshotFallback`, snapshot loading, `data-context-usage` emit
- 7 dead импортов из route.ts: `createFallbackSnapshot`, `addChatSnapshot`, `getChatWithSnapshotState`, `resetChatContextState`, `updateChatContextState`, `SNAPSHOT_THRESHOLD`, `FALLBACK_MESSAGE_PAIRS`
- `lib/ai/tools/chat-tools.ts`: удалён `CHAT_MODE_EXCLUDED_TOOLS` фильтр для Haiku-`chat`

#### Added
- `lib/ai/task-assignments.ts`: новые taskId `expertise` (default `grok-4.20-multi-agent-0309`) и `create` (default `MiniMax-M2.7`)

#### Changed
- `app/(chat)/api/chat/schema.ts`: `chatMode` стал обязательным полем (без `.default("chat")`)
- `lib/db/queries.ts:saveChat`: `chatMode` стал обязательным параметром (был `chatMode || "chat"` костыль)
- `app/(chat)/api/chat/route.ts:autoNameChat`: gate расширен на 4 default-имени через `DEFAULT_TITLES` set
- `app/(chat)/api/chat/route.ts`: builder switch стал явным трёхветочным (`expertise → buildExpertisePrompt`, `create → buildCreatePrompt`, `simply → buildChatPrompt`)
- `lib/ai/debug-events.ts`: пример taskId в jsdoc обновлён с `chat:sonnet` на `expertise`

#### Fixed
- **Костыль #1**: молчаливый `try/catch` на `getMemorySettings` в [route.ts](app/(chat)/api/chat/route.ts) — теперь `console.warn` с текстом ошибки вместо тихого degradation

#### Files
- lib/ai/task-assignments.ts
- lib/ai/chat-mode-config.ts
- lib/ai/debug-events.ts
- lib/ai/tools/chat-tools.ts
- app/(chat)/api/chat/schema.ts
- app/(chat)/api/chat/route.ts
- lib/db/queries.ts

### Этап 2: Физические удаления (commit 620730b)

#### Removed
- `app/(chat)/chat/[id]/page.tsx` — маршрут открытого «обычного чата»
- `app/(chat)/chat/page.tsx` — маршрут «новый обычный чат»
- `app/(dashboard)/chats/page.tsx` — страница «Все чаты»
- `components/projects/context-indicator.tsx` — мёртвый ContextIndicator (привязан был к удалённому snapshot fallback)
- `lib/db/queries.ts:getGeneralChatsWithStats` — функция использовалась только удалённой страницей
- `lib/prompts/builder/index.ts`: deprecated compatibility layer (`buildPrompt`, `getAvailablePrompts`, `getConfig`, `buildPromptAgentPrompt`) — никем не импортировался
- `lib/prompts/server.ts`: re-exports compatibility layer
- 5 страниц чата: импорт `DEFAULT_CHAT_MODEL` и чтение cookie `chat-model`

#### Added
- 5 страниц чата: локальная константа `INITIAL_CHAT_MODEL = "auto"` вместо мёртвой cookie

#### Changed
- `lib/utils.ts:getChatUrl`: default ветка теперь `throw Error` вместо `/chat/${id}`
- `lib/ai/models.ts`: переписан как тонкая `@deprecated` заглушка (полное удаление файла + 5 импортёров вынесено в follow-up `TZ_DeadModelSelectors`)
- `components/app-sidebar.tsx`: ChatMode literal сужен (без `"chat"`); 4 функции навигации без default-веток; fallback контекст `simply`
- `components/chats/mode-chats-page.tsx`: упрощено условие UUID-навигации; `href` стал опциональным
- `components/chat.tsx`: default `initialChatMode = "simply"`; удалены `ContextIndicator`, `contextPercent` state, `data-context-usage` обработчик
- `components/multimodal-input.tsx`: research depth toggle: убрана проверка `!== "chat"`
- `components/sidebar-history.tsx`: default context → `simply`
- `hooks/use-chat-visibility.ts`: union `chatMode` без `"chat"`
- `app/(dashboard)/expertise/page.tsx` + `create/page.tsx`: убраны мёртвые href на удалённый `/chat?mode=...`
- `app/(chat)/api/chat/route.ts:saveChat call`: дефолтный title теперь mode-aware (`Новый запрос` / `Новое задание` / `Чат проекта` / `Новый чат`)

#### Files
- app/(chat)/chat/[id]/page.tsx (deleted)
- app/(chat)/chat/page.tsx (deleted)
- app/(dashboard)/chats/page.tsx (deleted)
- components/projects/context-indicator.tsx (deleted)
- app/(chat)/simply/page.tsx
- app/(create)/create/[id]/page.tsx
- app/(expertise)/expertise/[id]/page.tsx
- app/(dashboard)/expertise/page.tsx
- app/(dashboard)/create/page.tsx
- app/(chat)/api/chat/route.ts
- components/app-sidebar.tsx
- components/chat.tsx
- components/chats/mode-chats-page.tsx
- components/multimodal-input.tsx
- components/sidebar-history.tsx
- hooks/use-chat-visibility.ts
- lib/utils.ts
- lib/ai/models.ts
- lib/db/queries.ts
- lib/prompts/builder/index.ts
- lib/prompts/server.ts

### Этап 3: БД cleanup и финализация

#### Removed (DB)
- 10 чатов `chatMode='chat'` из таблицы `Chat`
- 107 сообщений из `Message_v2`
- 52 stream из `Stream`
- 141 лог из `ai_usage_log`
- 2 ProjectTask
- 1 vote из `Vote_v2`

#### Changed (DB)
- 30 `memory_entry.sourceChatId` обнулены (факты сохранены)
- Verify: `SELECT COUNT(*) FROM "Chat" WHERE "chatMode" = 'chat'` = 0

#### Added (Documentation)
- `specs/WORKFLOW.md` 1.7 → 1.8: новое **Правило 8 — FINDINGS.md** (родилось из этого ТЗ)
- `specs/TZ_LegacyChatCleanup/SPEC.md`, `ANALYSIS.md`, `ROADMAP.md`, `FINDINGS.md`, `CHANGELOG.md`, `HANDOFF.md`
- 5 follow-up ТЗ-заготовок в `specs/`

#### Changed (Documentation)
- `CLAUDE.md`: секции «Списки веток режимов», «ChatMode System», «Context Window Management» обновлены под новую архитектуру
- `docs/ai-chats-map.md`: пример `getModel("chat:sonnet")` обновлён на `getModel("expertise")`
- `SIMPLY_STATUS.md`: версия 3.85.0 → 3.86.0, добавлена полная секция о ТЗ-LegacyChatCleanup в «План развития»

## Validation summary

- ✅ `npx tsc --noEmit` — 0 ошибок после каждой задачи Этапа 1 и 2
- ✅ `npm run build` — успешен после Этапа 2
- ✅ Мануал-тест Этапа 1 пройден пользователем (Simply, Think, expertise, create — все 4 режима)
- ✅ Мануал-тест Этапа 2 пройден пользователем (404 на удалённых маршрутах, sidebar в 4 контекстах, новые ветки с правильными mode-aware title)
- ✅ SQL cleanup verify = 0
