# Simply — Текущее состояние проекта

**Версия:** 3.2.0
**Дата:** 2026-02-02
**Статус:** Active development
**Production URL:** https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app

> **Назначение:** Полная информация о состоянии проекта для разработки ТЗ и архитектурных решений.

---

## О проекте

### Что это?

**Simply** — AI-платформа для российского рынка. Шлюз к лучшим мировым AI-моделям с оплатой в рублях.

### Философия

- **Apple-подход:** Качество важнее количества
- **Best-in-Class API:** Не изобретаем велосипеды — интегрируем лучшие решения (Perplexity, Plus AI, Ideogram)

### Ключевые особенности

| Особенность | Описание | Статус |
|-------------|----------|--------|
| **Универсальный AI-чат** | Один мощный чат со всеми инструментами | ✅ |
| **Проекты** | Изолированные рабочие пространства с Claude | ✅ v3.2.0 |
| **Модальные помощники** | Prompt-агент (📝), Бен (❓) | ✅ |
| **Три уровня персонализации** | Профиль + RAG + Chat Memory | Профиль ✅, RAG/Memory 📋 |
| **Best-in-Class инструменты** | Perplexity, Plus AI, Ideogram, AssemblyAI | 📋 Фаза 1 |
| **Мультипровайдер** | GPT, Claude, Gemini через единый интерфейс | ✅ v3.2.0 (Claude) |
| **Smart Routing** | Автовыбор модели для экономии без потери качества | 📋 |
| **Оплата в рублях** | ЮKassa, Тинькофф, СБП | 📋 |

**Подробнее:** [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md)

---

## Унаследовано от Family AI Assistant

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

### Артефакты (документы в холсте)
- ✅ Text Artifact (plain text + emoji)
- ✅ Markdown Artifact (форматированные документы)
- ✅ Excel Artifact (таблицы, формулы, графики)
- ✅ Presentation-Reveal (веб-презентации)
- ✅ Presentation-PPTX (PowerPoint)
- ✅ Public Share (публичные ссылки)
- ✅ PDF Export (для Markdown и Excel)

---

## Система промптов (v3.0)

> В версии 3.0.0 система агентов заменена на файловую систему промптов.

### Промпты

| Промпт | Модель | Назначение |
|--------|--------|------------|
| **chat** | Gemini 3 Pro | Универсальный AI-чат |
| **prompt-agent** | Gemini 3 Pro | Помощь в формулировке промптов |
| **ben** | Gemini 2.5 Flash | Гид по платформе |

### Файловая структура

```
lib/prompts/
├── index.ts                 # Экспорты
├── types.ts                 # TypeScript типы
├── builder.ts               # Логика сборки
├── template.ts              # Template engine
├── core/                    # Переиспользуемые блоки
├── chat/config.ts           # Конфиг чата
├── ben/config.ts            # Конфиг Бена
├── assistants/prompt-agent/ # Конфиг Prompt-агента
└── contexts/                # Контексты пользователя
```

### Модальные помощники

| Помощник | Кнопка | Назначение |
|----------|--------|------------|
| **Prompt-агент** | 📝 | Улучшение промптов, уточняющие вопросы |
| **Бен** | ❓ | Вопросы о платформе, онбординг |

---

## Проекты (v3.2.0)

> Изолированные рабочие пространства с Claude (Anthropic) через OpenRouter.

### Концепция

Проект = изолированное рабочее пространство со своими чатами и настройками. В отличие от основного чата (Gemini), проекты используют модели Claude.

### Три уровня моделей

| Уровень | Модель | Иконка | Назначение |
|---------|--------|--------|------------|
| **Исполнитель** | Claude Haiku | ⚡ | Быстрый, экономичный, простые задачи |
| **Эксперт** | Claude Sonnet | 🎯 | Баланс скорости и качества (по умолчанию) |
| **Профессор** | Claude Opus | 🎓 | Максимальное качество, сложный reasoning |

### Режим Профессор (Pipeline)

Многоэтапный reasoning pipeline:
1. **Анализ (Opus)** — разбивает задачу на подзадачи
2. **Исполнение (Haiku)** — параллельно выполняет подзадачи
3. **Синтез (Opus)** — объединяет результаты в финальный ответ

UI показывает прогресс с галочками для каждой подзадачи.

### Структура файлов

```
app/(chat)/projects/
├── page.tsx                    # Список проектов
├── new/page.tsx                # Создание проекта
└── [id]/
    ├── page.tsx                # Страница проекта
    └── chat/
        ├── page.tsx            # Новый чат в проекте
        └── [chatId]/page.tsx   # Существующий чат

lib/ai/
├── model-tiers.ts              # Конфиг уровней моделей
└── professor-pipeline.ts       # Pipeline для режима Профессор

components/projects/
└── professor-progress.tsx      # UI прогресса pipeline
```

### Не реализовано из ТЗ-03

