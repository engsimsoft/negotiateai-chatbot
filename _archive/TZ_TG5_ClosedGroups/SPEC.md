# ТЗ-TG5: Чтение закрытых групп через бота

**Цель:** @GetSimplyBot, добавленный в закрытую группу, сохраняет сообщения в БД Simply. Данные доступны для просмотра в UI и готовы к использованию AI-инструментами в Фазе 3.

**Одно предложение:** Бот в группе → webhook ловит сообщения → PostgreSQL → UI показывает группы и их содержимое.

---

## Зачем

Публичные каналы мы уже читаем через скрейпинг (TG1). Но закрытые рабочие группы — основной источник оперативной информации для бизнеса. Пример: группа SHORTCUT INFO (71 участник, форум с топиками: Общение, Техническая информация, РСКГ 2026, Документы). Скрейпинг туда не заходит — нужен бот.

---

## Что нужно сделать

### 1. Обработка group events в боте

Расширить `lib/telegram/bot.ts`:

**`my_chat_member` handler** — бот добавлен/удалён из группы:
- Бот добавлен (status: `member` или `administrator`) → создать запись TelegramGroup в БД
- Автопривязка к пользователю: `from.id` → найти в TelegramConnection → записать `ownerUserId`
- Если TelegramConnection не найден → `ownerUserId = null` (группа бесхозная)
- Бот удалён (status: `left` или `kicked`) → деактивировать группу (`isActive = false`)

**`message` handler для групп** — новое сообщение в группе:
- Фильтр: только `group` и `supergroup` chat types
- Сохранить в TelegramMessage: текст, автор, дата, topicId (если forum), наличие медиа
- НЕ сохранять: сервисные сообщения (user joined, pinned message и т.п.), сообщения без текста и без caption

**`forum_topic_created` / `forum_topic_edited`** — управление топиками:
- Создать/обновить запись TelegramGroupTopic (topicId, name, groupId)

### 2. Таблицы БД

**TelegramGroup:**
- `id` (uuid, PK)
- `telegramChatId` (bigint, unique) — ID чата в Telegram
- `title` (varchar) — название группы
- `type` (varchar) — "group" | "supergroup"
- `isForum` (boolean) — есть ли топики (forum mode)
- `ownerUserId` (uuid, FK → User, nullable) — кто добавил бота
- `isActive` (boolean, default true) — бот в группе
- `memberCount` (integer, nullable)
- `createdAt`, `updatedAt`

**TelegramGroupTopic:**
- `id` (uuid, PK)
- `groupId` (uuid, FK → TelegramGroup)
- `telegramTopicId` (integer) — Telegram thread ID
- `name` (varchar) — название топика
- `createdAt`

**TelegramMessage:**
- `id` (uuid, PK)
- `groupId` (uuid, FK → TelegramGroup)
- `topicId` (uuid, FK → TelegramGroupTopic, nullable) — если сообщение в топике
- `telegramMessageId` (integer) — ID сообщения в Telegram
- `fromUserId` (bigint) — Telegram user ID автора
- `fromUsername` (varchar, nullable)
- `fromFirstName` (varchar, nullable)
- `text` (text) — текст сообщения или caption
- `hasMedia` (boolean) — есть ли фото/видео/документ
- `mediaType` (varchar, nullable) — "photo" | "video" | "document" | "voice" | "sticker"
- `sentAt` (timestamp) — дата отправки в Telegram
- `createdAt` — дата сохранения в Simply

Индексы:
- `(groupId, sentAt)` — выборка сообщений группы по времени
- `(groupId, topicId, sentAt)` — выборка по топику

### 3. API endpoints

**GET `/api/telegram/groups`** — список групп текущего пользователя
- Возвращает: группы с ownerUserId = текущий юзер, isActive, кол-во сообщений, последнее сообщение
- Auth required

**GET `/api/telegram/groups/[groupId]/messages`** — сообщения группы
- Пагинация: `?cursor=&limit=50`
- Фильтр по топику: `?topicId=`
- Auth: проверка что группа принадлежит пользователю

**DELETE `/api/telegram/groups/[groupId]`** — отключить группу
- Деактивирует группу (isActive = false)
- НЕ удаляет сообщения (могут понадобиться)
- Бот остаётся в группе (удалять бота из группы программно — дурной тон)

### 4. UI

Новая страница **`/settings/groups`** или секция в настройках. Минимальный UI:

**Список групп:**
- Название группы, тип (группа/форум), статус (активна/неактивна)
- Количество сообщений, дата последнего
- Кнопка "Отключить"

**Просмотр группы** (при клике):
- Если форум → список топиков с количеством сообщений
- Лента сообщений (простой список: автор, текст, дата)
- Пагинация (scroll или кнопка "Загрузить ещё")

**Empty state:** "Добавьте @GetSimplyBot в вашу группу в Telegram — она появится здесь автоматически."

UI должен быть утилитарным — это просмотр данных, не чат-интерфейс. Таблица/список, не пузырьки.

---

## Ключевые ограничения

- **Privacy:** бот читает только те группы, куда его явно добавили. Не мониторит ничего за пределами.
- **Медиа не скачиваем:** сохраняем только флаг `hasMedia` и `mediaType`. Файлы остаются в Telegram. В будущем (если потребуется для RAG) можно добавить скачивание.
- **Rate limits:** Telegram не лимитирует получение webhook updates, но мы лимитируем запись в БД — batch insert если много сообщений одновременно.
- **Историю не подтягиваем:** бот получает только новые сообщения с момента добавления. Историю до добавления бота Telegram не отдаёт через Bot API (это ограничение платформы).
- **Один владелец на группу:** `ownerUserId` — кто добавил бота. В MVP одна группа принадлежит одному пользователю Simply.

---

## Чего НЕ делать в этом ТЗ

- AI-анализ сообщений (Фаза 3, TG6)
- Интеграция с брифингом как источник (отдельное ТЗ)
- Полнотекстовый поиск по сообщениям (Фаза 3)
- RAG-индексация (Фаза 4, TG9)
- Скачивание и хранение медиафайлов

---

## Критерий приёмки

1. **Автопривязка:** Добавить @GetSimplyBot в тестовую группу → группа автоматически появляется в Simply UI
2. **Сообщения сохраняются:** Написать сообщение в группу → оно появляется в БД и в UI
3. **Топики работают:** В форум-группе (SHORTCUT INFO) сообщения группируются по топикам
4. **UI показывает:** Список групп, переход в группу, просмотр сообщений по топикам
5. **Деактивация:** Удалить бота из группы → группа помечается неактивной в Simply
6. **Отключение:** В UI нажать "Отключить" → группа деактивирована, сообщения сохранены

---

## Тестовый сценарий

Группа **SHORTCUT INFO**: 71 участник, форум с топиками.
1. Добавить @GetSimplyBot в SHORTCUT INFO
2. Бот детектирует форум → создаёт группу + топики (Общение, Техническая информация, РСКГ 2026, Документы)
3. Написать тестовое сообщение в топик "Техническая информация"
4. В Simply → Настройки → Группы → SHORTCUT INFO → Техническая информация → сообщение видно

---

## Контекст для Claude Code

- Bot: `lib/telegram/bot.ts` (grammY, singleton, webhook)
- Webhook: `app/api/telegram/webhook/route.ts`
- TelegramConnection: `lib/db/schema.ts`, `lib/db/queries.ts`
- Middleware: `/api/telegram/webhook` уже исключён из auth
- Settings UI: `app/(dashboard)/settings/settings-page.tsx`
- grammY docs: `bot.on("my_chat_member")`, `bot.on("message")`, `ctx.message.message_thread_id` для forum topics
