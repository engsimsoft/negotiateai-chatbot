# Simply

AI-платформа для российского рынка. Шлюз к лучшим мировым AI-моделям с оплатой в рублях, без VPN.

**Production:** https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app
**Версия:** см. [package.json](package.json)
**Статус:** Active development

> **О проекте:** Simply — универсальный AI-чат + специализированные режимы (экспертные запросы, изолированные проекты, pipeline-фичи) для бизнес-пользователей, которым нужны лучшие мировые AI-модели в одном интерфейсе с оплатой в рублях.
>
> Полное видение: **[SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md)** · Текущее состояние: **[SIMPLY_STATUS.md](SIMPLY_STATUS.md)**

---

## Технологический стек

| Слой | Технологии |
|---|---|
| Frontend | Next.js 15.3 (App Router, RSC), React 18, TypeScript, Tailwind CSS, shadcn/ui |
| AI SDK | Vercel AI SDK v6 — Anthropic, xAI, Google, MiniMax, OpenRouter |
| Auth | NextAuth 5.0 + PostgreSQL adapter + bcrypt |
| Database | PostgreSQL (Neon) + Drizzle ORM |
| Storage | Vercel Blob Storage |
| Voice | Deepgram Nova-3 (STT, русский) |
| Deploy | Vercel (production Hobby plan + hourly Cron) |

**Детали архитектуры:** [docs/architecture.md](docs/architecture.md). **AI-провайдеры и маршрутизация:** [docs/ai-providers.md](docs/ai-providers.md) · [docs/ai-chats-map.md](docs/ai-chats-map.md).

---

## Требования

- **Node.js** ≥ 20.x
- **npm** ≥ 10.x (проект использует `npm`, не `pnpm`)
- **PostgreSQL** — через [Neon](https://neon.tech) или Vercel Postgres
- **API-ключи** провайдеров (см. [Переменные окружения](#переменные-окружения))

---

## Быстрый старт

```bash
# 1. Установка зависимостей
npm install

# 2. Настройка переменных окружения
cp .env.example .env.local
# → заполнить значения в .env.local (см. ниже)

# 3. Накатить миграции БД
npm run db:migrate

# 4. Запуск dev-сервера
npm run dev
# → http://localhost:3000
```

**Детальная установка и troubleshooting:** [docs/setup.md](docs/setup.md).

---

## Переменные окружения

Полный список с комментариями — в [.env.example](.env.example). Ниже — минимум для локального запуска.

### Обязательные

| Переменная | Где получить | Для чего |
|---|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/) | Claude (чат, артефакты, проекты) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | [aistudio.google.com](https://aistudio.google.com/app/apikey) | Gemini (TTS подкастов, vision) |
| `BRAVE_SEARCH_API_KEY` | [brave.com/search/api](https://brave.com/search/api/) | Веб-поиск |
| `POSTGRES_URL` | [neon.tech](https://neon.tech) | База данных |
| `BLOB_READ_WRITE_TOKEN` | [vercel.com/storage](https://vercel.com/storage) | Хранение файлов |
| `AUTH_SECRET` | `openssl rand -base64 32` | Шифрование сессий |

### Опциональные (для полной функциональности)

| Переменная | Для чего |
|---|---|
| `XAI_API_KEY` | xAI Grok (Simply Chat, Экспертиза, MIND) |
| `PERPLEXITY_API_KEY` | Deep Research tool |
| `VOYAGE_API_KEY` | Эмбеддинги (MIND, RAG) |
| `DEEPGRAM_API_KEY` | Голосовой ввод |
| `JINA_API_KEY` | Fetch URL (fallback) |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_WEBHOOK_SECRET` | Telegram-интеграция |
| `CLOUDCONVERT_API_KEY` | PDF-превью документов |

---

## Скрипты

```bash
npm run dev              # Dev-сервер (localhost:3000)
npm run build            # Production-сборка ⚠ АВТО-МИГРАЦИИ (см. ниже)
npm run start            # Запуск production-сборки
npm run lint             # Линтер (ultracite)
npm run format           # Автоформат (ultracite fix)

# База данных
npm run db:migrate       # Применить миграции
npm run db:generate      # Сгенерировать новую миграцию из schema.ts
npm run db:studio        # Drizzle Studio (UI для БД)
npm run db:push          # Push schema напрямую (dev-only, без миграций)

# Тесты
npm run test             # Playwright E2E
```

> ⚠ **Важно про `npm run build`:** команда выполняет `tsx lib/db/migrate && next build` — **автоматически накатывает все pending migrations** перед сборкой. Это hard-to-reverse операция против production БД. Использовать осознанно.

**Deploy:** `vercel --prod`. Детали: [docs/deployment.md](docs/deployment.md).

---

## Документация

### Продуктовое
- [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md) — видение, философия, горизонты
- [SIMPLY_STATUS.md](SIMPLY_STATUS.md) — snapshot текущего состояния
- [CHANGELOG.md](CHANGELOG.md) — история изменений (semver)

### Архитектурное (активная серия)
- [specs/Simply_xAI/SIMPLY_XAI_ROADMAP.md](specs/Simply_xAI/SIMPLY_XAI_ROADMAP.md) — дорожная карта
- [specs/Simply_xAI/MIND_ARCHITECTURE.md](specs/Simply_xAI/MIND_ARCHITECTURE.md) — автоматическая память из разговоров
- [specs/Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md](specs/Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md) — обработка вложений

### Техническое
- [docs/setup.md](docs/setup.md) — детальная установка
- [docs/deployment.md](docs/deployment.md) — деплой на Vercel
- [docs/architecture.md](docs/architecture.md) — архитектурные слои
- [docs/design-system.md](docs/design-system.md) — UI-закон (компоненты, цвета, шрифты)
- [docs/ai-chats-map.md](docs/ai-chats-map.md) — карта моделей и маршрутизации
- [docs/ai-providers.md](docs/ai-providers.md) — AI-провайдеры
- [docs/ai-agents.md](docs/ai-agents.md) — система промптов
- [docs/ai-artifacts.md](docs/ai-artifacts.md) — артефакты (документы в холсте)
- [docs/ai-tools.md](docs/ai-tools.md) — AI-инструменты
- [docs/troubleshooting.md](docs/troubleshooting.md) — частые проблемы
- [docs/decisions/](docs/decisions/) — Architecture Decision Records

### Процессное
- [CLAUDE.md](CLAUDE.md) — инструкция для Claude Code
- [DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md) — правила ведения документации
- [specs/WORKFLOW.md](specs/WORKFLOW.md) — фазы работы с ТЗ

---

## Лицензия

Проприетарный проект. Все права защищены.

---

## Благодарности

Изначально основан на [Vercel AI Chatbot Template](https://github.com/vercel/ai-chatbot). От template осталась базовая структура App Router и интеграция с AI SDK — всё остальное (архитектура агентов, MIND, pipelines, мультипровайдерная маршрутизация, UI) разработано под Simply.
