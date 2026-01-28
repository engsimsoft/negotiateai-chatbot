# Simply — Текущее состояние проекта

**Версия:** 2.4.0
**Дата:** 2026-01-28
**Статус:** ТЗ-2 завершён (Мультиагентный чат)
**Production URL:** https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app

> **Назначение:** Полная информация о состоянии проекта для разработки ТЗ и архитектурных решений.

---

## 📖 О проекте

### Что это?

**Simply** — платформа AI-агентов для российского рынка. Шлюз к лучшим мировым AI-моделям с оплатой в рублях.

### Философия

**Apple-подход:** Лучше 10 идеально работающих агентов, чем 100 посредственных.

### Ключевые особенности

| Особенность | Описание |
|-------------|----------|
| **Каталог агентов** | Проработанные агенты с проверенными промптами |
| **Персонализация** | Адаптация готовых агентов (не создание с нуля) |
| **Мультипровайдер** | GPT, Claude, Gemini через единый интерфейс |
| **Smart Routing** | Автовыбор модели для экономии без потери качества |
| **Оплата в рублях** | ЮKassa, Тинькофф, СБП |

**Подробнее:** [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md)

---

## ✅ Унаследовано от Family AI Assistant

Проект Simply построен на базе Family AI Assistant (v2.5.0). Сохранены:

### Инфраструктура
- ✅ Next.js 15.3 (App Router, RSC)
- ✅ NextAuth 5.0-beta.25
- ✅ PostgreSQL (Neon) + Drizzle ORM
- ✅ Vercel AI SDK
- ✅ Vercel Blob Storage

### AI-возможности
- ✅ Streaming responses
- ✅ Автовыбор модели (Gemini 3 Pro / 2.5 Flash)
- ✅ Web Search (Brave API)
- ✅ Weather (Open-Meteo)
- ✅ Get Current Date

### Артефакты
- ✅ Text Artifact (plain text + emoji)
- ✅ Presentation-Reveal (веб-презентации)
- ✅ Presentation-PPTX (PowerPoint)
- ✅ Public Share (публичные ссылки)

---

## 🤖 AI-агенты (в БД)

> Агенты мигрированы в БД в ТЗ-1. Промпты и capabilities хранятся в таблице `agents`.

| Агент | Тип | Модель | Slug |
|-------|-----|--------|------|
| **Помощник** | system | Gemini 3 Pro | helper |
| **Prompt-агент** | catalog | Gemini 3 Pro | prompt-agent |
| **Универсальный** | catalog | Gemini 2.5 Flash | universal |
| **Маркетолог** | catalog | Gemini 3 Pro | marketer |
| **Копирайтер** | catalog | Gemini 3 Pro | copywriter |
| **Переводчик** | catalog | Gemini 3 Pro | translator |
| **Наставник** | catalog | Gemini 3 Pro | mentor |
| **Презентатор** | catalog | Gemini 3 Pro | presenter |

Удалены: Кулинар, Астролог, Одессит

---

## 🛠️ AI-инструменты

**Текущие (все агенты):**
- Web Search (Brave API)
- Get Current Date
- Get Weather (Open-Meteo)
- Read Document
- Create/Update Document (text)

**Эксклюзивные (Презентатор):**
- Presentation-Reveal
- Presentation-PPTX

**Планируемые:**
- Website Analyzer (fetch, screenshot, SEO)
- Transcription (Whisper)
- Image Generation

---

## 🏗️ Технический стек

| Слой | Технология |
|------|------------|
| Frontend | Next.js 15.3, React 18, TypeScript, Tailwind CSS |
| AI | Vercel AI SDK (@ai-sdk/google, @ai-sdk/openai, @ai-sdk/anthropic) |
| Auth | NextAuth 5.0-beta.25 |
| Database | PostgreSQL (Neon) + Drizzle ORM |
| Storage | Vercel Blob Storage |
| External | Brave Search, CloudConvert, Open-Meteo |
| Deploy | Vercel |

---

## 📈 План развития

### Этап 0: Документация и ребрендинг — ✅ ЗАВЕРШЁН
### Этап 1: Архитектура агентов (ТЗ-1) — ✅ ЗАВЕРШЁН

**Выполнено:**
- Таблицы `agents`, `user_agents` в БД
- 7 агентов с промптами и capabilities
- UI каталога `/agents` и `/agents/[slug]`
- Смена агента в чате
- Greeting при старте чата

**Детали:** [TZ_01_AGENTS_ARCHITECTURE.md](TZ_01_AGENTS_ARCHITECTURE.md)

### Этап 2: Мультиагентный чат (ТЗ-2) — ✅ ЗАВЕРШЁН

**Выполнено:**
- @-mentions: парсинг, UI автокомплит, резолвинг агента
- Мультиагентный чат: иконка агента на сообщениях, `Message.agentId`
- Помощник: полный промпт-консьерж с динамическим `{AGENTS_LIST}`
- Prompt-агент: улучшение запросов, кнопки действий `[button:Label|payload]`
- Подсказки для новых пользователей (`ChatHint`)
- 8 агентов в БД (1 системный + 7 каталожных)

**Детали:** [TZ_02_MULTIAGENT_CHAT.md](TZ_02_MULTIAGENT_CHAT.md) | [TZ_02_ROADMAP.md](TZ_02_ROADMAP.md)

### Этап 3+: Будущее ← СЛЕДУЮЩИЙ

- Персонализация агентов (ТЗ-3)
- Tool Activity UX
- Мультипровайдер (GPT, Claude)
- Smart Routing, Биллинг

**Полный roadmap:** [SIMPLY_ROADMAP.md](SIMPLY_ROADMAP.md)

---

## 📊 Статистика

| Метрика | Значение |
|---------|----------|
| Версия | 2.4.0 |
| Статус | ТЗ-2 завершён |
| AI-агентов | 8 (в БД) |
| AI моделей | 2 (Gemini 3 Pro, 2.5 Flash) |
| Артефактов | 3 |
| Тем презентаций | 5 |
| Production build | ✅ Успешен |

---

## 🔗 Документация

**Основная:**
- [README.md](README.md) — О проекте
- [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md) — Видение
- [SIMPLY_ROADMAP.md](SIMPLY_ROADMAP.md) — План развития
- [CHANGELOG.md](CHANGELOG.md) — История изменений

**Техническая:**
- [docs/ai-capabilities.md](docs/ai-capabilities.md) — AI возможности
- [docs/architecture.md](docs/architecture.md) — Архитектура
- [docs/setup.md](docs/setup.md) — Установка
- [docs/decisions/](docs/decisions/) — ADR

**ТЗ:**
- [TZ_01_AGENTS_ARCHITECTURE.md](TZ_01_AGENTS_ARCHITECTURE.md) — Этап 1
- [TZ_02_MULTIAGENT_CHAT.md](TZ_02_MULTIAGENT_CHAT.md) — Этап 2
- [TZ_02_ROADMAP.md](TZ_02_ROADMAP.md) — Дорожная карта Этапа 2

---

**Обновлено:** 2026-01-28
