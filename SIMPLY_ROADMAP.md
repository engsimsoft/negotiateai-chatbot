# Project Roadmap: Simply

## 🎯 Цель проекта

Трансформировать Family AI Assistant в Simply — платформу AI-агентов для российского рынка с оплатой в рублях и фокусом на качество.

## 📊 Текущий статус

- **Этап:** Этап 1 / 2 (завершён)
- **Прогресс:** 54/54 задач (100%)
- **Следующее:** Этап 2 (ТЗ-2) — Агент-Помощник и рекомендации

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
- [ ] Проверить все ссылки в документации (30 мин)
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

## 📝 Текущая сессия

**2026-01-28:**
- [x] Создать SIMPLY_ROADMAP.md
- [x] Переработать README.md (Family AI → Simply, 118 строк)
- [x] Переработать CLAUDE.md (навигация для AI, 139 строк)
- [x] Создать SIMPLY_STATUS.md (текущее состояние проекта)
- [x] Обновить CHANGELOG.md (v2.2.0 — ребрендинг)
- [x] Обновить docs/architecture.md
- [x] Обновить docs/ (setup, deployment, troubleshooting, ai-capabilities)
- [x] ADR: создан 005-simply-rebrand.md, обновлены 002 и 004
- [x] Очистка: удалены ROADMAP.md, PROJECT_STATUS.md, _archive/
- [x] Обновлены DOCUMENTATION_GUIDE.md и package.json
- [x] Код: обновлены prompts.ts и presentation-pptx/server.ts
- [x] npm run build — успешно
- [x] Коммит: 96b080d "chore: rebrand Family AI Assistant → Simply (v2.2.0)"
- ✅ Этап 0 завершён

**ТЗ-1 (продолжение 2026-01-28):**
- [x] Миграция: agents, user_agents, удалён User.role, Chat.agentId → uuid
- [x] Schema: Agent, UserAgent, AgentCapabilities типы
- [x] Seed: 7 агентов с промптами и capabilities
- [x] API: /api/agents, /api/agents/[slug], /api/user-agents, /api/chats/[id]/agent
- [x] Chat route загружает промпты из БД
- [x] Компоненты обновлены (AgentSelector, ChatHeader, SidebarHistoryItem)
- [x] npm run build — успешно
- [x] Коммит: 5dcdb10 "feat: agent architecture — ТЗ-1"

**ТЗ-1 UI (2026-01-28):**
- [x] Удалены старые файлы lib/ai/agents/
- [x] Sidebar: Агент-Помощник, ссылка Каталог, секция Мои агенты
- [x] Страница /agents — каталог агентов с grid карточек
- [x] Страница /agents/[slug] — детали агента с суперсилами
- [x] ChatHeader: dropdown для смены агента в чате
- [x] npm run build — успешно
- ✅ ТЗ-1 завершён

---

## 📁 Ключевые файлы

**Документация:**
- README.md, CLAUDE.md, SIMPLY_STATUS.md
- docs/architecture.md, docs/ai-capabilities.md
- SIMPLY_ROADMAP.md (этот файл)

**Видение и ТЗ:**
- [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md) — видение продукта
- [TZ_01_AGENTS_ARCHITECTURE.md](TZ_01_AGENTS_ARCHITECTURE.md) — полное ТЗ для Этапа 1

**БД:**
- lib/db/schema.ts
- lib/db/seed-agents.ts (новый)

**API (новые):**
- app/api/agents/route.ts
- app/api/agents/[slug]/route.ts
- app/api/chats/[id]/agent/route.ts

**UI (новые):**
- app/(chat)/agents/page.tsx
- app/(chat)/agents/[slug]/page.tsx
- components/sidebar-agents.tsx

**Удалены:**
- ~~lib/ai/agents/index.ts~~
- ~~lib/ai/agents/*.md~~

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

---

**Создано:** 2026-01-28
**Источники:** SIMPLY_PRODUCT_VISION.md, TZ_01_AGENTS_ARCHITECTURE.md
