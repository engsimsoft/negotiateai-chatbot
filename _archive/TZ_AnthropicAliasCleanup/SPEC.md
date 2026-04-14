# ТЗ-AnthropicAliasCleanup

**Импакт:** low · **Оценка:** 0.3 сессии · **Создано:** 2026-04-14

## Контекст

В каталоге моделей 9 Anthropic-записей (4 физические + 5 alias). Из них 3 — dead code, подтверждено SQL-аудитом и grep-разведкой кодовой базы (2026-04-14, в ходе TZ_ModelCatalogDocumentFlags).

## Что удалить

### 1. `title-model` (alias → claude-haiku-4-5-20251001)

- Определён в [lib/ai/model-catalog.ts:313-324](../../lib/ai/model-catalog.ts#L313)
- **0 usages** в коде (grep `"title-model"` по *.ts/*.tsx)
- task-assignments использует прямо `"claude-haiku-4-5-20251001"` для `util:title` (строка 147)
- Был живым до ТЗ-1 CoreRegistry (v3.83.0), после миграции на task IDs забыт

### 2. `artifact-model` (alias → claude-sonnet-4-6)

- Определён в [lib/ai/model-catalog.ts:329-340](../../lib/ai/model-catalog.ts#L329)
- **0 usages** в коде
- Единственное упоминание — комментарий в [task-assignments.ts:139](../../lib/ai/task-assignments.ts#L139): «совпадает с прежним "artifact-model" алиасом». Там тоже прямо используется `"claude-sonnet-4-6"` для всех 5 artifact типов (строки 140-144)
- Удалить нужно комментарий тоже

### 3. `claude-sonnet-4-5-20250929` (physical legacy snapshot)

- Определён в [lib/ai/model-catalog.ts:255-266](../../lib/ai/model-catalog.ts#L255) с notes «Legacy snapshot; kept for historical ai_usage_log cost calc»
- **0 usages** в коде (grep)

**SQL-аудит ai_usage_log (2026-04-14):**
```sql
SELECT "modelId", COUNT(*), MIN("createdAt"), MAX("createdAt")
FROM ai_usage_log
WHERE "modelId" LIKE '%sonnet-4-5%'
GROUP BY "modelId";
```
Результат:
| modelId | count | first | last |
|---|---|---|---|
| claude-sonnet-4-5-20250929 | **2** | 2026-02-25 | 2026-04-06 |

Только 2 записи за всё время. Последняя — неделю назад.

**Удаление БЕЗОПАСНО для historical cost calc**, потому что:
1. Pricing `claude-sonnet-4-5-20250929` (`$3/$15/$0.3/$3.75`) **идентичен** `claude-sonnet-4-6` (`$3/$15/$0.3/$3.75`)
2. `getModelEntry` в [model-catalog.ts:540-551](../../lib/ai/model-catalog.ts#L540) имеет tolerant walk-back loop: `claude-sonnet-4-5-20250929` → strip `-20250929` → `claude-sonnet-4-5` → strip `-4-5` → `claude-sonnet` (alias) → resolve → `claude-sonnet-4-6` → тот же pricing
3. Historical cost для этих 2 записей останется корректным

## Что ОСТАВИТЬ

**НЕ удалять** `claude-sonnet` / `claude-haiku` / `claude-opus` aliases — они **живые** и используются в 10+ местах UI-слоя:

| Файл | Использование |
|---|---|
| [components/dev-panel/dev-panel-footer.tsx:12-14](../../components/dev-panel/dev-panel-footer.tsx#L12) | DevPanel labels mapping |
| [components/dev-panel/sections/model-section.tsx:7-9](../../components/dev-panel/sections/model-section.tsx#L7) | DevPanel label mapping |
| [components/projects/task-chat.tsx:272,308,347](../../components/projects/task-chat.tsx#L272) | `selectedModelId="claude-sonnet"` |
| [components/input/input-context.tsx:96](../../components/input/input-context.tsx#L96) | `defaultModelId = "claude-sonnet"` |
| [components/input/compact-input.tsx:55](../../components/input/compact-input.tsx#L55) | `defaultModelId = "claude-sonnet"` |
| [components/service-chat/configs/briefing-onboarding.ts:21](../../components/service-chat/configs/briefing-onboarding.ts#L21) | service chat config |
| [components/service-chat/configs/ben.ts:22](../../components/service-chat/configs/ben.ts#L22) | service chat config |
| [components/service-chat/configs/project-creation.ts:22](../../components/service-chat/configs/project-creation.ts#L22) | service chat config |
| [components/service-chat/configs/project-manager.ts:21](../../components/service-chat/configs/project-manager.ts#L21) | service chat config |
| [components/service-chat/types.ts:49](../../components/service-chat/types.ts#L49) | type `model: "claude-haiku" \| "claude-sonnet"` |

**Почему это не tech debt, а валидный паттерн:**
- task-assignments использует физические snapshot IDs (`claude-sonnet-4-6`) для точности cost tracking и cache invalidation
- UI-слой использует семантические alias (`claude-sonnet`) — при смене физической модели UI не нужно трогать, alias указывает на current default
- Два параллельных use case, каждый оправдан

## Definition of Done

- `title-model` entry удалён из `model-catalog.ts`
- `artifact-model` entry удалён из `model-catalog.ts` + комментарий в `task-assignments.ts:139`
- `claude-sonnet-4-5-20250929` entry удалён из `model-catalog.ts`
- `npx tsc --noEmit` → 0 ошибок
- `npm run build` → успешно
- CHANGELOG entry с ссылкой на SQL-аудит (2 вызова legacy snapshot за всю историю)
- Bump patch: v3.87.4 → v3.87.5

## Риски

- **Минимальные.** Все 3 entry не имеют consumers. Walk-back loop в `getModelEntry` обеспечит корректный fallback для любых будущих запросов с устаревшим `claude-sonnet-4-5-20250929` modelId (в БД 2 записи уйдут через fallback на current Sonnet pricing, который идентичен)
- Если в будущем кто-то захочет сравнить historical cost Sonnet 4.5 vs 4.6 — данных уже нет (всего 2 строки, не статистика)
