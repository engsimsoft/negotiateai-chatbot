# Project Roadmap: Simply

## 🎯 Цель проекта

Трансформировать Family AI Assistant в Simply — платформу AI-агентов для российского рынка с оплатой в рублях и фокусом на качество.

## 📊 Текущий статус

- **Этап:** Этап 3B (завершён)
- **Прогресс:** ТЗ-3B полностью выполнен
- **Следующее:** Этап 4+ — Мультипровайдер, биллинг

## 🚀 Этапы разработки

### Этап 0: Документация и ребрендинг (2-3 дня)

**Цель:** Переименовать проект в "Simply", обновить всю документацию согласно DOCUMENTATION_GUIDE.md

**0.1 Критические документы:**
- [x] Переработать README.md (80-150 строк, ссылки на docs/) (1 час)
- [x] Переработать CLAUDE.md (навигация для AI) (1 час)
- [x] Создать SIMPLY_STATUS.md (из PROJECT_STATUS.md) (1 час)
- [x] Обновить CHANGELOG.md (запись о ребрендинге) (15 мин)

**0.2 Техническая документация (docs/):**
- [x] Обновить docs/architecture.md (1 час)
- [x] Обновить docs/setup.md (30 мин)
- [x] Обновить docs/deployment.md (30 мин)
- [x] Обновить docs/troubleshooting.md (30 мин)
- [x] Обновить docs/ai-capabilities.md (1 час)

**0.3 ADR (Architecture Decision Records):**
- [x] Создать docs/decisions/005-simply-rebrand.md (30 мин)
- [x] Обновить docs/decisions/002-family-bot-concept.md (30 мин)
- [x] Обновить docs/decisions/004-agent-system.md (30 мин)

**0.4 Очистка:**
- [x] Удалить старые файлы (ROADMAP.md, PROJECT_STATUS.md, _archive/) (15 мин)
- [x] Обновить DOCUMENTATION_GUIDE.md (под Simply) (30 мин)
- [x] Обновить package.json (name, description) (15 мин)

**0.5 Код:**
- [x] Обновить lib/ai/prompts.ts (упоминания) (15 мин)
- [x] Обновить artifacts/presentation-pptx/server.ts (15 мин)

**0.6 Финализация:**
- [x] npm run build (проверка) (15 мин)
- [x] Проверить все ссылки в документации (30 мин)
- [x] Коммит: "chore: rebrand Family AI Assistant → Simply" (15 мин)

---

### Этап 1: Архитектура агентов — ТЗ-1 (5-7 дней)

**Цель:** Перенести систему агентов из хардкода в БД. Каталог агентов с UI.

**Детали:** См. [TZ_01_AGENTS_ARCHITECTURE.md](TZ_01_AGENTS_ARCHITECTURE.md)

**1.1 База данных — Миграции:**
- [x] Миграция: таблица `agents` (1 час)
- [x] Миграция: таблица `user_agents` (1 час)
- [x] Миграция: удалить `User.role` (30 мин)
- [x] Миграция: `Chat.agentId` varchar → uuid (1 час)
- [x] npm run db:migrate (15 мин)

**1.2 Схема и типы:**
- [x] Обновить lib/db/schema.ts (1 час)
- [x] Типы: Agent, UserAgent, AgentCapabilities (1 час)

**1.3 Seed данные:**
- [x] Создать seed скрипт (lib/db/seed-agents.ts) (1-2 часа)
- [x] Перенести промпты из .md в seed (1 час)
- [x] Заполнить capabilities для агентов (2 часа)
- [x] Создать агента helper (заглушка) (30 мин)
- [x] Удалить: Кулинар, Астролог, Одессит (15 мин)

**1.4 API endpoints:**
- [x] GET /api/agents (1 час)
- [x] GET /api/agents/:slug (1 час)
- [x] GET /api/user-agents (1 час)
- [x] PATCH /api/chats/:id/agent (1 час)

