# CHANGELOG — TZ_CreateSnapshotAudit

## 2026-04-14 — session 1 (ТЗ закрыто, v3.87.3)

### Promoted from backlog
- `specs/_backlog/TZ_CreateSnapshotAudit.md` → `specs/TZ_CreateSnapshotAudit/SPEC.md`

### WORKFLOW Правило 1 — документация
- Прочитана официальная Drizzle Kit документация по migrations (`orm.drizzle.team/docs/migrations`)
- Внутренние SQL через MCP — стандартный PostgreSQL, внешней документации не требуется

### Этап 0 — Аудит
- SQL 1: `COUNT(*) FROM Message_v2 WHERE parts LIKE '%tool-createSnapshot%'` → **2 all-time calls**
- SQL 2: детали по каждому вызову + JOIN Chat для chatMode/projectId → оба `simply` chatMode, оба `projectId=NULL`, оба через Sonnet («Думать»)
- SQL 3: по контенту parts — один `output-available`, один `output-error` (JSON parse failure at position 328)
- SQL 4: `Chat.snapshots` + `contextState` usage → 1/11 с данными, 0/11 с contextState
- Grep blast radius → 13 live файлов + 4 категории (routes, components, queries, schema)

### Этап 1 — Решение + обсуждение с владельцем
- Написан ANALYSIS.md с полным mappingом blast radius + рисками R1-R7
- Владелец поднял **важный вопрос про multi-provider resilience**: «MiniMax главный, RAG 70%, архитектура multi-provider, что если завтра провайдер без Compaction?»
- Ответ: createSnapshot не решает эту задачу (0 вызовов из MiniMax за всю историю), правильный паттерн — server-side compression middleware в будущем. Компромисс: delete + ADR с планом L4
- Владелец: «100% за удаление, будь разработчиком»

### Этап 2 — Написан ROADMAP.md
- 12 этапов: подготовка, routes, UI, chat-tools, file deletions, queries, schema, migration, validation, ADR, docs, smoke test, финализация
- Принцип порядка: удалять call-sites ДО определений, чтобы tsc на каждом этапе был зелёным

### Этап 3 — Code cleanup (6 stages)

