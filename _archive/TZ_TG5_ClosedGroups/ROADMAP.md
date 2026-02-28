# Roadmap ТЗ-TG5: Чтение закрытых групп через бота

**Создан:** 2026-02-28
**Версия проекта:** 3.55.0 → 3.56.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 5 |
| Текущий этап | 1 |
| Сессий (оценка) | 3-4 |

---

## Этап 1: Database — схема, миграция, queries

**Статус:** ✅ Завершён

**Цель:** 3 новые таблицы в PostgreSQL + CRUD queries для работы с группами, топиками, сообщениями.

**Задачи:**
- [x] Добавить таблицу `TelegramGroup` в `lib/db/schema.ts`
- [x] Добавить таблицу `TelegramGroupTopic` в `lib/db/schema.ts`
- [x] Добавить таблицу `TelegramMessage` в `lib/db/schema.ts`
- [x] Создать Drizzle миграцию (0041_telegram-groups.sql, вручную — drizzle-kit interactive)
- [x] Применить миграцию: `npm run db:migrate`
- [x] Добавить queries в `lib/db/queries.ts` (11 queries):
  - `upsertTelegramGroup`, `getTelegramGroupByChatId`, `deactivateTelegramGroup`, `deactivateTelegramGroupById`
  - `getTelegramGroupsByOwner`, `getTelegramGroupById`
  - `upsertTelegramGroupTopic`, `getTelegramGroupTopics`, `getTelegramTopicByTelegramId`
  - `createTelegramMessage`, `getTelegramMessages`

**Файлы:**
- `lib/db/schema.ts` — 3 новые таблицы + типы
- `lib/db/queries.ts` — ~10 новых queries
- `lib/db/migrations/` — новая миграция

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Миграция применена к production БД
- [x] SQL-проверка: 5 Telegram-таблиц (TelegramConnection, TelegramGroup, TelegramGroupTopic, TelegramLinkToken, TelegramMessage)
- [x] Индексы проверены: PK + unique telegramChatId + unique (groupId, telegramTopicId) + 2 составных на sentAt
- [x] 🧪 Мануальный тест: подтверждение пользователем

**Git (после валидации):**
```bash
git add lib/db/schema.ts lib/db/queries.ts lib/db/migrations/
git commit -m "feat(tz-tg5): database schema — TelegramGroup, TelegramGroupTopic, TelegramMessage"
```

**Критерий готовности:** 3 таблицы в БД, все queries компилируются.

---

## Этап 2: Bot handlers — обработка групповых событий

**Статус:** ✅ Завершён

**Цель:** Бот обрабатывает добавление/удаление из групп, сохраняет сообщения, отслеживает топики форумов.

**Задачи:**
- [x] Рефакторинг `bot.on("message")` catch-all → private: ответ, group: сохранение
- [x] Добавить `bot.on("my_chat_member")` handler (added/removed, auto-owner, DM notify, forum auto-topic)
- [x] Добавить handler для групповых сообщений (text/caption, media detect, topic resolve/create)
- [x] Добавить handler для `forum_topic_created` / `forum_topic_edited`
- [x] Обновить `setup/route.ts` — `allowed_updates: ["message", "my_chat_member"]`

**Файлы:**
- `lib/telegram/bot.ts` — расширение handlers (~100-150 строк)
- `app/api/telegram/setup/route.ts` — allowed_updates

**Edge cases:**
- Бот добавлен не-Simply пользователем → ownerUserId = null (бесхозная группа)
- Сообщение без текста и без caption (только фото) → пропускаем (НЕ сохранять)
- Сообщение с caption (фото + подпись) → сохранять caption как text, hasMedia = true
- `message_thread_id` для сообщения в неизвестном топике → создать запись с placeholder-именем
- Группа уже существует в БД (бот re-added) → обновить title, isActive = true

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] 🧪 Мануальный тест:
  1. Обновить webhook (POST /api/telegram/setup с allowed_updates)
  2. Добавить бота в тестовую группу → SQL: запись TelegramGroup появилась
  3. Написать сообщение в группу → SQL: запись TelegramMessage появилась
  4. В приватном чате бот по-прежнему отвечает "Я доставляю брифинги"
  5. Удалить бота из группы → SQL: isActive = false

**Git (после валидации):**
```bash
git add lib/telegram/bot.ts app/api/telegram/setup/route.ts
git commit -m "feat(tz-tg5): bot handlers — group events, messages, forum topics"
```

**Критерий готовности:** Бот сохраняет сообщения из групп в БД. Private chat работает как раньше.

---

## Этап 3: API endpoints

**Статус:** ✅ Завершён

✅ Этап 2 подтверждён

**Цель:** REST API для чтения групп и сообщений из фронтенда.

**Задачи:**
- [x] `GET /api/telegram/groups` — список групп текущего пользователя
  - Auth required (NextAuth session)
  - Возвращает: группы с ownerUserId = текущий юзер, isActive, count сообщений, последнее сообщение
  - Сортировка: по последнему сообщению (newest first)
- [x] `GET /api/telegram/groups/[groupId]/messages` — сообщения группы
  - Auth: проверка что группа принадлежит пользователю
  - Пагинация: `?cursor={sentAt}&limit=50`
  - Фильтр по топику: `?topicId={uuid}`
  - Возвращает: messages[] + nextCursor + topics[] (если группа — форум)
