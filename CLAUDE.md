# Инструкция для Claude Code

**Проект:** Simply | **Версия:** 3.25.0 | **Статус:** Active development

**URL:** https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app

---

## UI и дизайн

⛔ **ОБЯЗАТЕЛЬНО:** Перед ЛЮБОЙ работой с UI — прочитай **[docs/design-system.md](docs/design-system.md)**.

Этот файл содержит:
- **Структуру интерфейса** — layout groups, карта страниц, существующие компоненты навигации
- **Цвета** — ТОЛЬКО семантические токены. Хардкоженные цвета ЗАПРЕЩЕНЫ
- **Hover-паттерны** — два паттерна (карточки с border / inline-элементы)
- **Правила создания компонентов** — не создавать дубли, проверять все layout-ы

**Ключевое:** Перед созданием нового UI-компонента — проверь раздел 1.3 (существующие компоненты навигации).

---

## Начни здесь

1. **[README.md](README.md)** — О проекте Simply
2. **[SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md)** — Видение продукта (roadmap, инструменты, концепции)
3. **[SIMPLY_STATUS.md](SIMPLY_STATUS.md)** — Текущее состояние проекта
4. **[docs/design-system.md](docs/design-system.md)** — Дизайн-система (закон для UI)
5. **[DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md)** — Правила документации

**Главный принцип:** SSOT (Single Source of Truth)

---

## О проекте

**Simply** — AI-платформа для российского рынка. Шлюз к лучшим мировым AI-моделям с оплатой в рублях.

**Философия:**
- **Apple-подход** — качество важнее количества
- **Best-in-Class API** — не изобретаем велосипеды, интегрируем лучшие решения

**Ключевые особенности:**
- Универсальный AI-чат с инструментами (Claude Sonnet)
- Проекты: изолированные рабочие пространства (Claude Haiku/Sonnet/Opus)
- Сервисные чаты: Бен (❓), создание проекта, менеджер
- Три уровня персонализации: Профиль + RAG + Chat Memory
- Anthropic Claude — основной и единственный провайдер (Gemini только для vision-ocr)
- Оплата в рублях (ЮKassa, Тинькофф, СБП)

---

## Технологии

**Frontend:** Next.js 15.3 (App Router, RSC), TypeScript, Tailwind CSS

**AI:**
- Vercel AI SDK (@ai-sdk/anthropic, @ai-sdk/google для vision-ocr)
- Текущий: Anthropic Claude (Sonnet + Haiku + Opus)
- Voice Input: Deepgram Nova-3 (русский язык)
- План: мультипровайдер (GPT)

**Backend:** NextAuth 5.0-beta.25, PostgreSQL (Neon), Drizzle ORM

**Storage:** Vercel Blob Storage

**Deploy:** Vercel

---

## Структура кода

**Prompt System (v3.3 — Skills + Agents):**
- `lib/prompts/` — Система промптов (Skills + Agents)
- `lib/prompts/server.ts` — Server-only экспорты (buildChatPrompt, buildBenPrompt, buildFullManagerPrompt)
- `lib/prompts/index.ts` — Client-safe экспорты (типы, утилиты)
- `lib/prompts/builder/` — Модульная система сборки (registry, loaders, composer)
- `lib/prompts/skills/` — Атомарные навыки (SKILL.md)
- `lib/prompts/agents/` — Персонажи-агенты (AGENT.md + config.yaml)
- `lib/prompts/professors/` — Промпты профессоров (planning.md, task-review.md)
- `lib/prompts/experts/` — Промпты экспертов (task-expert.md)
- `lib/prompts/build-task-expert-prompt.ts` — Prompt builder для Эксперта
- `lib/prompts/clerks/` — Промпты клерков (file-analyzer.md, task-summarizer.md, snapshot-creator.md)
- `lib/prompts/service-chats/` — Промпты сервисных чатов (project-creation.md, project-manager.md)
- `lib/prompts/core/` — Базовые промпты (.md файлы: base, safety, formatting, russian-market, dev-mode)
- `lib/prompts/contexts/` — Контексты (user-profile, chat-memory)