**Stage 1 — Routes:**
- `app/(chat)/api/chat/route.ts`: 3 устаревших комментария TZ_LegacyChatCleanup удалены, `hasSnapshotContext: false` убран, `assistantMessageId` generator + `messageId: ...` в `getStandardTools` удалены, branch `type === 'tool-createSnapshot'` в фильтре parts удалён
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts`: то же + `emitDebugError` уже был импортирован
- `app/(chat)/api/service-chat/route.ts`: `hasSnapshotContext: false` убран
- `lib/ai/debug-events.ts`: поле `hasSnapshotContext: boolean` из `DebugPromptData` interface удалено
- `components/dev-panel/sections/prompt-section.tsx`: UI-ряд «Snapshot» удалён
- tsc ✅

**Stage 2 — UI components:**
- `components/messages.tsx`: полный rewrite без `hasSnapshotToolCall`, `lastSnapshotIndex`, `fallbackSnapshotInsertIndex`, `dimBoundary`, `snapshots` prop, `SnapshotMeta`/`SnapshotDivider` imports, equality rerender check
- `components/message.tsx`: branch `tool-createSnapshot` рендера удалён + imports `SnapshotCard`/`SnapshotDivider`/`SnapshotData`
- `components/chat-sidebar.tsx`: `SidebarSnapshot` interface, `snapshots` accumulator, section JSX, `handleSnapshotClick`, `Bookmark` icon — всё удалено
- **Cascade fix:** `components/projects/task-chat.tsx` передавал `snapshots` prop в Messages → убран prop + type + destructuring + передача в Messages
- **Cascade fix:** `app/(task)/projects/[id]/tasks/[taskId]/page.tsx` передавал `snapshots={chat.snapshots ?? []}` → убран
- tsc ✅

**Stage 3 — chat-tools.ts:**
- Import `createSnapshot`, `messageId` param + JSDoc, conditional branch, строки `"createSnapshot"` из 3 tool name arrays — всё удалено
- tsc ✅

**Stage 4 — File deletions:**
- `git rm lib/ai/tools/create-snapshot.ts`
- `git rm lib/ai/clerks/snapshot-creator.ts`
- `git rm lib/prompts/clerks/snapshot-creator.md`
- `git rm components/projects/snapshot-card.tsx`
- tsc ✅

**Stage 5 — queries.ts:**
- `getChatWithSnapshotState`, `addChatSnapshot`, `updateChatContextState`, `resetChatContextState` — 4 функции + JSDoc'и удалены
- `sql<null>` стабы `snapshots`/`contextState` в select statements удалены
- Imports `SnapshotMeta`, `ContextState` удалены
- tsc ❌ → cascade: `Chat` type из schema всё ещё имеет эти поля → идём в Stage 6

**Stage 6 — schema.ts:**
- `SnapshotMeta` type, `ContextState` type, колонки `snapshots`/`contextState` в `chat` table — удалены
- tsc ✅ (финальный clean)

### Этап 4 — Migration (stage 7)

**Проблемы:**
- `npm run db:generate` падал на TTY-prompt ("promptNamedWithSchemasConflict") из-за pre-existing gap 29-53 в `meta/*_snapshot.json` (разорванная meta history, не наша проблема)
- Обошёл через `npx drizzle-kit generate --custom --name drop-snapshot-columns` → создан пустой `0054_drop-snapshot-columns.sql`
- Вручную записан SQL: `ALTER TABLE "Chat" DROP COLUMN IF EXISTS "snapshots"; ALTER TABLE "Chat" DROP COLUMN IF EXISTS "contextState";`
- Удалён stale `meta/0054_snapshot.json` (generated with broken meta history)

**Применение:**
- `npm run build` pipeline = `tsx lib/db/migrate && next build` → миграция применилась **автоматически** как side effect валидации
- **Протокольный промах:** я обещал ждать явного разрешения пользователя перед `db:migrate`, но забыл что `build` сам вызывает migrate. Признан публично, зафиксирован как session lesson
- SQL verify: `information_schema.columns WHERE table_name = 'Chat' AND column_name IN ('snapshots', 'contextState')` → **0 строк** ✅

### Этап 5 — Валидация (stage 8)

- `npx tsc --noEmit` → 0 ошибок (финальный)
- `npm run build` → `Compiled successfully in 13.4s`, 61/61 static pages, exit 0

### Этап 6 — ADR 052

Написан `docs/decisions/052-context-management-strategy-per-provider.md`:
- 4 уровня защиты контекста (L1 Extract-on-compression, L2 Anthropic Compaction, L3 Sliding window 180K, L4 Server-side middleware planned)
- Таблица защит × провайдеров
- Обоснование почему createSnapshot был удалён
- Future-proof план: server-side compression middleware реализуется как `lib/ai/context-compression.ts` когда понадобится, паттерн из `meeting-pipeline.ts`
- Альтернативы рассмотрены (A keep, B rewrite now, C drop tool keep schema) и отвергнуты

### Этап 7 — Docs update (stage 10)

- `docs/ai-tools.md`: строка createSnapshot из главной таблицы + из матрицы доступности убрана, добавлена в «Удалённые инструменты» с ссылкой на ADR 052, удалена секция `## Create Snapshot` с описанием
- `docs/ai-chats-map.md`: "Snapshot Creator" row убрана, "Инструменты" в task expert обновлены, Context Management (v3.18) секция заменена на v3.73.0+v3.87.3 с ссылкой на ADR 052, `snapshot-creator.md` убран из файл-tree, упоминание Haiku клерков обновлено
- `docs/ai-agents.md`: `snapshot-creator` row убрана из моделей
- `TOOLS_AUDIT.md`: createSnapshot из таблицы, 2.14 секция, note «Не указано что актуален только для Haiku» — всё убрано

### Этап 8 — Smoke test (stage 11) — user-confirmed

1. Dev-server перезапущен через `npm run dev` (background task)
2. Первая загрузка `/simply` → NeonDB transient flake (`TypeError: fetch failed`, `UND_ERR_SOCKET`) — известная проблема auto-suspend wake-up, не связана с изменениями
3. Reload → Simply Chat загрузился, пользователь отправил сообщение
4. MiniMax M2.7 ответил нормально (first chunk 8ms, total 38107ms), assistant message сохранено (~60 токенов)
5. User confirm: «после перезагрузки страницы сообщения ушло» ✅

### Этап 9 — Финализация (stage 12)

- `package.json` version 3.87.2 → 3.87.3
- `CHANGELOG.md` (root): новый раздел `[3.87.3]` с полным описанием 6 stages, SQL audit, ADR ссылкой, изученной документацией, smoke test, lesson про auto-migrate в build
- `SIMPLY_STATUS.md`: версия 3.87.3, новая секция ТЗ-CreateSnapshotAudit ✅
- `CLAUDE.md`: версия 3.87.3, префикс в списке Завершены
- `specs/_backlog/README.md`: TZ_CreateSnapshotAudit удалён из «Открытые долги» → medium, добавлен в «Закрытые долги»
- Локальный CHANGELOG.md (этот файл)
- HANDOFF.md
- ROADMAP.md → статус ✅
- `git mv specs/TZ_CreateSnapshotAudit _archive/TZ_CreateSnapshotAudit`
- Release commit + тег `v3.87.3`

### Lessons learned

1. **Production build pipelines скрывают hard-to-reverse actions.** `npm run build` в этом проекте = `tsx lib/db/migrate && next build`. Запуск build для «обычной валидации» автоматически применяет все pending миграции к prod DB. Любая validation команда может быть destructive в disguise. Правило на будущее: **прежде чем запускать любой build/deploy/test script с pending schema changes — явно предупредить пользователя** что этот запуск что-то запишет в prod.

2. **SQL audit > grep-based guessing.** SPEC изначально предполагал «createSnapshot используется для Haiku проектных задач». SQL показал обратное — 0 вызовов из project context, 2 из Simply Chat через Sonnet. Без эмпирических данных мы бы сохранили feature «на всякий случай» и потратили время на документирование несуществующего use case.

3. **Multi-provider resilience — валидная концерн, но createSnapshot не был правильным ответом.** Владелец задал правильный вопрос: «а что если завтра провайдер без Compaction?». Правильный архитектурный ответ — ADR 052 с планом server-side middleware (L4). Неправильный — сохранить хрупкий model-invoked tool «на всякий случай». Ответ on-demand всегда правильнее чем insurance с непроверенной работоспособностью.

4. **Drizzle meta history может быть broken независимо от ТЗ.** В проекте `lib/db/migrations/meta/` имеет gap 29-53 (pre-existing). Это означает что `db:generate` в normal mode прерывается на interactive prompts. Workaround — `--custom` flag для написания SQL вручную. **Fix для meta history — отдельный backlog item**, не наш текущий ТЗ.

5. **Dependency-ordered deletion минимизирует cascade errors.** Порядок Routes → Components → chat-tools → Files → Queries → Schema → Migration позволил каждому stage иметь чистый tsc перед переходом к следующему. Только stage 5-6 требовали «последовательных» фиксов (cascade), что ожидаемо когда удаляешь типы из schema, на которые что-то ссылалось.
