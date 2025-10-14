# NegotiateAI Chatbot

AI-ассистент для переговоров по проекту MIR.TRADE на базе Claude Sonnet 4.

**Production:** https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app

**Основано на:** [Vercel AI Chatbot Template](https://github.com/vercel/ai-chatbot)

---

## 🚀 Быстрый старт

```bash
# 1. Клонировать и установить зависимости
git clone <repo-url>
npm install

# 2. Настроить .env.local
cp .env.example .env.local
# Добавить API ключи (см. .env.example)

# 3. Запустить локально
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000)

---

## 🎯 Возможности

- **Чат с Claude Sonnet 4** - AI-ассистент для переговоров
- **Чтение документов** - ~40 DOCX/PDF через Anthropic API (планируется)
- **Web search** - Поиск актуальной информации (планируется)
- **История чатов** - PostgreSQL + NextAuth
- **Streaming UI** - Быстрые ответы

---

## 📖 Документация

**Для разработки:**
- [DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md) - Правила документации (SSOT)
- [CLAUDE.md](CLAUDE.md) - Инструкция для Claude Code
- [CHANGELOG.md](CHANGELOG.md) - История изменений

**Техническая:**
- [docs/setup.md](docs/setup.md) - Детальная установка
- [docs/architecture.md](docs/architecture.md) - Архитектура
- [docs/deployment.md](docs/deployment.md) - Деплой
- [docs/troubleshooting.md](docs/troubleshooting.md) - Решение проблем
- [docs/vercel-deploy-debug.md](docs/vercel-deploy-debug.md) - История отладки Vercel

---

## 🔧 Технологии

- Next.js 15.3 (App Router)
- TypeScript
- Claude Sonnet 4.5 (Anthropic API)
- NextAuth 5.0 (authentication)
- PostgreSQL (Neon)
- Vercel Blob Storage

---

## 📄 License

Проект для внутреннего использования MIR.TRADE.
