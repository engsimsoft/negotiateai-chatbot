# Передача сессии ТЗ-DV2: Дашборд V2

**Дата:** 2026-02-16
**Сессия:** 3

## Статус этапов
- [x] Этап 1: Удаление экосистемы помощников ✅ (commit `0bbe51b`)
- [x] Этап 2: chatMode — схема, миграция, API ✅ (commit `0ce7dd0`)
- [x] Этап 3: Промпты и Tools по chatMode ✅ (ожидает мануальный тест + коммит)
- [ ] Этап 4: UI — карточки на дашборде + убрать селектор модели
- [ ] Этап 5: AI = Simply + chatMode badge в истории
- [ ] Этап 6: Финализация

## Что сделано в Этапе 3

- `composeExpertisePrompt()` и `composeCreatePrompt()` — стабы в `lib/prompts/builder/composer.ts` (делегируют в composeChatPrompt, хардкодят `model: 'claude-sonnet'`)
- `composeChatPrompt()` default model изменён с `'claude-sonnet'` на `'claude-haiku'`
- `buildExpertisePrompt()` и `buildCreatePrompt()` — high-level API в `lib/prompts/builder/index.ts`
- Экспорты добавлены в `lib/prompts/server.ts`
- `lib/ai/chat-mode-config.ts` — расширен: добавлены `tools`, `reservedTools` в конфиг каждого режима
- `lib/ai/tools/chat-tools.ts` — `chatMode` добавлен как optional param в `getStandardTools()` и `getActiveToolNames()` (backward compat для project чатов сохранён)
- `app/(chat)/api/chat/route.ts` — по chatMode вызывается правильный builder (chat/expertise/create), chatMode передаётся в tools
- Валидация: tsc 0 ошибок, build успешен

## Следующая сессия: начни с

1. **Мануальный тест Этапа 3** — обычный чат → dev-badge должен показать Haiku
2. **Коммит Этапа 3** — `feat(tz-dv2): add expertise/create composers and chatMode-based tools`
3. **Начать Этап 4** — UI карточки на дашборде + убрать селектор модели:
   - Прочитать `docs/design-system.md` перед UI работой!
   - Создать `components/glavnaya/mode-cards-section.tsx`
   - Убрать InputModelSelector из compact-input.tsx
   - Обработка `?mode=` query param для создания чатов

## Ключевые решения архитектора (напоминание)

- chatMode: varchar (не pgEnum) + Zod-валидация
- selectedChatModel убран из API → сервер определяет по chatMode
- Аватар: оставить SparklesIcon
- ToolsSection: удалена
- Greeting: одинаковый для всех режимов
- Badge в истории: 🔍 expertise, ✨ create
- Design system: `docs/design-system.md` — ОБЯЗАТЕЛЬНО читать перед UI работой

## Блокеры / Вопросы
- Нет блокеров.
