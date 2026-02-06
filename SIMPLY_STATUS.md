# Simply — Текущее состояние проекта

**Версия:** 3.7.1
**Дата:** 2026-02-06
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
| **Проекты** | Изолированные рабочие пространства (⚠️ временно Gemini) | ✅ v3.2.0 |
| **Модальные помощники** | Prompt-агент (📝), Бен (❓) | ✅ |
| **Три уровня персонализации** | Профиль + RAG + Chat Memory | Профиль ✅, RAG/Memory 📋 |
| **Best-in-Class инструменты** | Perplexity, Plus AI, Ideogram, AssemblyAI | 📋 Фаза 1 |
| **Мультипровайдер** | GPT, Claude, Gemini через единый интерфейс | ⏸️ v3.7.1 (только Gemini) |
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

## Система промптов (v3.3 — Skills + Agents)

> В версии 3.3.0 система промптов мигрирована на архитектуру Skills + Agents по стандарту Anthropic.

### Архитектура

| Концепция | Описание |
|-----------|----------|
| **Skills** | Атомарные навыки в формате Markdown (SKILL.md) |
| **Agents** | Персонажи-дирижёры с набором skills (AGENT.md + config.yaml) |
| **Builder** | Модульная система сборки промптов |
| **Progressive Disclosure** | Загрузка только необходимой информации |

### Промпты

| Промпт | Модель | Назначение |
|--------|--------|------------|
| **chat** | Gemini 3 Pro | Универсальный AI-чат |
| **prompt-agent** | Gemini 3 Pro | Помощь в формулировке промптов |
| **ben** | Gemini 2.5 Flash | Гид по платформе |

### Файловая структура

