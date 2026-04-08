# Changelog ТЗ-SimplyToolsMinimax

## Сессия 1 — 2026-04-08

### Added
- `stripMediaPartsForTextModel()` в route.ts — фильтрация image/file parts из истории для текстовых моделей
- `SIMPLY_MODE_EXCLUDED_TOOLS` в chat-tools.ts — список исключённых tools для simply (`deepResearch`)
- Параметр `think` в `getActiveToolNames()` — различает simply и simply+think

### Changed
- route.ts:870-874 — убрана блокировка tools для `isSimplyNonAnthropicModel`
- route.ts:869 — `stopWhen: stepCountIs(5)` теперь для всех моделей
- route.ts:865 — для MiniMax image/file заменяются на плейсхолдеры

### Files
- `lib/ai/tools/chat-tools.ts`
- `app/(chat)/api/chat/route.ts`
- `docs/ai-tools.md`
- `TOOLS_AUDIT.md`
- `CHANGELOG.md`
- `SIMPLY_STATUS.md`
- `CLAUDE.md`
- `package.json`
