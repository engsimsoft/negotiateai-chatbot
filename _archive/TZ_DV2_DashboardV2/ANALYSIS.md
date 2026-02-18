# Анализ ТЗ-DV2: Дашборд V2

## Резюме

Масштабный рефакторинг: удаление экосистемы помощников, добавление chatMode, три карточки на дашборде, ребрендинг AI → Simply, убрать выбор модели из UI. Затрагивает ~25 файлов, БД миграцию, промпт-систему и UI-слой.

---

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.
> Каждая рекомендация требует согласования с архитектором.

### ✅ Согласен с ТЗ

- **П.1 Удаление помощников** — ОК. Инвентаризация проведена: `lib/helpers/` (4 файла), `components/glavnaya/helpers-section.tsx`, `app/(chat)/helpers/` (3 страницы), `app/(chat)/api/helpers/` (2 route), таблица `Helper` в БД, `helperId` в `Chat`. Чистое удаление, зависимости изолированы.
- **П.2 Три карточки на дашборде** — ОК. Секция `HelpersSection` в `app/(dashboard)/dashboard/page.tsx:58` заменяется на новую. Паттерны карточек (`ProjectCard`, `ToolCard`) уже есть — берём за образец.
- **П.6 Убрать селектор модели** — ОК. `components/input/input-model-selector.tsx` используется в `CompactInput`. Можно просто не рендерить его.
- **П.7 AI = Simply** — ОК. В `message.tsx` аватар — SparklesIcon. В `chat-header.tsx` нет имени AI. Модель показывается только в dev-mode badge (`message.tsx:248-252`). Изменения минимальны.

### ⚠️ Рекомендую изменить

| # | Было (ТЗ) | Рекомендация | Обоснование из кода |
|---|-----------|--------------|-------------------|
| 1 | `chatMode: varchar, enum('chat', 'expertise', 'create')` | Использовать Drizzle `pgEnum` вместо varchar с enum. Формат: `pgEnum('chat_mode', ['chat', 'expertise', 'create'])` | В `schema.ts` уже есть паттерн с `varchar + enum` для visibility (строка 236), но `pgEnum` даёт валидацию на уровне БД. Однако если хотим простоту — varchar с enum тоже рабочий вариант. **На выбор архитектора.** |
| 2 | `ComposedPrompt` с полем `model: string` | Оставить существующий `ComposedPrompt` из `composer.ts:24-29` — он уже содержит `systemPrompt`, `model: ModelId`, `greeting?`, `toolAccess?`. Полностью совпадает с контрактом из ТЗ, только `model` типизирован как `ModelId`, а не `string`. | `lib/prompts/builder/composer.ts:24-29` — интерфейс уже существует и экспортируется. Создавать новый не нужно. |
| 3 | `composeChatPrompt()` — текущая модель по умолчанию `claude-sonnet` | В ТЗ указано: `chat` → Claude Haiku, `expertise` → Sonnet, `create` → Sonnet. Но сейчас `composeChatPrompt()` (строка 189) возвращает `model: context.model \|\| 'claude-sonnet'`. Новые функции `composeExpertisePrompt` и `composeCreatePrompt` должны возвращать фиксированную модель, игнорируя `context.model`. | `composer.ts:189` — если оставить fallback на `context.model`, пользователь сможет обойти жёсткую привязку через API. Рекомендую: новые composers хардкодят модель, а `composeChatPrompt` меняет default на `claude-haiku`. |
| 4 | `selectedChatModel` остаётся в API schema | Поле `selectedChatModel` в `schema.ts:29-33` сейчас отправляется из UI. Раз пользователь не выбирает модель — нужно решить: (А) убрать поле из schema и определять модель на сервере по chatMode, или (Б) оставить, но клиент отправляет модель, определённую chatMode. | `app/(chat)/api/chat/schema.ts:29-33`. Рекомендую вариант (А) — убрать `selectedChatModel`, добавить `chatMode`, сервер определяет модель. Это безопаснее: клиент не может подставить другую модель. **Но** это ломает проектные чаты, где модель определяется `projectModelTier`. Нужно обсудить. |
| 5 | Tools по режимам: отдельные наборы | Сейчас `getStandardTools()` в `chat-tools.ts` принимает `isProjectChat: boolean`. Рекомендую расширить на `chatMode: ChatMode` вместо boolean, и внутри фильтровать по конфигу. Зарезервированные tools — просто строки в конфиге, не реальные tool-объекты. | `lib/ai/tools/chat-tools.ts:38-63` — текущий интерфейс `GetStandardToolsParams` не знает о chatMode. |
| 6 | Удаление `helperId` из Chat — миграция данных | При удалении `helperId` из Chat нужна DB-миграция. Существующие чаты с `helperId` потеряют привязку. Рекомендую: (А) миграция ставит `helperId = null`, (Б) удаляем колонку, (В) удаляем таблицу Helper. Исторические данные будут потеряны. | `schema.ts:227` — FK constraint на `helper.id`. Нужно сначала дропнуть FK, потом колонку, потом таблицу. Порядок важен. |

