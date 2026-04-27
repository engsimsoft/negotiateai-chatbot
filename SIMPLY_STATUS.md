# Simply — Текущее состояние

**Версия:** 3.100.1
**Статус:** Active development (**hotfix(xai-cache) выпущен** 2026-04-27 в v3.100.1 — починен prompt cache xAI на длинных историях: убран `LIMIT 200` в `getMessagesByChatId`, добавлен header `x-grok-conv-id` для sticky routing; **ТЗ-FixSimplyMemory закрыт** 2026-04-27 в v3.100.0 — Simply Chat больше не теряет память: убран фильтр `excludeExtracted=true`, дедупликация в pre-compact extract; **ТЗ-MigrateArtifactPromptsToSkills закрыт** 2026-04-27 в v3.99.3 — inline промпты артефактов вынесены в `lib/prompts/skills/artifact-generation/`, разблокирован A/B Шаг 7 серии Simply_Migration; **ТЗ-BR-AUTHOR-KIMI закрыт** 2026-04-27 в v3.99.2 — миграция briefing pipeline с MiniMax на Kimi K2.6)
**URL:** https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app

> **Назначение:** snapshot «что работает прямо сейчас» на один взгляд. История изменений → [CHANGELOG.md](CHANGELOG.md). Архитектура → [docs/architecture.md](docs/architecture.md). Карта моделей → [docs/ai-chats-map.md](docs/ai-chats-map.md).

---

## О проекте

**Simply** — AI-платформа для российского рынка. Шлюз к лучшим мировым AI-моделям с оплатой в рублях.

**Философия:** Apple-подход (качество важнее количества) + Best-in-Class API (интегрируем лучшие решения, не изобретаем). Детали видения → [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md).

**Мультипровайдерная маршрутизация (финальная после закрытия серии Simply_xAI, 4 роли / 3 production провайдера / 1 dev-инструмент):**
- **Подсобка** — xAI Grok 4.1 Fast (`util:*`, `clerk:*`, `briefing:filter`, `memory:extract-batch/consolidate/profile/dedup-verify`, `compaction:summarize`)
- **Кухня** — Moonshot AI Kimi K2.6 (`briefing:author`, `briefing:section`, `briefing:podcast-script` — Instant mode, 180s fetch timeout через namespace `moonshotai`, мигрировано с MiniMax в v3.99.2)
- **Зал** — xAI Grok 4.20 reasoning (`simply-chat-think`, `expertise`, `create`, `meeting:summary`)
- **Автор** — Anthropic Claude Opus/Sonnet/Haiku (`professor:*`, `artifact:*`, `vision:ocr`, `service-chat:*`, `chat-vision` — capability-driven fallback для PDF-сканов во всех режимах, ADR 055)
- **Dev-инструмент** — OpenRouter (только через `/dev/models` override для тестирования новых моделей)

SSOT резолва — [lib/ai/task-assignments.ts](lib/ai/task-assignments.ts) + [lib/ai/model-catalog.ts](lib/ai/model-catalog.ts).

---

## Компоненты — что работает сегодня

> **Правила чтения таблицы:** статус отражает текущее состояние. Модели указаны как «какая модель сейчас обслуживает задачу» — детальный taskId-маппинг в [docs/ai-chats-map.md](docs/ai-chats-map.md). Если в коде поменялась модель — обновляется сначала `task-assignments.ts`, потом `ai-chats-map.md`, потом эта таблица.

