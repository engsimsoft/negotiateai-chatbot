# Передача сессии ТЗ-C1.5: ContextManagement

**Последнее обновление:** 2026-02-13
**Сессия:** 4

---

## Статус этапов

| Этап | Описание | Статус |
|------|----------|--------|
| 1 | БД + Конфиг + Tool createSnapshot | ✅ `c8c9d3a` |
| 2 | Сброс контекста + Мониторинг + Fallback | ✅ `53c52cd` |
| 3 | UI — SnapshotCard + разделитель + приглушение | ✅ `da34670` |
| 4 | UI — ContextIndicator + E2E flow | ✅ `f41793c` |
| 5 | Финализация | ⬜ Следующий |

---

## Следующая сессия: начни с

1. Прочитай этот файл
2. Прочитай `ROADMAP.md` → **Этап 5 (Финализация)**
3. Выполни задачи Этапа 5:
   - Перенести CHANGELOG.md → главный CHANGELOG.md
   - Обновить SIMPLY_STATUS.md
   - Обновить CLAUDE.md (добавить Context Management секцию)
   - Обновить package.json (3.17.0 → 3.18.0)
   - Обновить docs/ai-chats-map.md (добавить snapshot tool)
   - Переместить `specs/TZ_C1_5_ContextManagement/` → `_archive/`

---

## Что сделано в последних сессиях

### Сессия 1 (Этап 1)
- `lib/ai/context-limits.ts` — конфиг (CONTEXT_BUDGET=140k, SNAPSHOT_THRESHOLD=0.7, FALLBACK_MESSAGE_PAIRS=5)
- `lib/db/schema.ts` — поля `Chat.snapshots` (jsonb[]) и `Chat.contextState` (jsonb)
- `drizzle/0027_sharp_grim_reaper.sql` — миграция
- `lib/db/queries.ts` — 4 функции (addChatSnapshot, getChatWithSnapshotState, updateChatContextState, resetChatContextState)
- `lib/ai/tools/create-snapshot.ts` — tool createSnapshot
- `lib/ai/tools/chat-tools.ts` — регистрация tool, chatId в params

### Сессия 2 (Этап 2)
- `lib/prompts/build-task-expert-prompt.ts` — параметр `snapshotContext` → `<previous_context>` блок
- `route.ts` (task expert) — snapshot-aware message trimming, usage estimation, system signal, fallback
- `lib/ai/clerks/snapshot-creator.ts` — fallback clerk
- `lib/prompts/clerks/snapshot-creator.md` — промпт clerk'а

### Сессия 3 (Этап 3)
- `components/projects/snapshot-card.tsx` — SnapshotCard (expand/collapse) + SnapshotDivider
- `components/message.tsx` — обнаружение `tool-createSnapshot`, рендер карточки + разделитель
- `components/messages.tsx` — приглушение старых сообщений (`opacity-50`), fallback divider, prop `snapshots`
- `components/projects/task-chat.tsx` — прокинут `snapshots` prop
- `app/(task)/projects/[id]/tasks/[taskId]/page.tsx` — передаёт `chat.snapshots` в TaskChat

### Сессия 4 (Этап 4)
- `components/projects/context-indicator.tsx` — тонкий progress bar (3 цвета: серый <60% / amber 60-80% / orange+pulse 80-100%), Tooltip
- `components/projects/task-chat.tsx` — `contextPercent` useState, обработка `data-context-usage` в onData, размещение индикатора над input
- Мануальные тесты пройдены: карточка, разделитель, приглушение, индикатор — всё работает

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
| `components/projects/task-chat.tsx` | ✅ | snapshots prop + contextPercent + onData |
| `components/projects/context-indicator.tsx` | ✅ | Progress bar + tooltip |
| `app/(task)/projects/[id]/tasks/[taskId]/page.tsx` | ✅ | chat.snapshots → TaskChat |

---

## Блокеры / Вопросы

- Нет блокеров. Этапы 1-4 полностью завершены и протестированы.
- Осталась только финализация (документация, версия, архивация).

---

## Команды

```bash
npm run dev          # Dev сервер
npm run build        # Проверка сборки
npx tsc --noEmit     # Проверка TypeScript
```