### ❓ Требует уточнения

1. **Дашборд vs Главная.** В ТЗ сказано "три карточки на дашборде". Но текущий дашборд — это `app/(dashboard)/dashboard/page.tsx`, а главная — `app/(chat)/page.tsx`. На `page.tsx` нет секции помощников, она на `/dashboard`. Нужно уточнить: карточки добавляются на `/dashboard` (где сейчас HelpersSection)? Или на главную (`/`)? Или обе страницы консолидируются?

2. **`selectedChatModel` в API** — см. рекомендацию #4 выше. Как обрабатывать для проектных чатов, где модель определяется `projectModelTier`? Варианты:
   - (А) Добавить `chatMode` в schema, убрать `selectedChatModel` для обычных чатов, оставить `projectModelTier` для проектных
   - (Б) Оставить `selectedChatModel` но заполнять его на клиенте на основе chatMode

3. **Аватар Simply** — ТЗ говорит "логотип Simply или стилизованная S". Сейчас — SparklesIcon. Что именно ставить? Если логотип — нужен SVG. Если просто буква "S" — можно сделать текстовым. Есть ли готовый ассет?

4. **Удаление `ToolsSection` с дашборда?** Сейчас на дашборде есть секция "ИНСТРУМЕНТЫ" с карточками (Диктофон, Исследование, Брифинг — все "Coming Soon"). Три новые карточки (Экспертиза, Создать, Проекты) по сути заменяют и помощников, и эту секцию. Удалять ToolsSection?

5. **Greeting message для chatMode.** `composeChatPrompt()` сейчас возвращает `greeting: 'Привет! Чем могу помочь?'`. Для expertise/create нужен другой greeting? Например: "Задайте вопрос — я найду точный ответ" (expertise), "Что будем создавать?" (create)?

6. **История чатов — отображение chatMode.** В `/chats` и sidebar-history сейчас чаты не маркированы по типу. Нужно ли показывать значок/badge chatMode в списке чатов? Или просто разный AI-поведение, но визуально одинаковые чаты?

---

## Потенциальные риски

1. **Миграция БД** — удаление таблицы Helper и колонки helperId. На проде могут быть чаты с helperId. Нужна аккуратная миграция: сначала null FK, потом drop column, потом drop table.

2. **Breaking change для API** — если убираем `selectedChatModel` из POST body, все клиенты должны быть обновлены одновременно. На Vercel deployment атомарный, поэтому ОК.

3. **Проектные чаты** — ТЗ говорит "Проекты без изменений". Но если `selectedChatModel` убирается из schema — нужно убедиться, что проектные чаты продолжают работать через `projectModelTier`.

4. **Sidebar context** — `app-sidebar.tsx` сейчас имеет `SidebarContext` с вариантом `helper`. После удаления нужно убрать этот case и убедиться что навигация не сломается.

---

## Зависимости

- Нет внешних зависимостей, всё внутри проекта
- Drizzle миграция: `npx drizzle-kit generate` + `npm run db:migrate`
- Нет зависимости от других ТЗ в работе

## Затронутые компоненты

**Удаление целиком:**
- `lib/helpers/` (4 файла)
- `app/(chat)/helpers/` (3 страницы)
- `app/(chat)/api/helpers/` (2 routes)
- `components/glavnaya/helpers-section.tsx`

**Модификация:**
- `lib/db/schema.ts` — удалить helper table + helperId, добавить chatMode
- `lib/db/queries.ts` — удалить 6 helper-функций, обновить saveChat
- `app/(chat)/api/chat/schema.ts` — добавить chatMode, решить судьбу selectedChatModel
- `app/(chat)/api/chat/route.ts` — chatMode-based конфигурация
- `lib/prompts/builder/composer.ts` — две новые composer-функции
- `lib/prompts/builder/index.ts` — экспорты
- `lib/prompts/server.ts` — экспорты
- `lib/ai/tools/chat-tools.ts` — chatMode-based tools
- `components/chat.tsx` — убрать helper props
- `components/chat-header.tsx` — убрать helper props, убрать model badge
- `components/app-sidebar.tsx` — убрать helper context
- `components/sidebar-history.tsx` — убрать helper case
- `components/input/compact-input.tsx` — убрать model selector
- `components/message.tsx` — аватар Simply
- `app/(dashboard)/dashboard/page.tsx` — три карточки вместо помощников

---

## Оценка сложности

- [x] Среднее (3-5 сессий)

Основная сложность — аккуратное удаление зависимостей помощников без поломки остального, плюс DB-миграция.
