# Simply — Текущее состояние проекта

**Версия:** 3.14.0
**Дата:** 2026-02-09
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
| **Проекты** | Изолированные рабочие пространства с Профессором, Менеджером и автоанализом файлов | ✅ v3.14.0 |
| **Сервисные помощники** | Бен (❓), Секретарь (➕), Менеджер (👤) | ✅ v3.13.0 |
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
| **ben** | Gemini 2.5 Flash | Гид по платформе |
| **project-creation** | Gemini 3 Pro | Секретарь — AI-интервью для создания проектов |
| **project-manager** | Gemini 2.5 Flash | Менеджер проекта (живой AI-диалог) |
| **professor-planning** | Gemini 3 Pro | Профессор планирования — генерация плана задач |
| **file-analyzer** (Клерк) | Gemini 2.5 Flash | Автоанализ файлов проекта |

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
├── professors/                  # Промпты профессоров (v3.14)
│   └── planning.md          # Профессор планирования
│
├── clerks/                      # Промпты клерков (v3.13)
│   └── file-analyzer.md     # Клерк-анализатор файлов
│
├── service-chats/               # Промпты сервисных чатов (v3.11+)
│   ├── project-creation.md  # XML-промпт Секретаря
│   └── project-manager.md   # Промпт Менеджера проекта
│
└── contexts/                # Контексты пользователя
    ├── index.ts
    ├── user-profile.ts
    └── chat-memory.ts
