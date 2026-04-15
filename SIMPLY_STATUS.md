# Simply — Текущее состояние

**Версия:** 3.91.0
**Статус:** Active development (серия Simply_xAI)
**URL:** https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app

> **Назначение:** snapshot «что работает прямо сейчас» на один взгляд. История изменений → [CHANGELOG.md](CHANGELOG.md). Архитектура → [docs/architecture.md](docs/architecture.md). Карта моделей → [docs/ai-chats-map.md](docs/ai-chats-map.md).

---

## О проекте

**Simply** — AI-платформа для российского рынка. Шлюз к лучшим мировым AI-моделям с оплатой в рублях.

**Философия:** Apple-подход (качество важнее количества) + Best-in-Class API (интегрируем лучшие решения, не изобретаем). Детали видения → [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md).

**Мультипровайдерная маршрутизация:** xAI Grok (Simply Chat, MIND, Экспертиза), Anthropic Claude (vision, артефакты, клерки, профессор, project expert), MiniMax (создание, briefing pipeline). SSOT резолва — [lib/ai/task-assignments.ts](lib/ai/task-assignments.ts) + [lib/ai/model-catalog.ts](lib/ai/model-catalog.ts).

---

## Компоненты — что работает сегодня

> **Правила чтения таблицы:** статус отражает текущее состояние. Модели указаны как «какая модель сейчас обслуживает задачу» — детальный taskId-маппинг в [docs/ai-chats-map.md](docs/ai-chats-map.md). Если в коде поменялась модель — обновляется сначала `task-assignments.ts`, потом `ai-chats-map.md`, потом эта таблица.

| Компонент | Статус | Модели / стек |
|---|---|---|
| **Simply Chat** (persistent, один на пользователя) | ✅ | Grok 4.1 Fast (default) · Grok 4.20 (кнопка «Думать») · Claude Haiku 4.5 (vision) |
| **Экспертиза** (одноразовые экспертные запросы) | ✅ | Grok 4.20 Multi-Agent |
| **Создание** (одноразовые creation-чаты) | ✅ | MiniMax M2.7 |
| **Проекты** (изолированные рабочие пространства) | ✅ | Claude Haiku / Sonnet / Opus по tier, Профессор (Opus planning/review + Haiku execute) |
| **База знаний — MIND** (Слой 3 RAG, auto из разговоров) | ✅ | Grok 4.20 (extract) + Grok 4.1 Fast (batch, consolidate, profile, dedup) + Voyage AI (embeddings) + pgvector |
| **База знаний — Collections** (Слой 3 RAG, явная загрузка документов) | 📋 план | xAI Grok Collections API из коробки (`knowledge_search` / `file_search`). Отдельного векторного стека не строим. ТЗ-XAI-COL-1 |
| **Briefing** (hourly Vercel Cron) | ✅ | MiniMax M2.7-long (filter, author, section) · MiniMax M2.7 (podcast-script) |
| **Podcast** (attached to briefing) | ✅ | Gemini TTS (длинный формат, blob storage) |
| **Meeting Recorder** | ✅ | Deepgram Nova-3 (STT) + Claude Sonnet (summary) |
| **Telegram Bot + Groups** | ✅ | Custom bot + ingestion pipeline |
| **Artifacts** (text, markdown, excel, reveal, pptx) | ✅ | Claude Sonnet для всех 5 типов |
| **Service Chats** (project-creation, project-manager, briefing-onboarding) | ✅ | Claude Haiku / Sonnet |
| **Service Chat: Ben** | ⚠️ deprecated | Будет убран, не инвестировать время |
| **Dev Switchboard** (`/dev/models`) | ✅ | File-based overrides (dev-only) |
| **Auth** (NextAuth 5 + email/password + profile) | ✅ | NextAuth 5.0-beta.25 + bcrypt + PostgreSQL adapter |
| **Voice Input** | ✅ | Deepgram Nova-3 (русский) |
| **Deep Research tool** | ✅ | Perplexity Sonar API |
| **Web Search tool** | ✅ | Brave Search API |
| **Fetch URL / Page tool** | ✅ | Readability + JSDOM + Jina Reader fallback |
| **PDF preview** | ✅ | CloudConvert API |
| **Оплата в рублях** | 📋 план | ЮKassa, Тинькофф, СБП — отдельный ТЗ |

