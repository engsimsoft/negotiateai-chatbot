# Changelog ТЗ-07: Tool Activity UX

## Сессия 3 — 2026-02-15

### Refactored
- **Единая архитектура группировки** — один `groupedToolActivities` useMemo вместо двух render-путей
- **Чистый презентационный компонент** — ToolActivityIndicator принимает `isActive`, `count`, `summary`, `details[]` (вся логика вычисляется в message.tsx)
- Catch-all в message.tsx теперь `return null` для TOOL_ACTIVITY_CONFIG tools

### Added
- `resultCounter` в ToolActivityConfig — для агрегации числовых результатов параллельных вызовов
- Бейдж `×N` для параллельных вызовов одного инструмента
- Раскрываемый список деталей (queries) при клике на завершённый индикатор
- Агрегированный summary ("35 результатов" вместо 8 отдельных)

### Changed
- Loader спиннер (animate-spin) вместо animate-pulse для активного состояния

## Сессия 2 — 2026-02-15

### Added
- Backend: перехват `tool-input-start` → `data-tool-activity` events (chat + task expert routes)
- Client: потребление из `useDataStream()` + рендеринг активных индикаторов
- Скрытие пустого assistant message при streaming (double avatar fix)
- Подавление ThinkingMessage при наличии tool activity
- Очистка stale data-tool-activity событий (chat.tsx, task-chat.tsx)
- `"tool-activity"` в CustomUIDataTypes (lib/types.ts)

### Fixed
- min-h-96 отключен при `isLoading` (384px пустого пространства)
- Правильный event type: `tool-input-start` (не `tool-call`)

## Сессия 1 — 2026-02-15

### Added
- SPEC.md — ссылка на ТЗ
- ANALYSIS.md — код-ревью с 7 рекомендациями (все согласованы)
- ROADMAP.md — 3 этапа
- CHANGELOG.md
- HANDOFF.md
