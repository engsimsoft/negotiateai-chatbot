# ROADMAP: ТЗ-LegacyChatCleanup

**Дата:** 2026-04-13
**Статус:** ⬜ Готов к исполнению (ждёт финального «ок»)

---

## Принципы

- **Никаких «скопом»** — каждый этап валидируется отдельно
- После **каждой задачи** → `npx tsc --noEmit` → 0 ошибок → только тогда `[x]`
- После **каждого этапа** → мануальный тест пользователем → ждём подтверждения
- `route.ts` читается целиком в фазе кода, не по grep
- База данных (Stage 3) — только с явным подтверждением перед каждым SQL

---

## Этап 1 — Переключение модельного реестра и API

**Цель этапа:** перевести приложение с legacy `chat:*` тасков на новые `expertise` и `create`, сохранив работоспособность Simply/expertise/create/projects. Маршруты и страницы ещё не удаляются — только конфигурация.

**Риск этапа:** средний. Правки затрагивают `route.ts` (1000+ строк), требуется внимательное чтение.

### Задачи

- [ ] **1.1** `lib/ai/task-assignments.ts`
  - Удалить из `TaskId` union строки `"chat:haiku" | "chat:sonnet" | "chat:opus"`
  - Удалить из `DEFAULT_TASK_MODELS` записи `chat:haiku`, `chat:sonnet`, `chat:opus`
  - Добавить в union и в `DEFAULT_TASK_MODELS`:
    - `"expertise"` → `"grok-4.20-multi-agent-0309"`
    - `"create"` → `"MiniMax-M2.7"`
  - Обновить шапку-комментарий файла (убрать упоминание `chat:*` в конвенции)
  - Валидация: `npx tsc --noEmit`

- [ ] **1.2** `lib/ai/chat-mode-config.ts`
  - Убрать `"chat"` из `chatModeSchema` (Zod enum)
  - Удалить запись `CHAT_MODE_CONFIG.chat`
  - Обновить `getTaskIdForChatMode`:
    - `"expertise"` → `"expertise"` (вместо `"chat:sonnet"`)
    - `"create"` → `"create"` (вместо `"chat:sonnet"`)
    - `"simply"` → `"simply-chat"` (без изменений)
    - убрать `case "chat"`
  - `CHAT_MODE_CONFIG.expertise.displayName` → `"Grok 4.20 Multi-Agent"` (или нейтральное `"Экспертиза"` — решить при правке)
  - `CHAT_MODE_CONFIG.create.displayName` → `"MiniMax M2.7"` (или `"Создание"`)
  - Валидация: `npx tsc --noEmit`

- [ ] **1.3** `lib/ai/debug-events.ts` — обновить комментарий в `DebugPromptData`, заменить пример `"chat:sonnet"` на `"expertise"`.
  - Валидация: `npx tsc --noEmit`

- [ ] **1.4** `app/(chat)/api/chat/schema.ts`
  - Убрать `.default("chat")` у `chatMode` — сделать поле обязательным
  - Валидация: `npx tsc --noEmit` (ожидается — компилятор подсветит все call-sites, которые не передают `chatMode` → чиним их в 1.5)

- [ ] **1.5** `app/(chat)/api/chat/route.ts`
  - **Прочитать файл целиком** (через несколько `Read` offset), не по grep
  - Удалить все ветки `chatMode === "chat"` / `chatMode === "chat" || ...`
  - Проверить `buildChatPrompt` vs `buildExpertisePrompt`/`buildCreatePrompt` — что остаётся legacy
  - Убрать импорт `getTaskIdForChatMode` если он больше не нужен (либо оставить, если используется)
  - Параллельно зафиксировать в отдельном списке любые найденные костыли (молчаливые catch, магические значения, @deprecated без удаления)
  - Валидация: `npx tsc --noEmit`

- [ ] **1.6** `lib/db/queries.ts` — `saveChat`
  - Сделать параметр `chatMode` обязательным в типе (убрать `?` и `|| "chat"`)
  - Проверить все вызовы `saveChat` — передают ли они `chatMode` явно
  - Валидация: `npx tsc --noEmit`

