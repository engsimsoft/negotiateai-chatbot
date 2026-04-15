# ANALYSIS — TZ_SimplyChatModeInjection

**Дата:** 2026-04-15
**Верификация против кода:** ✅ все 3 claim из SPEC подтверждены + найдена дополнительная деталь

---

## Подтверждение находок SPEC

### 1. `buildChatPrompt` не пробрасывает `chatMode` — ✅
[lib/prompts/builder/index.ts:76-85](../../lib/prompts/builder/index.ts#L76-L85) — вызов `composeChatPrompt(context)` без второго аргумента. Внутри `composeChatPrompt` default `chatMode = 'chat'`.

### 2. Дефолт `'chat'` в composer — ✅
[lib/prompts/builder/composer.ts:162](../../lib/prompts/builder/composer.ts#L162) — режим `chat` удалён в v3.86.0, валидные только `simply | expertise | create`.

### 3. `modelMapForDisplay` знает только Claude — ✅
[lib/prompts/builder/composer.ts:179-184](../../lib/prompts/builder/composer.ts#L179-L184) — ключи `chat/expertise/create` → `claude-haiku/sonnet/sonnet`. Нет `simply`, нет Grok/MiniMax.

И второй легаси-маппинг на [composer.ts:208-212](../../lib/prompts/builder/composer.ts#L208-L212).

---

## Дополнительная деталь, не зафиксированная в SPEC

**`ComposedPrompt.model` и `BuiltPrompt.model` — мёртвое поле runtime.** Подтверждение:
```
grep '\.model\b' app/ lib/prompts/ → 0 runtime reads
```
Единственное упоминание в коде — комментарий в [app/(chat)/api/assistant/ben/route.ts:32](../../app/(chat)/api/assistant/ben/route.ts#L32):
> `prompt.model field from buildBenPrompt is no longer used.`

Модель выбирается через `getModel(taskId)`, поле `.model` у builder-результата не читается. Значит второй `modelMap` на [composer.ts:208-212](../../lib/prompts/builder/composer.ts#L208-L212) можно упростить до константы — runtime значение не важно.

**Scope decision:** полное удаление мёртвого поля `ComposedPrompt.model` / `BuiltPrompt.model` — **не в этом ТЗ**. Тип `ModelId` в [lib/prompts/types.ts:20-23](../../lib/prompts/types.ts#L20-L23) живёт как legacy union — трогать его значит цеплять `TZ_PromptsDeadCodeCleanup`. Оставляем поле, но упрощаем его к статическому значению.

---

## Зависимость от flow в `chat/route.ts`

**Проблема порядка:** прямо сейчас [chat/route.ts:513-524](../../app/(chat)/api/chat/route.ts#L513-L524) собирает `builtPrompt` раньше, чем [chat/route.ts:528-540](../../app/(chat)/api/chat/route.ts#L528-L540) вычисляет `activeTaskId`. Чтобы composer знал реальное имя модели (для `<current_model>`), `activeTaskId` нужно поднять **выше** prompt-building.

Три ветки computation:
- **Project** (строка 481): `activeTaskId = \`project:expert:${tier}\``
- **Simply** (строка 529-536): зависит от `think` + `hasAttachments` → `simply-chat` / `simply-chat-think` / `simply-chat-vision`
- **Expertise/Create**: `getTaskIdForChatMode(chatMode)`

Все три знают всё необходимое уже к строке 481 — `think`, `hasAttachments`, `chatMode`, `project` известны из request body. Подъём безопасен.

---

## Ещё одна тонкость — project branch

Project chat тоже вызывает `buildChatPrompt(promptContext)` на [route.ts:505](../../app/(chat)/api/chat/route.ts#L505) и получает simply-chat.md с неправильным `<current_mode>chat</current_mode>`. Значит починка должна покрыть и эту ветку: проброс `chatMode` (с которым запрос пришёл) + `activeTaskId = project:expert:${tier}`.

`<current_mode>` для проекта технически «simply» (запрос пришёл из Simply Chat UI), но семантически пользователь сейчас в проектном контексте. Модель читает тэг как info-маркер, не как инструкцию поведения. Минимальный вариант — пробрасывать реальный `chatMode` из body, реальное имя модели через `activeTaskId`.

---

## План изменений

### `lib/prompts/builder/composer.ts`
- Импортировать `ChatMode` из `@/lib/ai/chat-mode-config`, `TaskId` из `@/lib/ai/task-assignments`, `getModelIdForTask` из `@/lib/ai/getModel`, `getModelEntry` из `@/lib/ai/model-catalog`
- Сигнатура: `composeChatPrompt(context, chatMode: ChatMode = 'simply', activeTaskId?: TaskId)`
- Инъекция `<current_model>`: `getModelIdForTask(activeTaskId || fallbackTaskIdForMode(chatMode))` → `getModelEntry(modelId)?.displayName` → fallback `"AI"`
- Удалить оба локальных `modelMap`-а (верхний `modelDisplayMap` + `modelMapForDisplay`, нижний `modelMap`)
- `ComposedPrompt.model` — оставить статический `'claude-sonnet'` (мёртвое поле, runtime не читается) + комментарий «dead field, legacy type union»
- Обновить `composeExpertisePrompt` и `composeCreatePrompt` — пробрасывать `activeTaskId`

### `lib/prompts/builder/index.ts`
- Добавить второй опциональный параметр `activeTaskId?: TaskId` в `buildChatPrompt`, `buildExpertisePrompt`, `buildCreatePrompt`
- Пробрасывать в composer-ы

### `app/(chat)/api/chat/route.ts`
- Перенести вычисление `activeTaskId` до switch prompt-building (сразу после объявления `let activeTaskId`)
- Передавать `activeTaskId` в `buildChatPrompt` / `buildExpertisePrompt` / `buildCreatePrompt`
- Project-ветка — `buildChatPrompt(promptContext, chatMode, activeTaskId)` где chatMode = input chatMode (любой из трёх), activeTaskId = `project:expert:${tier}`

---

## Риски

**Low.** Изменения локальные, не трогают поведение модели — только информационные теги и display name. tsc должен пройти сразу. Smoke test: DevPanel → Prompt section → проверить что `<current_mode>simply</current_mode>` + `<current_model>Grok 4.1 Fast</current_model>` под Simply Chat (default), `Grok 4.20` под Think, `Claude Haiku 4.5` под vision/attachments.
