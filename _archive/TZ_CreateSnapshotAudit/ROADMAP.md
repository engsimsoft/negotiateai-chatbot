# ROADMAP — TZ_CreateSnapshotAudit

**Цель:** полностью удалить мёртвую фичу createSnapshot + задокументировать стратегию context management per provider в ADR 052.

**Статус:** ✅ ЗАВЕРШЕНО (v3.87.3, 2026-04-14)
**Версия:** v3.87.3
**Начато:** 2026-04-14
**Закрыто:** 2026-04-14

> Все этапы 0-12 выполнены. Подробности в [CHANGELOG.md](CHANGELOG.md) и [HANDOFF.md](HANDOFF.md).

---

## Этап 0 — Подготовка ✅

- [x] SQL audit (2 all-time calls, 0 в project task expert, 1 snapshot record в 1 чате, 0 contextState)
- [x] Blast radius mapping (13 живых файлов + миграция)
- [x] Schema check (snapshots + contextState колонки в Chat)
- [x] WORKFLOW правило 1 — Drizzle migration docs прочитаны
- [x] ANALYSIS.md написан с решением DELETE
- [x] Пользователь подтвердил опцию A (delete + ADR)

---

## Этап 1 — Stage 1: Call sites в routes ⬜

**Принцип порядка:** удаляем call-sites СНАЧАЛА, только потом удаляем сами определения функций/файлов/schema. Так на каждом промежуточном tsc не будет orphan references.

### 1.1 `app/(chat)/api/chat/route.ts`
- [ ] Удалить outdated комментарии: line 40, 69-71, 463-465, 779-781 (они говорят про LegacyChatCleanup follow-up — этот follow-up — наш ТЗ)
- [ ] Удалить `hasSnapshotContext: false` поле (line 812)
- [ ] Удалить "ТЗ-C3: Generate assistant message ID upfront (needed for snapshot tool)" комментарий (~line 830), но **оставить** сам messageId generation если он используется для других целей (проверить)
- [ ] Удалить branch `if (type === 'tool-createSnapshot')` в фильтре parts (lines 1435-1438)
- [ ] В вызове `getStandardTools` убрать `messageId` param если больше не нужен
- [ ] `npx tsc --noEmit` → проверить 0 ошибок

### 1.2 `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts`
- [ ] Удалить `hasSnapshotContext: false` (line 284)
- [ ] Убрать `|| type === "tool-createSnapshot"` из фильтра (line 688)
- [ ] В вызове `getStandardTools` убрать `messageId` param если больше не нужен
- [ ] `npx tsc --noEmit` → 0 ошибок

---

## Этап 2 — Stage 2: UI components ⬜

### 2.1 `components/messages.tsx`
- [ ] Убрать `SnapshotMeta` из import schema (line 6)
- [ ] Убрать `SnapshotDivider` import (line 16)
- [ ] Удалить функцию `hasSnapshotToolCall` (lines 19-25)
- [ ] Удалить `snapshots?: SnapshotMeta[]` из типа props (lines 37-38)
- [ ] Удалить `snapshots` из destructuring (line 71)
- [ ] Удалить `lastSnapshotIndex` useMemo (lines 84-95)
- [ ] Удалить `fallbackSnapshotInsertIndex` useMemo (lines 97-120)
- [ ] Удалить `dimBoundary` (line 123) — если использовался только для snapshot dimming, убрать все его ссылки
- [ ] Удалить fallback snapshot divider JSX (lines 144-147)
- [ ] Удалить rerender check на `snapshots` changes (lines 217-220)
- [ ] `npx tsc --noEmit` → 0 ошибок

### 2.2 `components/message.tsx`
- [ ] Убрать `SnapshotCard, SnapshotDivider` из import (line 28)
- [ ] Убрать `type { SnapshotData }` (line 29)
- [ ] Удалить branch `if (type === "tool-createSnapshot")` (lines 544-566)
- [ ] `npx tsc --noEmit` → 0 ошибок

