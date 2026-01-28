# Simply — Текущее состояние проекта

**Версия:** 2.2.0
**Дата:** 2026-01-28
**Статус:** 🚧 Ребрендинг (Family AI → Simply)
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

## 🤖 Текущие AI-агенты

> **Примечание:** При переходе к Этапу 1 агенты будут мигрированы в БД, часть удалена.

| Агент | Модель | Статус в Simply |
|-------|--------|-----------------|
| **Маркетолог** | Gemini 3 Pro | ✅ Останется |
| **Копирайтер** | Gemini 3 Pro | ✅ Останется |
| **Переводчик** | Gemini 3 Pro | ✅ Останется |
| **Наставник** | Gemini 3 Pro | ✅ Останется |
| **Презентатор** | Gemini 3 Pro | ✅ Останется |
| **Универсальный** | Gemini 2.5 Flash | ✅ Останется |
| **Кулинар** | Gemini 2.5 Flash | ❌ Будет удалён |
| **Астролог** | Gemini 2.5 Flash | ❌ Будет удалён |
| **Одессит** | Gemini 2.5 Flash | ❌ Будет удалён |

**Новый агент (Этап 1):**
- **Агент-Помощник** — системный, роутер + помощник по персонализации

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

### Этап 0: Документация и ребрендинг ← ТЕКУЩИЙ

**Цель:** Переименовать Family AI → Simply, обновить документацию

**Прогресс:** 2/21 задач

### Этап 1: Архитектура агентов (ТЗ-1)

**Цель:** Миграция агентов из кода в БД, каталог агентов

**Ключевое:**
- Таблицы `agents`, `user_agents`
- Удаление `User.role`
- UI каталога `/agents`
- Смена агента в чате

**Детали:** [TZ_01_AGENTS_ARCHITECTURE.md](TZ_01_AGENTS_ARCHITECTURE.md)

### Этап 2+: Будущее

- Tool Activity UX (живая индикация инструментов)
- Мультипровайдер (GPT, Claude)
- Smart Routing
- Биллинг (подписки, рубли)
- Новые агенты и инструменты

**Полный roadmap:** [SIMPLY_ROADMAP.md](SIMPLY_ROADMAP.md)

---

## 📊 Статистика

| Метрика | Значение |
|---------|----------|
| Версия | 2.2.0 |
| Статус | 🚧 Ребрендинг |
| AI-агентов | 9 (будет 7) |
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

---

**Обновлено:** 2026-01-28
**Источник:** PROJECT_STATUS.md (Family AI v2.5.0)
