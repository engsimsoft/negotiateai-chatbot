# Инструкция для Claude Code

**Проект:** Simply | **Версия:** 2.2.0 | **Статус:** 🚧 Ребрендинг

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
- `lib/ai/agents/` — AI-агенты (промпты, конфигурация)
- `lib/ai/tools/` — Инструменты (search, web scraping)

**Auth/DB:**
- `app/(auth)/` — NextAuth 5.0 setup
- `lib/db/schema.ts` — Database schema (Drizzle)
- `lib/db/queries.ts` — Database queries

**Config:**
- `.env.local` — API keys (НЕ коммитить!)
- `next.config.ts` — Next.js config
- `drizzle.config.ts` — Database config

---

## 🚀 Текущий этап

**Этап:** 0 / 2 (Документация и ребрендинг)
**Прогресс:** См. [SIMPLY_ROADMAP.md](SIMPLY_ROADMAP.md)

**Задачи Этапа 0:**
- Переименовать Family AI → Simply
- Обновить всю документацию
- Подготовить к Этапу 1 (Архитектура агентов)

**Детали ТЗ-1:** [TZ_01_AGENTS_ARCHITECTURE.md](TZ_01_AGENTS_ARCHITECTURE.md)

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

**Обновлено:** 2026-01-28
