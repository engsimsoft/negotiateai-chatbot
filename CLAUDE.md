# Инструкция для Claude Code

**Версия:** 2.1.1 | **Статус:** ✅ Deployed | **URL:** https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app

---

## 📖 Начни здесь

1. **[README.md](README.md)** - О проекте (Family AI Assistant)
2. **[ROADMAP.md](ROADMAP.md)** - План разработки и текущий прогресс
3. **[DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md)** - Правила работы с документацией
4. **[CHANGELOG.md](CHANGELOG.md)** - История изменений

**Главный принцип:** SSOT (Single Source of Truth) - вся информация в [DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md)

---

## 🎯 О проекте

**Family AI Assistant** - персональный семейный AI-ассистент с ролями и персонализацией.

**Пользователи:**
- **Владимир** (Инженер) - технический помощник
- **Юлия** (Маркетолог) - маркетинговый помощник

**Ключевые особенности:**
- Приватный проект для 2 пользователей
- Разные system prompts для каждой роли
- Персональные проекты с базой знаний
- Без guest режима

---

## 🔧 Технологии

**Frontend:**
- Next.js 15.3 (App Router, RSC)
- TypeScript
- Tailwind CSS

**AI:**
- Google Gemini 3 Pro + Gemini 2.5 Flash (@ai-sdk/google)
- AI SDK (Vercel AI SDK)
- Streaming responses
- 8 специализированных AI-агентов с автоматическим выбором модели

**Backend:**
- NextAuth 5.0-beta.25
- PostgreSQL (Neon)
- Drizzle ORM
- Vercel Blob Storage

**Deployment:**
- Vercel (production)

---

## 📁 Структура кода

**AI/Chat:**
- `app/(chat)/api/chat/route.ts` - Chat endpoint (streaming)
- `lib/ai/providers.ts` - Конфигурация Gemini (3 Pro + 2.5 Flash)
- `lib/ai/agents/` - 8 AI-агентов (промпты, конфигурация)
- `lib/ai/tools/` - AI-инструменты (search, web scraping, getCurrentDate)

**Auth/DB:**
- `app/(auth)/` - NextAuth 5.0 setup
- `lib/db/schema.ts` - Database schema (Drizzle)
- `lib/db/queries.ts` - Database queries

**Config:**
- `.env.local` - API keys (НЕ коммитить!)
- `next.config.ts` - Next.js config
- `drizzle.config.ts` - Database config

**Документация:**
- `docs/setup.md` - Установка
- `docs/architecture.md` - Архитектура
- `docs/deployment.md` - Deployment
- `docs/decisions/` - ADR (Architecture Decision Records)

---

## 🚀 Текущий этап

**Этап:** Этап 3 (Агенты и персонализация) - ✅ ЗАВЕРШЁН
**Прогресс:** 60/60 задач (100%)
**Версия:** v2.1.1 (UI индикатор модели + режим auto по умолчанию)
**Следующее:** Этап 4 (Персонализация: проекты и база знаний)

**Детали:** См. [ROADMAP.md](ROADMAP.md) и [TZ_STAGE_3_ROADMAP.md](TZ_STAGE_3_ROADMAP.md)

**Архивная ветка:** `archive/mir-trade-v1.0.14` ✅

---

## 📋 Команды

```bash
# Разработка
npm install              # Установка зависимостей
npm run dev              # Запуск dev сервера (localhost:3000)
npm run build            # Сборка production
npm run start            # Запуск production

# Database
npm run db:migrate       # Применить миграции
npm run db:studio        # Drizzle Studio (UI для БД)

# Git
git status               # Проверить изменения
git add -A               # Добавить все файлы
git commit -m "msg"      # Закоммитить
git push origin master   # Запушить на GitHub

# Vercel
vercel --prod            # Deploy на production
```

---

## 🔍 Навигация

**Основная документация:**
- [README.md](README.md) - Описание проекта
- [ROADMAP.md](ROADMAP.md) - План разработки
- [CHANGELOG.md](CHANGELOG.md) - История изменений
- [DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md) - Правила документации

**Техническая документация:**
- [docs/ai-capabilities.md](docs/ai-capabilities.md) - Возможности AI-агентов
- [docs/setup.md](docs/setup.md) - Установка
- [docs/architecture.md](docs/architecture.md) - Архитектура
- [docs/deployment.md](docs/deployment.md) - Deployment
- [docs/troubleshooting.md](docs/troubleshooting.md) - Проблемы

**Архитектурные решения:**
- [docs/decisions/](docs/decisions/) - ADR

**Архив:**
- [_archive/PROJECT_OVERVIEW.md](_archive/PROJECT_OVERVIEW.md) - Старый обзор (MIR.TRADE)
- [_archive/AUTH_ANALYSIS.md](_archive/AUTH_ANALYSIS.md) - Анализ авторизации

---

## 💡 Workflow

**При работе с задачами:**
1. Открыть [ROADMAP.md](ROADMAP.md)
2. Найти текущую задачу (⏸️)
3. Выполнить задачу
4. Обновить чекбоксы [x] в ROADMAP
5. Обновить прогресс

**Правило:** По одной задаче за раз.

---

**Обновлено:** 2026-01-27
