# Changelog ТЗ-SaveFact

## Сессия 1 — 2026-04-07

### Added
- Миграция `0050_save-fact-source.sql` — колонка `source` в `memory_entry`
- Тип `MemorySource` в `lib/ai/memory/types.ts`
- Tool `saveFact` в `lib/ai/tools/save-fact.ts`
- Tool activity config (Brain icon, "Сохраняю в память")
- Блок `<memory>` в промпте Simply Chat

### Changed
- `lib/db/schema.ts` — добавлена колонка `source`
- `lib/ai/memory/memory-queries.ts` — передача `source` в insert/select
- `lib/ai/memory/extract.ts` — явный `source: "extracted"`
- `lib/ai/tools/chat-tools.ts` — регистрация saveFact для chatMode=simply
- `lib/prompts/chat/simply-chat.md` — `<quick_commands>` → `<memory>`

### Files
- lib/db/migrations/0050_save-fact-source.sql
- lib/db/migrations/meta/_journal.json
- lib/db/schema.ts
- lib/ai/memory/types.ts
- lib/ai/memory/memory-queries.ts
- lib/ai/memory/extract.ts
- lib/ai/tools/save-fact.ts (NEW)
- lib/ai/tools/chat-tools.ts
- lib/ai/tool-activity-config.ts
- lib/prompts/chat/simply-chat.md
- docs/ai-tools.md
- CHANGELOG.md
- SIMPLY_STATUS.md
- CLAUDE.md
- package.json
