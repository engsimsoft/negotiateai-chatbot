# Инструкция для Claude Code

**Проект:** Simply | **Версия:** 3.4.0 | **Статус:** Active development

**URL:** https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app

---

## Начни здесь

1. **[README.md](README.md)** — О проекте Simply
2. **[SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md)** — Видение продукта (roadmap, инструменты, концепции)
3. **[SIMPLY_STATUS.md](SIMPLY_STATUS.md)** — Текущее состояние проекта
4. **[DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md)** — Правила документации

**Главный принцип:** SSOT (Single Source of Truth)

---

## О проекте

**Simply** — AI-платформа для российского рынка. Шлюз к лучшим мировым AI-моделям с оплатой в рублях.

**Философия:**
- **Apple-подход** — качество важнее количества
- **Best-in-Class API** — не изобретаем велосипеды, интегрируем лучшие решения

**Ключевые особенности:**
- Универсальный AI-чат с инструментами (Gemini)
- Проекты: изолированные рабочие пространства (Claude)
- Модальные помощники: Prompt-агент (📝), Бен (❓)
- Три уровня персонализации: Профиль + RAG + Chat Memory
- Мультипровайдер: Gemini + Claude (GPT планируется)
- Оплата в рублях (ЮKassa, Тинькофф, СБП)

---

## Технологии

**Frontend:** Next.js 15.3 (App Router, RSC), TypeScript, Tailwind CSS

**AI:**
- Vercel AI SDK (@ai-sdk/google, @ai-sdk/openai, @ai-sdk/anthropic)
- Текущий: Google Gemini (3 Pro + 2.5 Flash)
- Voice Input: Deepgram Nova-3 (русский язык)
- План: мультипровайдер

**Backend:** NextAuth 5.0-beta.25, PostgreSQL (Neon), Drizzle ORM

**Storage:** Vercel Blob Storage

**Deploy:** Vercel

---

## Структура кода

**Prompt System (v3.3 — Skills + Agents):**
- `lib/prompts/` — Система промптов (Skills + Agents)
- `lib/prompts/server.ts` — Server-only экспорты (buildChatPrompt, buildBenPrompt)
- `lib/prompts/index.ts` — Client-safe экспорты (типы, утилиты)
- `lib/prompts/builder/` — Модульная система сборки (registry, loaders, composer)
- `lib/prompts/skills/` — Атомарные навыки (SKILL.md)
- `lib/prompts/agents/` — Персонажи-агенты (AGENT.md + config.yaml)
- `lib/prompts/core/` — Базовые промпты (.md файлы)
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

**Universal Dialog:**
- `components/universal-dialog/` — Система диалогов (confirm, prompt, custom)

**Modal Assistants:**
- `components/modal-assistants/` — UI модальных помощников
- `components/modal-assistants/prompt-agent/` — Prompt-агент (📝)
- `components/modal-assistants/ben/` — Бен (❓), intro-bubble.tsx
- `app/(chat)/api/assistant/prompt-agent/route.ts` — API Prompt-агента
- `app/(chat)/api/assistant/ben/route.ts` — API Бена

**Sidebar (контекстный):**
- `components/sidebar-layout.tsx` — Layout с табами вне Sidebar
- `components/sidebar-history.tsx` — История чатов (контекстная фильтрация)
- `components/sidebar-history-item.tsx` — Элемент чата (inline-редактирование)
- `components/app-sidebar.tsx` — Sidebar с историей чатов
- `components/ui/sidebar.tsx` — CSS variable `--sidebar-left-offset`

**AI/Chat:**
- `app/(chat)/api/chat/route.ts` — Chat endpoint (streaming)
- `app/(chat)/api/chat/[id]/route.ts` — Chat management (DELETE/PATCH)
- `app/(chat)/api/chat/[id]/generate-title/route.ts` — Автонейминг чатов
- `lib/ai/providers.ts` — Конфигурация AI-моделей
- `lib/ai/model-tiers.ts` — Уровни моделей для проектов (Haiku/Sonnet/Opus)
- `lib/ai/professor-pipeline.ts` — Pipeline для режима Профессор
- `lib/ai/tools/` — Инструменты (search, excel, web scraping)
- `lib/ai/tools/excel/` — Excel tools (create, parse, edit)

**Projects (v3.2.0):**
- `app/(chat)/projects/` — Страницы проектов
- `app/(chat)/projects/page.tsx` — Список проектов
- `app/(chat)/projects/new/page.tsx` — Создание проекта
- `app/(chat)/projects/[id]/page.tsx` — Страница проекта
- `app/(chat)/projects/[id]/chat/` — Чаты проекта
- `app/(chat)/api/projects/` — API проектов (CRUD)
- `components/projects/professor-progress.tsx` — UI прогресса pipeline

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

**Завершены:** ТЗ-07A (v3.4.0 — Glavnaya + Navigation + Sidebar), ТЗ-04 (v3.3.0 — Skills + Agents), ТЗ-03 (v3.2.0 — Проекты + Claude), ТЗ-02 (v3.1.0 — Dashboard + Sidebar), ТЗ-NEW-01 (v3.0.0 — новая архитектура промптов)
**Прогресс:** См. [SIMPLY_STATUS.md](SIMPLY_STATUS.md)

**Следующие этапы (по приоритету):**
| Этап | Описание | Приоритет |
|------|----------|-----------|
| 7 | Tool Activity UX | Высокий |
| 8 | Инструменты Фаза 1 (Perplexity, Plus AI, Ideogram) | Высокий |
| 9 | RAG (База знаний) | Средний |
| 10 | Chat Memory | Средний |
| 11 | Мультипровайдер GPT | Средний |
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
- [docs/ai-providers.md](docs/ai-providers.md) — Провайдеры, модели, цены (SSOT)
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

## UI Guidelines (для редизайна)

**Дизайн-система:**
- **Компоненты:** shadcn/ui (components/ui/) — 22 базовых компонента
- **Стили:** Tailwind CSS с CSS variables для темизации
- **Иконки:** Lucide React

**Принципы:**
1. **Mobile-first** — responsive через Tailwind breakpoints (sm/md/lg/xl)
2. **Консистентность** — один паттерн = один компонент (не дублировать логику)
3. **Accessibility** — семантический HTML, ARIA где нужно
4. **Apple-подход** — минимализм, качество важнее количества

**Spacing система (Tailwind):**
- Мелкие элементы: `gap-2` (8px)
- Между секциями: `gap-4` или `gap-6` (16-24px)
- Крупные блоки: `gap-8` (32px)
- Padding контента: `p-4` mobile, `p-6` desktop

**Цвета (CSS variables):**
- `--background`, `--foreground` — основа
- `--muted`, `--muted-foreground` — вторичный текст
- `--primary`, `--primary-foreground` — акцент
- `--destructive` — ошибки/удаление

**Текущие боли (решаем в редизайне):**
1. Непоследовательность layout-ов (projects то с sidebar, то без)
2. Dashboard слишком простой
3. Search таб не функционален
4. Навигация между режимами не очевидна

**Карта компонентов:** [BRAINSTORM_UI_ARCHITECTURE.md](BRAINSTORM_UI_ARCHITECTURE.md)

---

## Workflow

**Моя роль:** Получаю ТЗ → Анализирую → Пишу код → Документирую

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

**Обновлено:** 2026-02-04