| Функция | Статус | Примечание |
|---------|--------|------------|
| Иконки уровней | Изменено | ⚡🎯🎓 вместо ⚙️💼🎓 |
| "думает..." индикатор | Не реализовано | Во время генерации |
| Pipeline индикатор в header | Не реализовано | Динамический статус |
| Drag & drop файлов | Nice to have | Не в MVP |
| Предпросмотр файлов | Nice to have | Не в MVP |
| Поиск в проектах | Nice to have | Не в MVP |
| Сортировка проектов | Nice to have | Не в MVP |

---

## Профиль пользователя

### Поля профиля

| Поле | Тип | Описание |
|------|-----|----------|
| `displayName` | varchar(100) | Как обращаться к пользователю |
| `pronouns` | varchar(10) | "ты" / "вы" — форма обращения |
| `occupation` | varchar(100) | Сфера деятельности |
| `bio` | text | Контекст для AI |
| `theme` | varchar(20) | "light" / "dark" / "system" |
| `hasSeenBenIntro` | boolean | Флаг онбординга Бена |

### Функционал

- **Страница настроек** `/settings` — 3 секции (Профиль, Аккаунт, Внешний вид)
- **Меню пользователя** — имя вместо email, аватар, план, настройки
- **Онбординг** — 3-шаговый диалог для новых пользователей
- **Интеграция с AI** — user context в system prompts
- **Синхронизация темы** — БД ↔ next-themes

---

## AI-инструменты

**Текущие:**
- Web Search (Brave API)
- Get Current Date
- Get Weather (Open-Meteo)
- Read Document
- Create Document (text, markdown, excel, presentations)
- Update Document (редактирование артефактов)
- Request Suggestions
- Parse Excel (анализ загруженных файлов)

**Планируемые:**
- Website Analyzer (fetch, screenshot, SEO)
- Transcription (Whisper)
- Image Generation

---

## Технический стек

| Слой | Технология |
|------|------------|
| Frontend | Next.js 15.3, React 18, TypeScript, Tailwind CSS |
| AI | Vercel AI SDK (@ai-sdk/google, @ai-sdk/openai, @ai-sdk/anthropic) |
| Auth | NextAuth 5.0-beta.25 |
| Database | PostgreSQL (Neon) + Drizzle ORM |
| Storage | Vercel Blob Storage |
| External | Brave Search, CloudConvert, Open-Meteo, Deepgram |
| Deploy | Vercel |

---

## План развития

### ТЗ-03: Проекты + Claude + Режим Профессор — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Проекты** — изолированные рабочие пространства
- **Claude интеграция** — Haiku, Sonnet, Opus через OpenRouter
- **Три уровня моделей** — Исполнитель/Эксперт/Профессор
- **Режим Профессор** — Pipeline с Opus→Haiku→Opus
- **UI прогресса** — галочки для подзадач в pipeline
- **Breadcrumb навигация** — Home > Project > Чат
- **Database** — таблица `Project`, поле `projectId` в `Chat`

**Ключевые файлы:**
- `lib/ai/model-tiers.ts` — конфиг уровней моделей
- `lib/ai/professor-pipeline.ts` — pipeline для Профессора
- `components/projects/professor-progress.tsx` — UI прогресса
- `app/(chat)/projects/` — страницы проектов

**Детали:** [_archive/TZ_03_PROJECTS_ANTHROPIC_PROFESSOR.md](_archive/TZ_03_PROJECTS_ANTHROPIC_PROFESSOR.md)

### ТЗ-02: Dashboard + Sidebar + Routing — ✅ ЗАВЕРШЁН

**Выполнено:**
- Dashboard (`/dashboard`) — новая точка входа с карточками инструментов
- Sidebar с вертикальными вкладками (Search, Chats, Projects)
- SidebarLayout — табы остаются видимыми при сворачивании sidebar
- Settings без sidebar (`/settings`)
- Ben персонализация — intro bubble для новых пользователей
- Modal drawer responsive — корректная работа при смене desktop/mobile

**Ключевые файлы:**
- `components/sidebar-layout.tsx` — layout с табами вне Sidebar
- `components/modal-assistants/ben/intro-bubble.tsx` — speech bubble для онбординга
- `components/ui/sidebar.tsx` — CSS variable `--sidebar-left-offset`

**Детали:** [_archive/TZ_02_ROADMAP.md](_archive/TZ_02_ROADMAP.md)

### ТЗ-NEW-01: Новая архитектура (v3.0.0) — ✅ ЗАВЕРШЁН

**Выполнено:**
- Файловая система промптов (`lib/prompts/`)
- Модальные помощники (Prompt-агент, Бен)
- Удалены таблицы `Agent` и `UserAgent`
- Удалены поля `agentId` из `Chat` и `Message`
- Удалён UI выбора агента и @-mentions
- Добавлено поле `hasSeenBenIntro` в `User`
- Anthropic SDK через OpenRouter

**Фазы:**
1. ✅ Инфраструктура промптов
2. ✅ Anthropic SDK
3. ✅ Модальные помощники
4. ✅ Чистка UI
5. ✅ Чистка кода
6. ✅ Миграция БД
7. ✅ Интеграция
8. ✅ Тестирование
9. ✅ Финализация

**Детали:** [_archive/TZ_NEW_01_ROADMAP.md](_archive/TZ_NEW_01_ROADMAP.md)

