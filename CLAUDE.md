# Инструкция для Claude Code

**Проект:** Simply | **Версия:** см. [package.json](package.json) | **Статус:** Active development
**URL:** https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app

> ⛔ **Правило этого файла для Claude Code:**
> — Лимит: **220 строк**. При достижении — STOP и доложить владельцу (не дописывать сюда, вынести в CHANGELOG / docs/).
> — НЕ писать сюда: историю ТЗ, версионные теги (`v3.x`, `ТЗ-XXX`), пофайловые описания, хронологические блоки «Завершены».
> — История версий → [CHANGELOG.md](CHANGELOG.md). Пофайловая карта → [docs/architecture.md](docs/architecture.md). Детали AI → [docs/ai-*.md](docs/).
> — Этот файл = **навигация со ссылками**, не реестр файлов и не летопись.
> — Конкретные модели/цены устаревают за недели — **не писать их здесь**, ссылаться на [docs/ai-chats-map.md](docs/ai-chats-map.md) и [docs/ai-providers.md](docs/ai-providers.md).
> — Следовать [DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md).

---

## UI и дизайн

⛔ **ОБЯЗАТЕЛЬНО:** Перед ЛЮБОЙ работой с UI — прочитай **[docs/design-system.md](docs/design-system.md)** (структура интерфейса, семантические токены цветов, hover-паттерны, правила создания компонентов). Перед новым UI-компонентом — раздел 1.3 (существующие компоненты навигации), чтобы не плодить дубли.

---

## Начни здесь

1. [README.md](README.md) — о проекте · 2. [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md) — видение · 3. [SIMPLY_STATUS.md](SIMPLY_STATUS.md) — состояние · 4. [docs/design-system.md](docs/design-system.md) — UI · 5. [DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md) — правила докуметации.

**Главный принцип:** SSOT (Single Source of Truth).

---

## О проекте

**Simply** — AI-платформа для российского рынка. Шлюз к лучшим мировым AI-моделям с оплатой в рублях.

**Философия:**
- **Apple-подход** — качество важнее количества
- **Best-in-Class API** — не изобретаем велосипеды, интегрируем лучшие решения

**Ключевые особенности:**
- Универсальный AI-чат с инструментами + изолированные проекты
- Сервисные чаты, брифинг, подкаст, meeting recorder, Telegram-бот
- Три уровня персонализации: Профиль + MIND (RAG) + Chat Memory
- Мультипровайдер (текущий состав моделей и маршрутизация → [docs/ai-chats-map.md](docs/ai-chats-map.md))
- Оплата в рублях (ЮKassa, Тинькофф, СБП)

---

## Технологии

**Frontend:** Next.js 15.3 (App Router, RSC), TypeScript, Tailwind CSS, shadcn/ui
**AI:** Vercel AI SDK v6 — провайдеры и модели живут в [docs/ai-providers.md](docs/ai-providers.md)
**Backend:** NextAuth 5.0, PostgreSQL (Neon), Drizzle ORM
**Storage:** Vercel Blob Storage
**Voice:** Deepgram Nova-3
**Deploy:** Vercel

---

## Структура кода

Только высокоуровневая карта. Пофайловые детали по слоям живут в **[docs/architecture.md](docs/architecture.md)** и тематических документах.

### Prompt System
`lib/prompts/` — модульная система промптов (skills + agents + professors + experts + clerks + service-chats + briefing + core + contexts). Server-only экспорты в `server.ts`, client-safe — в `index.ts`.
**Детали:** [docs/ai-agents.md](docs/ai-agents.md)

### AI / Chat core
`app/(chat)/api/chat/route.ts` — основной chat endpoint (streaming).
`lib/ai/getModel.ts` — **SSOT резолва моделей** по taskId.
`lib/ai/task-assignments.ts` — taskId → default model.
`lib/ai/model-catalog.ts` — каталог моделей (pricing, capabilities).
`lib/ai/registry.ts` — provider registry.
`lib/ai/providers.ts` — pricing utilities.
**Детали:** [docs/ai-providers.md](docs/ai-providers.md) · [docs/ai-chats-map.md](docs/ai-chats-map.md) · [docs/model-catalog-ops.md](docs/model-catalog-ops.md)

### AI Tools
`lib/ai/tools/` — deepResearch, fetchUrl, readProjectFile, excel, readTelegramChannel, createSnapshot и др.
**Детали:** [docs/ai-tools.md](docs/ai-tools.md)