**1.5 Загрузка промптов:**
- [x] Обновить chat route — агент из БД (2 часа)
- [x] Логика: agents vs user_agents (1 час)
- [x] Удалить lib/ai/agents/index.ts (30 мин)
- [x] Удалить lib/ai/agents/*.md (15 мин)

**1.6 UI — Sidebar:**
- [x] Компонент: Агент-Помощник (1 час)
- [x] Ссылка "Каталог" → /agents (30 мин)
- [x] Секция "Мои агенты" (пустая) (30 мин)
- [x] Обновить sidebar layout (1 час)

**1.7 UI — Каталог /agents:**
- [x] app/agents/page.tsx (2 часа)
- [x] AgentCard компонент (1 час)
- [x] Grid стили (1 час)

**1.8 UI — Страница /agents/[slug]:**
- [x] app/agents/[slug]/page.tsx (2 часа)
- [x] Секции: описание, суперсилы, инструменты (1 час)
- [x] Кнопка "Начать чат" (1 час)
- [x] Кнопка "В мои агенты" (disabled) (15 мин)

**1.9 UI — Индикация в чате:**
- [x] Иконка и имя агента в шапке (1 час)
- [x] Селектор смены агента (1-2 часа)
- [x] Обновление Chat.agentId (30 мин)

**1.10 Финализация:**
- [x] Тест: создание чата из каталога (30 мин)
- [x] Тест: смена агента в чате (30 мин)
- [x] Тест: промпты из БД (30 мин)
- [x] npm run build (15 мин)
- [x] Коммит: "feat: agents UI — ТЗ-1 complete" (15 мин)
- [ ] Deploy на Vercel (15 мин)

---

### Этап 2: Мультиагентный чат — ТЗ-2 (3-5 дней)

**Цель:** @-mentions, полноценный Помощник, Prompt-агент, кнопки действий, подсказки.

**Детали:** См. [TZ_02_MULTIAGENT_CHAT.md](TZ_02_MULTIAGENT_CHAT.md) | [TZ_02_ROADMAP.md](TZ_02_ROADMAP.md)

**2.1 База данных:**
- [x] Миграция: `Message_v2.agentId` (uuid, nullable) (30 мин)
- [x] Backfill: существующие сообщения → agentId из Chat.agentId (30 мин)
- [x] Обновить `lib/db/schema.ts` — поле agentId (30 мин)

**2.2 @-mentions — Парсинг и API:**
- [x] Утилита `parseMention` в `lib/agents/parse-mentions.ts` (1 час)
- [x] API: GET `/api/agents/by-name/:name` (1 час)
- [x] Обновить POST `/api/chat` — @-mention → агент (1-2 часа)
- [x] Сохранение `Message.agentId` + обновление `Chat.agentId` (1 час)

**2.3 @-mentions — UI автокомплит:**
- [x] Компонент `MentionAutocomplete` (1-2 часа)
- [x] Фильтрация списка по мере ввода (30 мин)
- [x] Вставка `@Имя` при Enter/клике (30 мин)
- [x] Закрытие по Escape (15 мин)
- [x] Интеграция в `multimodal-input.tsx` (1-2 часа)

**2.4 Отображение в чате:**
- [x] Иконка и имя агента на сообщениях (1-2 часа)
- [x] Индикатор текущего агента в шапке (1 час)

**2.5 Агент-Помощник:**
- [x] Полный промпт с `{AGENTS_LIST}` (1 час)
- [x] Динамическая подстановка в chat route (1-2 часа)
- [x] Обновить capabilities (30 мин)

**2.6 Prompt-агент:**
- [x] Добавить в `seed-agents.ts` (30 мин)
- [x] Промпт с техниками улучшения запросов (1 час)
- [x] Capabilities и greeting (30 мин)

**2.7 Кнопки действий:**
- [x] Парсинг `[button:Label|payload]` (1 час)
- [x] Рендеринг кнопок в `message.tsx` (1 час)
- [x] Обработка клика → отправка как сообщение (1 час)

**2.8 Подсказки:**
- [x] Компонент `ChatHint` (1 час)
- [x] Логика показа для новых пользователей (30 мин)
- [x] Dismiss → localStorage (30 мин)
- [x] Не показывать если уже использовал @-mentions (30 мин)

**2.9 Финализация:**
- [x] npm run build (15 мин)
- [x] Обновить документацию (30 мин)
- [x] Коммит (15 мин)

---

### Этап 3A: Профиль пользователя — ТЗ-3A (2-3 дня)

**Цель:** Страница настроек, меню пользователя, онбординг, персонализация агентов через user context.

**Детали:** См. [TZ_03A_USER_PROFILE.md](TZ_03A_USER_PROFILE.md)

**3A.1 База данных:**
- [x] Миграция: 5 новых полей в таблице User (displayName, pronouns, occupation, bio, theme)
- [x] npm run db:migrate

**3A.2 API:**
- [x] GET /api/user/profile — получить профиль
- [x] PATCH /api/user/profile — обновить профиль

**3A.3 UI — Страница настроек /settings:**
- [x] app/(chat)/settings/page.tsx (серверная обёртка)
- [x] app/(chat)/settings/settings-page.tsx (клиентский компонент)
- [x] Секция "Профиль": имя, обращение (ты/вы), сфера деятельности, о себе
- [x] Секция "Аккаунт": email (readonly), заглушки для будущих функций
- [x] Секция "Внешний вид": выбор темы (светлая/тёмная/системная)
- [x] components/ui/radio-group.tsx (Radix UI)

**3A.4 UI — Меню пользователя:**
- [x] Редизайн sidebar-user-nav.tsx
- [x] Аватар с первой буквой имени
- [x] Имя вместо email (фоллбэк: username из email)
- [x] Метка "Бесплатный" под именем
- [x] Пункты: Настройки, Тема, Помощь (заглушка), Выйти
- [x] Русификация всех текстов

**3A.5 Динамическое приветствие:**
- [x] Обновить greeting.tsx — динамическое имя через SWR
- [x] Удалить старые артефакты ("Ольга", текст про Gemini)

**3A.6 Интеграция с агентами:**
- [x] buildUserContext в lib/ai/prompts.ts
- [x] Инъекция user context в chat route (все агенты)

**3A.7 Синхронизация темы:**
- [x] hooks/use-theme-sync.ts — синхронизация БД ↔ next-themes
- [x] Подключение в AppSidebar

**3A.8 Онбординг:**
- [x] components/onboarding-dialog.tsx — 3-шаговый модальный диалог
- [x] Шаг 1: Имя
- [x] Шаг 2: Обращение (ты/вы)
- [x] Шаг 3: Сфера деятельности (опционально)
- [x] Интеграция в agent-selector.tsx

**3A.9 Очистка артефактов:**
- [x] system-prompt.md: "Family AI Assistant" → "Simply"

**3A.10 Финализация:**
- [x] npm run build — успешен
- [x] Обновить документацию
- [x] Коммит: 649cb1a "feat: user profile and settings — ТЗ-3A complete"

---

### Этап 3B: Персонализация агентов — ТЗ-3B (2-3 дня)

**Цель:** Диалоговая персонализация агентов — пользователь создаёт персональную копию через скриптованный диалог.

**Детали:** См. [TZ_03B_AGENT_PERSONALIZATION.md](TZ_03B_AGENT_PERSONALIZATION.md) | [TZ_03B_ROADMAP.md](TZ_03B_ROADMAP.md)

**3B.1 Типы и схема БД:**
- [x] Обновить `AgentCustomizations` (brief → expert)
- [x] Убрать неиспользуемые поля из типа

**3B.2 API endpoints:**
- [x] POST /api/user-agents — создание персонального агента
- [x] PATCH /api/user-agents/[id] — обновление
- [x] DELETE /api/user-agents/[id] — удаление (soft delete)
- [x] Queries: createUserAgent, updateUserAgent, deleteUserAgent, getUserAgentsWithSource

**3B.3 Диалог персонализации:**
- [x] Компонент `PersonalizationDialog` (4 шага)
- [x] Шаг 1: Имя агента
- [x] Шаг 2: Стиль общения (Дружелюбный/Деловой/Экспертный)
- [x] Шаг 3: Специализация (опционально)
- [x] Шаг 4: Подтверждение
- [x] Режим редактирования

**3B.4 UI — Кнопка "В мои агенты":**
- [x] `AddToMyAgentsButton` на странице /agents/[slug]
- [x] Проверка "Уже добавлен"

**3B.5 UI — Sidebar:**
- [x] Секция "Мои агенты" с реальными данными
- [x] Меню (⋯) → Редактировать / Удалить
- [x] Иконка базового агента + имя персональной копии

**3B.6 Применение настроек:**
- [x] `buildAgentCustomizations` в lib/ai/prompts.ts
- [x] Chat route: fallback на userAgent
- [x] Применение customizations к system prompt

**3B.7 Удаление:**
- [x] Компонент `DeleteAgentDialog` с подтверждением

**3B.8 Финализация:**
- [x] npm run build — успешен
- [x] Обновить документацию
- [x] Коммит: fdf0cc2

---

## 📝 Текущая сессия

**2026-01-29 — ТЗ-3B:**
- [x] Обновлён тип AgentCustomizations (brief → expert)
- [x] API: POST /api/user-agents (создание)
- [x] API: PATCH /api/user-agents/[id] (обновление)
- [x] API: DELETE /api/user-agents/[id] (soft delete)
- [x] Queries: createUserAgent, updateUserAgent, deleteUserAgent, getUserAgentsWithSource
- [x] PersonalizationDialog — 4 шага + режим редактирования
- [x] AddToMyAgentsButton — кнопка на странице агента
- [x] DeleteAgentDialog — подтверждение удаления
- [x] Sidebar: секция "Мои агенты" с меню действий
- [x] buildAgentCustomizations — применение стиля и специализации
- [x] Chat route: fallback на userAgent, применение customizations
- [x] npm run build — успешно
- ✅ ТЗ-3B завершён

**2026-01-29 — ТЗ-3A:**
- [x] Миграция: 5 новых полей User (displayName, pronouns, occupation, bio, theme)
- [x] API: GET/PATCH /api/user/profile
- [x] Страница настроек /settings с 3 секциями
- [x] Редизайн меню пользователя (sidebar-user-nav.tsx)
- [x] Онбординг для новых пользователей (onboarding-dialog.tsx)
- [x] Динамическое приветствие (greeting.tsx)
- [x] User context injection в system prompts агентов
- [x] Синхронизация темы БД ↔ next-themes
- [x] Очистка артефактов (Family AI → Simply)
- [x] npm run build — успешно
- ✅ ТЗ-3A завершён

**2026-01-28 — ТЗ-2:**
- [x] Миграция `Message_v2.agentId` + backfill
- [x] Обновлён Помощник (полный промпт, capabilities, `{AGENTS_LIST}`)
- [x] Добавлен Prompt-агент (slug: `prompt-agent`, 8 агентов в БД)
- [x] Утилита парсинга @-mentions + API `/api/agents/by-name/[name]`
- [x] Chat route: @-mention → агент, динамический промпт, agentId на сообщениях
- [x] `MentionAutocomplete` — dropdown при вводе @, стрелки, Enter/Tab/Escape
- [x] Иконка агента на сообщениях + кнопки действий `[button:Label|payload]`
- [x] `ChatHint` — подсказка для новых пользователей (localStorage dismiss)
- [x] npm run build — успешно
- ✅ ТЗ-2 завершён

**2026-01-28 — ТЗ-1:**
- [x] Миграция: agents, user_agents, удалён User.role, Chat.agentId → uuid
- [x] Seed: 7 агентов с промптами и capabilities
- [x] API: /api/agents, /api/agents/[slug], /api/user-agents, /api/chats/[id]/agent
- [x] UI: Каталог /agents, страница /agents/[slug], смена агента в чате
- ✅ ТЗ-1 завершён

**2026-01-28 — Этап 0:**
- [x] Ребрендинг Family AI Assistant → Simply
- [x] Документация: README, CLAUDE.md, SIMPLY_STATUS.md, docs/
- ✅ Этап 0 завершён

---

## 📁 Ключевые файлы

**Документация:**
- README.md, CLAUDE.md, SIMPLY_STATUS.md
- docs/architecture.md, docs/ai-capabilities.md
- SIMPLY_ROADMAP.md (этот файл)

**Видение и ТЗ:**
- [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md) — видение продукта
- [TZ_01_AGENTS_ARCHITECTURE.md](TZ_01_AGENTS_ARCHITECTURE.md) — полное ТЗ для Этапа 1
- [TZ_02_MULTIAGENT_CHAT.md](TZ_02_MULTIAGENT_CHAT.md) — полное ТЗ для Этапа 2
- [TZ_03A_USER_PROFILE.md](TZ_03A_USER_PROFILE.md) — полное ТЗ для Этапа 3A
- [TZ_03B_AGENT_PERSONALIZATION.md](TZ_03B_AGENT_PERSONALIZATION.md) — полное ТЗ для Этапа 3B

**БД:**
- lib/db/schema.ts
- lib/db/queries.ts (getUserById, updateUserProfile)
- lib/db/seed-agents.ts

**API (ТЗ-1, ТЗ-2):**
- app/api/agents/route.ts
- app/api/agents/[slug]/route.ts
- app/api/agents/by-name/[name]/route.ts
- app/api/chats/[id]/agent/route.ts

**API (ТЗ-3A):**
- app/(chat)/api/user/profile/route.ts

**UI (ТЗ-1, ТЗ-2):**
- app/(chat)/agents/page.tsx
- app/(chat)/agents/[slug]/page.tsx
- components/sidebar-agents.tsx
- components/mention-autocomplete.tsx
- components/action-buttons.tsx
- components/chat-hint.tsx

**UI (ТЗ-3A):**
- app/(chat)/settings/page.tsx
- app/(chat)/settings/settings-page.tsx
- components/sidebar-user-nav.tsx (редизайн)
- components/greeting.tsx (динамическое)
- components/onboarding-dialog.tsx
- components/ui/radio-group.tsx
- hooks/use-theme-sync.ts

**AI (ТЗ-3A, ТЗ-3B):**
- lib/ai/prompts.ts (buildUserContext, buildAgentCustomizations)

**UI (ТЗ-3B):**
- components/personalization-dialog.tsx
- components/delete-agent-dialog.tsx
- app/(chat)/agents/[slug]/add-to-my-agents-button.tsx

**API (ТЗ-3B):**
- app/(chat)/api/user-agents/route.ts (POST)
- app/(chat)/api/user-agents/[id]/route.ts (PATCH, DELETE)

**Парсинг:**
- lib/agents/parse-mentions.ts

---

## ✅ Критерии готовности

### Этап 0 (Документация)
- [x] Все упоминания "Family AI Assistant" заменены на "Simply"
- [x] README.md ≤ 150 строк, со ссылками на docs/
- [x] npm run build успешен

### Этап 1 (ТЗ-1)
- [x] Таблицы `agents` и `user_agents` созданы
- [x] 7 агентов в БД (6 каталожных + helper)
- [x] User.role удалён
- [x] /agents показывает каталог
- [x] /agents/[slug] показывает детали агента
- [x] Смена агента в чате работает
- [x] Production build успешен

### Этап 2 (ТЗ-2)
- [x] `Message_v2.agentId` добавлен + миграция данных
- [x] @-mentions парсинг работает (имя и slug)
- [x] UI автокомплит при вводе @
- [x] Сообщения показывают иконку и имя агента
- [x] Помощник с полным промптом и `{AGENTS_LIST}`
- [x] Prompt-агент добавлен (8 агентов в БД)
- [x] Кнопки действий `[button:Label|payload]` работают
- [x] Подсказки для новых пользователей
- [x] Production build успешен

### Этап 3A (ТЗ-3A)
- [x] 5 новых полей в таблице User (displayName, pronouns, occupation, bio, theme)
- [x] API GET/PATCH /api/user/profile работает
- [x] Страница /settings с 3 секциями (Профиль, Аккаунт, Внешний вид)
- [x] Меню пользователя: аватар, имя, план, настройки, тема, помощь, выход
- [x] Онбординг для новых пользователей (3 шага)
- [x] Динамическое приветствие на главной
- [x] User context инъекция в system prompts всех агентов
- [x] Синхронизация темы БД ↔ next-themes
- [x] Production build успешен

### Этап 3B (ТЗ-3B)
- [x] Тип AgentCustomizations обновлён (brief → expert)
- [x] API CRUD для персональных агентов (POST, PATCH, DELETE)
- [x] Диалог персонализации (4 шага + режим редактирования)
- [x] Кнопка "В мои агенты" на странице агента
- [x] Секция "Мои агенты" в sidebar с меню действий
- [x] Применение customizations в chat route
- [x] Production build успешен

---

**Создано:** 2026-01-28
**Обновлено:** 2026-01-29
**Источники:** SIMPLY_PRODUCT_VISION.md, TZ_01_AGENTS_ARCHITECTURE.md
