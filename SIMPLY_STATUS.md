# Simply — Текущее состояние проекта

**Версия:** 2.6.0
**Дата:** 2026-01-29
**Статус:** ТЗ-3B завершён (Персонализация агентов)
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
| **Персонализация** | Профиль пользователя + адаптация агентов |
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

## 👤 Профиль пользователя (ТЗ-3A)

> Добавлен в ТЗ-3A. Данные профиля используются агентами и при персонализации.

### Поля профиля

| Поле | Тип | Описание |
|------|-----|----------|
| `displayName` | varchar(100) | Как обращаться к пользователю |
| `pronouns` | varchar(10) | "ты" / "вы" — форма обращения |
| `occupation` | varchar(100) | Сфера деятельности |
| `bio` | text | Контекст для агентов |
| `theme` | varchar(20) | "light" / "dark" / "system" |

### Функционал

- **Страница настроек** `/settings` — 3 секции (Профиль, Аккаунт, Внешний вид)
- **Меню пользователя** — имя вместо email, аватар, план, настройки
- **Онбординг** — 3-шаговый диалог для новых пользователей
- **Интеграция с агентами** — user context в system prompts
- **Синхронизация темы** — БД ↔ next-themes

---

## 🎭 Персонализация агентов (ТЗ-3B)

> Добавлен в ТЗ-3B. Пользователи создают персональные копии агентов из каталога.

### Диалог персонализации (4 шага)

| Шаг | Действие | Описание |
|-----|----------|----------|
| 1 | Имя агента | Текстовый ввод, default "Мой {agentName}" |
| 2 | Стиль общения | Дружелюбный / Деловой / Экспертный |
| 3 | Специализация | Текстовый ввод (опционально) |
| 4 | Подтверждение | Сводка настроек, создание агента |

### Тип AgentCustomizations

```typescript
type AgentCustomizations = {
  communicationStyle?: "formal" | "friendly" | "expert";
  specialization?: string;
};
```

### Функционал

- **Кнопка "В мои агенты"** — на странице каждого агента из каталога
- **Секция "Мои агенты"** — в sidebar, с меню (⋯) для каждого агента
- **Редактирование** — изменение настроек персонального агента
- **Удаление** — soft delete с подтверждением
- **Применение в чате** — customizations инжектятся в system prompt

### API

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/user-agents` | GET | Список персональных агентов |
| `/api/user-agents` | POST | Создание персонального агента |
| `/api/user-agents/[id]` | PATCH | Обновление настроек |
| `/api/user-agents/[id]` | DELETE | Soft delete (isActive = false) |

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

### Этап 3A: Профиль пользователя (ТЗ-3A) — ✅ ЗАВЕРШЁН

**Выполнено:**
- 5 новых полей в таблице User (displayName, pronouns, occupation, bio, theme)
- API: GET/PATCH `/api/user/profile`
- Страница настроек `/settings` с 3 секциями
- Редизайн меню пользователя (sidebar): имя, аватар, "Бесплатный", Настройки, Тема, Помощь, Выйти
- Динамическое приветствие вместо хардкода
- Онбординг для новых пользователей (3 шага)
- User context injection в system prompts всех агентов
- Синхронизация темы БД ↔ next-themes
- Очистка артефактов ("Family AI Assistant" → "Simply")

**Детали:** [TZ_03A_USER_PROFILE.md](TZ_03A_USER_PROFILE.md)

### Этап 3B: Персонализация агентов (ТЗ-3B) — ✅ ЗАВЕРШЁН

**Выполнено:**
- Диалог персонализации (4 шага): имя, стиль, специализация, подтверждение
- CRUD API для персональных агентов (POST, PATCH, DELETE)
- Кнопка "В мои агенты" на странице каждого агента
- Секция "Мои агенты" в sidebar с меню действий
- Редактирование и удаление персональных агентов
- buildAgentCustomizations — применение настроек в system prompt
- Fallback в chat route: userAgent если не найден в каталоге

**Детали:** [TZ_03B_AGENT_PERSONALIZATION.md](TZ_03B_AGENT_PERSONALIZATION.md) | [TZ_03B_ROADMAP.md](TZ_03B_ROADMAP.md)

### Этап 4+: Будущее ← СЛЕДУЮЩИЙ

- Tool Activity UX
- Мультипровайдер (GPT, Claude)
- Smart Routing, Биллинг

**Полный roadmap:** [SIMPLY_ROADMAP.md](SIMPLY_ROADMAP.md)

---

## 📊 Статистика

| Метрика | Значение |
|---------|----------|
| Версия | 2.6.0 |
| Статус | ТЗ-3B завершён |
| AI-агентов | 8 (в БД) + персональные |
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
- [TZ_03A_USER_PROFILE.md](TZ_03A_USER_PROFILE.md) — Этап 3A
- [TZ_03B_AGENT_PERSONALIZATION.md](TZ_03B_AGENT_PERSONALIZATION.md) — Этап 3B
- [TZ_03B_ROADMAP.md](TZ_03B_ROADMAP.md) — Дорожная карта Этапа 3B

---

**Обновлено:** 2026-01-29
