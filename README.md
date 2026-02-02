# Simply

AI-платформа для российского рынка. Шлюз к лучшим мировым AI-моделям с оплатой в рублях, без VPN.

**Production:** https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app
**Версия:** 3.0.0
**Статус:** Active development

---

## О проекте

**Simply** — AI-платформа для бизнес-пользователей в России.

**Философия:** Apple-подход. Качество важнее количества.

**Ключевые отличия:**
- Универсальный AI-чат с мощными инструментами
- Модальные помощники: Prompt-агент (📝), Бен (❓)
- Умный выбор AI-модели для экономии без потери качества
- Оплата в рублях

**Подробнее:** [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md)

---

## Возможности

- **Универсальный чат:** Один мощный AI-помощник со всеми инструментами
- **Модальные помощники:** Prompt-агент для улучшения запросов, Бен для помощи по платформе
- **Мультипровайдер:** Gemini (текущий), Claude, GPT (планируется)
- **Инструменты:** Web search, Excel, презентации, документы
- **Голосовой ввод:** Deepgram Nova-3 (русский язык)
- **Streaming:** Быстрые ответы через streaming API

**Возможности AI:** [docs/ai-agents.md](docs/ai-agents.md) | [docs/ai-artifacts.md](docs/ai-artifacts.md) | [docs/ai-tools.md](docs/ai-tools.md)

---

## Быстрый старт

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
- `DEEPGRAM_API_KEY` — [deepgram.com](https://deepgram.com)
- `AUTH_SECRET` — `openssl rand -base64 32`
- `POSTGRES_URL` — [neon.tech](https://neon.tech)
- `BLOB_READ_WRITE_TOKEN` — [vercel.com/storage](https://vercel.com/storage)

---

## Технологии

| Слой | Технология |
|------|------------|
| Frontend | Next.js 15.3 (App Router, RSC), TypeScript, Tailwind CSS |
| AI | Vercel AI SDK (@ai-sdk/google, @ai-sdk/openai, @ai-sdk/anthropic) |
| Auth | NextAuth 5.0-beta.25 |
| Database | PostgreSQL (Neon) + Drizzle ORM |
| Storage | Vercel Blob Storage |
| Voice | Deepgram Nova-3 |
| Deploy | Vercel |

---

## Команды

```bash
npm run dev          # Разработка (localhost:3000)
npm run build        # Сборка production
npm run start        # Запуск production
npm run db:migrate   # Применить миграции БД
npm run db:studio    # Drizzle Studio (UI для БД)
```

---

## Документация

**Основные:**
- [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md) — Видение продукта
- [SIMPLY_STATUS.md](SIMPLY_STATUS.md) — Текущее состояние
- [CHANGELOG.md](CHANGELOG.md) — История изменений
- [DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md) — Правила документации

**Техническая:**
- [docs/setup.md](docs/setup.md) — Детальная установка
- [docs/architecture.md](docs/architecture.md) — Архитектура
- [docs/ai-agents.md](docs/ai-agents.md) — Система промптов и помощники
- [docs/ai-artifacts.md](docs/ai-artifacts.md) — Артефакты
- [docs/ai-tools.md](docs/ai-tools.md) — Инструменты
- [docs/decisions/](docs/decisions/) — Architecture Decision Records

**Для AI:**
- [CLAUDE.md](CLAUDE.md) — Навигация для Claude Code

---

## Roadmap

**Завершено:**
- ТЗ-NEW-01: Новая архитектура промптов (v3.0.0) ✅
- Этапы 0-6, Performance Audit, Voice Input ✅

**Следующее:**
- Этап 7: Tool Activity UX
- Этап 8: Инструменты Фаза 1 (Perplexity, Plus AI, Ideogram)
- Мультипровайдер, RAG, Биллинг

**Детали:** [SIMPLY_STATUS.md](SIMPLY_STATUS.md)

---

**Основано на:** [Vercel AI Chatbot Template](https://github.com/vercel/ai-chatbot)