- [ ] **1.7** `lib/db/queries.ts` — функция `getGeneralChatsWithStats`
  - Оставить на месте до Этапа 2 (она будет удалена вместе со страницей /chats)
  - В комментарии пометить `// LEGACY — удалить в Stage 2 вместе с /chats`
  - Валидация: `npx tsc --noEmit`

### Границы этапа

**Что проверяем мануально перед переходом к Этапу 2:**

1. **Экспертиза работает на Grok 4.20 Multi-Agent.** Открыть `/expertise/[существующий-id]`, отправить сообщение → должен прийти ответ. В dev panel footer внизу ответа видно `grok-4.20-multi-agent-0309`.
2. **Создание работает на MiniMax M2.7.** То же самое на `/create/[существующий-id]`.
3. **Simply работает.** `/simply` → сообщение → ответ на MiniMax M2.7 (дефолт) / Sonnet (при «Думать»).
4. **Проект работает.** Открыть любой проект → экспертный чат по задаче → отправить сообщение → ответ приходит.
5. **Обычный чат пока не трогаем** — в Этапе 1 `/chat/[id]` ещё физически существует, но функционально деградирует (видно в поведении). Если попробовать открыть `/chat/[id]` — может упасть, это ок, всё равно удаляем на этапе 2.
6. **`/dev/models`** — открыть, убедиться что `chat:haiku/sonnet/opus` исчезли, появились `expertise` и `create`. Попробовать переключить `expertise` на другую модель, послать сообщение в экспертизе → увидеть что дев-override работает.

**Валидация перехода на Этап 2:** `npx tsc --noEmit` + `npm run build` + ручной тест выше + подтверждение от Владимира.

---

## Этап 2 — Физические удаления маршрутов, страниц, legacy файлов

**Цель этапа:** после того как рантайм уже корректно маршрутизируется без `chat:*`, физически вырезать мёртвый код. Компилятор — наш главный помощник на этом этапе: любая забытая связь с удалёнными файлами подсветится немедленно.

**Риск этапа:** низкий. Удаления изолированы, компилятор ловит все висячие импорты.

### Задачи

- [ ] **2.1** Удалить маршруты обычного чата
  - Удалить файлы `app/(chat)/chat/[id]/page.tsx` и `app/(chat)/chat/page.tsx`
  - Удалить пустую папку `app/(chat)/chat/` (если после удаления файлов в ней ничего нет; если остались другие файлы — оставить папку)
  - Валидация: `npx tsc --noEmit`

- [ ] **2.2** Удалить страницу списка обычных чатов
  - Удалить `app/(dashboard)/chats/page.tsx`
  - Удалить пустую папку `app/(dashboard)/chats/` если осталась пустой
  - Валидация: `npx tsc --noEmit`

- [ ] **2.3** Удалить `getGeneralChatsWithStats` из `lib/db/queries.ts`
  - Эта функция используется **только** удалённой страницей `/chats`
  - После удаления — компилятор подтвердит что нет внешних импортов
  - Валидация: `npx tsc --noEmit`

- [ ] **2.4** Удалить мёртвый `lib/ai/models.ts`
  - **Перед удалением**: прочитать `components/chat.tsx` целиком, убедиться что `initialChatModel` prop физически не влияет на поведение — ни на один `if`, ни на один API-вызов. Если где-то влияет — НЕ удалять до разбора
  - Удалить файл `lib/ai/models.ts`
  - Удалить импорт `DEFAULT_CHAT_MODEL` из:
    - `app/(chat)/chat/page.tsx` (уже удалён в 2.1)
    - `app/(chat)/chat/[id]/page.tsx` (уже удалён в 2.1)
    - `app/(expertise)/expertise/[id]/page.tsx`
    - `app/(create)/create/[id]/page.tsx`
    - `app/(chat)/simply/page.tsx`
  - Убрать `initialChatModel` prop из всех мест передачи в компонент `Chat`
  - Если `Chat` принимает этот prop в интерфейсе — убрать и из интерфейса
  - Валидация: `npx tsc --noEmit` после **каждой** правки страницы