| Компонент | Статус | Модели / стек |
|---|---|---|
| **Simply Chat** (persistent, один на пользователя) | ✅ | Grok 4.1 Fast (default, включая картинки через нативный vision) · Grok 4.20 reasoning (кнопка «Думать») · Claude Haiku 4.5 — fallback для PDF-сканов через `chat-vision`. История чата = primary source с budget 140K, MIND = augmentation (фикс v3.100.0). xAI prompt cache hit-rate стабильный благодаря `x-grok-conv-id` sticky routing + token-aware loading без жёсткого `LIMIT 200` (фикс v3.100.1) |
| **Экспертиза** (одноразовые экспертные запросы) | ✅ | Grok 4.20 reasoning (single-agent, R-5 резолв 2026-04-16). Multi-agent вариант 🔒 зарезервирован под ТЗ-XAI-MA-1 |
| **Создание** (одноразовые creation-чаты) | ✅ | Grok 4.20 reasoning (мигрировано 2026-04-16) |
| **Проекты** (изолированные рабочие пространства) | ✅ | Claude Haiku / Sonnet / Opus по tier, Профессор (Opus planning/review + Haiku execute) |
| **База знаний — MIND** (Слой 3 RAG, auto из разговоров) | ✅ | **Hot path:** Grok 4.1 Fast (batch-extract, consolidate, profile, dedup-verify) + Voyage AI (embeddings) + pgvector. Extract пакетно из to-compact окна в момент compaction (ADR 054). **Ночная глубокая консолидация (v3.97.0):** Grok 4.20 reasoning (`memory:deep-consolidate`) в 01:00 МСК — причёсывает базу на reasoning-модели (tiered Letta sleep-time pattern), 4 действия включая `rephrase`. A/B через `/dev/models` |
| **Simply Compaction** (автосжатие истории чата при пороге 50%/85% от 200K) | ✅ | Grok 4.1 Fast non-reasoning (`compaction:summarize`) + provider-agnostic middleware. Активен во всех chat-модах (simply, expertise, create, project). Orchestration: pre-compact batch-extract → summarize → verbatim window (ADR 054) |
| **Библиотека — Collections** (Слой 3 RAG, явная загрузка документов) | ✅ | xAI Grok Collections API из коробки. Tool `librarySearch` подключён в Simply/Экспертизе/Создании/проектах. Авто-анализ (Grok 4.1 Fast) + развёрнутый авто-обзор после indexing. Split-view изолированного мини-чата. Source picker (до 3 коллекций / 5 документов) для scoping в Экспертизе/Создании. Закрыто в v3.99.0 (ТЗ-XAI-COL-1) |
| **Briefing** (hourly Vercel Cron) | ✅ | Grok 4.1 Fast (filter) · **Kimi K2.6** (author, section, podcast-script — Instant mode, namespace `moonshotai` с 180s timeout). Мигрировано с MiniMax в v3.99.2 (ТЗ-BR-AUTHOR-KIMI) — closed silent hang после `ai@6.0.168`. Подключение через `@ai-sdk/moonshotai@ai-v6` |
| **Podcast** (attached to briefing) | ✅ | Gemini TTS (длинный формат, blob storage) |
| **Meeting Recorder** | ✅ | Deepgram Nova-3 (STT) + Grok 4.20 reasoning (summary, мигрировано 2026-04-16) |
| **Telegram Bot + Groups** | ✅ | Custom bot + ingestion pipeline |
| **Artifacts** (text, markdown, excel, reveal, pptx) | ✅ | Claude Sonnet для всех 5 типов. System-промпты в `lib/prompts/skills/artifact-generation/<kind>/` (вынесены из inline в v3.99.3 — provider-agnostic база для A/B Шага 7) |
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

**🎯 Simply_Migration** — финальная миграция на xAI Grok + Kimi K2.6 + Perplexity (Anthropic Opus только аудитор Профессор/Проекты, MiniMax уходит из проекта).

- Концепт миграции: [specs/Simply_Migration/SIMPLY_MIGRATION_CONCEPT.md](specs/Simply_Migration/SIMPLY_MIGRATION_CONCEPT.md)
- Концепт Briefing: [specs/Simply_Migration/SIMPLY_BRIEFING_CONCEPT.md](specs/Simply_Migration/SIMPLY_BRIEFING_CONCEPT.md)
- Архитектура вложений (SSOT): [specs/Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md](specs/Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md)
- Архитектура MIND (SSOT): [specs/Simply_xAI/MIND_ARCHITECTURE.md](specs/Simply_xAI/MIND_ARCHITECTURE.md)
- Завершённая серия Simply_xAI: [specs/_archive/Simply_xAI/](specs/_archive/Simply_xAI/)

**План работ:** 11 ТЗ в 4 фазы (А — закрыть боль, Б — унификация чата, В — A/B тесты, Г — большие блоки). **ТЗ-1 BR-AUTHOR-KIMI закрыт 2026-04-27 в v3.99.2** (silent hang устранён, MiniMax удалён). **ТЗ-2 MigrateArtifactPromptsToSkills закрыт 2026-04-27 в v3.99.3** (10 .md файлов + loader, A/B Шаг 7 разблокирован). Следующий — ТЗ-3 (план в концепте миграции, Фаза А/Б).

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

SSOT: [specs/_backlog/README.md](specs/_backlog/README.md). **План разруливания:** [specs/_backlog/TRIAGE.md](specs/_backlog/TRIAGE.md). История закрытых: [specs/_archive/BACKLOG_CLOSED.md](specs/_archive/BACKLOG_CLOSED.md).