- [x] `DELETE /api/telegram/groups/[groupId]` — деактивировать группу
  - Auth: проверка что группа принадлежит пользователю
  - Ставит isActive = false
  - Не удаляет сообщения
  - Возвращает: `{ success: true }`

**Файлы:**
- `app/(chat)/api/telegram/groups/route.ts` — GET (список групп)
- `app/(chat)/api/telegram/groups/[groupId]/messages/route.ts` — GET (сообщения)
- `app/(chat)/api/telegram/groups/[groupId]/route.ts` — DELETE (деактивация)

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] 🧪 Мануальный тест: curl/browser → API возвращает данные из БД (группы, сообщения)

**Git (после валидации):**
```bash
git add "app/(chat)/api/telegram/groups/"
git commit -m "feat(tz-tg5): API endpoints — groups list, messages, deactivation"
```

**Критерий готовности:** 3 API endpoints работают, auth проверяется, пагинация работает.

---

## Этап 4: UI — страница /groups

**Статус:** ✅ Завершён

✅ Этап 3 подтверждён

**Цель:** Пользователь видит свои группы и может просматривать сообщения в утилитарном интерфейсе.

**Задачи:**
- [x] Прочитать `docs/design-system.md` (обязательно перед UI)
- [x] Создать страницу `/groups` в dashboard:
  - `app/(dashboard)/groups/page.tsx` — Server Component (auth + fetch groups)
  - `components/groups/groups-page.tsx` — Client Component (основной layout)
- [x] Список групп:
  - Название, тип (группа/форум), статус (активна/неактивна)
  - Количество сообщений, дата последнего
  - Кнопка "Отключить" (→ DELETE API)
  - Утилитарный стиль: таблица/список, не карточки
- [x] Просмотр группы (при клике):
  - Header: название группы, статус, кнопка "← Назад"
  - Если форум → табы с топиками (название + count)
  - Лента сообщений (простой список: автор, текст, дата, hasMedia badge)
  - Пагинация: кнопка "Загрузить ещё" (cursor-based)
- [x] Empty state: "Добавьте @GetSimplyBot в вашу группу в Telegram — она появится здесь автоматически."
- [x] Ссылка в Settings → Connections: "N групп подключено →" (с линком на /groups)

**Файлы:**
- `app/(dashboard)/groups/page.tsx` — Server Component
- `components/groups/groups-page.tsx` — Client Component (список + detail)
- `components/groups/group-list.tsx` — Список групп
- `components/groups/group-detail.tsx` — Просмотр группы (топики + сообщения)
- `components/groups/group-message-list.tsx` — Лента сообщений
- `app/(dashboard)/settings/settings-page.tsx` — ссылка в Connections

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] 🧪 Мануальный тест: подтверждение пользователем
  1. Открыть /groups → список групп с данными ✅
  2. Кликнуть на группу → сообщения видны ✅
  3. Для форум-группы → топики отображаются, фильтрация работает ✅
  4. "Отключить" → не тестировали (единственная группа)
  5. Empty state → подтверждено (другой аккаунт без групп) ✅
  6. Settings → Connections → ссылка ведёт на /groups ✅

**Git (после валидации):**
```bash
git add "app/(dashboard)/groups/" "components/groups/" "app/(dashboard)/settings/settings-page.tsx"
git commit -m "feat(tz-tg5): UI — /groups page with list, detail, topics, messages"
```

**Критерий готовности:** Полный flow: /groups → список → клик → сообщения → отключение.

---

## Этап 5: Финализация

**Статус:** ✅ Завершён

✅ Этап 4 подтверждён
⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../../DOCUMENTATION_GUIDE.md) → пройти чеклист.

**Документация (обязательная):**
- [x] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти "Чек-лист при изменениях"
- [x] Обновить главный CHANGELOG.md (включая file download, message delete, media placeholder)
- [x] Обновить SIMPLY_STATUS.md
- [x] Обновить CLAUDE.md (новые файлы: Telegram Bot groups, /groups page, API routes, file-downloader)
- [x] Обновить package.json: 3.55.0 → 3.56.0

**Документация (по чеклисту — оценить каждый пункт):**
- [x] ADR нужен? → Да: `docs/decisions/028-telegram-closed-groups.md`
- [x] docs/architecture.md нужно обновить? → Да (3 новые таблицы, группы)
- [x] docs/ai-tools.md нужно обновить? → Нет (без AI tools)
- [x] docs/ai-chats-map.md нужно обновить? → Нет (без новых AI чатов)
- [x] docs/ai-agents.md нужно обновить? → Нет
- [x] docs/design-system.md нужно обновить? → Да (новая страница /groups)

**Проверка БД:**
- [x] SQL: все 3 таблицы существуют с правильными колонками (+3 file fields в TelegramMessage)
- [x] SQL: foreign keys корректны
- [x] SQL: индексы созданы (7 индексов)

**Дополнительные фичи (по результатам тестирования):**
- [x] Медиа без подписи — сообщения с файлами без текста сохраняются с плейсхолдером
- [x] Удаление сообщений — DELETE API + trash icon в UI
- [x] Скачивание файлов — Telegram Bot API → Vercel Blob → preview/download в UI
- [x] Миграция 0042_telegram-message-files.sql (fileName, fileSize, blobUrl)

**Завершение:**
- [x] Финальное мануальное тестирование — все фичи подтверждены пользователем
- [ ] Переместить папку в `_archive/`

**Валидация:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Production URL работает
- [x] Документация актуальна (проверено по чеклисту выше)