**Unified Input System (v3.4.0):**
- `components/input/` — Унифицированная система инпутов (композиция)
- `components/input/input-context.tsx` — React Context для связи компонентов
- `components/input/input-base.tsx` — Базовый контейнер + toolbar
- `components/input/input-textarea.tsx` — Поле ввода с auto-resize
- `components/input/input-voice-button.tsx` — 🎤 Диктовка (Deepgram)
- `components/input/input-model-selector.tsx` — Селектор модели
- `components/input/compact-input.tsx` — Готовый пресет для главной/проектов

**Glavnaya (Home Page):**
- `app/(chat)/page.tsx` — Главная страница
- `components/glavnaya/` — Компоненты главной
- `components/glavnaya/glavnaya-input.tsx` — Инпут на главной (использует CompactInput)
- `components/glavnaya/chat-history-card.tsx` — Карточка "💬 История чатов" (v3.5.0)
- `components/glavnaya/mode-cards-section.tsx` — 3 карточки-лаунчера (Экспертиза 🔍, Создать ✨, Проекты 📁) (v3.24.0)

**ListDetailPage (v3.24.0):**
- `components/list-detail/list-detail-page.tsx` — Универсальный composition layout (header, two-column, empty state)
- `components/list-detail/index.ts` — exports

**Chat History (v3.5.0, v3.24.0 — ListDetailPage):**
- `app/(dashboard)/chats/page.tsx` — Страница истории чатов (chatMode='chat' only)
- `app/(dashboard)/expertise/page.tsx` — Страница экспертиз (chatMode='expertise')
- `app/(dashboard)/create/page.tsx` — Страница создания (chatMode='create')
- `components/chats/` — Компоненты для /chats
- `components/chats/chats-page-content.tsx` — Клиентский контейнер с ListDetailPage
- `components/chats/mode-chats-page.tsx` — Shared компонент для /expertise и /create
- `components/chats/chat-list.tsx` — Левая колонка (список чатов)
- `components/chats/chat-list-item.tsx` — Элемент списка (⭐, date, chatMode badge, actions)
- `components/chats/chat-detail-panel.tsx` — Правая колонка (summary, actions)

**ChatMode System (v3.24.0) + Route Groups (v3.25.0):**
- `lib/ai/chat-mode-config.ts` — Конфигурация режимов (chatMode → модель, tools)
- `app/(chat)/chat/[id]/page.tsx` — Маршрут обычного чата (redirect для expertise/create)
- `app/(expertise)/expertise/[id]/page.tsx` — Маршрут экспертизы (chatMode=expertise)
- `app/(create)/create/[id]/page.tsx` — Маршрут создания (chatMode=create)
- `lib/utils.ts` — `getChatUrl()` — формирование URL по chatMode

**ServiceChat (v3.8.0):**
- `components/service-chat/` — Унифицированная система сервисных чатов
- `components/service-chat/service-chat-core.tsx` — Ядро (messages, streaming, quickActions)
- `components/service-chat/service-chat-floating.tsx` — Floating modal (center/bottom-right)
- `components/service-chat/service-chat-drawer.tsx` — Drawer справа
- `components/service-chat/service-chat-trigger.tsx` — Универсальная кнопка
- `components/service-chat/ben-intro-bubble.tsx` — Speech bubble для онбординга
- `components/service-chat/configs/` — Конфиги (ben, project-creation, project-manager)
- `app/(chat)/api/service-chat/route.ts` — Унифицированный API
- `app/(chat)/api/assistant/ben/route.ts` — Legacy API Бена

**UserMenu (глобальный):**
- `components/user-menu.tsx` — Автономный dropdown (avatar + Настройки, Тема, Выйти). Prop `align`