### MIND Memory / RAG
`lib/ai/memory/` — extract, retrieve, consolidate, profile, voyage-client.
**Архитектура:** [specs/Simply_xAI/MIND_ARCHITECTURE.md](specs/Simply_xAI/MIND_ARCHITECTURE.md)

### Артефакты (документы в холсте)
`artifacts/` + `components/artifact-*.tsx` — text, markdown, excel, presentation-reveal, presentation-pptx.
**Детали:** [docs/ai-artifacts.md](docs/ai-artifacts.md)

### UI
`components/` — shadcn/ui + прикладные (glavnaya, briefing, projects, meeting, groups, service-chat, input, dev-panel, context, chats, list-detail, right-sidebar, …).
`app/` — App Router route groups: `(chat)`, `(dashboard)`, `(task)`, `(expertise)`, `(create)`, `(auth)`.
**Правила UI:** [docs/design-system.md](docs/design-system.md) ⭐ — ЗАКОН, читать перед любой UI-работой.
**Архитектура:** [docs/architecture.md](docs/architecture.md)

### Pipelines (фичи)
- Briefing: `lib/briefing/` + `app/(dashboard)/briefing/` + `components/briefing/`
- Podcast: `lib/podcast/` + `components/briefing/podcast-*.tsx`
- Meeting Recorder: `lib/meeting/` + `app/(dashboard)/meeting/` + `components/meeting/`
- Telegram Bot: `lib/telegram/` + `app/api/telegram/` + `components/groups/`
- Projects: `app/(dashboard)/projects/` + `components/projects/` + `app/(task)/`

### Dev Switchboard
`app/(dashboard)/dev/models/` + `components/dev-panel/` — runtime model overrides, observability.
**Детали:** [docs/decisions/048-dev-switchboard-ui.md](docs/decisions/048-dev-switchboard-ui.md)

### Auth / DB / Config
`app/(auth)/`, `lib/db/schema.ts`, `lib/db/queries.ts`, `lib/db/migrations/`, `.env.local`, `next.config.ts`, `drizzle.config.ts`.
**Детали:** [docs/setup.md](docs/setup.md) · [docs/architecture.md](docs/architecture.md)

---

## Текущий этап

**Активная серия:** **Simply_xAI** — миграция с MiniMax+OpenRouter на xAI Grok + Anthropic.
- Дорожная карта: [specs/Simply_xAI/SIMPLY_XAI_ROADMAP.md](specs/Simply_xAI/SIMPLY_XAI_ROADMAP.md)
- Архитектура вложений (SSOT): [specs/Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md](specs/Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md)
- Архитектура MIND: [specs/Simply_xAI/MIND_ARCHITECTURE.md](specs/Simply_xAI/MIND_ARCHITECTURE.md)
- Лог решений: [specs/Simply_xAI/SIMPLY_XAI_NOTES.md](specs/Simply_xAI/SIMPLY_XAI_NOTES.md)

**Правило:** не отвлекаться на другие ТЗ до завершения серии.

**История версий и завершённые ТЗ:** [CHANGELOG.md](CHANGELOG.md)
**Текущее состояние и roadmap:** [SIMPLY_STATUS.md](SIMPLY_STATUS.md)

---

## Команды

```bash
npm install              # Установка зависимостей
npm run dev              # Dev сервер (localhost:3000)
npm run build            # Сборка production (⚠ автоматически накатывает pending migrations)
npm run start            # Запуск production
npm run db:migrate       # Применить миграции вручную
npm run db:studio        # Drizzle Studio
vercel --prod            # Deploy на Vercel
```

---

## Навигация

**Главные:**
- [README.md](README.md) — о проекте
- [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md) — видение продукта
- [SIMPLY_STATUS.md](SIMPLY_STATUS.md) — текущее состояние
- [CHANGELOG.md](CHANGELOG.md) — история изменений

**Обязательное чтение при AI-работе:**
- [specs/Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md](specs/Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md) — SSOT обработки вложений
- [specs/Simply_xAI/MIND_ARCHITECTURE.md](specs/Simply_xAI/MIND_ARCHITECTURE.md) — MIND pipeline

