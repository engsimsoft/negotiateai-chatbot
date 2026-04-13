# Анализ ТЗ-LegacyChatCleanup

**Дата анализа:** 2026-04-13

---

## Резюме

В репозитории есть два параллельных «пласта» чата: (1) **legacy «обычный чат»** — `chatMode="chat"` + маршрут `/chat/[id]` + страница `/chats` + задания `chat:haiku|sonnet|opus`, (2) **фактическая архитектура** — Simply (вечный) + expertise/create (разовые запросы) + projects. Legacy мёртв концептуально, но физически ещё в коде и путает dev panel. Задача — выпилить legacy, привести task-assignments к реальности (`expertise`→Grok Multi-Agent, `create`→MiniMax), при этом **не удаляя исторические записи в DB** и попутно поймать костыли прошлых агентов.

---

## 0. Изученная документация (Правило 1 WORKFLOW)

| Технология | Источник | Что проверено |
|---|---|---|
| xAI Grok catalog | `lib/ai/model-catalog.ts:280-351` — комментарий «pricing verified against docs.x.ai/docs/models (2026-04-12)» | Модель `grok-4.20-multi-agent-0309` уже в каталоге. WebFetch xAI docs не требуется: аудит был сделан на той же неделе. Если на этапе внедрения модель не запустится — обязательно повторная сверка с docs.x.ai. |
| MiniMax M2.7 | `docs/ai-minimax.md` + `lib/ai/model-catalog.ts` | Уже активная модель, используется в Simply, briefing, memory. Добавление её как дефолта для `create` таски не требует интеграционных работ. |
| Anthropic SDK / streamText | Без изменений — просто удаление условных веток | Не требуется. |

Подтверждение: каталог синхронизирован с xAI 2026-04-12, id корректен. Если при мануальном тесте появятся ошибки 404/400 от xAI API — обновить id через повторный WebFetch.

---

## 1. Карта касаний `chatMode="chat"` / `chat:*` / `/chat/[id]`

### 1.1. Task-assignments и реестр моделей

| Файл | Строки | Что | Действие |
|---|---|---|---|
| `lib/ai/task-assignments.ts` | 30–32 (TaskId union), 91–93 (DEFAULT_TASK_MODELS), 12 (комментарий-конвенция) | Три таска `chat:haiku/sonnet/opus` | Удалить три записи + три строки union. Добавить `expertise` и `create` |
| `lib/ai/chat-mode-config.ts` | 14 (zod enum), 29–48 (CHAT_MODE_CONFIG), 55–65 (getTaskIdForChatMode) | Ветки `"chat"` везде + маппинг `expertise`/`create` → `chat:sonnet` | Убрать `"chat"` из schema, удалить `CHAT_MODE_CONFIG.chat`, перенаправить expertise→`"expertise"`, create→`"create"` |
| `lib/ai/debug-events.ts` | 93 | Комментарий упоминает `"chat:sonnet"` как пример taskId | Заменить пример на `"expertise"` или `"simply-chat"` |
| `docs/decisions/047-core-model-registry.md` | 81 | Исторический ADR упоминает старые таски | **Не трогать** — ADR фиксирует состояние на момент принятия решения |
| `docs/ai-chats-map.md` | 607 | Пример в документации | Обновить пример на актуальный |
| `_archive/TZ1_CoreRegistry/**` | — | Архив предыдущего ТЗ | **Не трогать** |

### 1.2. Маршруты (удаляются целиком)

| Путь | Что | Кто импортирует |
|---|---|---|
| `app/(chat)/chat/[id]/page.tsx` | Страница открытого «обычного чата» с redirect expertise/create наружу (legacy) | — нет внутренних импортов |
| `app/(chat)/chat/page.tsx` | «Новый обычный чат» (генерирует UUID, читает `?mode=`) | — нет внутренних импортов |
| `app/(dashboard)/chats/page.tsx` | Список обычных чатов, импортирует `getGeneralChatsWithStats` и `ModeChatsPage` | — нет внутренних импортов |

**Blast radius**: всё удаляется без внешних импорт-связей, только навигационные ссылки нужно вычистить.

### 1.3. Навигация на мёртвые URL