**Семантика статусов:** ✅ работает в production · ⚠️ deprecated / частично · 📋 план · 🔄 в миграции.

---

## Активная серия ТЗ

**🎯 Simply_xAI** — миграция с MiniMax+OpenRouter на xAI Grok + Anthropic.

- Дорожная карта: [specs/Simply_xAI/SIMPLY_XAI_ROADMAP.md](specs/Simply_xAI/SIMPLY_XAI_ROADMAP.md)
- Архитектура вложений (SSOT): [specs/Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md](specs/Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md)
- Архитектура MIND: [specs/Simply_xAI/MIND_ARCHITECTURE.md](specs/Simply_xAI/MIND_ARCHITECTURE.md)
- Лог решений: [specs/Simply_xAI/SIMPLY_XAI_NOTES.md](specs/Simply_xAI/SIMPLY_XAI_NOTES.md)

**Правило серии:** не отвлекаться на другие ТЗ до завершения.

---

## Три уровня персонализации

Как Simply знает пользователя:

1. **Профиль пользователя** (`User` таблица) — displayName, pronouns, occupation, bio, theme. Редактируется в `/settings`, попадает в system prompt каждого чата.
2. **MIND** (`MemoryEntry` + `UserProfileSummary`) — автоматически извлекает факты из диалогов, nightly narrative profile, retrieval в контекст новых сообщений. Dashboard «Мой контекст» для просмотра. **Это автоматическая память** (из разговоров), не путать с Библиотекой (Collections) для явной загрузки документов — см. таблицу компонентов выше.
3. **Chat Memory** (history) — полная история каждого чата в БД (`Message_v2`), плюс stream state.

Архитектура MIND: [specs/Simply_xAI/MIND_ARCHITECTURE.md](specs/Simply_xAI/MIND_ARCHITECTURE.md).

---

## Инфраструктура

| Слой | Технология |
|---|---|
| Frontend | Next.js 15.3 (App Router, RSC), React 18, TypeScript, Tailwind CSS, shadcn/ui |
| AI SDK | `ai@6.x` + `@ai-sdk/anthropic@3.x` + `@ai-sdk/google@3.x` + `@ai-sdk/xai@3.x` + `@ai-sdk/react@3.x` + `vercel-minimax-ai-provider` + `@openrouter/ai-sdk-provider` + `@google/genai` (TTS) |
| Core Registry | `lib/ai/getModel.ts` + `task-assignments.ts` + `model-catalog.ts` + `registry.ts` — SSOT для 39 AI-точек, смена модели = одна строка |
| AI провайдеры (в registry) | Anthropic, MiniMax (default + long 180s namespace), xAI, OpenRouter (GLM/Qwen резерв) |
| AI провайдеры (non-LLM) | Voyage (embeddings), Deepgram (STT), Perplexity (deep research), Gemini TTS |
| Auth | NextAuth 5.0-beta.25 + bcrypt + PostgreSQL adapter |
| Database | PostgreSQL (Neon) + Drizzle ORM + `@neondatabase/serverless` HTTP driver (stateless) |
| Storage | Vercel Blob Storage |
| External сервисы | Brave Search, Perplexity, CloudConvert, Open-Meteo, Deepgram |
| Deploy | Vercel (Hobby plan на production URL, Cron hourly) |

**Подробнее по слоям:** [docs/architecture.md](docs/architecture.md). Провайдеры и цены: [docs/ai-providers.md](docs/ai-providers.md).

---

## Метрики (от SSOT-файлов)

> Цифры ниже вычисляются из SSOT-файлов и обновляются в том же коммите, что меняет соответствующий файл. Если несовпадает — SSOT прав.

| Метрика | Значение | SSOT |
|---|---|---|
| AI-точек маршрутизации (taskId) | 39 | [lib/ai/task-assignments.ts](lib/ai/task-assignments.ts) |
| Моделей в каталоге | — (аудит по запросу) | [lib/ai/model-catalog.ts](lib/ai/model-catalog.ts) |
| Таблиц БД (Drizzle `pgTable`) | 29 | [lib/db/schema.ts](lib/db/schema.ts) |
| AI-инструментов (`lib/ai/tools/`) | 17 | [docs/ai-tools.md](docs/ai-tools.md) |
| shadcn/ui примитивов (`components/ui/`) | 25 | [docs/design-system.md § 13.1](docs/design-system.md) |
| AI-chat элементов (`components/elements/`) | 17 | [docs/design-system.md § 13.2](docs/design-system.md) |
| Типов артефактов | 5 (text, markdown, excel, reveal, pptx) | [docs/ai-artifacts.md](docs/ai-artifacts.md) |
| Production build | ✅ успешен | CI / Vercel |