### Предыдущие этапы

| Этап | Описание | Статус |
|------|----------|--------|
| 0 | Документация и ребрендинг | ✅ |
| 1 | Архитектура агентов (ТЗ-1) | ✅ → Заменено в v3.0 |
| 2 | Мультиагентный чат (ТЗ-2) | ✅ → Заменено в v3.0 |
| 3A | Профиль пользователя (ТЗ-3A) | ✅ |
| 3B | Персонализация агентов (ТЗ-3B) | ✅ → Заменено в v3.0 |
| 4 | Упрощение UX (ТЗ-4) | ✅ |
| 5 | Markdown документы (ТЗ-5) | ✅ |
| 6 | Excel Tool (ТЗ-6) | ✅ |
| — | Performance Audit | ✅ |
| — | Artifact Loading UX | ✅ |
| — | Voice Input (Deepgram) | ✅ |

### Следующие этапы

| Этап | Описание | Приоритет |
|------|----------|-----------|
| **7** | Tool Activity UX | 🔴 Высокий |
| **8** | Инструменты Фаза 1 (Perplexity, Plus AI, Ideogram) | 🔴 Высокий |
| **9** | RAG (База знаний) | 🟡 Средний |
| **10** | Chat Memory | 🟡 Средний |
| **11** | Мультипровайдер (GPT, Claude) | 🟡 Средний |
| **12** | Биллинг (Pay-as-you-go) | 🟡 Средний |
| **13** | Инструменты Фаза 2 | 🟢 Низкий |
| **14** | Инструменты Фаза 3 + Morning Briefing | 🟢 Низкий |

**Философия инструментов:** Best-in-Class API — интегрируем лучшие готовые решения, не изобретаем велосипеды.

**Подробности:** [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md)

---

## Статистика

| Метрика | Значение |
|---------|----------|
| Версия | 3.2.0 |
| Статус | Active development |
| Voice Input | Deepgram Nova-3 (русский) |
| Промптов | 4 (chat, prompt-agent, ben, project) |
| AI моделей | 5 (Gemini 3 Pro, 2.5 Flash, Claude Haiku, Sonnet, Opus) |
| AI-инструментов | 8 |
| Типов документов | 5 (text, markdown, excel, presentation-reveal, presentation-pptx) |
| Тем презентаций | 5 |
| Тем Excel | 5 |
| Шаблонов Excel | 10 |
| Production build | ✅ Успешен |

---

## Документация

**Основная:**
- [README.md](README.md) — О проекте
- [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md) — Видение продукта
- [CHANGELOG.md](CHANGELOG.md) — История изменений

**Техническая:**
- [docs/ai-agents.md](docs/ai-agents.md) — Система промптов и помощники
- [docs/ai-artifacts.md](docs/ai-artifacts.md) — Артефакты
- [docs/ai-tools.md](docs/ai-tools.md) — Инструменты
- [docs/architecture.md](docs/architecture.md) — Архитектура
- [docs/setup.md](docs/setup.md) — Установка
- [docs/decisions/](docs/decisions/) — ADR

**ТЗ (архив):**
- [_archive/TZ_03_PROJECTS_ANTHROPIC_PROFESSOR.md](_archive/TZ_03_PROJECTS_ANTHROPIC_PROFESSOR.md) — ТЗ-03 Проекты + Claude
- [_archive/TZ_02_ROADMAP.md](_archive/TZ_02_ROADMAP.md) — ТЗ-02 Dashboard + Sidebar
- [_archive/TZ_NEW_01_ROADMAP.md](_archive/TZ_NEW_01_ROADMAP.md) — ТЗ-NEW-01 (v3.0.0)
- [_archive/TZ_VOICE_01_MIGRATION_TO_DEEPGRAM.md](_archive/TZ_VOICE_01_MIGRATION_TO_DEEPGRAM.md) — Voice Input Deepgram
- [_archive/TZ_01_AGENTS_ARCHITECTURE.md](_archive/TZ_01_AGENTS_ARCHITECTURE.md) — Этап 1
- [_archive/TZ_02_MULTIAGENT_CHAT.md](_archive/TZ_02_MULTIAGENT_CHAT.md) — Этап 2
- [_archive/TZ_03A_USER_PROFILE.md](_archive/TZ_03A_USER_PROFILE.md) — Этап 3A
- [_archive/TZ_03B_AGENT_PERSONALIZATION.md](_archive/TZ_03B_AGENT_PERSONALIZATION.md) — Этап 3B
- [_archive/TZ_04_UX_SIMPLIFICATION.md](_archive/TZ_04_UX_SIMPLIFICATION.md) — Этап 4
- [_archive/TZ_05_MARKDOWN_ARTIFACTS.md](_archive/TZ_05_MARKDOWN_ARTIFACTS.md) — Этап 5
- [_archive/TZ_EXCEL_TOOL.md](_archive/TZ_EXCEL_TOOL.md) — Этап 6
- [_archive/TZ_06_ROADMAP.md](_archive/TZ_06_ROADMAP.md) — Этап 6 Roadmap

---

**Обновлено:** 2026-02-02
