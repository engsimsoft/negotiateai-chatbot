# ROADMAP — TZ_SimplyChatModeInjection

**Цель:** плейсхолдеры `<current_mode>` и `<current_model>` в Simply Chat prompt заменяются на реальные значения через SSOT (task-assignments + model-catalog).

---

## Этап 1 — Композер и builder-API

- [ ] Обновить `composeChatPrompt` в [lib/prompts/builder/composer.ts](../../lib/prompts/builder/composer.ts):
  - Импорт `ChatMode`, `TaskId`, `getModelIdForTask`, `getModelEntry`
  - Сигнатура: `composeChatPrompt(context, chatMode: ChatMode = 'simply', activeTaskId?: TaskId)`
  - Вычисление `displayModel` через `getModelEntry(getModelIdForTask(taskId))?.displayName` с fallback `"AI"`
  - Удалить верхний `modelDisplayMap` + `modelMapForDisplay`
  - Удалить нижний `modelMap`, вернуть статический `'claude-sonnet'` (dead field)
- [ ] Обновить `composeExpertisePrompt` / `composeCreatePrompt` — пробрасывать `activeTaskId`
- [ ] Обновить `buildChatPrompt` / `buildExpertisePrompt` / `buildCreatePrompt` в [lib/prompts/builder/index.ts](../../lib/prompts/builder/index.ts) — добавить опциональный `activeTaskId?: TaskId`
- [ ] `npx tsc --noEmit` → 0 ошибок

## Этап 2 — Chat route

- [ ] В [app/(chat)/api/chat/route.ts](../../app/(chat)/api/chat/route.ts):
  - Вычисление `activeTaskId` поднять **до** switch prompt-building (строка ~479)
  - Передать `activeTaskId` в `buildChatPrompt` / `buildExpertisePrompt` / `buildCreatePrompt` (включая project-ветку)
  - Удалить дублирующее вычисление внизу switch-а
- [ ] `npx tsc --noEmit` → 0 ошибок
- [ ] `npm run build` → успешен

## Этап 3 — Мануальная валидация

- [ ] Dev server запущен
- [ ] Открыть Simply Chat → отправить «привет» → DevPanel → Prompt section → проверить:
  - `<current_mode>simply</current_mode>`
  - `<current_model>Grok 4.1 Fast</current_model>`
- [ ] Нажать «Думать» → отправить запрос → DevPanel:
  - `<current_model>Grok 4.20</current_model>`
- [ ] Прикрепить картинку или PDF → отправить → DevPanel:
  - `<current_model>Claude Haiku 4.5</current_model>`
- [ ] Открыть /expertise → новый запрос → DevPanel:
  - `<current_mode>expertise</current_mode>`
  - `<current_model>Grok 4.20 Multi-Agent</current_model>`
- [ ] Открыть /create → новое задание → DevPanel:
  - `<current_mode>create</current_mode>`
  - `<current_model>MiniMax M2.7</current_model>`

## Этап 4 — Финализация

- [ ] Обновить `SIMPLY_PROMPTS_AND_MODEL_CONFIG.md` — одна строчка про SSOT чтение displayName в composer
- [ ] CHANGELOG запись (patch bump v3.90.x)
- [ ] Commit
- [ ] Архив: `mv specs/TZ_SimplyChatModeInjection _archive/`, запись в `BACKLOG_CLOSED.md`
- [ ] `git status` → clean
