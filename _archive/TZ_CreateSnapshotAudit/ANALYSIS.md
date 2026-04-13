# ANALYSIS — TZ_CreateSnapshotAudit

**ТЗ-источник:** `SPEC.md` (promoted из backlog, Finding #8 из TZ_LegacyChatCleanup)
**Дата:** 2026-04-14
**Автор:** Claude Opus 4.6
**Статус:** Анализ завершён, решение — **УДАЛИТЬ**

---

## 1. Изученная документация (WORKFLOW Правило 1)

Задача — внутренний cleanup (аудит + удаление). Внешних SDK/API не затрагивает, кроме Drizzle ORM для schema-миграции.

| Источник | URL | Что взято |
|---|---|---|
| Drizzle Kit — Migrations | https://orm.drizzle.team/docs/migrations | `drizzle-kit generate` читает schema и генерирует diff-миграцию автоматически. DROP COLUMN поддержан, SQL нужно ревьюить перед applying. Для Postgres DROP COLUMN на маленьких таблицах безопасен, lock'ов не будет. Workflow: edit schema → `npm run db:generate` → review `.sql` → `npm run db:migrate` |
| Drizzle Kit в проекте | `drizzle.config.ts`, `package.json` scripts (`db:generate`, `db:migrate`) | SSOT — `lib/db/schema.ts`, миграции в `lib/db/migrations/`. Nested команды уже настроены |

SQL-запросы (аудит) — стандартный Postgres, внешней документации не требуется, используется MCP `postgres__query` tool.

---

## 2. SQL Audit — фактические данные

### 2.1 Вызовы tool `createSnapshot` за всё время

```sql
SELECT COUNT(*) AS snapshot_calls_alltime,
       MIN("createdAt")::date AS earliest_ever,
       MAX("createdAt")::date AS latest_ever,
       COUNT(DISTINCT "chatId") AS distinct_chats
FROM "Message_v2"
WHERE parts::text LIKE '%"type":"tool-createSnapshot"%';
```

**Результат:**
- `snapshot_calls_alltime` = **2**
- `earliest_ever` = **2026-04-08**
- `latest_ever` = **2026-04-08** (оба в один день)
- `distinct_chats` = **2**

### 2.2 Контекст обоих вызовов

```sql
SELECT m."chatId", c."title", c."projectId", c."chatMode"
FROM "Message_v2" m LEFT JOIN "Chat" c ON c."id" = m."chatId"
WHERE m.parts::text LIKE '%"type":"tool-createSnapshot"%';
```

| chatId | title | projectId | chatMode |
|---|---|---|---|
| `c3bca966` | "Simply" | **NULL** | `simply` |
| `d441f9b0` | "Новый чат" | **NULL** | `simply` |

**Оба вызова — из Simply Chat, оба без projectId.** 0 вызовов из project task expert — т.е. контекста для которого SPEC предполагал tool'у «alive». `callProviderMetadata.anthropic.caller.type = "direct"` подтверждает: оба вызова были через Sonnet (режим «Думать»), не через MiniMax.

### 2.3 Статус вызовов

- `42957d28` (chat `d441f9b0`): `state: "output-available"` — успешно, Sonnet создал snapshot после того как пользователь показал ему screenshot таблицы расходов. Модель сама решила «зафиксировать».
- `3b89ed89` (chat `c3bca966`): `state: "output-error"` — Sonnet сгенерировал **невалидный JSON** в `rawInput` (`{"decisions": \n- ... text ...}` — пробелы в массивах, нет `[`), tool вернул `errorText: "JSON parsing failed: No number after minus sign at position 328"`. Этот вызов не просто бесполезен — он обнажает хрупкость самой tool schema.

### 2.4 `Chat.snapshots` + `Chat.contextState` колонки

```sql
SELECT COUNT(*) total_chats,
       COUNT(*) FILTER (WHERE "snapshots" IS NOT NULL AND jsonb_array_length("snapshots"::jsonb) > 0) with_actual_entries,
       COUNT(*) FILTER (WHERE "contextState" IS NOT NULL) with_context_state
FROM "Chat";
```

**Результат:**
- `total_chats` = **11** (после TZ_LegacyChatCleanup: только simply/expertise/create)
- `with_actual_entries` (snapshots[] > 0) = **1**
- `with_context_state` = **0**

**1 snapshot-запись** на **11 чатов**. `contextState` — **0 использований**. Обе колонки фактически мертвы.

---

## 3. Вывод аудита

**Решение — DELETE.** Обоснования:

1. **Тула не используется в project task expert.** 0 вызовов за всё время (а SPEC предполагал что «может быть используется как fallback для Haiku без Compaction»). Compaction API включён для всех проектных задач независимо от модели → snapshot tool избыточен.
2. **В Simply Chat 2 вызова** — случайные, один failed, другой создан моделью voluntarily без пользовательского запроса. Simply Chat имеет Extract-on-compression (v3.78.0) для памяти — snapshot тут семантически дублирует MIND memory layer.
3. **Хрупкая tool schema.** Из 2 вызовов 1 failed из-за сложного nested input (`artifacts: string[]`, `decisions: string[]`, `nextSteps: string[]`, `openQuestions: string[]`, `currentState: string`, `shortSummary: string`, `fullMarkdown?: string`). Модель легко ошибается в JSON.
4. **DB колонки практически пусты:** 1 запись на 11 чатов. Не представляют ценности данных.
5. **Dead DB functions:** `getChatWithSnapshotState`, `updateChatContextState` — объявлены в queries.ts, **ни одного call-site** в live коде (grep confirmed). `addChatSnapshot` + `resetChatContextState` — вызываются **только из `create-snapshot.ts`**, т.е. из самой удаляемой tool'ы.
6. **Dead prop.** `Messages.snapshots` prop — объявлен в типе, но в `chat.tsx` (единственный caller) **не передаётся**. Вся логика `lastSnapshotIndex` / `fallbackSnapshotInsertIndex` / `dimBoundary` в messages.tsx работает на основе `messages` parts (т.е. на `hasSnapshotToolCall`) — эта часть даст эффект только если tool вызывалась в этом чате. Удалится вместе с tool'ой.

---

## 4. Blast radius (файлы для правки / удаления)

### 4.1 Удаление файлов

| Файл | Обоснование |
|---|---|
| `lib/ai/tools/create-snapshot.ts` | Сам tool definition (единственный caller addChatSnapshot/resetChatContextState) |
| `lib/ai/clerks/snapshot-creator.ts` | Снэпшот-клерк для legacy fallback пути (удалённого в TZ_LegacyChatCleanup). Orphan по смыслу |
| `components/projects/snapshot-card.tsx` | UI карточка + `SnapshotDivider` (единственные импортёры — messages.tsx, message.tsx) |

### 4.2 Правка файлов

| Файл | Что убрать |
|---|---|
| `lib/db/schema.ts` | `SnapshotMeta` type (line 207-), `ContextState` type (если есть отдельно), `snapshots` column (line 244), `contextState` column (line 245) из `chat` table |
| `lib/db/queries.ts` | `getChatWithSnapshotState` (2541-2559), `addChatSnapshot` (2561-2590), `updateChatContextState` (2594-2610), `resetChatContextState` (2614-2623) функции. Плюс `sql<null>` стабы `snapshots` / `contextState` в selects (лines 418-419) |
| `lib/ai/tools/chat-tools.ts` | import line 11, tool entry line 64, messageId param + JSDoc line 31-32, `"createSnapshot"` из ALL_TOOL_NAMES (line 133), из isProjectChat branch (line 164), из baseTools (line 181) |
| `app/(chat)/api/chat/route.ts` | Outdated comments (lines 40, 69-71, 463-465, 779-781) — они уже говорят «snapshot пути удалены» после TZ_LegacyChatCleanup, но этот ТЗ закрывает оставшиеся концы. Плюс: `hasSnapshotContext: false` (line 812), comment про «messageId upfront для snapshot tool» (line 830-ish), branch `type === 'tool-createSnapshot'` в фильтре parts (lines 1435-1438). Удалить `messageId` param из getStandardTools call |
| `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` | `hasSnapshotContext: false` (line 284), branch `|| type === "tool-createSnapshot"` в фильтре (line 688), `messageId` param из getStandardTools call |
| `components/messages.tsx` | imports `SnapshotMeta`, `SnapshotDivider` (lines 6, 16), `hasSnapshotToolCall` функцию (lines 19-25), `snapshots` prop в тип (lines 37-38), destructuring (line 71), `lastSnapshotIndex`/`fallbackSnapshotInsertIndex` useMemo (lines 84-120), `dimBoundary` (line 123), Divider JSX (lines 144-147), rerender check (lines 217-220) |
| `components/message.tsx` | imports `SnapshotCard`, `SnapshotDivider`, `SnapshotData` (lines 28-29), branch `type === "tool-createSnapshot"` (lines 544-566) |
| `components/chat-sidebar.tsx` | `SidebarSnapshot` interface (line 45), `snapshots` в useMemo reducer (lines 168-194), `snapshots` в return (195), `snapshots` в destructuring callsite (line 239), section JSX (lines 279-310), `isEmpty` условие (line 241), `handleSnapshotClick` (lines 251-253) |
| `scripts/debug-orphan-tool-use.ts` | Оставить как есть — это standalone debug fixture с inline tool-createSnapshot data, не импортирует tool, удалится естественно когда debug необходимость пропадёт |
| `docs/ai-chats-map.md` | Упоминания createSnapshot — заменить на «tool removed in v3.87.3» либо удалить строку |
| `docs/ai-tools.md` | То же |
| `docs/ai-agents.md` | То же |
| `TOOLS_AUDIT.md` | Обновить — createSnapshot убран |

### 4.3 Миграция БД

Новый файл `lib/db/migrations/0054_drop-snapshot-columns.sql` (сгенерируется через `npm run db:generate`):
```sql
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "snapshots";
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "contextState";
```

Ревью ожидаемый — Drizzle может сгенерировать в другом формате, но эффект тот же.

### 4.4 НЕ ТРОГАТЬ (ложные срабатывания grep)

Файлы в `_archive/**`, `specs/TZ_RAG_SimplyRAG/**`, `specs/_backlog/README.md` — исторические документы, не live код. Обновляются только CLAUDE.md/SIMPLY_STATUS.md/CHANGELOG.md в финализации.

---

## 5. Риски

| # | Риск | Митигация |
|---|---|---|
| R1 | Удаление `snapshots` column теряет 1 реальную запись в одном чате | Принимаем потерю — это orphan data (пользователь теперь этот вид UI не видит, всё равно недостижимо). Перед migration делаем commit с удалением кода → `v3.87.3` tag → если что-то обнаружим — rollback через `git reset --hard v3.87.2` и откат миграции |
| R2 | Drizzle generate сгенерирует неожиданный SQL | После `npm run db:generate` обязательный manual review файла ДО `db:migrate` |
| R3 | tsc упадёт из-за dangling типов `SnapshotMeta`/`SnapshotData` после schema правок | Делаю изменения в порядке зависимостей: сначала удаляю call-sites (routes, components), потом tool, потом queries, потом schema. На каждом шаге `tsc --noEmit` |
| R4 | `messages.tsx` dimming feature теряется | `dimBoundary` был driven исключительно `lastSnapshotIndex`, без snapshot'ов дым-эффекта нет логической основы. Удаляем чисто |
| R5 | `debug-orphan-tool-use.ts` после удаления tool типов даст TS ошибку | Inline данные + `as any`, не импортирует сам createSnapshot. Проверить после tsc |
| R6 | Neon Postgres DROP COLUMN locking | 11 строк, DROP COLUMN мгновенен. Без рисков |
| R7 | Confuse с уже существующими ТЗ-LegacyChatCleanup комментариями в `chat/route.ts` (они уже говорят что query функции dead) | Хорошо — эти комментарии становятся ненужны после этого ТЗ, удаляются вместе с кодом |

---

## 6. Definition of Done

1. 4 функции в queries.ts удалены
2. `create-snapshot.ts`, `snapshot-creator.ts`, `snapshot-card.tsx` удалены
3. `chat-tools.ts` — createSnapshot везде вычищен
4. Оба chat routes — фильтры и комментарии обновлены
5. 3 компонента — dead prop + rendering branches убраны
6. Schema — 2 колонки + 1 тип удалены
7. Миграция `0054_drop-snapshot-columns.sql` сгенерирована, приревьюена, применена
8. docs/ обновлены
9. `tsc --noEmit` = 0 ошибок
10. `npm run build` = exit 0
11. SQL-проверка после миграции: `SELECT column_name FROM information_schema.columns WHERE table_name = 'Chat'` — колонки отсутствуют
12. Smoke-тест (с пользователем): Simply Chat + одна project task expert задача отправляют сообщения, отвечают нормально
13. CHANGELOG.md/SIMPLY_STATUS.md/CLAUDE.md/backlog обновлены, архив, release commit, tag `v3.87.3`

---

## 7. Оценка времени

SPEC сказал 0.5 сессии. Реалистично — **~1 сессия** из-за ширины blast radius:
- Audit + analysis: ~20 мин ✅ (уже почти закончено)
- ROADMAP: ~5 мин
- Код cleanup (5 удалений файлов + ~10 правок + миграция): ~30 мин
- tsc/build: ~5 мин
- Smoke test с пользователем: ~5-10 мин
- Финализация (docs + archive + commit): ~15 мин

Итого **~90 мин** чистого времени. Не критично — задача однозначно в скоупе.