```
lib/prompts/
├── index.ts                 # Client-safe экспорты (типы, утилиты)
├── server.ts                # Server-only экспорты (fs-зависимые)
├── types.ts                 # TypeScript типы
├── template.ts              # Template engine
│
├── skills/                  # Атомарные навыки
│   ├── _template/SKILL.md   # Шаблон skill
│   ├── document/            # Skills для документов
│   │   ├── create-presentation/SKILL.md
│   │   ├── create-spreadsheet/SKILL.md
│   │   ├── create-text-document/SKILL.md
│   │   └── analyze-document/SKILL.md
│   ├── research/            # Skills для исследований
│   │   └── web-research/SKILL.md
│   └── utility/
│       └── prompt-helper/SKILL.md
│
├── agents/                  # Персонажи-агенты
│   ├── _template/           # Шаблон агента
│   │   ├── AGENT.md
│   │   └── config.yaml
│   └── ben/                 # Бен — гид по платформе
│       ├── AGENT.md
│       ├── config.yaml
│       ├── onboarding.md
│       └── references/
│           ├── features.md
│           └── scenarios.md
│
├── builder/                 # Система сборки промптов
│   ├── index.ts             # Public API
│   ├── registry.ts          # Сканирование skills/agents
│   ├── skill-loader.ts      # Загрузка SKILL.md
│   ├── agent-loader.ts      # Загрузка AGENT.md + config.yaml
│   └── composer.ts          # Сборка финального промпта
│
├── core/                    # Переиспользуемые блоки (.md)
│   ├── index.ts             # Загрузчик .md файлов
│   ├── base.md
│   ├── safety.md
│   ├── formatting.md
│   └── russian-market.md
│
└── contexts/                # Контексты пользователя
    ├── index.ts
    ├── user-profile.ts
    └── chat-memory.ts
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
- **Load Skill** (динамическая загрузка инструкций) ← v3.3.2

**Планируемые:**
- Website Analyzer (fetch, screenshot, SEO)
- Transcription (Whisper)
- Image Generation

---

## Технический стек

| Слой | Технология |
|------|------------|
| Frontend | Next.js 15.3, React 18, TypeScript, Tailwind CSS |
| AI | Vercel AI SDK (@ai-sdk/google, @openrouter/ai-sdk-provider) |
| Auth | NextAuth 5.0-beta.25 |
| Database | PostgreSQL (Neon) + Drizzle ORM |
| Storage | Vercel Blob Storage |
| External | Brave Search, CloudConvert, Open-Meteo, Deepgram |
| Deploy | Vercel |

---

## План развития

### ТЗ-08: File Viewer — ✅ ЗАВЕРШЁН

**Выполнено:**
- **FileViewer модалка** — просмотр файлов проекта без скачивания
- **Поддержка форматов** — изображения, PDF, текст, Markdown, CSV, Excel, PPTX
- **Навигация** — стрелки ← → между файлами, индикатор позиции (1/5)
- **UX** — анимация (fade + zoom), мобильная адаптация, touch targets 48px
- **Shared компонент** — MarkdownViewer вынесен из artifacts

**Ключевые файлы:**
- `components/file-viewer/` — модуль просмотра файлов (12 файлов)
- `components/file-viewer/file-viewer.tsx` — главный компонент (Radix Dialog)
- `components/file-viewer/renderers/` — 7 рендереров по типу файла
- `components/markdown-viewer.tsx` — shared компонент для Markdown
- `components/projects/project-files-card.tsx` — интеграция (клик → FileViewer)

**Детали:** [_archive/TZ_08_FileViewer/](_archive/TZ_08_FileViewer/)

### ТЗ-07C3: Project Entry Points — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Карточка "Новая задача"** — быстрое создание задачи (➕), переход в чат
- **Карточка "Менеджер"** — точка входа в управление проектом (👤)
- **Модалка Менеджера** — заглушка с превью будущих функций
- **Секция ProjectActions** — wrapper для 3 карточек (Задачи, Новая задача, Менеджер)
- **Убран ProjectInput** — поле ввода убрано со страницы проекта

**Ключевые файлы:**
- `components/projects/new-task-card.tsx` — карточка "Новая задача"
- `components/projects/manager-card.tsx` — карточка "Менеджер"
- `components/projects/manager-dialog.tsx` — модалка Менеджера
- `components/projects/project-actions.tsx` — секция с карточками
- `app/(dashboard)/projects/[id]/page.tsx` — обновлённая страница проекта

**Детали:** [_archive/TZ_07C3_ProjectEntryPoints/](_archive/TZ_07C3_ProjectEntryPoints/)

### ТЗ-07C2: Project Pulse — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Панель "Пульс проекта"** — живая панель состояния на странице проекта
- **Статусы задач** — not_started / in_progress / done
- **Автопереход статуса** — not_started → in_progress при первом сообщении
- **AI-итог проекта** — генерация summary через Gemini 2.5 Flash
- **UI статусов** — визуальные индикаторы в списке задач, детальной панели, sidebar

**Ключевые файлы:**
- `components/projects/project-pulse.tsx` — панель Пульс проекта
- `app/(chat)/api/projects/[id]/generate-summary/route.ts` — API генерации итога
- `app/(chat)/api/chat/route.ts` — автопереход статуса
- `components/tasks/` — обновлённые компоненты с кнопками статуса
- `lib/db/queries.ts` — updateChatTaskStatus, updateProjectSummary

**Детали:** [_archive/TZ_07C2_ProjectPulse/](_archive/TZ_07C2_ProjectPulse/)

### ТЗ-07B: Chat History — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Страница /chats** — двухколоночный layout (список + детали)
- **Карточка на главной** — "💬 История чатов" со счётчиком, переход на /chats
- **Автогенерация summary** — AI генерирует краткое описание чата
- **Звёзды (isStarred)** — отметка важных чатов (toggle в sidebar и на /chats)
- **Database** — поля `summary`, `isStarred` в Chat

**Ключевые файлы:**
- `app/(dashboard)/chats/page.tsx` — страница истории чатов
- `components/chats/` — 6 компонентов для /chats
- `components/glavnaya/chat-history-card.tsx` — карточка на главной
- `lib/db/queries.ts` — новые queries (getGeneralChatsCount, getGeneralChatsWithStats)
- `sidebar-history-item.tsx` — ⭐ toggle в меню

**Детали:** [_archive/TZ_07B_ChatHistory/](_archive/TZ_07B_ChatHistory/)

### ТЗ-07A: Glavnaya + Navigation + Sidebar — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Новая главная страница** — `/` с инпутом в стиле Google Gemini / Claude Desktop
- **Унифицированная система инпутов** — `components/input/` (композиционная архитектура)
- **Контекстный sidebar** — показывает релевантные чаты (главные / проектные)
- **Автонейминг чатов** — автоматическая генерация названий через Gemini Flash
- **Переименование чатов** — inline-редактирование в sidebar
- **Universal Dialog** — унифицированный компонент диалогов
- **Breadcrumbs** — навигационные хлебные крошки на всех уровнях
- **API управления чатами** — DELETE/PATCH для `/api/chat/[id]`

**Ключевые файлы:**
- `components/input/` — унифицированная система инпутов (10 файлов)
- `components/glavnaya/` — компоненты главной страницы
- `components/universal-dialog/` — система диалогов
- `app/(chat)/api/chat/[id]/route.ts` — API чатов
- `app/(chat)/api/chat/[id]/generate-title/route.ts` — генерация заголовков

**Детали:** [_archive/TZ_07A_Glavnaya/](_archive/TZ_07A_Glavnaya/)

### ТЗ-04: Skills + Agents Architecture — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Skills** — атомарные навыки в формате Markdown (SKILL.md с frontmatter)
- **Agents** — персонажи с AGENT.md + config.yaml
- **Builder** — модульная система сборки промптов
- **Progressive Disclosure** — загрузка metadata → full content по требованию
- **Server-only exports** — изоляция fs-зависимых функций
- **Core в Markdown** — base.md, safety.md, formatting.md, russian-market.md
- **Миграция Ben** — полноценный агент с references
- **Миграция Prompt-agent** — skill в utility/prompt-helper/

**Ключевые файлы:**
- `lib/prompts/builder/` — система сборки (registry, loaders, composer)
- `lib/prompts/agents/ben/` — агент Бен
- `lib/prompts/skills/utility/prompt-helper/` — skill Prompt-helper
- `lib/prompts/server.ts` — server-only экспорты

**Детали:** [_archive/TZ_04_ROADMAP.md](_archive/TZ_04_ROADMAP.md)

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
| Версия | 3.7.1 |
| Статус | Active development |
| Voice Input | Deepgram Nova-3 (русский) |
| Архитектура промптов | Skills + Agents (v3.3) |
| Архитектура UI | Унифицированные инпуты (v3.4), File Viewer (v3.7) |
| Skills | 6 (document: 4, research: 1, utility: 1) |
| Agents | 1 (ben) |
| Промптов | 4 (chat, prompt-agent, ben, project) |
| AI моделей | 5 (Gemini 3 Pro, 2.5 Flash, Claude Haiku, Sonnet, Opus) |
| AI-инструментов | 9 |
| Типов документов | 5 (text, markdown, excel, presentation-reveal, presentation-pptx) |
| Тем презентаций | 5 |
| Тем Excel | 5 |
| Шаблонов Excel | 10 |
| Форматов FileViewer | 8 (image, pdf, text, markdown, csv, excel, pptx, unsupported) |
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
- [_archive/TZ_07C3_ProjectEntryPoints/](_archive/TZ_07C3_ProjectEntryPoints/) — ТЗ-07C3 Project Entry Points
- [_archive/TZ_07C2_ProjectPulse/](_archive/TZ_07C2_ProjectPulse/) — ТЗ-07C2 Project Pulse
- [_archive/TZ_07B_ChatHistory/](_archive/TZ_07B_ChatHistory/) — ТЗ-07B Chat History
- [_archive/TZ_07A_Glavnaya/](_archive/TZ_07A_Glavnaya/) — ТЗ-07A Glavnaya + Navigation + Sidebar
- [_archive/TZ_04_ROADMAP.md](_archive/TZ_04_ROADMAP.md) — ТЗ-04 Skills + Agents
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

**Обновлено:** 2026-02-06
