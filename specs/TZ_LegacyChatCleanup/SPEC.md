# ТЗ-LegacyChatCleanup: чистка legacy «обычного чата»

**Версия ТЗ:** 1.0
**Дата:** 2026-04-13
**Автор:** Владимир Анатольевич (устное ТЗ в сессии)

---

## Контекст

В проекте исторически существовал «обычный чат» (`chatMode="chat"`, маршрут `/chat/[id]`, страница «Все чаты» `/chats`, задания `chat:haiku|sonnet|opus` в task-assignments). Концепция продукта изменилась: **постоянная точка диалога — это Simply** (один вечный чат на пользователя), а «экспертиза» и «создание» — отдельные специализированные флоу с разовыми запросами.

«Обычный чат» больше не создаётся, но код и UI под него в репозитории ещё живы. Это генерирует путаницу — в том числе в dev panel `/dev/models`, где видны три слота `chat:haiku/sonnet/opus`, которые интерпретируются как «три тира одной фичи», хотя на самом деле это разные `chatMode`, один из которых (`chat:opus`) вообще не используется.

## Цель

1. **Удалить legacy «обычного чата»** — маршруты, страницы, навигация, task-assignments, типы, функции под `chatMode="chat"`.
2. **Привести task-assignments.ts и chat-mode-config.ts к фактической архитектуре** — по одному taskId на фактически используемый режим:
   - `expertise` → дефолт `grok-4.20-multi-agent-0309` (Grok 4.20 Multi-Agent)
   - `create` → дефолт `MiniMax-M2.7`
   - `simply-chat` / `simply-chat-think` / `simply-chat-vision` — не трогать, они уже корректны
3. **Аудит затронутых файлов на костыли/заплатки** — при чистке legacy найти и исправить shortcut'ы прошлых агентов (молчаливые `try/catch`, мёртвые fallback'ы, магические значения, необъяснённые conditions, legacy ссылки и @deprecated без удаления).
4. **Сохранить исторические данные** — никакого `DELETE FROM Chat` по `chatMode='chat'`. Строгое правило из памяти: никогда не удалять данные чатов пользователя без явного разрешения.

## Требования

### R1. Task-assignments
- Удалить `chat:haiku`, `chat:sonnet`, `chat:opus` из `TaskId` union и из `DEFAULT_TASK_MODELS`
- Добавить `expertise` → `grok-4.20-multi-agent-0309` и `create` → `MiniMax-M2.7`
- Комментарий-конвенция в шапке файла привести в соответствие с новым списком
- Тип `TaskId` остаётся строгим union — компилятор должен ловить опечатки

### R2. Chat-mode-config
- Убрать `"chat"` из `chatModeSchema` Zod enum
- Убрать ветку `case "chat"` из `getTaskIdForChatMode`
- `expertise` → `"expertise"`, `create` → `"create"`, `simply` → `"simply-chat"`
- `CHAT_MODE_CONFIG[chat]` — удалить запись
- `displayName` у `expertise`/`create` обновить на актуальные ("Grok 4.20 Multi-Agent" / "MiniMax M2.7") или сделать нейтральными (например, "Экспертиза" / "Создание"), чтобы не рассинхрониваться при переключении в dev panel

### R3. Маршруты и страницы
- Удалить `app/(chat)/chat/[id]/page.tsx`
- Удалить `app/(chat)/chat/page.tsx` (новый обычный чат)
- Удалить `app/(dashboard)/chats/page.tsx` (список обычных чатов)
- Папку `app/(chat)/chat/` удалить целиком, если после этих удалений она пустая

### R4. Навигация и sidebar
- В `components/app-sidebar.tsx` удалить ветки связанные с `chatMode="chat"`:
  - `getContextTitle` default "Чаты" → либо убрать default, либо вынести под явный exhaustive switch
  - `getAllChatsHref` default `/chats` → удалить
  - `getAllChatsLabel` default "Все чаты" → удалить
  - `getNewChatLabel` default "Новый чат" → удалить
  - `getSidebarContext` default branch `{ chatMode: "chat" }` — заменить на осмысленный fallback (вероятнее всего `simply`, т.к. если URL не expertise/create/projects/simply — скорее всего пользователь на дашборде и контекст Simply уместен; обсудить в ANALYSIS)
- Тип `ChatMode` в шапке `app-sidebar.tsx` убрать литерал `"chat"`

### R5. Утилиты
- `lib/utils.ts` → `getChatUrl`: убрать `default: /chat/${chatId}`. Fallback — либо `"/simply"`, либо throw. Решение в ANALYSIS.
- `lib/ai/models.ts` — файл `DEFAULT_CHAT_MODEL + chatModels` легаси от старого селектора моделей (claude-sonnet/haiku/opus строки). Сейчас фактически используется только как cookie-default строка, к реальному резолву моделей отношения не имеет. Варианты:
  - Удалить файл целиком + все импорты `DEFAULT_CHAT_MODEL`
  - Оставить как мёртвый cookie-default (минимальная правка)