| Файл | Строки | Что | Действие |
|---|---|---|---|
| `components/app-sidebar.tsx` | 27 (type literal), 57 (default context), 87–118 (getContextTitle/getAllChatsHref/getAllChatsLabel/getNewChatLabel — все с default "Чаты"/"/chats"/"Все чаты"/"Новый чат") | Четыре default-ветки после удаления `"chat"` становятся недостижимыми | **Открытый вопрос Q1**: каким должен быть fallback для неизвестного контекста? |
| `lib/utils.ts` | 79–88 (getChatUrl switch) | Default возвращает `/chat/${chatId}` | **Открытый вопрос Q1 (тот же)** |
| `components/suggested-actions.tsx` | 42 | `getChatUrl(chatId, chatMode)` | Работает через утилиту — правится автоматически при правке `getChatUrl` |
| `components/sidebar-history-item.tsx` | 84 | То же | То же |
| `components/chat.tsx` | 391, 400 | То же — `replaceState` после первого `onFinish` | То же |
| `components/multimodal-input.tsx` | 186 | То же | То же |
| `components/chats/chat-list-item.tsx` | 111 | `<Link href={getChatUrl(chat.id, chat.chatMode)}>` — элемент в списке /expertise/create | Работает через утилиту |
| `components/chats/chat-detail-panel.tsx` | 69 | `<Link href={getChatUrl(chat.id, chat.chatMode)}>` — кнопка «Открыть» | Работает через утилиту |
| `components/chats/mode-chats-page.tsx` | 76 (`chatMode !== "chat"`), 81 | Явное исключение режима `"chat"` из UUID-навигации | Условие `!== "chat"` станет всегда true — ветку можно убрать и сделать безусловно UUID |

### 1.4. API / schema / persistence

| Файл | Строки | Что | Действие |
|---|---|---|---|
| `app/(chat)/api/chat/schema.ts` | 31 | `chatMode: chatModeSchema.default("chat")` | **Открытый вопрос Q2**: дефолт → `"simply"`? Или сделать обязательным? |
| `app/(chat)/api/chat/route.ts` | 16, 17, 353–356, 603, 610–630 | Импортирует `buildChatPrompt`, `getTaskIdForChatMode`; есть ветвления по `chatMode` | Удалить ветку `chatMode==="chat"` из builder switch. `getTaskIdForChatMode` уже будет без ветки `"chat"` после правки chat-mode-config |
| `lib/db/queries.ts` | 197–216 (saveChat) | `chatMode: chatMode || "chat"` — **костыль**: дефолт `"chat"` | **Fix**: параметр `chatMode` обязательный, `|| "chat"` убираем. Все вызовы `saveChat` обязаны передать осмысленный режим. |
| `lib/db/queries.ts` | 378–410 (history listing) | Фильтр `ne(chat.chatMode, "simply")` + optional `eq(chat.chatMode, chatMode)` | Добавить `ne(chat.chatMode, "chat")` чтобы исторические legacy-чаты не просачивались в /expertise и /create списки |
| `lib/db/queries.ts` | 2031 (getGeneralChatsWithStats) | Используется **только** удаляемой страницей `/chats` | **Удалить функцию** целиком вместе со страницей |
| `lib/db/schema.ts` | колонка `chatMode` в `Chat` | Тип — nullable string | Не трогать — это историческая колонка, `chatMode='chat'` остаётся валидным значением в данных |

### 1.5. Prompts builder

| Файл | Что | Действие |
|---|---|---|
| `lib/prompts/server.ts` | Реэкспорт `buildChatPrompt` | Проверить: используется ли `buildChatPrompt` только legacy-чатом или также expertise/create/simply |
| `lib/prompts/builder/index.ts:76, 189–202` | `buildChatPrompt(context)` + `@deprecated` обёртки | `buildExpertisePrompt`/`buildCreatePrompt` существуют (видны в `route.ts:17`) — значит `buildChatPrompt` = legacy. **Проверить** в фазе кода, и если подтвердится — удалить целиком |

**Подозрение**: `buildChatPrompt` — это legacy билдер под `chatMode="chat"`, после удаления режима он больше не нужен. Но это обязательно перепроверить чтением файла в фазе кода, не по grep.

### 1.6. Legacy cookie-based model selector

