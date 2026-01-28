# Project Roadmap: Simply

## 🎯 Цель проекта

Трансформировать Family AI Assistant в Simply — платформу AI-агентов для российского рынка с оплатой в рублях и фокусом на качество.

## 📊 Текущий статус

- **Этап:** Этап 0 / 2
- **Прогресс:** 18/54 задач (33%)
- **Следующее:** Коммит ребрендинга → Этап 1

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
- [ ] Коммит: "chore: rebrand Family AI Assistant → Simply" (15 мин)

---

### Этап 1: Архитектура агентов — ТЗ-1 (5-7 дней)

**Цель:** Перенести систему агентов из хардкода в БД. Каталог агентов с UI.

**Детали:** См. [TZ_01_AGENTS_ARCHITECTURE.md](TZ_01_AGENTS_ARCHITECTURE.md)

**1.1 База данных — Миграции:**
- [ ] Миграция: таблица `agents` (1 час)
- [ ] Миграция: таблица `user_agents` (1 час)
- [ ] Миграция: удалить `User.role` (30 мин)
- [ ] Миграция: `Chat.agentId` varchar → uuid (1 час)
- [ ] npm run db:migrate (15 мин)

**1.2 Схема и типы:**
- [ ] Обновить lib/db/schema.ts (1 час)
- [ ] Типы: Agent, UserAgent, AgentCapabilities (1 час)

**1.3 Seed данные:**
- [ ] Создать seed скрипт (lib/db/seed-agents.ts) (1-2 часа)
- [ ] Перенести промпты из .md в seed (1 час)
- [ ] Заполнить capabilities для агентов (2 часа)
- [ ] Создать агента helper (заглушка) (30 мин)
- [ ] Удалить: Кулинар, Астролог, Одессит (15 мин)

**1.4 API endpoints:**
- [ ] GET /api/agents (1 час)
- [ ] GET /api/agents/:slug (1 час)
- [ ] GET /api/user-agents (1 час)
- [ ] PATCH /api/chats/:id/agent (1 час)

**1.5 Загрузка промптов:**
- [ ] Обновить chat route — агент из БД (2 часа)
- [ ] Логика: agents vs user_agents (1 час)
- [ ] Удалить lib/ai/agents/index.ts (30 мин)
- [ ] Удалить lib/ai/agents/*.md (15 мин)

**1.6 UI — Sidebar:**
- [ ] Компонент: Агент-Помощник (1 час)
- [ ] Ссылка "Каталог" → /agents (30 мин)
- [ ] Секция "Мои агенты" (пустая) (30 мин)
- [ ] Обновить sidebar layout (1 час)

**1.7 UI — Каталог /agents:**
- [ ] app/agents/page.tsx (2 часа)
- [ ] AgentCard компонент (1 час)
- [ ] Grid стили (1 час)

**1.8 UI — Страница /agents/[slug]:**
- [ ] app/agents/[slug]/page.tsx (2 часа)
- [ ] Секции: описание, суперсилы, инструменты (1 час)
- [ ] Кнопка "Начать чат" (1 час)
- [ ] Кнопка "В мои агенты" (disabled) (15 мин)

**1.9 UI — Индикация в чате:**
- [ ] Иконка и имя агента в шапке (1 час)
- [ ] Селектор смены агента (1-2 часа)
- [ ] Обновление Chat.agentId (30 мин)

**1.10 Финализация:**
- [ ] Тест: создание чата из каталога (30 мин)
- [ ] Тест: смена агента в чате (30 мин)
- [ ] Тест: промпты из БД (30 мин)
- [ ] npm run build (15 мин)
- [ ] Коммит: "feat: agent architecture — ТЗ-1" (15 мин)
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
- ⏸️ Остановился на: готово к коммиту

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
- app/agents/page.tsx
- app/agents/[slug]/page.tsx

**Удалить:**
- lib/ai/agents/index.ts
- lib/ai/agents/*.md

---

## ✅ Критерии готовности

### Этап 0 (Документация)
- [ ] Все упоминания "Family AI Assistant" заменены на "Simply"
- [ ] README.md ≤ 150 строк, со ссылками на docs/
- [ ] npm run build успешен

### Этап 1 (ТЗ-1)
- [ ] Таблицы `agents` и `user_agents` созданы
- [ ] 7 агентов в БД (6 каталожных + helper)
- [ ] User.role удалён
- [ ] /agents показывает каталог
- [ ] /agents/[slug] показывает детали агента
- [ ] Смена агента в чате работает
- [ ] Production build успешен

---

**Создано:** 2026-01-28
**Источники:** SIMPLY_PRODUCT_VISION.md, TZ_01_AGENTS_ARCHITECTURE.md