**Sidebar (контекстный, icon mode):**
- `components/sidebar-layout.tsx` — Layout с SidebarProvider
- `components/sidebar-history.tsx` — История чатов (контекстная фильтрация, ⭐ toggle)
- `components/sidebar-history-item.tsx` — Элемент чата (inline-редактирование, ⭐ toggle, tooltip)
- `components/app-sidebar.tsx` — Sidebar `collapsible="icon"` (паттерн Claude): навигация (Главная, Новый чат, Все чаты) + история (скрыта в icon mode)
- `components/ui/sidebar.tsx` — CSS variable `--sidebar-left-offset`

**Right Sidebar (v3.21.0 — ChatSidebar):**
- `components/right-sidebar.tsx` — Унифицированный правый сайдбар-shell (bg-sidebar, Sheet на мобильных, push-layout). Переиспользуемый контейнер для chat/projects/helpers
- `components/chat-sidebar.tsx` — Материалы чата (артефакты + вложения), scroll-to-message навигация, скачивание. Использует RightSidebar

**AI/Chat:**
- `app/(chat)/api/chat/route.ts` — Chat endpoint (streaming, sanitizeCoreMessages, isStarred PATCH)
- `app/(chat)/api/chat/[id]/route.ts` — Chat management (DELETE/PATCH)
- `app/(chat)/api/chat/[id]/generate-title/route.ts` — Автонейминг + summary (v3.5.0)
- `lib/ai/providers.ts` — Конфигурация AI-моделей (Anthropic Claude)
- `lib/ai/model-tiers.ts` — Уровни моделей для проектов (Haiku/Sonnet/Opus)
- `lib/ai/professor-pipeline.ts` — Pipeline для режима Профессор
- `lib/ai/task-completion-types.ts` — Zod-схемы и типы для завершения задач
- `lib/ai/clerks/task-summarizer.ts` — Суммаризатор задач (Claude Haiku)
- `lib/ai/professors/task-reviewer.ts` — Ревьюер задач (Claude Opus)
- `lib/utils.ts` — `sanitizeCoreMessages()` — санитизация сообщений для Anthropic API (удаление orphan tool-calls/results, пустых сообщений)
- `lib/ai/tools/` — Инструменты (search, excel, web scraping)
- `lib/ai/tools/excel/` — Excel tools (create, parse, edit)
- `lib/ai/tools/read-project-file.ts` — Tool чтения файлов проекта по имени

**Tool Activity UX (v3.20.0):**
- `lib/ai/tool-activity-config.ts` — Конфиг инструментов (icon, activeLabel, doneLabel, argsFormatter, resultFormatter, resultCounter)
- `components/tool-activity-indicator.tsx` — Индикатор активности (спиннер/галочка, ×N бейдж, раскрываемые детали)

**Projects (v3.16.0 — ExpertTaskChat):**
- `app/(dashboard)/projects/[id]/page.tsx` — Страница проекта (Server Component)
- `components/projects/project-page-layout.tsx` — Двухколоночный layout (Пульс + WorkArea + Drawer)
- `components/projects/project-pulse.tsx` — Навигационный Пульс (План, Файлы, Паспорт) + ProjectTask[] кликабельные
- `components/projects/project-work-area.tsx` — Рабочая область (switch по phase)
- `components/projects/manager-drawer.tsx` — Push-drawer Менеджера с живым AI-диалогом (ServiceChatCore)
- `components/projects/project-files-card.tsx` — Файлы проекта (auto-analyze, documentType, tooltip)
- `components/projects/phase-states/` — 5 компонентов фаз (welcome, planning, approved, execution, completed)
- `app/(dashboard)/projects/page.tsx` — Список проектов
- `app/(dashboard)/projects/new/page.tsx` — Создание проекта
- `app/(dashboard)/projects/[id]/chat/` — Чаты проекта
- `app/(chat)/api/projects/` — API проектов (CRUD)
- `app/(chat)/api/projects/[id]/plan/route.ts` — Профессор планирования (Claude Opus)
- `app/(chat)/api/projects/[id]/approve-plan/route.ts` — Утверждение плана → ProjectTask[]
- `app/(chat)/api/projects/[id]/tasks/route.ts` — GET ProjectTask[]
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — Чат с Экспертом (streaming)
- `app/(chat)/api/projects/[id]/tasks/[taskId]/unlock/route.ts` — Разблокировка locked задачи
- `app/(chat)/api/projects/[id]/tasks/[taskId]/complete/route.ts` — Завершение задачи (summarize → review → save)
- `app/(chat)/api/projects/[id]/tasks/[taskId]/reopen/route.ts` — Доработка (issues → in_progress)
- `app/(chat)/api/projects/[id]/tasks/[taskId]/accept/route.ts` — Принятие (issues → done + unlock)
- `app/(chat)/api/projects/[id]/analyze-file/route.ts` — Клерк-анализатор файлов (Claude Haiku)
- `lib/ai/professor-types.ts` — Zod-схемы плана (tasks, risks, recommendations, caveats)
- `lib/ai/tools/chat-tools.ts` — Shared tools (getStandardTools)
- `components/projects/professor-progress.tsx` — UI прогресса pipeline

