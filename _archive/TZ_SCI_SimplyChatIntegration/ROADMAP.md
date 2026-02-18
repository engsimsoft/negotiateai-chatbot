# ТЗ-SCI: Simply Chat Integration v1.1 — ROADMAP

**Статус:** 🔄 В работе
**Ветка:** master

---

## Этап 1: Файлы промптов

- [x] 1.1 Создать `lib/prompts/chat/simply-chat.md` (XML-промпт из SIMPLY_CHAT_PROMPT_v1.1.md)
- [x] 1.2 Заменить `lib/prompts/core/dev-mode.md` (из DEV_MODE_UPDATE.md)

## Этап 2: Composer

- [x] 2.1 Обновить `composeChatPrompt()` — параметр chatMode, загрузка simply-chat.md, current_mode инъекция, dev_reminder, modelMap
- [x] 2.2 Обновить `composeExpertisePrompt()` и `composeCreatePrompt()` — делегация с chatMode
- [x] 2.3 Проверить экспорты в `index.ts` (уже есть — confirm only)

## Этап 3: Валидация

- [x] 3.1 `npx tsc --noEmit` → 0 ошибок
- [x] 3.2 `npm run build` → успех