> 🚨 **ОТКРЫТАЯ КРИТИЧЕСКАЯ РЕГРЕССИЯ — Simply Chat «помнит только последнее сообщение»** ([TZ_SimplyChatMemoryRegression](specs/_backlog/TZ_SimplyChatMemoryRegression.md)).
>
> Архитектурный фильтр `excludeExtracted=true` режет inline-историю агрессивно: используется 3.5% окна модели grok-4-1-fast (200k) при 192 сообщениях в БД. Модель не помнит artefact, который сама создала 30 минут назад.
>
> **Следующее ТЗ для разруливания:** [TZ_MindAtomicityFix](specs/_backlog/TZ_MindAtomicityFix.md) — фундамент атомарности фактов (без него лечение памяти бессмысленно). Затем [TZ_SimplyChatMemoryRegression](specs/_backlog/TZ_SimplyChatMemoryRegression.md) — главное лечение. Полный порядок → [TRIAGE.md](specs/_backlog/TRIAGE.md).

### 🟥 Critical impact

- **TZ_SimplyChatMemoryRegression** (новое) — Simply Chat «помнит только последнее сообщение». Архитектурный фильтр `excludeExtracted=true` режет inline-историю до сообщений с `extractedAt IS NULL`, при этом контекст модели grok-4-1-fast = 200k токенов используется на 3.5%. История 192 сообщения / ~50k токенов помещалась бы целиком. UX-катастрофа: «не помню artefact про X» при том что модель сама его создала 30 минут назад. Найдено в Этапе 7 ТЗ-MigrateArtifactPromptsToSkills.

### 🟥 High impact

- **TZ_MindAtomicityFix** (новое) — `markMessagesExtracted` в [lib/ai/memory/extract.ts:235-246](lib/ai/memory/extract.ts#L235-L246) безусловно отмечает сообщения как extracted даже при провале `processAndStoreFact` (Voyage 403). Память безвозвратно теряется. Нужна атомарность.
- **TZ_ChatModeUndefinedSubmit** (новое) — Runtime error `getChatUrl: chatMode "undefined"` блокирует submit формы при открытом артефакте. Требует TS-fix контракта пропов в [components/multimodal-input.tsx](components/multimodal-input.tsx).
- **TZ_GrokSkipsUpdateDocumentTool** (новое) — Grok 4.1 Fast иногда генерит ответ как обычный chat-message вместо вызова `updateDocument` tool. Нужно усилить tool description / системный промпт.
- **TZ_PptxRevealUpdateRender** (новое) — Презентации не перерисовываются в холсте после `onUpdateDocument` (БД и blob обновлены, превью генерится — но клиент показывает старую версию). Скачанный файл — свежий.

### 🟧 Medium impact

- **[TZ_ExpertiseReasoningRestore](specs/_backlog/TZ_ExpertiseReasoningRestore.md)** — Экспертиза временно понижена с `grok-4.20-reasoning` на non-reasoning из-за регрессии `@ai-sdk/xai@3.0.83` (`reasoning part not found` при параллельных tool calls). Качество Экспертизы снижено. Существует с 2026-04-23.
- **[TZ_BriefingConcurrencyGuard](specs/_backlog/TZ_BriefingConcurrencyGuard.md)** — Гонка cron-запуска и user-triggered «Сгенерировать» для одного userId; partial unique index или optimistic lock.
- **TZ_RevealVsPptxToolSelection** (новое) — AI стабильно выбирает `presentation-pptx` когда пользователь просит `reveal`. Reveal-артефакт практически недоступен через AI-канал. Нужно уточнить tool description.
- **TZ_ChatInputBlockedOnDocumentFetchHang** (новое) — Chat input блокируется когда `GET /api/document` висит в timeout (Neon ConnectTimeoutError). UI должен иметь fail-fast fallback.

> **TZ_BriefingMiniMaxHang** перенесён в архив — закрывается через `Simply_Migration/BR-AUTHOR-KIMI` (Фаза А концепта миграции).

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

**Обновлено:** 2026-04-27 — закрыт ТЗ-MigrateArtifactPromptsToSkills (v3.99.3): inline промпты артефактов вынесены в `lib/prompts/skills/artifact-generation/`, добавлено 7 новых записей в backlog (1 critical: SimplyChatMemoryRegression; 4 high: MindAtomicityFix, ChatModeUndefinedSubmit, GrokSkipsUpdateDocumentTool, PptxRevealUpdateRender; 2 medium). Все находки выявлены через мануальный смок Этапа 7 ТЗ-2.
**До этого:** 2026-04-27 — открыта новая активная серия **Simply_Migration** (концепт миграции + концепт Briefing).