**ExpertTaskChat (v3.16.0) + TaskCompletion (v3.17.0):**
- `app/(task)/layout.tsx` — Layout route group (SWRProvider + DataStreamProvider, без AppSidebar)
- `app/(task)/projects/[id]/tasks/[taskId]/page.tsx` — Страница задачи (Server Component, auth + guards)
- `components/projects/task-chat.tsx` — Полноценный чат с Экспертом (streaming, артефакты, auto-trigger, завершение задачи)
- `components/projects/task-sidebar.tsx` — Навигация между задачами (статусы, сворачивание, «← К проекту»)
- `components/projects/task-completion-card.tsx` — Карточка результата (success/issues/critical)
- `lib/prompts/experts/task-expert.md` — Промпт Эксперта
- `lib/prompts/build-task-expert-prompt.ts` — Prompt builder (project + task + completedTasks + manifest)

**Context Window Management (v3.18.0 — ТЗ-C1.5):**
- `lib/ai/context-limits.ts` — Конфиг (CONTEXT_BUDGET, SNAPSHOT_THRESHOLD, FALLBACK_MESSAGE_PAIRS)
- `lib/ai/tools/create-snapshot.ts` — Tool createSnapshot (structured params → fullMarkdown)
- `lib/ai/clerks/snapshot-creator.ts` — Fallback-клерк (авто-snapshot при игнорировании)
- `lib/prompts/clerks/snapshot-creator.md` — Промпт fallback-клерка
- `components/projects/snapshot-card.tsx` — SnapshotCard (expand/collapse) + SnapshotDivider
- `components/projects/context-indicator.tsx` — Progress bar над input (3 цвета)

**Voice Input (Deepgram):**
- `app/(chat)/api/deepgram/token/route.ts` — Token API
- `lib/audio/` — Аудио утилиты (types, constants, utils)
- `hooks/use-voice-recorder.ts` — Хук записи (Deepgram Nova-3)
- `components/voice-button.tsx` — Кнопка микрофона

**Auth/DB:**
- `app/(auth)/` — NextAuth 5.0 setup
- `lib/db/schema.ts` — Database schema (Drizzle)
- `lib/db/queries.ts` — Database queries

**User Profile:**
- `app/(chat)/api/user/profile/route.ts` — API профиля (GET/PATCH)
- `app/(chat)/api/user/ben-intro/route.ts` — API флага Бена (GET/PATCH)
- `app/(dashboard)/settings/page.tsx` — Страница настроек (без sidebar)
- `components/onboarding-dialog.tsx` — Онбординг

**Config:**
- `.env.local` — API keys (НЕ коммитить!)
- `next.config.ts` — Next.js config
- `drizzle.config.ts` — Database config

---

## Текущий этап

