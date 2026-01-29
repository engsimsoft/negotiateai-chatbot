# Инструкция для Claude Code

**Проект:** Simply | **Версия:** 2.7.0 | **Статус:** ТЗ-4 завершён

**URL:** https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app

---

## 📖 Начни здесь

1. **[README.md](README.md)** — О проекте Simply
2. **[SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md)** — Видение продукта
3. **[SIMPLY_ROADMAP.md](SIMPLY_ROADMAP.md)** — План разработки и прогресс
4. **[DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md)** — Правила документации

**Главный принцип:** SSOT (Single Source of Truth)

---

## 🎯 О проекте

**Simply** — платформа AI-агентов для российского рынка.

**Философия:** Apple-подход. Качество важнее количества.

**Ключевые особенности:**
- Каталог проработанных AI-агентов
- Персонализация готовых агентов (не создание с нуля)
- Мультипровайдер: GPT, Claude, Gemini
- Smart Routing — автовыбор модели
- Оплата в рублях

---

## 🔧 Технологии

**Frontend:** Next.js 15.3 (App Router, RSC), TypeScript, Tailwind CSS

**AI:**
- Vercel AI SDK (@ai-sdk/google, @ai-sdk/openai, @ai-sdk/anthropic)
- Текущий: Google Gemini (3 Pro + 2.5 Flash)
- План: мультипровайдер

**Backend:** NextAuth 5.0-beta.25, PostgreSQL (Neon), Drizzle ORM

**Storage:** Vercel Blob Storage

**Deploy:** Vercel

---

## 📁 Структура кода

**AI/Chat:**
- `app/(chat)/api/chat/route.ts` — Chat endpoint (streaming)
- `lib/ai/providers.ts` — Конфигурация AI-моделей
- `lib/ai/tools/` — Инструменты (search, web scraping)
- `lib/db/seed-agents.ts` — Агенты и промпты (БД)

**Auth/DB:**
- `app/(auth)/` — NextAuth 5.0 setup
- `lib/db/schema.ts` — Database schema (Drizzle)
- `lib/db/queries.ts` — Database queries

**Agents UI:**
- `app/(chat)/agents/page.tsx` — Каталог агентов
- `app/(chat)/agents/[slug]/page.tsx` — Страница агента
- `components/sidebar-agents.tsx` — Секция агентов в sidebar

**Agents API:**
- `app/api/agents/route.ts` — GET список агентов
- `app/api/agents/[slug]/route.ts` — GET агент по slug
- `app/api/agents/by-name/[name]/route.ts` — GET агент по имени (ТЗ-2)
- `app/api/chats/[id]/agent/route.ts` — PATCH смена агента

**@-mentions & UI (ТЗ-2):**
- `lib/agents/parse-mentions.ts` — Парсинг @-mentions
- `components/mention-autocomplete.tsx` — Автокомплит @-mentions
- `components/action-buttons.tsx` — Кнопки действий в сообщениях
- `components/chat-hint.tsx` — Подсказки для новых пользователей

**User Profile (ТЗ-3A):**
- `app/(chat)/api/user/profile/route.ts` — API профиля (GET/PATCH)
- `app/(chat)/settings/page.tsx` — Страница настроек
- `app/(chat)/settings/settings-page.tsx` — UI настроек
- `components/sidebar-user-nav.tsx` — Меню пользователя
- `components/onboarding-dialog.tsx` — Онбординг
- `hooks/use-theme-sync.ts` — Синхронизация темы
- `lib/ai/prompts.ts` — buildUserContext

**Agent Personalization (ТЗ-3B):**
- `app/(chat)/api/user-agents/route.ts` — API персональных агентов (GET/POST)
- `app/(chat)/api/user-agents/[id]/route.ts` — PATCH/DELETE персонального агента
- `app/(chat)/agents/[slug]/add-to-my-agents-button.tsx` — Кнопка "В мои агенты"
- `components/personalization-dialog.tsx` — Диалог персонализации (4 шага)
- `components/delete-agent-dialog.tsx` — Подтверждение удаления
- `lib/ai/prompts.ts` — buildAgentCustomizations

**Config:**
- `.env.local` — API keys (НЕ коммитить!)
- `next.config.ts` — Next.js config
- `drizzle.config.ts` — Database config

---

## 🚀 Текущий этап

**Завершены:** Этап 0 (Документация), Этап 1 (ТЗ-1), Этап 2 (ТЗ-2), Этап 3A (ТЗ-3A), Этап 3B (ТЗ-3B), Этап 4 (ТЗ-4)
**Следующий:** Этап 5+ — Мультипровайдер, биллинг
**Прогресс:** См. [SIMPLY_ROADMAP.md](SIMPLY_ROADMAP.md)

**Выполнено в ТЗ-4:**
- Убрана персонализация агентов из UI (backend сохранён)
- @-mentions теперь "гостевой вызов" — не меняет Chat.agentId
- Гостевые сообщения визуально выделены (отступ + фон + метка)
- Подсказка обновлена + иконка 💡 для повторного показа
- Suggested actions берутся из agent.capabilities.exampleTasks
- Убрано создание greeting как сообщения

**Детали ТЗ-4:** [TZ_04_UX_SIMPLIFICATION.md](TZ_04_UX_SIMPLIFICATION.md)

---

## 📋 Команды

```bash
# Разработка
npm install              # Установка зависимостей
npm run dev              # Dev сервер (localhost:3000)
npm run build            # Сборка production
npm run start            # Запуск production

# Database
npm run db:migrate       # Применить миграции
npm run db:studio        # Drizzle Studio

# Deploy
vercel --prod            # Deploy на Vercel
```

---

## 🔍 Навигация

**Основная:**
- [README.md](README.md) — О проекте
- [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md) — Видение
- [SIMPLY_ROADMAP.md](SIMPLY_ROADMAP.md) — План и прогресс
- [CHANGELOG.md](CHANGELOG.md) — История изменений

**Техническая:**
- [docs/ai-capabilities.md](docs/ai-capabilities.md) — Возможности AI
- [docs/setup.md](docs/setup.md) — Установка
- [docs/architecture.md](docs/architecture.md) — Архитектура
- [docs/deployment.md](docs/deployment.md) — Deployment
- [docs/decisions/](docs/decisions/) — ADR

**ТЗ:**
- [TZ_01_AGENTS_ARCHITECTURE.md](TZ_01_AGENTS_ARCHITECTURE.md) — Этап 1
- [TZ_02_MULTIAGENT_CHAT.md](TZ_02_MULTIAGENT_CHAT.md) — Этап 2
- [TZ_03A_USER_PROFILE.md](TZ_03A_USER_PROFILE.md) — Этап 3A
- [TZ_03B_AGENT_PERSONALIZATION.md](TZ_03B_AGENT_PERSONALIZATION.md) — Этап 3B
- [TZ_04_UX_SIMPLIFICATION.md](TZ_04_UX_SIMPLIFICATION.md) — Этап 4

---

## 💡 Workflow

**При работе с задачами:**
1. Открыть [SIMPLY_ROADMAP.md](SIMPLY_ROADMAP.md)
2. Найти текущую задачу
3. Выполнить задачу
4. Отметить [x] в ROADMAP
5. Обновить прогресс и секцию "Текущая сессия"

**Правило:** По одной задаче за раз.

---

**Обновлено:** 2026-01-29
