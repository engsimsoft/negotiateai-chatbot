# NegotiateAI Chatbot

AI чат-бот для переговоров (MIR.TRADE) на базе Claude Sonnet 4.

**Production:** https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app
**Версия:** 1.0.7
**Статус:** ✅ Deployed, работает

---

## 🎯 Текущее состояние

**Что работает:**
- ✅ Next.js 15.3 + TypeScript
- ✅ Google Gemini 1.5 Pro API (streaming)
- ✅ NextAuth (PostgreSQL + guest mode)
- ✅ Vercel deployment (middleware fixed)
- ✅ AI Tools: read_document, web_search, get_current_date, get_weather
- ✅ Brave Search integration (2000 req/month free tier)

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
- `ANTHROPIC_API_KEY` - https://console.anthropic.com
- `BRAVE_SEARCH_API_KEY` - https://brave.com/search/api (2000 req/month free)
- `AUTH_SECRET` - `openssl rand -base64 32`
- `POSTGRES_URL` - neon.tech или vercel.com/storage
- `BLOB_READ_WRITE_TOKEN` - vercel.com/storage

Детали: [docs/setup.md](docs/setup.md)

---

## 📁 Ключевые файлы

**AI/Chat:**
- `app/(chat)/api/chat/route.ts` - Chat endpoint (streaming)
- `lib/ai/providers.ts` - Claude Sonnet 4.5 configuration
- `lib/ai/tools/` - AI tools:
  - `read-document.ts` - Чтение DOCX/PDF из knowledge/ ✅
  - `get-current-date.ts` - Текущая дата/время ✅
  - `web-search.ts` - Brave Search API ✅
  - `get-weather.ts` - Погода (example tool) ✅

**Auth/DB:**
- `app/(auth)/` - NextAuth 5.0 setup
- `lib/db/queries.ts` - Database queries (Drizzle ORM)

**Config:**
- `.env.local` - API keys (НЕ коммитить!)
- `next.config.ts` - Next.js config (experimental.ppr)
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
- [docs/vercel-deploy-debug.md](docs/vercel-deploy-debug.md) - История отладки v1.0.5

**Решения:**
- [docs/decisions/](docs/decisions/) - Architecture Decision Records

---

## ⚙️ Конфигурация моделей

**Модель:** Google Gemini 1.5 Pro (`gemini-1.5-pro`)
**Где:** `lib/ai/providers.ts:28-30`
**Цена:** Free tier available

**Параметры:** Настраиваются в `app/(chat)/api/chat/route.ts`

---

## 🔧 Технологии

- Next.js 15.3 (App Router, RSC)
- Google Gemini SDK (@ai-sdk/google)
- NextAuth 5.0-beta.25
- PostgreSQL (Neon) + Drizzle ORM
- Vercel Blob Storage

**Основано на:** [Vercel AI Chatbot Template](https://github.com/vercel/ai-chatbot)

---

**Для пользователей:** См. [USER_GUIDE.md](USER_GUIDE.md) (создать при необходимости)