**Завершены:** ТЗ-RG (v3.25.0 — RouteGroups), ТЗ-DV2 (v3.24.0 — DashboardV2), ТЗ-C4 (v3.23.0 — AnthropicProviderSwitch), ТЗ-C3 (v3.22.0 — ChatContextManagement), ТЗ-08CS (v3.21.0 — ChatSidebar + RightSidebar), ТЗ-07 (v3.20.0 — ToolActivity + SidebarIconMode), ТЗ-DS (v3.19.0 — DesignSystem), ТЗ-C1.5 (v3.18.0 — ContextManagement), ТЗ-C2 (v3.17.0 — TaskCompletion), ТЗ-C1 (v3.16.0 — ExpertTaskChat), ТЗ-B2 (v3.15.0 — Approval + ProjectTask), ТЗ-B1 (v3.14.0 — Professor Planning), ТЗ-A3 (v3.13.0 — Manager + Clerk + Manifest), ТЗ-A1 (v3.12.0 — Project Page Layout), ТЗ-12 (v3.11.0 — Secretary), ТЗ-09 (v3.8.0 — ServiceChat), ТЗ-08 (v3.7.0 — File Viewer), ТЗ-07B (v3.5.0 — Chat History), ТЗ-07A (v3.4.0 — Glavnaya + Navigation + Sidebar), ТЗ-04 (v3.3.0 — Skills + Agents), ТЗ-03 (v3.2.0 — Проекты + Claude), ТЗ-02 (v3.1.0 — Dashboard + Sidebar), ТЗ-NEW-01 (v3.0.0 — новая архитектура промптов)
**Прогресс:** См. [SIMPLY_STATUS.md](SIMPLY_STATUS.md)

**Следующие этапы (по приоритету):**
| Этап | Описание | Приоритет |
|------|----------|-----------|
| 8 | Инструменты Фаза 1 (Perplexity, Plus AI, Ideogram) | Высокий |
| 9 | RAG (База знаний) | Средний |
| 10 | Chat Memory | Средний |
| 11 | Мультипровайдер (GPT) | Средний |
| 12 | Биллинг (Pay-as-you-go) | Средний |

**Документы в холсте (5 типов):**
- `text` — plain text для соцсетей
- `markdown` — форматированные документы
- `excel` — таблицы с формулами и графиками
- `presentation-reveal` — веб-презентации
- `presentation-pptx` — PowerPoint

**Детали:** [docs/ai-artifacts.md](docs/ai-artifacts.md) | [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md)

---

## Команды

```bash
# Разработка
npm install              # Установка зависимостей
npm run dev              # Dev сервер (localhost:3000)
npm run build            # Сборка production
npm run start            # Запуск production

# Database
npm run db:migrate       # Применить миграции
npm run db:studio        # Drizzle Studio

# Deploy
vercel --prod            # Deploy на Vercel
```

---

## Навигация

**Основная:**
- [README.md](README.md) — О проекте
- [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md) — Видение продукта
- [SIMPLY_STATUS.md](SIMPLY_STATUS.md) — Текущее состояние проекта
- [CHANGELOG.md](CHANGELOG.md) — История изменений

**Техническая (AI):**
- [docs/ai-chats-map.md](docs/ai-chats-map.md) — **Карта всех чатов и моделей (SSOT)**
- [docs/ai-providers.md](docs/ai-providers.md) — Провайдеры, модели, цены
- [docs/ai-agents.md](docs/ai-agents.md) — Система промптов и помощники
- [docs/ai-artifacts.md](docs/ai-artifacts.md) — Документы в холсте
- [docs/ai-tools.md](docs/ai-tools.md) — Инструменты (search, vision)

**Техническая (инфраструктура):**
- [docs/setup.md](docs/setup.md) — Установка
- [docs/architecture.md](docs/architecture.md) — Архитектура
- [docs/deployment.md](docs/deployment.md) — Deployment
- [docs/mcp-tools.md](docs/mcp-tools.md) — MCP инструменты (PostgreSQL, GitHub, Vercel)
- [docs/decisions/](docs/decisions/) — ADR

**Архив (не читать для новых задач):**
- [_archive/](_archive/) — завершённые ТЗ (история планирования)