### 2.3 `components/chat-sidebar.tsx`
- [ ] Удалить `SidebarSnapshot` interface (lines 45-ish)
- [ ] Удалить `snapshots` accumulator в `useExtractedMaterials` (lines 168-194)
- [ ] Убрать `snapshots` из return (195)
- [ ] В `ChatSidebar` убрать `snapshots` из destructuring (line 239) и из `isEmpty` (241)
- [ ] Удалить `handleSnapshotClick` callback (lines 251-253)
- [ ] Удалить всю Snapshots section JSX (lines 279-310)
- [ ] `npx tsc --noEmit` → 0 ошибок

---

## Этап 3 — Stage 3: `chat-tools.ts` ⬜

- [ ] Убрать `import { createSnapshot } from "./create-snapshot"` (line 11)
- [ ] Убрать `messageId` из `GetStandardToolsParams` interface (+ JSDoc, line 31-32)
- [ ] Убрать `messageId` из параметров функции `getStandardTools` (line 52)
- [ ] Убрать branch `...(chatId && messageId ? { createSnapshot: ... } : {})` (lines 63-65)
- [ ] Убрать `"createSnapshot"` из `ALL_TOOL_NAMES` (line 133)
- [ ] Убрать `"createSnapshot"` из `isProjectChat` ветки в `getActiveToolNames` (line 164)
- [ ] Убрать `"createSnapshot"` из `baseTools` (line 181)
- [ ] `npx tsc --noEmit` → 0 ошибок

---

## Этап 4 — Stage 4: удаление файлов ⬜

На этом этапе у нас не должно быть ни одного call-site, значит файлы можно смело удалять.

- [ ] `rm lib/ai/tools/create-snapshot.ts`
- [ ] `rm lib/ai/clerks/snapshot-creator.ts` (проверить что нет внешних импортов!)
- [ ] `rm components/projects/snapshot-card.tsx`
- [ ] `npx tsc --noEmit` → 0 ошибок

---

## Этап 5 — Stage 5: `queries.ts` ⬜

- [ ] Удалить `snapshots: sql<null>` stub (line 418)
- [ ] Удалить `contextState: sql<null>` stub (line 419)
- [ ] Удалить функцию `getChatWithSnapshotState` (lines 2541-2559) + её JSDoc
- [ ] Удалить функцию `addChatSnapshot` (lines 2561-2590) + JSDoc
- [ ] Удалить функцию `updateChatContextState` (lines 2594-2610) + JSDoc
- [ ] Удалить функцию `resetChatContextState` (lines 2614-2623) + JSDoc
- [ ] Проверить не осталось ли других call-сайтов для этих функций (grep)
- [ ] `npx tsc --noEmit` → 0 ошибок

---

## Этап 6 — Stage 6: `schema.ts` ⬜

- [ ] Удалить `SnapshotMeta` type (lines 207-ish)
- [ ] Удалить `ContextState` type (если есть отдельно)
- [ ] Удалить `snapshots` колонку из `chat` table (line 244)
- [ ] Удалить `contextState` колонку (line 245)
- [ ] Проверить что нет других ссылок на удалённые типы (`SnapshotMeta`, `ContextState`) в schema
- [ ] `npx tsc --noEmit` → 0 ошибок (ВАЖНО — здесь будут каскадные ошибки если остались call-sites из предыдущих этапов)

---

## Этап 7 — Stage 7: Drizzle migration ⬜

### 7.1 Generate
- [ ] `npm run db:generate`
- [ ] Проверить что создался новый файл `lib/db/migrations/0054_*.sql`
- [ ] **Обязательный review:** открыть файл, убедиться что SQL содержит только `DROP COLUMN` для `snapshots` и `contextState` в таблице `Chat`
- [ ] **НЕ применять если в файле есть что-то неожиданное** — показать пользователю

