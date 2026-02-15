# Передача сессии ТЗ-07: Tool Activity UX

**Дата:** 2026-02-15
**Сессии:** 1–3 (завершены), сессия 4 = финализация

## Статус этапов
- [x] Этап 1: Config + Компонент
- [x] Этап 2: Интеграция (backend + client + группировка)
- [ ] Этап 3: Финализация (документация, версия, архив)

## Что сделано

### Backend (серверная часть)
- `app/(chat)/api/chat/route.ts` — перехват `tool-input-start` событий AI SDK v5, отправка `data-tool-activity` через `dataStream.write()`
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — аналогично для task expert chat
- **Важно:** AI SDK v5 использует `tool-input-start` (НЕ `tool-call`) для начала вызова инструмента

### Client (3 ключевых файла)
1. **`lib/ai/tool-activity-config.ts`** — конфиг 3 инструментов (webSearch, parseExcel, readProjectFile) с `resultCounter` для агрегации
2. **`components/tool-activity-indicator.tsx`** — чистый презентационный компонент:
   - `isActive` → спиннер (Loader) + label + "..."
   - `!isActive` → галочка + doneLabel + summary
   - `count > 1` → бейдж "×N"
   - `details[]` → раскрываемый список запросов
3. **`components/message.tsx`** — единый `groupedToolActivities` useMemo:
   - Объединяет active (dataStream) + completed (message.parts)
   - Группирует по toolName
   - Агрегирует результаты через `resultCounter`
   - Один render-point перед `deduplicatedParts.map()`
   - Catch-all → `return null` для TOOL_ACTIVITY_CONFIG tools

### Вспомогательные изменения
- `lib/types.ts` — добавлен `"tool-activity"` в `CustomUIDataTypes`
- `components/messages.tsx` — подавление ThinkingMessage при наличии tool activity в dataStream
- `components/chat.tsx` — очистка stale `data-tool-activity` событий в `onFinish`
- `components/projects/task-chat.tsx` — аналогичная очистка в `useEffect` на status

## Архитектура (финальная)

```
Server (route.ts)                    Client (message.tsx)
─────────────────                    ────────────────────
tool-input-start event               groupedToolActivities useMemo
  → dataStream.write({                 ├─ active: из dataStream (data-tool-activity)
      type: "data-tool-activity",      ├─ completed: из message.parts (tool-*)
      data: { toolName, toolCallId }   ├─ группировка по toolName
    })                                 ├─ агрегация summary через resultCounter
                                       └─ один render → <ToolActivityIndicator />
```

## Ключевые решения (для контекста)
1. **data-tool-activity** приходит через `onData` → `DataStreamProvider`, НЕ через `message.parts`
2. **AI SDK v5 event types**: `tool-input-start`, `tool-input-available`, `tool-output-available` (НЕ `tool-call`/`tool-result`)
3. **Пустое сообщение**: SDK создаёт пустой assistant message до контента → скрываем через `return null` в PurePreviewMessage
4. **min-h-96**: отключен при `isLoading` чтобы не было 384px пустого пространства при streaming
5. **Группировка**: один useMemo объединяет оба источника данных, catch-all возвращает null

## Известные проблемы / ограничения
- Gemini иногда делает 6-8 параллельных webSearch и тратит весь контекст на поиск, не оставляя токенов на ответ. Это AI-баг, не UI
- `icon` в `ToolActivityConfig` сейчас не используется (спиннер заменил иконку), но оставлен для будущего использования

## Следующая сессия: начни с
1. **Read ROADMAP.md** → Этап 3 (Финализация)
2. Финальный `npm run build`
3. Обновить: CHANGELOG.md, SIMPLY_STATUS.md, CLAUDE.md, package.json (→ 3.20.0)
4. Git commit
5. Переместить `specs/TZ_07_ToolActivity/` → `_archive/`

## Файлы затронутые ТЗ-07 (для git)
```
# Новые
lib/ai/tool-activity-config.ts
components/tool-activity-indicator.tsx

# Изменённые
components/message.tsx
components/messages.tsx
components/chat.tsx
components/projects/task-chat.tsx
lib/types.ts
app/(chat)/api/chat/route.ts
app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts
```