> **Правило:** Папка `_archive/` содержит завершённые ТЗ. Вся актуальная информация уже в docs/. Не трать токены на изучение архива.

---

## MCP-инструменты (ВАЖНО!)

> **Используй MCP-инструменты для ускорения работы!** Не забывай про них.

**Доступные инструменты:**

| Инструмент | Что делает | Когда использовать |
|------------|------------|-------------------|
| `mcp__postgres__query` | SQL-запросы к базе | Проверка данных, отладка, анализ |
| `mcp__github__*` | Работа с GitHub | Коммиты, issues, PRs |
| Vercel (терминал) | Деплои, логи | Через `claude "..."` в терминале |

**Примеры использования:**
```sql
-- Вместо "посмотри в базе" — делай запрос напрямую:
SELECT * FROM "User" LIMIT 5;
SELECT COUNT(*) FROM "Chat";
```

**Документация:** [docs/mcp-tools.md](docs/mcp-tools.md)

---

## UI Guidelines

**Полные правила:** [docs/design-system.md](docs/design-system.md) — SSOT для всего UI.

**Кратко (не заменяет чтение docs/design-system.md):**
- **Компоненты:** shadcn/ui (components/ui/) + Lucide React
- **Цвета:** ТОЛЬКО семантические токены (bg-muted, text-foreground, border-border...)
- **Шрифты:** Source Sans 3 (sans), Lora (serif), JetBrains Mono (mono)
- **Hover:** Два паттерна — карточки (border-primary + shadow) и inline (bg-muted/60)
- **Принципы:** Mobile-first, SSOT компонентов, Apple-подход

**Текущие боли (backlog):**
1. Навигация между режимами не очевидна

---

## Workflow

**Моя роль:** Получаю ТЗ → Анализирую → Пишу код → Документирую

**⛔ ОБЯЗАТЕЛЬНАЯ ВАЛИДАЦИЯ:**
```
После КАЖДОЙ задачи: npx tsc --noEmit → 0 ошибок → [x]
После КАЖДОГО этапа: npm run build → ЗАПРОСИТЬ мануальный тест → ЖДАТЬ ОК
```
**НЕ делать "скопом"!** Этап → валидация → следующий этап.

**⛔ ROADMAP — ОСНОВНОЙ ЧЕКЛИСТ (НЕ TodoWrite!):**
```
НЕ использовать TodoWrite как основной чеклист задач.
Основной рабочий документ — ROADMAP.md в папке активного ТЗ.

Перед КАЖДОЙ задачей: Read ROADMAP.md → прочитать описание задачи
После КАЖДОЙ задачи: Edit ROADMAP.md → отметить [x]
После КАЖДОГО этапа: Edit ROADMAP.md → обновить статус (⬜ → ✅)
```

**При работе с новым ТЗ:**
1. Читай [specs/WORKFLOW.md](specs/WORKFLOW.md) — процесс работы с ТЗ
2. Создай папку `specs/TZ_XX_Name/`
3. Следуй фазам: Анализ → Планирование → Разработка → Финализация
4. Обновляй HANDOFF.md после каждой сессии

**Структура ТЗ:**
```
specs/
├── WORKFLOW.md         # Инструкция (передаётся с каждым ТЗ)
├── _template/          # Шаблоны файлов
└── TZ_XX_Name/         # Активное ТЗ
    ├── SPEC.md         # Само ТЗ
    ├── ANALYSIS.md     # Анализ, вопросы
    ├── ROADMAP.md      # План внедрения
    ├── CHANGELOG.md    # Лог изменений (локальный)
    └── HANDOFF.md      # Передача между сессиями
```

**При работе с существующими задачами:**
1. Читай [SIMPLY_STATUS.md](SIMPLY_STATUS.md) — текущее состояние
2. Читай [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md) — куда идём
3. Читай docs/ — техническая документация

**Правило:** Не читай `_archive/` — там только история.

---

**Обновлено:** 2026-02-18