- Компоненты/страницы, импортирующие `DEFAULT_CHAT_MODEL`, перестают передавать `initialChatModel` если он больше ни на что не влияет

### R6. Компоненты
- `components/chats/` — папка **не удаляется**, она shared между `/expertise`, `/create`, `/projects`. Внутри удалить legacy fallback'ы (`getChatUrl(chat.id, chat.chatMode)` со значением `"chat"` → 404)
- `components/chat.tsx`, `components/multimodal-input.tsx` — проверить условные ветки по `chatMode==="chat"`, удалить
- `components/suggested-actions.tsx` — проверить использование `getChatUrl`
- `components/sidebar-history-item.tsx` — проверить использование `getChatUrl`

### R7. API
- `app/(chat)/api/chat/schema.ts` — убрать `chatMode: chatModeSchema.default("chat")`. Сделать обязательным или поменять дефолт на осмысленный (обсудить в ANALYSIS — `simply` как единственная точка по умолчанию?)
- `app/(chat)/api/chat/route.ts` — найти и удалить все ветки `chatMode === "chat"`, `buildChatPrompt` для legacy-ветки (если `buildChatPrompt` используется **только** legacy-чатом, удалить его тоже; если используется Simply — оставить)
- `saveChat({... chatMode: chatMode || "chat"})` в `lib/db/queries.ts` — дефолт `"chat"` должен исчезнуть. Правильно — сделать параметр обязательным

### R8. Промпты
- `lib/prompts/server.ts` + `lib/prompts/builder/index.ts`: функция `buildChatPrompt` — проверить, используется ли она **только** для legacy `chatMode="chat"`, или это общий builder с ветвлением на expertise/create/simply. Если общий — переименовать в нейтральное `buildGeneralPrompt` или оставить, только убрав ветку "chat". Решение в ANALYSIS.

### R9. DB — сохранение исторических данных
- **Запрещено** `DELETE FROM "Chat" WHERE "chatMode"='chat'`
- Колонка `chatMode` в таблице `Chat` остаётся строкой, исторические записи `chatMode='chat'` остаются в DB
- Простой подход: если пользователь каким-то образом открывает URL исторического чата (который больше не существует как маршрут), получает 404 — это нормально. Данные не стёрты, восстановить доступ при необходимости можно отдельной миграцией
- Отдельно проверить, что `sidebar-history` и `ModeChatsPage` не показывают `chatMode='chat'` чаты в списках (т.к. соответствующих страниц больше нет)

### R10. Dev Panel
- После удаления `chat:*` тасков, страница `/dev/models` автоматически перестаёт их показывать (она читает из `DEFAULT_TASK_MODELS`). Проверить, что там нет хардкода `chat:haiku|sonnet|opus`.

### R11. Audit: костыли и заплатки
При прохождении R1–R10 в каждом затронутом файле — полноценное чтение, а не только места с `grep`-match. Искать:
- Молчаливые `catch (e) { /* empty */ }` или `catch { return null }` без логирования — по правилу «no silent degradation» из памяти
- `@deprecated` комментарии, у которых deprecated-код физически остался на месте
- Мёртвые импорты, мёртвые экспорты
- Магические числа/строки без ADR или комментария-why
- `if (chatMode === "chat" || chatMode === ...)` — сложные условия, которые после удаления `"chat"` упрощаются
- `TODO`, `FIXME`, `HACK` — зафиксировать в CHANGELOG ТЗ без автоматического исправления (если не относится напрямую)

## Ограничения

- **Нельзя** удалять данные чатов из DB
- **Нельзя** ломать Simply Chat, проекты, экспертизу, создание, брифинг, подкаст, meeting recorder, memory
- **Нельзя** править `simply-chat*` таски — они уже корректны
- Каждый этап должен проходить `npx tsc --noEmit` (0 ошибок), финальный этап — `npm run build`
- После build — мануальный тест пользователем (regression на Simply/expertise/create/project/settings/dashboard)

## Definition of Done

1. `DEFAULT_TASK_MODELS` содержит `expertise` и `create`, но **не** содержит `chat:haiku|sonnet|opus`
2. `chatModeSchema` Zod enum не содержит `"chat"`
3. `app/(chat)/chat/` и `app/(dashboard)/chats/` — физически удалены
4. `npx tsc --noEmit` → 0 ошибок
5. `npm run build` → успешен
6. Мануальный тест пользователем: Simply/expertise/create/project/dashboard — работают без регрессий
7. Dev panel `/dev/models` показывает только актуальные таски, `chat:*` исчезли
8. `/dev/models` → переключение `expertise` на другую модель → на `/expertise/[id]` действительно используется выбранная модель (dev override работает)
9. Sidebar: в контексте expertise/create/projects/simply всё корректно; default-fallback не ведёт на мёртвый `/chats`
10. ADR в `docs/decisions/` — опционально, если вносим крупное архитектурное решение (например, удаление `DEFAULT_CHAT_MODEL`)
