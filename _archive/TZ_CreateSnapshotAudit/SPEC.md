# ТЗ-CreateSnapshotAudit (Follow-up из TZ_LegacyChatCleanup, Finding #8)

**Импакт:** medium · **Оценка:** 0.5 сессии · **Создано:** 2026-04-13

## Цель

Эмпирически проверить, действительно ли проектные task expert чаты вызывают tool `createSnapshot`. Если 0 вызовов — удалить tool целиком (он, скорее всего, мёртв после введения Compaction API). Если есть вызовы — задокументировать use case.

## Контекст находки

В TZ_LegacyChatCleanup был удалён snapshot fallback из `chat/route.ts` (привязан к legacy `chatMode="chat"`). Я предполагал что `createSnapshot` tool тоже станет полностью dead, но обнаружил что он всё ещё прокидывается в **project task expert chat** через `getStandardTools` → `experimental_activeTools`.

Однако проектные задачи используют Anthropic Compaction:
```ts
const supportsCompaction = isAnthropicModel && (modelSupportsCompaction || isProjectChat);
```
То есть для `isProjectChat` Compaction всегда включён, что делает snapshot-механизм избыточным. Tool оставлен «на всякий случай», но возможно никем не вызывается.

## Что проверить

### Часть 1 — SQL Audit

Запрос для подсчёта реальных вызовов `createSnapshot` за последний месяц через `Message_v2.parts`:

```sql
SELECT
  COUNT(*) AS snapshot_calls,
  MIN("createdAt")::date AS earliest_call,
  MAX("createdAt")::date AS latest_call
FROM "Message_v2"
WHERE parts::text LIKE '%"type":"tool-createSnapshot"%'
  AND "createdAt" >= NOW() - INTERVAL '30 days';
```

Альтернатива через `ai_usage_log`:
```sql
SELECT COUNT(*) FROM ai_usage_log
WHERE "createdAt" >= NOW() - INTERVAL '30 days'
  AND "guardianFlags"::text LIKE '%createSnapshot%';
```
(Если Guardian отслеживает tool calls)

### Часть 2 — Проверка статуса в проектных чатах

Открыть несколько project task expert чатов в `/projects/[id]/tasks/[taskId]`, провести длинные диалоги (30+ сообщений), посмотреть:
- Срабатывает ли Compaction (проверить через DevPanel → `data-debug-compaction` события)
- Появляется ли SnapshotCard в UI (это значит tool вызывался)

### Часть 3 — Решение

**Если 0 вызовов за 30 дней:**
- Удалить `createSnapshot` из `getActiveToolNames` для проектов (`lib/ai/tools/chat-tools.ts`)
- Удалить из `baseTools` в той же функции
- Удалить tool definition в `getStandardTools` (`lib/ai/tools/chat-tools.ts`)
- Удалить файл `lib/ai/tools/create-snapshot.ts`
- Удалить файл `lib/ai/clerks/snapshot-creator.ts`
- Удалить связанные queries: `addChatSnapshot`, `getChatWithSnapshotState` (если не нужны для других целей)
- Удалить UI компонент `components/projects/snapshot-card.tsx` если он только для createSnapshot results
- Обновить рендеринг в `components/messages.tsx` и `components/message.tsx` (убрать `tool-createSnapshot` ветки)
- Обновить таблицу `Chat` schema — если есть колонка `snapshots` или подобная, удалить миграцией

**Если есть вызовы (>0):**
- Задокументировать use case в `docs/ai-tools.md`
- Объяснить почему Compaction недостаточно
- Оставить как есть

## Definition of Done

- SQL запрос выполнен, цифра вызовов задокументирована в HANDOFF этого ТЗ
- Решение принято: удаляем или оставляем
- Если удаляем — все артефакты вычищены, tsc + build + smoke test проектных задач
- Если оставляем — `docs/ai-tools.md` обновлён с обоснованием

## Риски

- **Каскадное удаление UI**: SnapshotCard может рендериться где-то ещё (history view проекта?). Перед удалением grep по всем местам где упоминается `tool-createSnapshot` или `SnapshotCard`
- **Schema migration**: если в `Chat` есть колонка `snapshots: jsonb` — удалить через Drizzle миграцию, не мануально
