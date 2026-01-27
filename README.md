# Family AI Assistant

Персональный семейный AI-ассистент с ролями и персонализацией на базе Google Gemini.

**Production:** https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app
**Версия:** 2.0.0
**Статус:** ✅ Deployed

---

## 👥 О проекте

Приватный AI-ассистент для двух пользователей с разными ролями и специализированными system prompts.

**Пользователи:**

| Имя | Роль | Специализация ассистента |
|-----|------|--------------------------|
| Владимир | Инженер | Технический помощник (код, архитектура, debugging) |
| Юлия | Маркетолог | Маркетинговый помощник (контент, стратегия, аналитика) |

---

## ✨ Возможности

- **Персонализация:** Разные system prompts для каждой роли
- **Проекты:** Персональные проекты с базой знаний
- **AI Tools:** Brave Search, web scraping, file analysis
- **Streaming:** Быстрые ответы через streaming API
- **История:** Сохранение и управление диалогами

**Подробнее:** [docs/ai-capabilities.md](docs/ai-capabilities.md) - полный список возможностей AI-агентов

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
- `GOOGLE_GENERATIVE_AI_API_KEY` - https://aistudio.google.com/app/apikey
- `BRAVE_SEARCH_API_KEY` - https://brave.com/search/api
- `AUTH_SECRET` - `openssl rand -base64 32`
- `POSTGRES_URL` - neon.tech или vercel.com/storage
- `BLOB_READ_WRITE_TOKEN` - vercel.com/storage

---

## 🔑 Тестовые пользователи

После установки создай тестовых пользователей:

```bash
npm run db:seed
```

**Учетные данные для входа:**

| Email | Пароль | Роль |
|-------|--------|------|
| `vladimir@family.local` | `change-me-vladimir` | engineer |
| `julia@family.local` | `change-me-julia` | marketer |

⚠️ **Важно:** Смени пароли после первого входа!

---

## 🔧 Технологии

- **Frontend:** Next.js 15.3 (App Router, RSC)
- **AI:** Google Gemini 2.5 Pro (@ai-sdk/google)
- **Auth:** NextAuth 5.0-beta.25
- **Database:** PostgreSQL (Neon) + Drizzle ORM
- **Storage:** Vercel Blob Storage
- **Deployment:** Vercel

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

- [DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md) - Правила документации
- [CLAUDE.md](CLAUDE.md) - Навигация для AI
- [CHANGELOG.md](CHANGELOG.md) - История изменений
- [ROADMAP.md](ROADMAP.md) - План разработки
- [docs/ai-capabilities.md](docs/ai-capabilities.md) - Возможности AI-агентов
- [docs/setup.md](docs/setup.md) - Детальная установка
- [docs/architecture.md](docs/architecture.md) - Архитектура
- [docs/decisions/](docs/decisions/) - Architecture Decision Records

---

**Основано на:** [Vercel AI Chatbot Template](https://github.com/vercel/ai-chatbot)
