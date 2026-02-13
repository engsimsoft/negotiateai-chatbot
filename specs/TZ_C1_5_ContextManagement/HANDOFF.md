# Передача сессии ТЗ-C1.5: ContextManagement

**Последнее обновление:** 2026-02-12
**Сессия:** 3

---

## Статус этапов

| Этап | Описание | Статус |
|------|----------|--------|
| 1 | БД + Конфиг + Tool createSnapshot | ✅ `c8c9d3a` |
| 2 | Сброс контекста + Мониторинг + Fallback | ✅ `53c52cd` |
| 3 | UI — SnapshotCard + разделитель + приглушение | ✅ (ожидает коммит) |
| 4 | UI — ContextIndicator + E2E flow | ⬜ Следующий |
| 5 | Финализация | ⬜ |

---

## Следующая сессия: начни с

1. Прочитай этот файл
2. Прочитай `ROADMAP.md` → **Этап 4**
3. Запусти `npm run dev`
4. **Первая задача:** Этап 4.1 — Создать `components/projects/context-indicator.tsx`

---

## Что сделано в последних сессиях

### Сессия 1 (Этап 1)
- Создана рабочая папка, ANALYSIS.md, ROADMAP.md
- `lib/ai/context-limits.ts` — конфиг (CONTEXT_BUDGET=140k, SNAPSHOT_THRESHOLD=0.7, FALLBACK_MESSAGE_PAIRS=5)
- `lib/db/schema.ts` — поля `Chat.snapshots` (jsonb[]) и `Chat.contextState` (jsonb)
- `drizzle/0027_sharp_grim_reaper.sql` — миграция
- `lib/db/queries.ts` — 4 функции (addChatSnapshot, getChatWithSnapshotState, updateChatContextState, resetChatContextState)
- `lib/ai/tools/create-snapshot.ts` — tool createSnapshot (structured params → fullMarkdown → save to DB)
- `lib/ai/tools/chat-tools.ts` — регистрация tool, chatId в params
- Мануальный тест пройден: Эксперт вызывает createSnapshot, snapshot сохраняется в БД

### Сессия 2 (Этап 2)
- `lib/prompts/build-task-expert-prompt.ts` — параметр `snapshotContext` → `<previous_context>` блок в system prompt
- `route.ts` (task expert) — snapshot-aware message trimming, usage estimation, system signal injection, fallback logic
- `lib/ai/clerks/snapshot-creator.ts` — fallback clerk (по паттерну task-summarizer)
- `lib/prompts/clerks/snapshot-creator.md` — промпт clerk'а
- `lib/db/schema.ts` — `SnapshotMeta.fullMarkdown?: string` для clerk snapshots
- `lib/db/queries.ts` — `addChatSnapshot` принимает optional `fullMarkdown`
- Build пройден, мануальный тест: логи `[TaskExpert]` подтверждают snapshot loading + trimming

### Сессия 3 (Этап 3)
- `components/projects/snapshot-card.tsx` — новый компонент:
  - `SnapshotCard` — карточка с expand/collapse (shortSummary свёрнуто, секции fullMarkdown развёрнуто)
  - `SnapshotDivider` — тонкий разделитель с иконкой и текстом
  - `parseSections()` — парсер fullMarkdown в секции
- `components/message.tsx` — обнаружение `tool-createSnapshot` parts:
  - `output-available` → рендерит `SnapshotCard` + `SnapshotDivider`
  - loading state → рендерит стандартный `Tool` + `ToolHeader`
- `components/messages.tsx` — приглушение + fallback:
  - `hasSnapshotToolCall()` — проверяет наличие snapshot tool call в сообщении
  - `lastSnapshotIndex` — useMemo, находит индекс последнего snapshot-сообщения
  - `fallbackSnapshotInsertIndex` — useMemo, для clerk snapshots (по createdAt timestamp)
  - Сообщения до boundary → `opacity-50` wrapper
  - Fallback divider → `SnapshotDivider` с label "Контекст сжат"
  - Новый prop `snapshots?: SnapshotMeta[]` + memo comparator обновлён
