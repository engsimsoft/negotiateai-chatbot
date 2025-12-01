# NegotiateAI Chatbot

AI чат-бот для переговоров (MIR.TRADE) на базе Google Gemini.

**Production:** https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app
**Версия:** 1.0.14 (стабилизация)
**Статус:** ✅ Deployed, работает

---

## 🎯 Текущее состояние

**Что работает:**
- ✅ Next.js 15.3 + TypeScript
- ✅ Google Gemini 2.5 Pro API (streaming, единая модель)
- ✅ NextAuth (PostgreSQL + guest mode)
- ✅ Vercel deployment
- ✅ AI Tools (детали в `docs/api/tools.md`)
- ✅ Brave Search integration

**В разработке:**
- [ ] Knowledge base integration (~40 DOCX/PDF)
- [ ] System prompt + index.md
- [ ] UI кастомизация (брендинг NegotiateAI)

---

## 🚀 Разработка

```bash
npm install
cp .env.example .env.local  # Добавить API ключи
npm run dev                 # http://localhost:3000
```

**Требуется в .env.local:**
- `GOOGLE_GENERATIVE_AI_API_KEY` - https://aistudio.google.com/app/apikey
- `BRAVE_SEARCH_API_KEY` - https://brave.com/search/api
- `AUTH_SECRET` - `openssl rand -base64 32`
- `POSTGRES_URL` - neon.tech или vercel.com/storage
- `BLOB_READ_WRITE_TOKEN` - vercel.com/storage

Детали: [docs/setup.md](docs/setup.md)

---

## 📁 Ключевые файлы

**AI/Chat:**
- `app/(chat)/api/chat/route.ts` - Chat endpoint (streaming)
- `lib/ai/providers.ts` - Конфигурация Gemini 2.5 Pro
- `lib/ai/tools/` - Реализация AI-инструментов

**Auth/DB:**
- `app/(auth)/` - NextAuth 5.0 setup
- `lib/db/queries.ts` - Database queries (Drizzle ORM)

**Config:**
- `.env.local` - API keys (НЕ коммитить!)
- `next.config.ts` - Next.js config
- `drizzle.config.ts` - Database config

---

## 📖 Документация

**Обязательно читать:**
- [DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md) - Правила документации (SSOT)
- [CLAUDE.md](CLAUDE.md) - Быстрая навигация для AI
- [CHANGELOG.md](CHANGELOG.md) - История изменений

**Техническая:**
- [docs/setup.md](docs/setup.md) - Детальная установка
- [docs/architecture.md](docs/architecture.md) - Архитектура
- [docs/deployment.md](docs/deployment.md) - Vercel deployment
- [docs/troubleshooting.md](docs/troubleshooting.md) - Решение проблем

**Решения:**
- [docs/decisions/](docs/decisions/) - Architecture Decision Records

---

## ⚙️ Конфигурация моделей

**Модель:** Google Gemini 2.5 Pro (`gemini-2.5-pro`)
**Где:** `lib/ai/providers.ts`
**Цена:** Free tier available

---

## 🔧 Технологии

- Next.js 15.3 (App Router, RSC)
- Google Gemini SDK (@ai-sdk/google)
- NextAuth 5.0-beta.25
- PostgreSQL (Neon) + Drizzle ORM
- Vercel Blob Storage

**Основано на:** [Vercel AI Chatbot Template](https://github.com/vercel/ai-chatbot)