---

## Известные проблемы (открытые хвосты)

SSOT: [specs/_backlog/README.md](specs/_backlog/README.md). Сводка на сегодня:

### 🟥 High impact

- **[TZ_ErrorRecoveryUI](specs/_backlog/TZ_ErrorRecoveryUI.md)** — Stage 2 root cause fix: useChat state recovery через правильную обработку `clearError` для не-ChatSDK ошибок. Stage 1 (hint в красном флаге) уже сделан.

### 🟧 Medium impact

- **[TZ_SimplyContextUsageWidget](specs/_backlog/TZ_SimplyContextUsageWidget.md)** — виджет контекста в Simply показывает не ту шкалу (привязан к `contextWindow` модели, не к `SIMPLY_CONTEXT_LIMIT`). Даёт ложную тревогу. Плюс подозрительное 128K для Grok 4.1 Fast в каталоге.
- **[TZ_PromptsDeadCodeCleanup](specs/_backlog/TZ_PromptsDeadCodeCleanup.md)** — удалить мёртвые экспорты из `lib/ai/prompts.ts`. 90% файла dead.
- **[TZ_SimplyChatRaceCondition](specs/_backlog/TZ_SimplyChatRaceCondition.md)** — `getOrCreateSimplyChat` без partial unique index → race при первых параллельных запросах нового пользователя.

**Правило backlog (из `specs/WORKFLOW.md`):** перед стартом нового крупного ТЗ — пройтись по списку и предложить владельцу закрыть или игнорировать. Решение за владельцем.

---

## Навигация по документации

**Главные документы:**
- [README.md](README.md) — о проекте (точка входа)
- [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md) — видение продукта
- [CHANGELOG.md](CHANGELOG.md) — история изменений (semver)
- [CLAUDE.md](CLAUDE.md) — инструкция для Claude Code
- [DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md) — правила ведения документации

**Обязательное чтение при AI-работе:**
- [specs/Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md](specs/Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md) — SSOT обработки вложений
- [specs/Simply_xAI/MIND_ARCHITECTURE.md](specs/Simply_xAI/MIND_ARCHITECTURE.md) — MIND pipeline

**Техническая документация (`docs/`):**
- [docs/architecture.md](docs/architecture.md) — архитектурные слои + пофайловая карта фич
- [docs/design-system.md](docs/design-system.md) ⭐ — UI закон (компоненты, цвета, шрифты)
- [docs/ai-chats-map.md](docs/ai-chats-map.md) ⭐ — карта всех чатов и моделей по taskId
- [docs/ai-providers.md](docs/ai-providers.md) — провайдеры, цены, namespace-ы
- [docs/ai-agents.md](docs/ai-agents.md) — система промптов (Skills + Agents)
- [docs/ai-artifacts.md](docs/ai-artifacts.md) — артефакты (5 типов)
- [docs/ai-tools.md](docs/ai-tools.md) — AI-инструменты (17 файлов)
- [docs/model-catalog-ops.md](docs/model-catalog-ops.md) — workflow каталога моделей
- [docs/setup.md](docs/setup.md) — установка
- [docs/deployment.md](docs/deployment.md) — деплой
- [docs/troubleshooting.md](docs/troubleshooting.md) — частые проблемы
- [docs/mcp-tools.md](docs/mcp-tools.md) — MCP-инструменты
- [docs/decisions/](docs/decisions/) — ADR

**Процесс:**
- [specs/WORKFLOW.md](specs/WORKFLOW.md) — фазы работы с ТЗ
- [specs/ROADMAP_GUIDE.md](specs/ROADMAP_GUIDE.md) — шаблон ROADMAP

---

**Обновлено:** 2026-04-15 (TZ_DocsCleanup Этап 3 — переписан как snapshot)
