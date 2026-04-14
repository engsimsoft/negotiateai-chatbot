# ТЗ-DeadModelSelectors — CHANGELOG

История изменений по этому ТЗ.

---

## 2026-04-14 — Частичное закрытие

### Коммиты сессии (после отката Этапа 1)

1. **`9ddf814`** — fix(projects): DevPanel Switchboard + dev overrides в проектных task-чатах
   - Файл: `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts`
   - Добавлен side-effect import `@/lib/ai/model-overrides-node`
   - В `emitDebugPrompt` добавлены 4 поля: `taskId`, `overrideActive`, `defaultModelId`, `effectiveModelId`
   - Закрывает 2 pre-existing бага которых не было в оригинальном SPEC

2. **`a1923b1`** — chore(cleanup): удалить 3 мёртвых legacy selector-компонента
   - Удалены: `components/compact-model-selector.tsx`, `components/model-selector.tsx`, `components/input/input-model-selector.tsx`
   - Убран экспорт `InputModelSelector` из `components/input/index.tsx`
   - −402 строки

3. **`5b2571c`** — chore(cleanup): убрать unused availableChatModelIds из entitlements
   - Файл: `lib/ai/entitlements.ts`
   - Убрана зависимость от типа `ChatModel` из `lib/ai/models.ts`
   - Тип упрощён до `{ maxMessagesPerDay: number }`

### Откачено в процессе

- **`772e886`** — refactor(tz-deadmodelsel): этап 1 — коллапс цепочки props — **откачен `git reset --hard 71de7f9`** после инцидента с HMR recompile во время активного streaming.

### Workspace воссоздание

Папка `specs/TZ_DeadModelSelectors/` воссоздана ретроспективно в конце сессии (SPEC, ANALYSIS, ROADMAP, FINDINGS, CHANGELOG, HANDOFF), потому что первая версия была в откаченном коммите `772e886`.

### Статус

🟢 **Закрыто частично.** Оригинальный scope выполнен на ~30%. Остальные ~70% **намеренно оставлены** по решению владельца — проектный flow (`ModelSelectorCompact` в `multimodal-input.tsx` + вся цепочка props вокруг него) должен сохраниться как есть.

Попутно закрыт критический баг проектного override который не входил в оригинальный SPEC.