```

### Сервисные чаты (v3.8+)

> В версии 3.8.0 модальные помощники унифицированы в систему ServiceChat.
> В версии 3.13.0 Менеджер получил живой AI-диалог с серверной персистенцией.

| Чат | Кнопка | Оболочка | Назначение |
|-----|--------|----------|------------|
| **Бен** | ❓ | Floating (bottom-right) | Вопросы о платформе, онбординг |
| **Создание проекта** | ➕ | Full-page (split layout) | Секретарь — AI-интервью для создания проекта |
| **Менеджер проекта** | 👤 | Push-drawer (right) | Живой AI-диалог, серверная персистенция сообщений |

### Клерки (v3.13)

> Клерки — автоматические backend-процессы (без UI чата). Вызываются программно.

| Клерк | Модель | Триггер | Назначение |
|-------|--------|---------|------------|
| **Анализатор файлов** | Gemini 2.5 Flash | Upload файла в проект | Описание, тип, папка, ключевые темы, manifest |

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

### ТЗ-B1: Professor Planning — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Профессор планирования** — AI-агент (Gemini 3 Pro), анализирует проект и генерирует структурированный план задач
- **`POST /api/projects/[id]/plan`** — endpoint Профессора: принимает passport, manifest, files, возвращает plan JSON
- **`Project.planJson`** (jsonb) — хранение плана (discriminated union: complete / partial / needs_input)
- **`Project.planStatus`** — статус планирования (idle / generating / done / error)
- **Zod-валидация** — строгие типизированные схемы для tasks, risks, recommendations, caveats, questions с lenient parsing
- **PlanningState UI** — три состояния:
  - Loading: анимация прогресса (4 шага: Анализ → Декомпозиция → Оценка рисков → Формирование)
  - NeedsInput: карточки вопросов от Профессора (blocking/non-blocking)
  - PlanView: карточки задач (order, title, description, dependencies, tools), секция рисков (severity badge), рекомендации, кавеаты
- **Pulse: превью плана** — в фазе planning: нумерованные задачи (badge + title), или "Анализ проекта..." с Brain animate-pulse
- **Manager: контекст плана** — `<professor_plan>` XML-блок инжектируется в system prompt Менеджера (tasks, risks, recommendations)
- **Delete cascade fix** — корректное удаление проекта с учётом всех FK (Stream, Vote_v2, Message_v2, legacy tables, Chat, ProjectFile, ProjectFolder)

**Ключевые файлы:**
- `app/(chat)/api/projects/[id]/plan/route.ts` — endpoint Профессора
- `lib/ai/professor-types.ts` — Zod-схемы и типы плана
- `lib/prompts/professors/planning.md` — промпт Профессора
- `components/projects/phase-states/planning-state.tsx` — UI планирования (3 состояния)
- `components/projects/project-pulse.tsx` — Пульс с превью плана
- `app/(chat)/api/service-chat/route.ts` — Manager с план-контекстом
- `app/(dashboard)/projects/[id]/page.tsx` — передача planJson и phase в компоненты

**Детали:** [_archive/TZ_B1_ProfessorPlanning/](_archive/TZ_B1_ProfessorPlanning/)

### ТЗ-A3: Manager + Clerk + Manifest — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Клерк-анализатор файлов** — `POST /api/projects/[id]/analyze-file` (Gemini Flash): анализ файла, определение типа, описания, папки, ключевых тем
- **Auto-folder + move-to-folder** — автоматическое создание папок и перемещение файлов по рекомендации Клерка
- **Project Manifest** — `Project.manifestJson` (jsonb), автоматическая агрегация всех анализов
- **Живой Менеджер в drawer** — `ServiceChatCore` вместо заглушки, серверная персистенция сообщений
- **Prompt builder** — `buildFullManagerPrompt()` с passport, manifest, mode injection по phase
- **Fire-and-forget анализ** — после upload файла → автоматический вызов Клерка
- **UI обратная связь** — пульсация "Анализ...", documentType тег, tooltip с описанием
- **Адаптивная кнопка планирования** — "Начать планирование" / "без документов"

**Ключевые файлы:**
- `app/(chat)/api/projects/[id]/analyze-file/route.ts` — endpoint Клерка
- `lib/prompts/clerks/file-analyzer.md` — промпт Клерка
- `lib/prompts/service-chats/project-manager.md` — промпт Менеджера
- `components/projects/manager-drawer.tsx` — живой AI-диалог
- `components/projects/project-files-card.tsx` — auto-analyze + UI
- `components/projects/phase-states/welcome-state.tsx` — адаптивная кнопка

**Детали:** [_archive/TZ_A3_ManagerClerkManifest/](_archive/TZ_A3_ManagerClerkManifest/)

### ТЗ-A1: Project Page Layout — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Колонка `phase`** в таблице Project — фазовая система проектов (setup/documents/planning/approved/execution/completed)
- **ProjectPageLayout** — двухколоночный layout (Пульс ~300px + WorkArea flex-1), полноэкранный
- **ProjectPulse** — три сворачиваемые секции: План (задачи со статусами), Файлы (compact), Паспорт (описание, контекст, инструкция, мета)
- **ProjectWorkArea** — switch-рендеринг по фазе проекта (5 компонентов: welcome, planning, approved, execution, completed)
- **ManagerDrawer** — push-drawer справа (400px, WorkArea сжимается), мобильный bottom sheet (vaul)
- **Авто-переход setup → documents** — server-side при первом открытии проекта
- **Мобильная адаптация** — bottom sheet для Пульса + Менеджера
- **Удалены** project-actions.tsx, manager-card.tsx, new-task-card.tsx, task-history-card.tsx

**Ключевые файлы:**
- `components/projects/project-page-layout.tsx` — двухколоночный layout + drawer state
- `components/projects/project-pulse.tsx` — навигационный Пульс (3 секции)
- `components/projects/project-work-area.tsx` — рабочая область по фазе
- `components/projects/manager-drawer.tsx` — push-drawer Менеджера
- `components/projects/phase-states/` — 5 компонентов фаз
- `app/(dashboard)/projects/[id]/page.tsx` — обновлённая страница проекта
- `lib/db/queries.ts` — updateProjectPhase

**Детали:** [_archive/TZ_A1_ProjectPageLayout/](_archive/TZ_A1_ProjectPageLayout/)

### ТЗ-12: Secretary Integration — ✅ ЗАВЕРШЁН

**Выполнено:**
- **XML-промпт Секретаря** — качественное адаптивное интервью (2-4 вопроса, не допрос)
- **Промпт в отдельном файле** — `lib/prompts/service-chats/project-creation.md` (SSOT)
- **Gemini 3 Pro** — модель повышена с Flash для качественного интервью
- **Динамический user_context** — pronouns, bio, occupation, displayName (пустые поля не включаются)
- **Pronouns в greeting** — клиент учитывает ты/вы при приветствии
- **Убраны Quick Actions** — секретарь сам ведёт диалог, кнопки не нужны
- **Фикс скролла чата** — `min-h-0` на flex-контейнерах
- **Tool description** — "2-4 предложения" вместо "1-2"

**Ключевые файлы:**
- `lib/prompts/service-chats/project-creation.md` — XML-промпт Секретаря
- `app/(chat)/api/service-chat/route.ts` — загрузка промпта, user context, Gemini 3 Pro
- `app/(dashboard)/projects/new/page.tsx` — передача pronouns
- `app/(dashboard)/projects/new/project-creation-client.tsx` — greeting с pronouns, без quick actions
- `app/(dashboard)/projects/new/components/project-chat-panel.tsx` — без quick actions, фикс скролла

**Детали:** [_archive/TZ_12_SecretaryIntegration/](_archive/TZ_12_SecretaryIntegration/)

### ТЗ-10: Project Creation Live Preview — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Split Layout** — Preview слева (400px) + Chat справа
- **Live Preview** — поля заполняются в реальном времени при вызове AI tool
- **Tool updateProjectDraft** — AI обновляет черновик постепенно (name, description, context)
- **Кнопка "Создать проект"** — появляется когда name + description заполнены
- **API создания** — POST /api/projects с данными из черновика
- **Success card** — показывается после создания с навигацией
- **Фикс скролла** — левая панель не скроллится вместе с чатом
- **ServiceChatInput баги** — исправлены stale closure, добавлены attachments и voice mode

**Ключевые файлы:**
- `app/(dashboard)/projects/new/project-creation-client.tsx` — клиент со split layout
- `app/(dashboard)/projects/new/components/project-draft-preview.tsx` — preview с кнопкой
- `app/(dashboard)/projects/new/components/project-chat-panel.tsx` — chat panel
- `app/(chat)/api/service-chat/route.ts` — updateProjectDraft tool
- `components/input/input-context.tsx` — фикс stale closure для controlled mode

**Детали:** [_archive/TZ_10_ProjectCreationLivePreview/](_archive/TZ_10_ProjectCreationLivePreview/)

### ТЗ-11: Project Creation Polish — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Фикс скролла чата** — scroll anchor + auto-scroll к новым сообщениям
- **Placeholder-подсказки** — «Ожидание...» заменены на полезные примеры
- **Лейбл «Контекст проекта»** — вместо «Инструкция для AI» в preview создания
- **Колонка `context` в БД** — отдельное поле для справки о бизнесе (миграция 0022)
- **Tool updateProjectDraft** — параметр `instruction` → `context`
- **API POST /api/projects** — сохраняет в колонку `context`
- **Страница проекта** — вкладка «Паспорт» → КОНТЕКСТ читает реальные данные из БД
- **ADR 012** — документировано разделение Context vs Instruction

**Архитектурное решение (ADR 012):**
- Секретарь → `context` (справка о бизнесе, собирается при создании)
- Менеджер → `instruction` (инструкция для AI, заполняется позже)

**Ключевые файлы:**
- `app/(dashboard)/projects/new/components/project-chat-panel.tsx` — scroll fix
- `app/(dashboard)/projects/new/components/project-draft-preview.tsx` — placeholders + label
- `app/(chat)/api/service-chat/route.ts` — tool parameter context
- `app/(chat)/api/projects/route.ts` — POST saves context
- `lib/db/schema.ts` — колонка `context` в Project
- `lib/db/migrations/0022_flat_adam_destine.sql` — миграция
- `components/projects/project-passport.tsx` — отображает context из БД

**Детали:** [_archive/TZ_11_ProjectCreationPolish/](_archive/TZ_11_ProjectCreationPolish/) | [docs/decisions/012-context-vs-instruction-separation.md](docs/decisions/012-context-vs-instruction-separation.md)

### ТЗ-09: ServiceChat — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Унифицированная система сервисных чатов** — единая архитектура для Бен, создания проекта, менеджера
- **ServiceChatCore** — ядро с messages, streaming, quickActions
- **ServiceChatFloating** — floating modal (center/bottom-right) для Бена и создания проекта
- **ServiceChatDrawer** — drawer справа для менеджера проекта
- **Конфиги** — BEN_CONFIG, PROJECT_CREATION_CONFIG, PROJECT_MANAGER_CONFIG
- **Унифицированный API** — `/api/service-chat` с context-параметром
- **Удалён Prompt-Agent** — архивирован в `_archive/prompts/`
- **Очистка** — удалены modal-assistants, universal-dialog

**Ключевые файлы:**
- `components/service-chat/` — новая система (12 файлов)
- `app/(chat)/api/service-chat/route.ts` — унифицированный API
- `app/(dashboard)/projects/new/project-creation-client.tsx` — клиент создания проекта

**Детали:** [_archive/TZ_09_ServiceChat/](_archive/TZ_09_ServiceChat/)

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
| Версия | 3.14.0 |
| Статус | Active development |
| Voice Input | Deepgram Nova-3 (русский) |
| Архитектура промптов | Skills + Agents (v3.3) |
| Архитектура UI | Унифицированные инпуты (v3.4), File Viewer (v3.7), ServiceChat (v3.8), Live Preview (v3.9), Context/Instruction (v3.10), Secretary (v3.11), Project Layout (v3.12), Manager+Clerk+Manifest (v3.13), Professor Planning (v3.14) |
| Skills | 5 (document: 4, research: 1) |
| Agents | 1 (ben) |
| Профессоры | 1 (planning) |
| Сервисные чаты | 3 (ben, project-creation, project-manager) |
| Промптов | 5 (chat, ben, project-creation, project-manager, professor-planning) |
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
- [_archive/TZ_B1_ProfessorPlanning/](_archive/TZ_B1_ProfessorPlanning/) — ТЗ-B1 Professor Planning
- [_archive/TZ_A3_ManagerClerkManifest/](_archive/TZ_A3_ManagerClerkManifest/) — ТЗ-A3 Manager + Clerk + Manifest
- [_archive/TZ_A1_ProjectPageLayout/](_archive/TZ_A1_ProjectPageLayout/) — ТЗ-A1 Project Page Layout
- [_archive/TZ_12_SecretaryIntegration/](_archive/TZ_12_SecretaryIntegration/) — ТЗ-12 Secretary Integration
- [_archive/TZ_11_ProjectCreationPolish/](_archive/TZ_11_ProjectCreationPolish/) — ТЗ-11 Project Creation Polish
- [_archive/TZ_10_ProjectCreationLivePreview/](_archive/TZ_10_ProjectCreationLivePreview/) — ТЗ-10 Project Creation Live Preview
- [_archive/TZ_09_ServiceChat/](_archive/TZ_09_ServiceChat/) — ТЗ-09 ServiceChat
- [_archive/TZ_08_FileViewer/](_archive/TZ_08_FileViewer/) — ТЗ-08 File Viewer
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

**Обновлено:** 2026-02-09