| Файл | Что | Действие |
|---|---|---|
| `lib/ai/models.ts` | `DEFAULT_CHAT_MODEL = "claude-sonnet"` + `chatModels[]` (3 record'а с human-readable именами и строками pricing) | **Костыль / мёртвый код** — оставшийся от старого UI-селектора моделей до CoreRegistry. Строки pricing (`"$3"`/`"$15"`) — rot'ом задеты, не синхронизированы с каталогом. |
| Импортёры `DEFAULT_CHAT_MODEL` | `app/(chat)/chat/page.tsx`, `app/(chat)/chat/[id]/page.tsx`, `app/(expertise)/expertise/[id]/page.tsx`, `app/(create)/create/[id]/page.tsx`, `app/(chat)/simply/page.tsx` | Все передают результат как `initialChatModel` prop в `Chat`. Этот prop больше не влияет на резолв моделей (после ТЗ-1), только как cookie-value для UI-селектора, которого нет. |

**Открытый вопрос Q3**: удаляем `lib/ai/models.ts` целиком? Нужно проверить, читает ли `components/chat.tsx` проп `initialChatModel` хоть где-то осмысленно, или он 100% мёртв.

---

## 2. Костыли и заплатки, найденные по пути

Зафиксирую уже обнаруженные. В фазе кода каждый затронутый файл читается целиком, список пополнится.

### 2.1. Подтверждённые (найдены на стадии карты)

1. **`lib/db/queries.ts:216`** — `chatMode: chatMode || "chat"` в `saveChat`. Дефолт `"chat"` превращает любой chatless-вызов в обычный чат. После удаления режима это сразу ломает constraint. Правильно — обязательный параметр.
2. **`app/(chat)/api/chat/schema.ts:31`** — `chatMode: chatModeSchema.default("chat")`. То же самое на API-границе.
3. **`lib/ai/task-assignments.ts:32`** — `"chat:opus" | // зарезервирован (tier opus)`. Таск существует, но **никто его не резолвит**. Комментарий «зарезервирован» без ADR/use case — это классический мёртвый fallback, а не «зарезервированная функциональность».
4. **`components/chats/mode-chats-page.tsx:76–84`** — ветвление `chatMode !== "chat"` как триггер для UUID-навигации вместо `createButton.href`. Это костыль эпохи миграции `/chat → /expertise`: для «обычного чата» оставили старую href-кнопку, для новых режимов — UUID. После удаления `"chat"` условие упрощается до безусловной UUID-ветки.
5. **`app/(chat)/chat/[id]/page.tsx:33–35`** — `if (chat.chatMode === "expertise" || chat.chatMode === "create") { redirect(...) }`. Это compatibility shim для старых ссылок, после удаления маршрута он исчезает вместе с файлом.
6. **`lib/ai/models.ts`** — целиком мёртвый legacy-селектор моделей (см. раздел 1.6).

### 2.2. Что **может** оказаться костылём (перепроверить при чтении файла)

- `lib/prompts/builder/index.ts:189–197` — два `@deprecated` варианта `buildChatPrompt`. Почему «deprecated», но код остался? Проверить, удалять или оставить.
- `components/chat.tsx` — состояние `think` прокидывается для всех chatMode. Надо убедиться, что Think-кнопка в expertise/create действительно нужна (из тебя я понял — только Simply имеет Think). Если в expertise/create она не используется, скрыть её там.
- `app/(chat)/api/chat/route.ts` весь целиком — читать в фазе кода. Там 1000+ строк и они известны как место концентрации шорткатов (по памяти проекта).

---

## 3. Открытые вопросы (ответь перед ROADMAP)

### Q1. Default fallback в `getChatUrl` и `getSidebarContext`

После удаления `chatMode="chat"`:

- `getChatUrl(id, chatMode)` — если пришёл неизвестный `chatMode` (например, легаси `"chat"` из DB), какой URL возвращать?
  - **(a)** `"/simply"` — пользователь попадает в свой постоянный чат
  - **(b)** `"/dashboard"` — на главную
  - **(c)** throw `Error` — быстро находит баги, но может упасть прод
- `getSidebarContext(pathname)` — аналогично: если URL не матчится ни с одним известным префиксом, какой дефолт?
  - **(a)** `simply` — кажется безопаснее всего
  - **(b)** оставить `expertise` / что-то ещё

**Рекомендация**: (a) в обоих случаях — `"/simply"` / `simply`. Это семантически правильно: Simply теперь «домашний» чат, и если UI не понимает контекст, уместно показать Simply-ориентированный sidebar.

### Q2. Дефолт `chatMode` в API schema и `saveChat`

После удаления `"chat"`:

- В `app/(chat)/api/chat/schema.ts:31` — что поставить вместо `default("chat")`?
  - **(a)** `.default("simply")` — но по логике simply создаётся через `getOrCreateSimplyChat`, не через обычный POST
  - **(b)** сделать обязательным (убрать `.default()`) — chatMode придётся всегда явно передавать
- В `lib/db/queries.ts:216` — `saveChat({ chatMode })` — сделать обязательным параметром?

**Рекомендация**: (b) для обоих — сделать обязательным. Это строго, но после чистки все call-sites известны и легко обновляются. Обязательность compile-time ловит любые будущие забывания.

### Q3. Удаляем ли `lib/ai/models.ts` и проп `initialChatModel` целиком

Если `initialChatModel` физически не влияет на резолв модели (а только через cookie сохраняется в браузере как legacy UI-preference), его можно удалить вместе с `DEFAULT_CHAT_MODEL` и `chatModels[]`, упростив все 5 страниц чата на 3–4 строки каждую.

**Рекомендация**: удалить. Но сначала в фазе кода полностью прочитать `components/chat.tsx` и убедиться, что `initialChatModel` prop нигде не влияет на поведение (логично — cookie-based UI selector был заменён на `/dev/models` и `chatMode` server-side).

### Q4. Что делать с историческими чатами `chatMode='chat'` в DB

Правило: **не удалять**. Вариант: добавить в `sidebar-history` и `/expertise`/`/create` списки фильтр `ne(chat.chatMode, 'chat')` чтобы старые чаты не просачивались в UI (иначе клик по элементу ведёт на 404). Исторические чаты становятся невидимыми, но не уничтоженными — при необходимости SQL-запросом можно их достать.

**Рекомендация**: подтверди, что такой подход устраивает (данные целы, доступ через UI закрыт).

### Q5. Simply как единственная точка чата — переход с экспертизы/создания обратно в Simply

Текущий UX: в sidebar есть отдельные пункты «Simply», «Новый запрос» (для expertise), «Новое задание» (для create). После чистки эта структура остаётся. Подтверди, что это правильная модель (мы не схлопываем экспертизу/создание в один «запрос» — они остаются двумя отдельными списками в sidebar).

---

## 4. Потенциальные риски

| Риск | Вероятность | Влияние | Митигация |
|---|---|---|---|
| В `route.ts` (1000+ строк) остались неочевидные ветки `chatMode === "chat"` | Средняя | Средняя — runtime ошибка | Полное чтение файла в фазе кода + `tsc --noEmit` после каждой правки |
| `buildChatPrompt` используется expertise/create (не только legacy), тогда удалить нельзя | Средняя | Высокая — сломает expertise/create | Перед удалением `buildChatPrompt` — grep по проекту + чтение `lib/prompts/builder/index.ts` целиком |
| `DEFAULT_CHAT_MODEL = "claude-sonnet"` cookie где-то сравнивается со строкой и ветвит логику | Низкая | Средняя | Grep по `DEFAULT_CHAT_MODEL` и `claude-sonnet` перед удалением файла |
| Исторические чаты `chatMode='chat'` начнут 404-ить в sidebar-history | Высокая | Низкая | Добавить фильтр `ne('chat')` в queries |
| Grok 4.20 Multi-Agent через xAI API вернёт 404 (рассинхрон каталога и API) | Низкая | Средняя | На этапе мануального теста — проверить реальный ответ от xAI. При ошибке — WebFetch актуальных docs |
| dev panel `/dev/models` хардкодит `chat:*` где-то за пределами `DEFAULT_TASK_MODELS` | Низкая | Низкая | `grep chat:haiku chat:sonnet chat:opus` перед финальной сборкой |

---

## 5. Зависимости

**Что нужно до начала:**
- [x] SPEC.md — готов
- [x] ANALYSIS.md — готов (этот файл)
- [ ] Ответы Владимира на Q1–Q5
- [ ] ROADMAP.md с этапами и точками валидации

**Затронутые компоненты (полный список):**
- `lib/ai/task-assignments.ts` — удалить `chat:*`, добавить `expertise`, `create`
- `lib/ai/chat-mode-config.ts` — удалить ветку `"chat"`
- `lib/ai/debug-events.ts` — обновить комментарий
- `lib/ai/models.ts` — удалить (Q3)
- `lib/utils.ts` (getChatUrl) — новый default
- `lib/db/queries.ts` — saveChat обязательный chatMode, удалить getGeneralChatsWithStats, фильтр `ne('chat')` в history
- `lib/prompts/server.ts`, `lib/prompts/builder/index.ts` — возможно удалить `buildChatPrompt`
- `app/(chat)/chat/**` — удалить папку
- `app/(dashboard)/chats/**` — удалить папку
- `app/(chat)/api/chat/route.ts` — удалить ветку chatMode='chat'
- `app/(chat)/api/chat/schema.ts` — новый дефолт (Q2)
- `components/app-sidebar.tsx` — убрать ChatMode="chat", default-ветки
- `components/chats/mode-chats-page.tsx` — упростить UUID-ветку
- `components/chats/chat-list.tsx|chat-list-item.tsx|chat-detail-panel.tsx` — fallback через getChatUrl автоматический
- `components/chat.tsx`, `components/multimodal-input.tsx` — проверить условные ветки
- `components/sidebar-history*` — проверить фильтрацию
- `docs/ai-chats-map.md` — обновить примеры
- `docs/model-catalog-ops.md` / `docs/ai-providers.md` — обновить если есть упоминания chat:*

---

## 6. Оценка

- [x] Среднее (3–5 сессий)
- [ ] Простое
- [ ] Сложное

**Обоснование**: удалений много, но blast radius хорошо изолирован (legacy-код физически отделён от Simply/expertise/create/projects). Ключевой риск — `route.ts`, нужно читать аккуратно. Валидация после каждого этапа (`tsc --noEmit`) ловит компилятор-ошибки сразу. Финальная валидация — `npm run build` + мануальный тест пользователем. Ориентировочно: 3 этапа по 1 сессии каждый, плюс финализация.

---

## 7. Принятые решения

> Согласовано с Владимиром в сессии 2026-04-13

1. **Q1 (fallback getChatUrl):** `getChatUrl` при неизвестном режиме — **throw Error**. Страница чата (`/expertise/[id]`, `/create/[id]`) при обнаружении записи с неизвестным режимом возвращает `notFound()` → 404. Это честный сигнал «такой ветки нет» вместо тихого редиректа на Simply.

2. **Q2 (default chatMode в API/saveChat):** `chatMode` — **обязательное поле**, без `.default()`. Каждое место в коде обязано явно указывать режим. Компилятор ловит забывания на этапе сборки.

3. **Q3 (удаление lib/ai/models.ts):** **Удалить целиком** вместе с `DEFAULT_CHAT_MODEL`, массивом `chatModels[]`, и `initialChatModel` prop'ом во всех 5 страницах чата и в `components/chat.tsx` (если проп физически мёртв — предварительно перепроверить чтением файла в фазе кода).

4. **Q4 (исторические chatMode='chat' в DB):** Владимир подтвердил — **данные в базе ничего не стоят, это тестовые записи в режиме разработки, можно физически удалять**. Подход:
   - Этап DB cleanup: одним SQL-запросом удалить все записи `WHERE chatMode='chat'` из таблицы `Chat` (связанные сообщения удалятся по каскаду)
   - Перед удалением — показать Владимиру `SELECT COUNT(*)` для подтверждения порядка цифр
   - После удаления никакая фильтрация `ne('chat')` в коде не нужна — база чиста
   - **Это снимает прежнее правило «никогда не удалять чаты без разрешения» — разрешение получено явно, в рамках этого ТЗ**

5. **Q5 (sidebar после чистки):** Подтверждено:
   - Всегда видимо: Главная, Simply
   - В контексте expertise: кнопка «Новый запрос» + список всех запросов
   - В контексте create: кнопка «Новое задание» + список всех заданий
   - В контексте проекта: список веток чатов проекта
   - На главной/настройках/`/context`/`/dev/models`: только верхний блок, без списков
   - Simply не имеет списков — это один вечный чат
   - Общий пункт «Все чаты» / «Новый чат» — удаляется полностью