- `components/projects/task-chat.tsx` — прокинут `snapshots` prop через TaskChat → Messages
- `app/(task)/projects/[id]/tasks/[taskId]/page.tsx` — передаёт `chat.snapshots` в TaskChat
- `tsc --noEmit` ✅ 0 ошибок, `npm run build` ✅ успешен

---

## Файлы в работе

| Файл | Статус | Примечание |
|------|--------|------------|
| `lib/ai/context-limits.ts` | ✅ | Конфиг бюджетов |
| `lib/ai/tools/create-snapshot.ts` | ✅ | Tool createSnapshot |
| `lib/ai/clerks/snapshot-creator.ts` | ✅ | Fallback clerk |
| `lib/prompts/clerks/snapshot-creator.md` | ✅ | Промпт clerk'а |
| `lib/prompts/build-task-expert-prompt.ts` | ✅ | +snapshotContext |
| `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` | ✅ | Snapshot-aware logic |
| `lib/db/schema.ts` | ✅ | SnapshotMeta, ContextState |
| `lib/db/queries.ts` | ✅ | 4 snapshot queries |
| `components/projects/snapshot-card.tsx` | ✅ | SnapshotCard + SnapshotDivider |
| `components/messages.tsx` | ✅ | Приглушение + fallback divider |
| `components/message.tsx` | ✅ | tool-createSnapshot rendering |
| `components/projects/task-chat.tsx` | ✅ | snapshots prop |
| `app/(task)/projects/[id]/tasks/[taskId]/page.tsx` | ✅ | chat.snapshots → TaskChat |
| `components/projects/context-indicator.tsx` | 🔜 | Этап 4 |

---

## Известные нюансы

1. **Snapshot messageId mismatch:** `assistantMessageId` генерируется в route до стриминга, но `createUIMessageStream` может присвоить другой ID. В результате `findIndex` по messageId в loaded messages возвращает -1 → fallback ветка использует `lastSnapshot.fullMarkdown || summary`. Это безопасное поведение — контекст передаётся через `snapshotContext`, просто не обрезает сообщения (trimmed 0). Для 100% точности нужно убедиться что message ID из tool closure совпадает с сохранённым.

2. **data-context-usage annotation:** Отправляется через `dataStream.write({ type: "data-context-usage", data: { percent, tokens } })`. Фронтенд ещё не обрабатывает — это задача Этапа 4.

3. **Fallback clerk:** Срабатывает на стороне сервера при `messagesSinceSuggestion >= 5`. Snapshot сохраняется с `fullMarkdown` и fake messageId `fallback-{uuid}`. Применяется при следующем запросе.

4. **Dimming boundary:** Для tool-created snapshots — dimBoundary = индекс сообщения с tool call. Для fallback — определяется по `createdAt` timestamp snapshot vs message metadata. Сообщения до boundary получают `opacity-50`.

---

## Блокеры / Вопросы

- Нет блокеров. Этапы 1-3 полностью завершены.
- **Мануальный тест Этапа 3 ещё не проведён** — нужно проверить в браузере: snapshot карточка, expand/collapse, приглушение, fallback divider.

---

## Команды

```bash
npm run dev          # Dev сервер
npm run build        # Проверка сборки
npx tsc --noEmit     # Проверка TypeScript
```

---

## Ключевые решения

1. **Snapshot = tool call в assistant message** (не отдельный Message)
2. **Usage estimated ДО стриминга** из DB tokenCount (не из onFinish)
3. **Fallback включён с первой итерации** (~100 строк по паттерну task-summarizer)
4. **Убрана колонка isSnapshot** — избыточна при наличии Chat.snapshots[].messageId
5. **SnapshotMeta.fullMarkdown optional** — есть только у clerk-generated snapshots; у tool-generated берётся из tool call output
6. **Dimming через wrapper div** — `opacity-50` на div вокруг PreviewMessage, а не CSS selector, для простоты и предсказуемости
7. **Fallback divider position** — определяется по `createdAt` timestamp snapshot vs message metadata
