# Архитектура Simply

Описание архитектуры платформы AI-агентов Simply.

## Общая схема

```
┌─────────────────────────────────────────────────────────────┐
│                    User (Browser)                           │
│                  Пользователи платформы                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP/WebSocket
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Next.js Application (Vercel)                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  App Router (app/)                                   │  │
│  │  ├── (auth)/           - Auth routes (NextAuth)      │  │
│  │  ├── (chat)/           - Chat UI                     │  │
│  │  ├── agents/           - Каталог агентов (план)      │  │
│  │  └── api/chat/route.ts - Chat API endpoint           │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Business Logic (lib/)                               │  │
│  │  ├── ai/providers.ts   - AI Provider config          │  │
│  │  ├── ai/agents/        - AI-агенты (промпты)         │  │
│  │  ├── ai/tools/         - AI-инструменты              │  │
│  │  ├── db/queries.ts     - Database queries            │  │
│  │  └── db/schema.ts      - Database schema             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                     │
                     │ External Services
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  External Services                                          │
│  ├── AI Providers      - Gemini (текущий), GPT, Claude     │
│  ├── Brave Search API  - Web search                        │
│  ├── CloudConvert API  - PPTX preview                      │
│  └── PostgreSQL (Neon) - Database                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Слои приложения

### 1. Presentation Layer (UI)

**Папки:** `app/`, `components/`

Отвечает за:
- Интерфейс чата
- Streaming ответов в реальном времени
- Рендеринг Markdown
- UI артефактов (text, презентации)
- Auth UI

**Технологии:**
- Next.js 15.3 (App Router, RSC)
- React 18, TypeScript
- Tailwind CSS
- Vercel AI SDK UI

---

### 2. Authentication Layer

**Файлы:** `app/(auth)/`, `middleware.ts`

Отвечает за:
- Авторизацию (NextAuth 5.0)
- Управление сессиями
- Защиту routes

**Текущее состояние:**
- 2 hardcoded пользователя (Владимир, Юлия)
- Роли: engineer, marketer

**План (ТЗ-1):**
- Удаление User.role
- Агенты вместо ролей

---

### 3. AI Layer

**Папка:** `lib/ai/`

#### providers.ts
- Конфигурация AI-моделей
- Текущий: Google Gemini (3 Pro, 2.5 Flash)
- План: мультипровайдер (GPT, Claude, Gemini)

#### agents/
- Промпты AI-агентов
- Текущий: 9 агентов в коде
- План (ТЗ-1): агенты в БД

#### tools/
- `web-search.ts` — Brave Search API
- `get-current-date.ts` — текущая дата
- `get-weather.ts` — погода (Open-Meteo)
- `presentation-reveal.ts` — веб-презентации
- `presentation-pptx.ts` — PowerPoint

---

### 4. Data Layer

**PostgreSQL (Neon) + Drizzle ORM**

**Текущие таблицы:**
- `User` — пользователи
- `Chat` — чаты
- `Message` — сообщения
- `Document` — артефакты
- NextAuth таблицы

**План (ТЗ-1) — новые таблицы:**
- `agents` — каталог агентов
- `user_agents` — персональные агенты пользователей

**Vercel Blob Storage:**
- Загруженные файлы
- Attachments

---

## Система AI-агентов

### Текущая архитектура

```
lib/ai/agents/
├── index.ts         - конфигурация агентов
├── marketer.md      - промпт Маркетолога
├── copywriter.md    - промпт Копирайтера
├── translator.md    - промпт Переводчика
├── mentor.md        - промпт Наставника
├── universal.md     - промпт Универсального
├── presenter.md     - промпт Презентатора
└── ...
```

**Недостатки:**
- Агенты захардкожены в коде
- Нельзя добавить агента без деплоя
- Нельзя персонализировать

### Целевая архитектура (ТЗ-1)

```
База данных:
┌─────────────────────────────────────────┐
│ agents (каталог)                        │
│ ├── id, slug, name, icon                │
│ ├── description, systemPrompt           │
│ ├── capabilities (JSON)                 │
│ └── modelPreference                     │
└─────────────────────────────────────────┘
          │
          │ user добавляет агента
          ▼
┌─────────────────────────────────────────┐
│ user_agents (персональные)              │
│ ├── userId, agentId                     │
│ ├── customName, customSettings (JSON)   │
│ └── createdAt                           │
└─────────────────────────────────────────┘
```

**Преимущества:**
- Агенты в БД, не в коде
- Каталог агентов с UI
- Персонализация без деплоя
- Масштабируемость

**Детали:** [TZ_01_AGENTS_ARCHITECTURE.md](../TZ_01_AGENTS_ARCHITECTURE.md)

---

## Smart Routing (план)

Автоматический выбор модели для экономии:

| Сложность | Модель | Примерная цена |
|-----------|--------|----------------|
| Простой вопрос | Gemini Flash / GPT-4o-mini | ~$0.10/1M |
| Средняя задача | Gemini Pro / GPT-4o | ~$2-5/1M |
| Сложный анализ | Claude Sonnet | ~$3-15/1M |
| Максимум качества | Claude Opus | ~$15-60/1M |

**Текущее:** Ручной выбор или auto (Gemini 3 Pro/2.5 Flash)
**План:** Интеллектуальный роутинг на основе анализа запроса

---

## Security

### API Keys
- Хранятся в `.env.local`
- Server-side only
- Не передаются клиенту

### Authentication
- NextAuth 5.0
- PostgreSQL adapter
- bcrypt для паролей
- Secure cookies

### Authorization
- Middleware защищает routes
- Пользователи видят только свои чаты
- Агенты доступны по подписке (план)

---

## Почему такая архитектура?

### Принятые решения

**Next.js App Router:**
- RSC для безопасности
- Built-in API routes
- Легкий деплой на Vercel

**Google Gemini (текущий):**
- Free tier для старта
- Хорошее качество
- Мультимодальность
- См. [ADR 001](decisions/001-why-gemini.md)

**Мультипровайдер (план):**
- Vercel AI SDK поддерживает все провайдеры
- Гибкость выбора модели
- Оптимизация затрат

**PostgreSQL + Drizzle:**
- Type-safe queries
- Удобные миграции
- Интеграция с NextAuth

---

## Связанные документы

- [setup.md](setup.md) — Установка
- [deployment.md](deployment.md) — Деплой
- [ai-agents.md](ai-agents.md) — AI-агенты
- [ai-artifacts.md](ai-artifacts.md) — Артефакты
- [ai-tools.md](ai-tools.md) — Инструменты
- [ADR](decisions/) — Архитектурные решения
- [TZ_01_AGENTS_ARCHITECTURE.md](../TZ_01_AGENTS_ARCHITECTURE.md) — ТЗ-1

---

**Обновлено:** 2026-01-28 (Simply rebrand)
