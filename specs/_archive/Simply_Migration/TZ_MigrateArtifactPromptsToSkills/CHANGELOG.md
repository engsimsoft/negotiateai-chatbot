# Changelog ТЗ-MigrateArtifactPromptsToSkills

## Сессия 1 — 2026-04-27 (закрытие ТЗ, v3.99.3)

### Added
- 10 новых .md файлов с inline-промптами артефактов в `lib/prompts/skills/artifact-generation/<kind>/`
- `loader.ts` с `loadArtifactSkill(kind, op, vars?)` API через существующий `render()` из template.ts
- `scripts/integrity-artifact-skills.ts` — substring containment check для excel/pptx/reveal
- 7 новых записей в `specs/_backlog/` (1 critical: SimplyChatMemoryRegression; 4 high; 2 medium)

### Changed
- 5 server.ts артефактов: inline промпты заменены на `loadArtifactSkill()` вызов
- docs/ai-artifacts.md: новый раздел «System-промпты артефактов»
- docs/ai-agents.md: категория `artifact-generation` в структуре skills
- docs/architecture.md: упоминание новой папки в Prompt System
- CHANGELOG.md (главный): запись v3.99.3
- SIMPLY_STATUS.md: версия 3.99.3, обновлены compoenents + backlog
- package.json: 3.99.2 → 3.99.3
- scripts/README.md: добавлена секция Integrity Scripts

### Removed
- `lib/ai/artifact-prompts.ts` (единственная функция инлайнится через loader)
- inline констант `EXCEL_SYSTEM_PROMPT`, `PPTX_SYSTEM_PROMPT`, `PRESENTATION_SYSTEM_PROMPT`
- inline create-промптов в text/server.ts и markdown/server.ts
- мёртвый импорт `updateDocumentPrompt` из presentation-reveal/server.ts