**Техническая документация (`docs/`):**
- [docs/ai-chats-map.md](docs/ai-chats-map.md) ⭐ — карта всех чатов и моделей (SSOT)
- [docs/ai-providers.md](docs/ai-providers.md) — провайдеры, модели, цены
- [docs/model-catalog-ops.md](docs/model-catalog-ops.md) — workflow каталога
- [docs/ai-agents.md](docs/ai-agents.md) — промпты и агенты
- [docs/ai-artifacts.md](docs/ai-artifacts.md) — документы в холсте
- [docs/ai-tools.md](docs/ai-tools.md) — инструменты (search, vision, …)
- [docs/design-system.md](docs/design-system.md) ⭐ — закон для UI
- [docs/architecture.md](docs/architecture.md) — архитектура и пофайловая карта
- [docs/setup.md](docs/setup.md) · [docs/deployment.md](docs/deployment.md) · [docs/troubleshooting.md](docs/troubleshooting.md) · [docs/mcp-tools.md](docs/mcp-tools.md)
- [docs/decisions/](docs/decisions/) — ADR

**Процесс:**
- [specs/WORKFLOW.md](specs/WORKFLOW.md) — фазы работы с ТЗ
- [specs/ROADMAP_GUIDE.md](specs/ROADMAP_GUIDE.md) — шаблон ROADMAP

> **Правило:** `_archive/` и `specs/_backlog/_archive/` не читать для новых задач.

---

## MCP-инструменты

| Инструмент | Что делает |
|---|---|
| `mcp__postgres__query` | SQL-запросы к базе (Neon) — проверка данных, отладка, аудит |
| `mcp__github__*` | Работа с GitHub (issues, PRs, коммиты) |
| Vercel (терминал) | Деплои, логи — через `claude "..."` |

**Документация:** [docs/mcp-tools.md](docs/mcp-tools.md)

---

## UI Guidelines (кратко)

Полные правила: [docs/design-system.md](docs/design-system.md).

- **Компоненты:** shadcn/ui + Lucide React
- **Цвета:** только семантические токены (`bg-muted`, `text-foreground`, `border-border`)
- **Шрифты:** Source Sans 3 (sans), Lora (serif), JetBrains Mono (mono)
- **Hover:** два паттерна — карточки (`border-primary + shadow`) и inline (`bg-muted/60`)
- **Принципы:** Mobile-first, SSOT компонентов, Apple-подход

---

## Workflow

**Моя роль:** получаю ТЗ → читаю официальную документацию → анализирую → пишу код → документирую.

**⛔ Критические правила (нарушать нельзя):**
1. **Official docs FIRST** — перед ЛЮБОЙ работой с внешней технологией (SDK, API, модель, библиотека): WebSearch + WebFetch актуальной документации. Работа по памяти = провал. Knowledge cutoff = май 2025.
2. **Валидация каждой задачи:** `npx tsc --noEmit` → 0 ошибок → только тогда `[x]` в ROADMAP.
3. **Валидация каждого этапа:** `npm run build` → запросить мануальный тест → дождаться OK → следующий этап. Не «скопом».
4. **ROADMAP, не TodoWrite** — основной чеклист задач живёт в `specs/TZ_XX/ROADMAP.md`.
5. **⚠ `npm run build` автоматически накатывает pending migrations** (`tsx lib/db/migrate && next build`). Hard-to-reverse — **предупреждать владельца ДО запуска**.
6. **CLAUDE.md — не трогать при финализации ТЗ.** История → CHANGELOG, пофайловые детали → `docs/architecture.md`. См. блок ⛔ в шапке файла.
7. **Один коммит на ТЗ.** Поэтапно валидируем (tsc + build + браузер + OK владельца), но НЕ коммитим на каждый этап. Коммит ровно один в финализации, описывает ТЗ целиком. Исключение — ТЗ длится > недели и один этап блокирует параллельную работу. Для багфиксов — один коммит на исправление.
8. **Никаких пояснительных комментариев в коде и раздутой документации.** Код описывает себя сам (хорошие имена + структура). Комментарий — только если есть СКРЫТОЕ ограничение, которого из кода не видно. Обновлять `docs/` — только когда реально поменялся контракт (SSOT-код из таблицы Правила 6 WORKFLOW). Никаких диаграмм, ссылок на «индустриальные практики 2026», обоснований решений в коде — это в SPEC.md и ADR, не в файлах проекта.
9. **Максимум 10 строк в ответе.** Если пишу больше — защищаю себя, а не делаю работу. Исключения: явный запрос «подробно», анализ ТЗ, код-ревью.

**Процесс работы с ТЗ:** [specs/WORKFLOW.md](specs/WORKFLOW.md) — полная инструкция, фазы, структура папки ТЗ, HANDOFF.

---

**Обновлено:** 2026-04-21 — правила 7-9 (один коммит на ТЗ, запрет раздутых комментариев/доков, лимит 10 строк в ответе).