- [ ] **2.5** `lib/utils.ts` → `getChatUrl`
  - Удалить `case "simply"` (теперь не нужен — Simply имеет фиксированный URL `/simply`, но case полезен для надёжности; решить при правке)
  - `default:` меняем с `return /chat/${chatId}` на `throw new Error(...)` с информативным сообщением
  - Валидация: `npx tsc --noEmit`

- [ ] **2.6** `components/app-sidebar.tsx`
  - Убрать литерал `"chat"` из типа `ChatMode`
  - В `getSidebarContext` убрать `return { type: "general", chatMode: "chat" }` default-ветку
  - Вместо этого: либо explicit `return { type: "general", chatMode: "simply" }`, либо бросать Error — решить при правке
  - Функции `getContextTitle`, `getAllChatsHref`, `getAllChatsLabel`, `getNewChatLabel` — убрать `default:` ветки
  - Убрать рендер пунктов «Новый запрос/задание» и «Все запросы/задания» если контекст не expertise/create/projects (выключатся автоматически после уборки default'ов, но проверить)
  - Валидация: `npx tsc --noEmit`

- [ ] **2.7** `components/chats/mode-chats-page.tsx`
  - Упростить условие в строках 74–85: `chatMode !== "chat"` убирается, ветвление становится безусловно UUID-navigation
  - Валидация: `npx tsc --noEmit`

- [ ] **2.8** `components/chat.tsx`, `components/multimodal-input.tsx`, `components/suggested-actions.tsx`, `components/sidebar-history-item.tsx`
  - Прочитать целиком каждый файл
  - Найти ветки `chatMode === "chat"` / условные рендеры по legacy-режиму
  - Удалить
  - Попутно зафиксировать костыли в список CHANGELOG (молчаливые catch, магические значения)
  - Валидация: `npx tsc --noEmit` после каждого файла

- [ ] **2.9** Prompts builder — проверка и чистка
  - Прочитать `lib/prompts/builder/index.ts` целиком (строки вокруг 76, 189–202)
  - Определить: `buildChatPrompt` используется только legacy-чатом, или это общий builder
  - Если только legacy → удалить вместе с @deprecated обёртками
  - Если общий → убрать ветку `chat` внутри, оставить функцию
  - Обновить реэкспорты в `lib/prompts/server.ts`
  - Валидация: `npx tsc --noEmit`

### Границы этапа

**Что проверяем мануально перед переходом к Этапу 3:**

1. **Переход на удалённые маршруты даёт 404.** Попробовать открыть `/chat/[любой-id]` и `/chats` напрямую в браузере — оба должны показать 404.
2. **Sidebar корректен в 4 контекстах:**
   - `/simply` — только Главная + Simply в навигации, без списков
   - `/expertise/[id]` — навигация + «Новый запрос» + «Все запросы» + список запросов
   - `/create/[id]` — навигация + «Новое задание» + «Все задания» + список заданий
   - Внутри проекта — контекст проекта
3. **Главная (`/dashboard`) и настройки (`/settings`)** — открываются, нигде нет битых ссылок на `/chats` / `/chat/...`
4. **Simply / expertise / create / projects** — вся регрессия из Этапа 1 повторяется и проходит.
5. **Dev panel** — открывается, `expertise` и `create` редактируются, override работает.
6. **`npm run build`** — успешен.

**Валидация перехода на Этап 3:** `npx tsc --noEmit` + `npm run build` + ручной тест + подтверждение Владимира.

---

## Этап 3 — Чистка БД и финализация

**Цель этапа:** физически удалить мусорные записи из базы, обновить документацию, закрыть ТЗ.

**Риск этапа:** низкий. Правило «data in dev is worthless» подтверждено Владимиром в сессии 2026-04-13.

### Задачи

- [ ] **3.1** Pre-delete audit: посчитать сколько записей будет удалено
  - `SELECT COUNT(*), chatMode FROM "Chat" WHERE chatMode='chat' OR chatMode IS NULL GROUP BY chatMode;`
  - Показать Владимиру результат
  - **Дождаться явного подтверждения** «ок, сноси»

- [ ] **3.2** SQL cleanup
  - `DELETE FROM "Chat" WHERE chatMode='chat' OR chatMode IS NULL;`
  - Связанные записи из `Message_v2` удалятся по каскаду (проверить, что FK на `Chat` имеет `ON DELETE CASCADE` — если нет, удалить сообщения первым запросом)
  - Verify: `SELECT COUNT(*) FROM "Chat" WHERE chatMode='chat' OR chatMode IS NULL;` → 0

- [ ] **3.3** Документация
  - `docs/ai-chats-map.md` — обновить примеры `chat:sonnet` → `expertise`, убрать упоминания «обычного чата»
  - `docs/ai-providers.md` — проверить если есть упоминания `chat:*`, обновить
  - `docs/model-catalog-ops.md` — то же
  - `CLAUDE.md` — в секции "Chat History" убрать упоминание `/chats` и `chatMode='chat'`; обновить описание sidebar и режимов
  - `SIMPLY_STATUS.md` — добавить запись о завершённом ТЗ-LegacyChatCleanup в «Завершены»

- [ ] **3.4** CHANGELOG ТЗ — зафиксировать все найденные и исправленные костыли
  - Файл: `specs/TZ_LegacyChatCleanup/CHANGELOG.md`
  - Структура: список костылей по файлам, что исправлено, почему было костылём

- [ ] **3.5** ADR (опционально)
  - Если по ходу ТЗ возникло архитектурное решение, которое нужно зафиксировать для будущих агентов — создать `docs/decisions/049-legacy-chat-cleanup.md`
  - Критерий: «решение не очевидно из кода и имеет долгосрочные последствия» (например, «chatMode сделан обязательным во всех API — никаких дефолтов»)

- [ ] **3.6** HANDOFF ТЗ
  - `specs/TZ_LegacyChatCleanup/HANDOFF.md` — краткая передача состояния (для будущих сессий)

- [ ] **3.7** Финальный `npm run build`

- [ ] **3.8** Финальный мануальный regression-тест
  - Simply / expertise / create / projects / dashboard / settings / /context / /dev/models
  - Чат в каждом режиме: отправить сообщение, получить ответ
  - dev override `expertise` на другую модель → проверить что сообщение идёт на новую модель

- [ ] **3.9** Обновить auto-memory (если нужно)
  - Зафиксировать принцип «dev-режим: данные в БД ничего не стоят, можно чистить» как feedback memory
  - Обновить project memory про текущие tасk assignments если в memory есть устаревшая информация

- [ ] **3.10** Git commit
  - **Только по явному запросу Владимира**
  - Формат коммита соответствует конвенции проекта: `refactor(tz-legacychatcleanup): удалить legacy режим обычного чата`

### Definition of Done всего ТЗ

- [x] SPEC.md + ANALYSIS.md с ответами на все вопросы
- [x] ROADMAP.md (этот файл) с принятым планом
- [ ] Все 3 этапа завершены
- [ ] `npx tsc --noEmit` → 0 ошибок
- [ ] `npm run build` → успешен
- [ ] Мануальный regression-тест пройден
- [ ] БД очищена от мусорных записей
- [ ] Документация обновлена
- [ ] SIMPLY_STATUS.md обновлён
- [ ] ТЗ-LegacyChatCleanup перемещено в `_archive/` (в следующую сессию после подтверждения стабильности)

---

## Ожидаемая длительность

- **Этап 1**: 1 рабочая сессия (~2–3 часа агент-времени + мануал-тест)
- **Этап 2**: 1 рабочая сессия (~2 часа агент-времени + мануал-тест)
- **Этап 3**: 0.5 сессии (SQL + docs + commit)

**Итого: 2–3 сессии с явными break-point'ами между ними.**
