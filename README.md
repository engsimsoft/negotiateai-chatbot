# Simply

Платформа AI-агентов для российского рынка. Шлюз к лучшим мировым AI-моделям с оплатой в рублях, без VPN.

**Production:** https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app
**Версия:** 2.7.0
**Статус:** ТЗ-4 завершён (Упрощение UX)

---

## 🎯 О проекте

**Simply** — платформа качественных AI-агентов для бизнес-пользователей в России.

**Философия:** Apple-подход. Лучше 10 идеально работающих агентов, чем 100 посредственных.

**Ключевые отличия:**
- Проработанные агенты с проверенными промптами
- Персонализация готовых агентов (не создание с нуля)
- Умный выбор AI-модели для экономии без потери качества
- Оплата в рублях

**Подробнее:** [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md)

---

## ✨ Возможности

- **AI-агенты:** 8 специализированных агентов (Помощник, Маркетолог, Копирайтер, Презентатор и др.)
- **Мультипровайдер:** GPT, Claude, Gemini — через единый интерфейс
- **Smart Routing:** Автоматический выбор оптимальной модели
- **Инструменты:** Web search, анализ сайтов, документы, презентации
- **Streaming:** Быстрые ответы через streaming API

**Возможности AI:** [docs/ai-agents.md](docs/ai-agents.md) | [docs/ai-artifacts.md](docs/ai-artifacts.md) | [docs/ai-tools.md](docs/ai-tools.md)

---

## 🚀 Быстрый старт

```bash
# Установка
npm install

# Настройка окружения
cp .env.example .env.local

# Миграция БД
npm run db:migrate

# Запуск
npm run dev  # http://localhost:3000
```

**Требуется в .env.local:**
- `GOOGLE_GENERATIVE_AI_API_KEY` — [aistudio.google.com](https://aistudio.google.com/app/apikey)
- `BRAVE_SEARCH_API_KEY` — [brave.com/search/api](https://brave.com/search/api)
- `AUTH_SECRET` — `openssl rand -base64 32`
- `POSTGRES_URL` — [neon.tech](https://neon.tech)
- `BLOB_READ_WRITE_TOKEN` — [vercel.com/storage](https://vercel.com/storage)

---

## 🔧 Технологии

| Слой | Технология |
|------|------------|
| Frontend | Next.js 15.3 (App Router, RSC), TypeScript, Tailwind CSS |
| AI | Vercel AI SDK (@ai-sdk/google, @ai-sdk/openai, @ai-sdk/anthropic) |
| Auth | NextAuth 5.0-beta.25 |
| Database | PostgreSQL (Neon) + Drizzle ORM |
| Storage | Vercel Blob Storage |
| Deploy | Vercel |

---

## 📋 Команды

```bash
npm run dev          # Разработка (localhost:3000)
npm run build        # Сборка production
npm run start        # Запуск production
npm run db:migrate   # Применить миграции БД
npm run db:studio    # Drizzle Studio (UI для БД)
```

---

## 📖 Документация

**Основные:**
- [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md) — Видение продукта
- [SIMPLY_STATUS.md](SIMPLY_STATUS.md) — Текущее состояние
- [CHANGELOG.md](CHANGELOG.md) — История изменений
- [DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md) — Правила документации

**Техническая:**
- [docs/setup.md](docs/setup.md) — Детальная установка
- [docs/architecture.md](docs/architecture.md) — Архитектура
- [docs/ai-agents.md](docs/ai-agents.md) — AI-агенты
- [docs/ai-artifacts.md](docs/ai-artifacts.md) — Артефакты
- [docs/ai-tools.md](docs/ai-tools.md) — Инструменты
- [docs/decisions/](docs/decisions/) — Architecture Decision Records

**Для AI:**
- [CLAUDE.md](CLAUDE.md) — Навигация для Claude Code

---

## 🛣️ Roadmap

**Этап 0:** Документация и ребрендинг — ✅
**Этап 1:** Архитектура агентов (ТЗ-1) — ✅
**Этап 2:** Мультиагентный чат (ТЗ-2) — ✅
**Этап 3A:** Профиль пользователя (ТЗ-3A) — ✅
**Этап 3B:** Персонализация агентов (ТЗ-3B) — ✅
**Этап 4:** Упрощение UX (ТЗ-4) — ✅
**Этап 5+:** Мультипровайдер, Биллинг ← следующий

**Детали:** [SIMPLY_ROADMAP.md](SIMPLY_ROADMAP.md)

---

**Основано на:** [Vercel AI Chatbot Template](https://github.com/vercel/ai-chatbot)
