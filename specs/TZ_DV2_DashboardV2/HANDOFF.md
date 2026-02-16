# Передача сессии ТЗ-DV2: Дашборд V2

**Дата:** 2026-02-16
**Сессия:** 3 (завершена)

## Статус этапов
- [x] Этап 1: Удаление экосистемы помощников ✅ (commit `0bbe51b`)
- [x] Этап 2: chatMode — схема, миграция, API ✅ (commit `0ce7dd0`)
- [x] Этап 3: Промпты и Tools по chatMode ✅ (commit `cee6942`, тест пройден)
- [ ] Этап 4: UI — карточки на дашборде + убрать селектор модели
- [ ] Этап 5: AI = Simply + chatMode badge в истории
- [ ] Этап 6: Финализация

## Следующая сессия: начни с

1. **Прочитать ROADMAP.md** — проверить задачи Этапа 4
2. **Прочитать `docs/design-system.md`** — ОБЯЗАТЕЛЬНО перед UI работой
3. **Начать Этап 4** — UI карточки на дашборде + убрать селектор модели:
   - Создать `components/glavnaya/mode-cards-section.tsx` — три карточки:
     - Экспертиза (🔍) → `/chat?mode=expertise`
     - Создать (✨) → `/chat?mode=create`
     - Проекты (📁) → `/projects`
     - Hover: `hover:border-primary hover:shadow-sm transition-all` (Паттерн A из design-system)
   - Обновить `components/glavnaya/index.ts` — экспорт ModeCardsSection
   - Интегрировать в `app/(dashboard)/dashboard/page.tsx` (под инпутом)
   - Обработать `?mode=` query param в `app/(chat)/page.tsx` или `chat.tsx` → создание чата с chatMode
   - Убрать `InputModelSelector` из `components/input/compact-input.tsx`
   - Убрать model badge из `components/chat-header.tsx` (если есть)

## Что сделано в Этапе 3

- `composeExpertisePrompt()` и `composeCreatePrompt()` — стабы в `lib/prompts/builder/composer.ts`
- `composeChatPrompt()` default model: `'claude-sonnet'` → `'claude-haiku'`
- `buildExpertisePrompt()` и `buildCreatePrompt()` high-level API
- `chat-mode-config.ts` расширен: `tools` + `reservedTools`
- `chat-tools.ts`: `chatMode` optional param (backward compat)
- `route.ts`: routing builder по chatMode, chatMode в tools
- Мануальный тест: селектор показывал Sonnet, но dev-badge под аватаркой — Haiku (сервер правильно определяет модель по chatMode, клиентский селектор уже не влияет)

## Ключевые решения архитектора (напоминание)

- chatMode: varchar (не pgEnum) + Zod-валидация
- selectedChatModel убран из API → сервер определяет по chatMode
- Аватар: оставить SparklesIcon
- ToolsSection: удалена
- Greeting: одинаковый для всех режимов
- Badge в истории: 🔍 expertise, ✨ create
- Design system: `docs/design-system.md` — ОБЯЗАТЕЛЬНО читать перед UI работой
- Карточки: Паттерн A (border + shadow hover)

## Блокеры / Вопросы
- Нет блокеров.