### 7.2 Apply
- [ ] `npm run db:migrate`
- [ ] SQL verification через MCP:
  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'Chat' AND column_name IN ('snapshots', 'contextState');
  ```
  Ожидаемый результат: 0 строк

---

## Этап 8 — Валидация ⬜

- [ ] `npx tsc --noEmit` → 0 ошибок (финальный check)
- [ ] `npm run build` → exit 0 (prod build + migrations)
- [ ] Визуальный diff review всех изменённых файлов через `git diff --stat`

---

## Этап 9 — ADR 052 ⬜

- [ ] Создать `docs/decisions/052-context-management-strategy-per-provider.md`
- [ ] Содержание:
  - Context window per provider (MiniMax, Anthropic, xAI, OpenRouter, Gemini)
  - Защитные механизмы: Compaction (Anthropic only), Extract-on-compression (provider-agnostic), Sliding window 180K (provider-agnostic)
  - Таблица защит × провайдеров
  - Почему createSnapshot был удалён (2 all-time calls, model-invoked, fragile schema, 0 for MiniMax main model)
  - **Future-proof план:** если в будущем нужна provider-agnostic компрессия — реализуется как server-side middleware в `lib/ai/context-compression.ts` (а не через tool): pre-streamText → cheap model (Haiku/similar) summarizes old → insert в system prompt → truncate history. Триггер: `contextFillRatio > 0.7 && !hasCompaction && extractOnCompressionInsufficient`. Паттерн уже используется в `lib/meeting/meeting-pipeline.ts` для расшифровок встреч
  - Ссылка на этот ТЗ как источник решения

---

## Этап 10 — docs обновление ⬜

- [ ] `docs/ai-tools.md` — убрать createSnapshot из списка
- [ ] `docs/ai-chats-map.md` — убрать упоминания
- [ ] `docs/ai-agents.md` — убрать упоминания
- [ ] `TOOLS_AUDIT.md` (root) — убрать
- [ ] Проверить что нет других live docs с устаревшими упоминаниями (live ≠ _archive)

---

## Этап 11 — Smoke test с пользователем ⬜

**С владельцем:**
1. Dev-сервер hot-reload подхватил правки
2. Открыть `/simply` → отправить 2-3 нормальных сообщения → ответы идут нормально, ничего не сломано
3. Открыть какой-нибудь активный project task (`/projects/[id]/tasks/[taskId]`) → отправить сообщение → ответ идёт нормально
4. Открыть ChatSidebar справа (если есть материалы) → убедиться что секция «Итоги» отсутствует, артефакты/вложения остались
5. Никаких TypeScript ошибок в браузере, никаких 500 в dev logs
6. Подтверждение пользователем → ✅

---

## Этап 12 — Финализация ⬜

- [ ] `package.json` version → 3.87.3
- [ ] Root `CHANGELOG.md` — новый раздел `[3.87.3]` с Fixed/Removed/Architectural
- [ ] `SIMPLY_STATUS.md` — версия 3.87.3, новая секция ТЗ-CreateSnapshotAudit ✅
- [ ] `CLAUDE.md` — версия 3.87.3, префикс в списке Завершены
- [ ] `specs/_backlog/README.md` — удалить TZ_CreateSnapshotAudit из «Открытые долги», добавить в «Закрытые»
- [ ] Локальный `CHANGELOG.md` в папке ТЗ
- [ ] `HANDOFF.md`
- [ ] `ROADMAP.md` → статус ✅
- [ ] `git mv specs/TZ_CreateSnapshotAudit _archive/TZ_CreateSnapshotAudit`
- [ ] Release commit `release(v3.87.3): ТЗ-CreateSnapshotAudit — delete dead snapshot tool + ADR 052`
- [ ] Тег `v3.87.3` — recovery point

---

## Риски / подстраховки

- **Неожиданный generate output** — если Drizzle сгенерирует что-то помимо DROP COLUMN для 2 колонок — останавливаюсь, показываю пользователю, обсуждаем
- **Rollback**: до Этапа 7 (migration) всё легко откатить через `git reset --hard v3.87.2`. После migration — откат требует обратной миграции. Commit перед generation/migrate — отдельный reset-point
- **Каскадные tsc ошибки** при удалении schema — ожидаемо если порядок этапов сбит. Ловим на этапе 6 и исправляем ретроактивно
- **Smoke test** — если что-то ломается в проектных чатах, rollback к pre-migrate commit и re-plan
