# ТЗ-DeadModelSelectors — ROADMAP

**Статус:** 🟢 Закрыто частично (2026-04-14)
**Ветка:** `feature/simply-kitt`
**Этапы:** оригинальный план был 5 этапов, из них 3 закрыты (в том числе незапланированный hotfix), 2 намеренно отброшены

---

## Итоговая хронология сессии 2026-04-14

### Попытка 1: Этап 1 «Коллапс цепочки props» (откачен)

**Commit:** `772e886` — refactor(tz-deadmodelsel): этап 1 — коллапс цепочки props

Удалял `initialChatModel` / `currentModelId` / `selectedModelId` / `onModelChange` через 11 файлов одним atomic изменением. TSC проходил, next build проходил. При мануальном тестировании в проектном task-чате:
- Владелец заметил что **DevPanel Switchboard не показывает override для проектов** (pre-existing bug A)
- Я начал Этап 1.5 как hotfix и сделал ошибку: редактировал `api/projects/.../tasks/.../chat/route.ts` **во время активного streaming** (updateDocument tool генерировал документ). HMR пересобрал модуль посреди потока, tool таймаутнулся по своему 120s лимиту, интерфейс «завис».

**Решение:** владелец приказал `git reset --hard 71de7f9` — откат до handoff состояния предыдущей сессии. Коммит `772e886` физически удалён, вместе с ним эта рабочая папка ТЗ (SPEC/ANALYSIS/ROADMAP/FINDINGS/HANDOFF/CHANGELOG).

### Попытка 2: фикс проектного override (успех)

**Commit:** `9ddf814` — fix(projects): DevPanel Switchboard + dev overrides в проектных task-чатах

Один файл `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts`. Два изменения:
1. Добавлен side-effect import `import "@/lib/ai/model-overrides-node"` — тот же паттерн что в `app/(chat)/api/chat/route.ts`. Закрывает **Bug B**: reader overrides не регистрировался для проектных роутов, `isTaskOverridden` возвращал false, `getModel()` молча отдавал default модель.
2. В `emitDebugPrompt` добавлены 4 поля: `taskId` (= `getTaskIdForTier(tier)`), `overrideActive` (= `isTaskOverridden(activeTaskId)`), `defaultModelId` (= `DEFAULT_TASK_MODELS[activeTaskId]`), `effectiveModelId` (= `getProjectTierModelId(tier)`). Закрывает **Bug A**: `SwitchboardSection.tsx:30-31` делал ранний return из-за отсутствия `taskId` → dropdown вообще не рендерился в drawer.

**Валидация:** tsc = 0 ошибок, HMR пересобрал route за 706ms, живой мануальный тест владельца подтвердил: «всё работает как в других режимах».

**Важная лэссон:** НЕ редактировать route-файлы во время активного streaming. Dev-HMR пересобирает модуль → активные promises (tools, streams) могут зависнуть. Ждать завершения стрима перед правкой.

### Попытка 3: удаление мёртвых selector-файлов (ограниченный scope)

**Commit:** `a1923b1` — chore(cleanup): удалить 3 мёртвых legacy selector-компонента

Удалены 3 файла с 0 импортёров в активном коде:
1. `components/compact-model-selector.tsx`
2. `components/model-selector.tsx`
3. `components/input/input-model-selector.tsx`

Также убрана строка `export { InputModelSelector } from "./input-model-selector"` из `components/input/index.tsx`.

**`components/projects/model-selector.tsx` НЕ удалён** — Владимир явно сказал «проектные файлы не трогать».

**Валидация:** tsc = 0, HMR пересобрал чисто (после транзитной ошибки HMR на момент между `rm file` и `edit index`).

### Попытка 4: упрощение entitlements (ограниченный scope)

**Commit:** `5b2571c` — chore(cleanup): убрать unused availableChatModelIds из entitlements

В `lib/ai/entitlements.ts`:
- Убран `import type { ChatModel } from "./models"` (единственный не-archive импортёр `ChatModel`)
- Убрано поле `availableChatModelIds: ChatModel["id"][]` (читалось только удалённым `model-selector.tsx`)
- Тип `Entitlements` упрощён до `{ maxMessagesPerDay: number }`

**Валидация:** tsc = 0, HMR пересобрал за 850ms.

---

## Что намеренно оставлено (НЕ долги, решение владельца)

После инцидента с Этапом 1 владелец явно потребовал не трогать проектный flow. Всё что связано с рабочим `ModelSelectorCompact` в `multimodal-input.tsx` и цепочкой props вокруг него — **сохранено**.

Следующие пункты оригинального SPEC не выполнены **намеренно**:

1. **`lib/ai/models.ts`** — файл всё ещё существует как тонкая `@deprecated` заглушка с `DEFAULT_CHAT_MODEL = "auto"`, пустым `chatModels: []`, типом `ChatModel`. Единственный живой импортёр сейчас — `components/multimodal-input.tsx` (через `chatModels`). Удалить файл = сломать multimodal-input = сломать проектный flow.

2. **`components/multimodal-input.tsx`** — не трогался вообще. Внутри содержит:
   - Dead Claude-ветку в `PureModelSelectorCompact` (линии 700-751, unreachable)
   - Неиспользуемые props `selectedModelId`/`onModelChange` на outer `PureMultimodalInput`
   - `isReasoningModel` check в `PureAttachmentsButton` (всегда false)
   - Импорты `saveChatModelAsCookie` и `chatModels`

3. **`components/chat.tsx`** — не трогался. Содержит:
   - `currentModelId` state (никогда не меняется от `"auto"`)
   - `currentModelIdRef` (объявлен, синхронизируется, никогда не читается — Finding #6)
   - Prop `initialChatModel` (всегда получает `"auto"` literal от 5 pages)

4. **`components/messages.tsx`, `components/artifact.tsx`** — не трогались. Содержат мёртвые props `selectedModelId`.

5. **`components/projects/task-chat.tsx`** — не трогался. Содержит 3 × `selectedModelId="claude-sonnet"` литерала.

6. **5 page-файлов** — не трогались:
   - `app/(chat)/simply/page.tsx`
   - `app/(expertise)/expertise/[id]/page.tsx`
   - `app/(create)/create/[id]/page.tsx`
   - `app/(chat)/projects/[id]/chat/page.tsx`
   - `app/(chat)/projects/[id]/chat/[chatId]/page.tsx`

7. **`components/input/input-context.tsx`** — не трогался. Содержит дуальность `provider: "google" | "anthropic"` с мёртвой google-веткой.

8. **`components/projects/model-selector.tsx`** — не трогался (0 импортёров, но в `/projects/` папке).

9. **`app/(chat)/actions.ts` → `saveChatModelAsCookie`** — не трогался (вызывается только из `multimodal-input.tsx`'s dead ветки).

## Будущие решения

Если в следующий раз появится реальная потребность закончить очистку, нужно **сначала** обсудить с Владимиром архитектуру UI-селектора моделей для проектов (чтобы гарантированно не сломать то что работает), **потом** переписывать цепочку props, **в отдельном окне сессии**, на холодном dev-сервере.
