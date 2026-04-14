# HANDOFF — TZ_AnthropicAliasCleanup

**Статус:** ✅ ЗАВЕРШЁН (v3.87.5, 2026-04-14)
**Исходник:** [SPEC.md](SPEC.md)
**Сессия:** одна сессия, follow-up к TZ_ModelCatalogDocumentFlags (v3.87.4)

## Контекст появления

При работе над TZ_ModelCatalogDocumentFlags (v3.87.4) пользователь увидел в UI `/dev/models` 9 Anthropic catalog entries и задал вопрос «почему так много и почему дубликаты». Разведка кодовой базы + SQL-аудит `ai_usage_log` показали, что 3 из 9 — dead code после миграции на ТЗ-1 CoreRegistry (v3.83.0). Решили закрыть сразу, пока контекст в памяти.

## Что сделано

### Удалено (3 entry)

1. **`title-model`** — alias → claude-haiku-4-5-20251001. 0 grep usages в `*.ts`/`*.tsx`. Задача `util:title` в task-assignments.ts ссылается на физический id напрямую.

2. **`artifact-model`** — alias → claude-sonnet-4-6. 0 grep usages (было только упоминание в комментарии, тоже убрано). Все 5 artifact задач (`artifact:text/markdown/excel/pptx/reveal`) используют физический id напрямую.

3. **`claude-sonnet-4-5-20250929`** — physical legacy snapshot. SQL-аудит `ai_usage_log`:

   ```sql
   SELECT "modelId", COUNT(*), MIN("createdAt"), MAX("createdAt")
   FROM ai_usage_log WHERE "modelId" LIKE '%sonnet-4-5%' GROUP BY "modelId";
   ```
   | modelId | count | first | last |
   |---|---|---|---|
   | claude-sonnet-4-5-20250929 | 2 | 2026-02-25 | 2026-04-06 |

   Всего 2 исторические записи. Удаление безопасно:
   - Pricing Sonnet 4.5 и 4.6 **идентичны** ($3/$15/$0.3/$3.75)
   - Tolerant walk-back loop в `getModelEntry` резолвит устаревшие ID: `claude-sonnet-4-5-20250929` → strip `-20250929` → `claude-sonnet-4-5` → strip `-4-5` → `claude-sonnet` alias → `claude-sonnet-4-6` → identical pricing
   - Исторический cost для тех 2 записей остаётся корректным

### Оставлено (важно!)

`claude-sonnet`, `claude-haiku`, `claude-opus` — **живые aliases**, 10+ usages в UI-слое:

- [components/dev-panel/dev-panel-footer.tsx](../../components/dev-panel/dev-panel-footer.tsx) — label mapping
- [components/dev-panel/sections/model-section.tsx](../../components/dev-panel/sections/model-section.tsx) — label mapping
- [components/projects/task-chat.tsx](../../components/projects/task-chat.tsx) — `selectedModelId`
- [components/input/input-context.tsx](../../components/input/input-context.tsx) — `defaultModelId`
- [components/input/compact-input.tsx](../../components/input/compact-input.tsx) — `defaultModelId`
- 4× service chat configs: ben, project-creation, project-manager, briefing-onboarding
- [components/service-chat/types.ts](../../components/service-chat/types.ts) — type `model: "claude-haiku" | "claude-sonnet"`

**Архитектурное обоснование** закреплено в комментариях каталога: `task-assignments` использует физические snapshot IDs для cost precision и cache invalidation, UI использует семантические aliases для изоляции от snapshot version changes. При выкате Sonnet 4.7 нужно поправить одну строку (target alias-а), UI трогать не надо.

## Файлы изменены

- [lib/ai/model-catalog.ts](../../lib/ai/model-catalog.ts) — 3 entry удалены, добавлены inline-комментарии с обоснованием
- [lib/ai/task-assignments.ts:139](../../lib/ai/task-assignments.ts#L139) — убрано устаревшее упоминание «artifact-model» в комментарии
- [package.json](../../package.json) — 3.87.4 → 3.87.5
- [CLAUDE.md](../../CLAUDE.md) — version header + добавлен ТЗ первой строкой в список «Завершены»
- [SIMPLY_STATUS.md](../../SIMPLY_STATUS.md) — version bump + детальная секция плана развития
- [CHANGELOG.md](../../CHANGELOG.md) — entry v3.87.5 с полным контекстом

## Валидация

- ✅ `npx tsc --noEmit` — 0 ошибок
- ✅ `npm run build` — успешно (retry после network flap к Neon на первой попытке)
- ✅ Grep `"title-model"|"artifact-model"|"claude-sonnet-4-5-20250929"` — 0 matches
- ✅ SQL audit ai_usage_log (2 записи, не блокирует)

## Итоговое состояние каталога Anthropic

**Было:** 4 physical + 5 alias = 9 записей
**Стало:** 3 physical + 3 alias = 6 записей

Чистое разделение:

| | Physical (cost precision) | Alias (UI stability) |
|---|---|---|
| Sonnet | `claude-sonnet-4-6` | `claude-sonnet` |
| Haiku | `claude-haiku-4-5-20251001` | `claude-haiku` |
| Opus | `claude-opus-4-6` | `claude-opus` |

## Key insight (lesson для будущих cleanup)

**Разведка до кода — две независимые проверки:**
1. Grep usages по всей кодовой базе (статический анализ)
2. SQL audit реального использования в БД (runtime данные)

Если бы я не проверил UI-слой через grep, мог бы ошибочно удалить живые `claude-sonnet`/`claude-haiku` aliases (10+ usages) → сломать service-chat, DevPanel, default model selection. SQL audit показал **реальные**, а не теоретические patterns для legacy snapshot — 2 записи за всё время позволили удалить с уверенностью, что никого не сломаем.
