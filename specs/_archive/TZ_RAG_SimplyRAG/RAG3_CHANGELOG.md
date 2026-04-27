# Changelog ТЗ-RAG3: Compaction — Бесконечный чат

## Сессия 1 — 2026-04-07

### Added
- Compaction API (`compact_20260112`) включён для Sonnet/Opus routes (expertise, create, project tasks)
- `DebugCompactionData` тип + `emitDebugCompaction()` в debug-events.ts
- Compaction badge в DevPanel footer (amber)
- Compaction info в DevPanel model-section (triggered/not + iterations breakdown)
- `originalMessages: uiMessages` в `createUIMessageStream` (chat + task routes) — активация persistence mode

### Fixed
- **Критический баг:** сообщения ассистента не сохранялись в БД — SDK без `originalMessages` не активировал persistence mode
- **Duplicate key error:** с `originalMessages` SDK возвращал ВСЕ сообщения в onFinish — добавлена фильтрация новых
- **Type error:** `originalMessages` ужесточил типизацию `UIMessageStreamWriter` — professor events приведены через `(dataStream as any)`
- **Haiku crash:** Compaction API не поддерживается Haiku 4.5 — добавлена условная логика `supportsCompaction`

### Changed
- ROADMAP переработан: вместо "удалить snapshot полностью" → "двойная система: snapshot для Haiku, compaction для Sonnet/Opus"
- Оценка сложности скорректирована с учётом Haiku-ограничения

### Files
- `app/(chat)/api/chat/route.ts`
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts`
- `lib/ai/debug-events.ts`
- `components/dev-panel/dev-panel-provider.tsx`
- `components/dev-panel/dev-panel-footer.tsx`
- `components/dev-panel/sections/model-section.tsx`
- `specs/TZ_RAG_SimplyRAG/RAG3_ANALYSIS.md`
- `specs/TZ_RAG_SimplyRAG/RAG3_ROADMAP.md`
- `specs/TZ_RAG_SimplyRAG/RAG3_CHANGELOG.md`
- `specs/TZ_RAG_SimplyRAG/RAG3_HANDOFF.md`
