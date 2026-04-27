# Architecture Decision Records (ADR)

Архитектурные решения проекта Simply.

**Формат:** [ADR](https://adr.github.io/) — стандартный формат для документирования архитектурных решений.

---

## Индекс решений

| # | Название | Дата | Статус |
|---|----------|------|--------|
| [001](001-why-gemini.md) | Выбор Google Gemini | 2026-01-26 | Принято |
| [002](002-family-bot-concept.md) | Концепция Family AI Assistant | 2026-01-26 | Superseded by 005 |
| [003](003-no-guest-mode.md) | Удаление guest режима | 2026-01-26 | Принято |
| [004](004-agent-system.md) | Система из 8 агентов | 2026-01-27 | Superseded by 006 |
| [005](005-simply-rebrand.md) | Ребрендинг в Simply | 2026-01-28 | Принято |
| [006](006-prompt-architecture.md) | Новая архитектура промптов (v3.0) | 2026-02-02 | Superseded by 008 |
| [007](007-projects-claude-integration.md) | Проекты + Claude Integration (v3.2) | 2026-02-02 | Принято |
| [008](008-skills-agents-architecture.md) | Skills + Agents Architecture (v3.3) | 2026-02-02 | Принято |
| [009](009-loadskill-progressive-disclosure.md) | loadSkill — Progressive Disclosure (v3.3.2) | 2026-02-03 | Принято |
| [010](010-performance-optimization.md) | Оптимизация производительности БД (v3.4.1) | 2026-02-04 | Принято |
| [011](011-temporary-gemini-for-projects.md) | Временный переход проектов на Gemini | 2026-02-05 | Принято (временное) |
| [012](012-context-vs-instruction-separation.md) | Разделение Context и Instruction в проектах | 2026-02-07 | Принято |
| [013](013-design-system-root-file.md) | Design System как корневой файл для UI | 2026-02-10 | Принято |
| [014](014-route-groups-per-chat-mode.md) | Route Groups по ChatMode | 2026-02-13 | Принято |
| [015](015-neon-serverless-driver.md) | Neon Serverless Driver | 2026-02-17 | Принято |
| [016](016-briefing-backend-architecture.md) | Архитектура Briefing — Gemini-пайплайн + Landing-first UI | 2026-02-19 | Принято |
| [017](017-podcast-engine-architecture.md) | Архитектура Podcast Engine — двухэтапный Gemini-пайплайн | 2026-02-22 | Принято |
| [018](018-prompt-engineering-lessons.md) | Prompt Engineering Lessons | 2026-02-22 | Принято |
| [019](019-usage-logging-architecture.md) | Архитектура Usage Logging — fire-and-forget + numeric precision | 2026-02-25 | Принято |
| [020](020-telegram-integration-strategy.md) | Telegram Integration Strategy — Shared Parser + фазовый подход | 2026-02-25 | Принято |
| [021](021-telegram-bot-infrastructure.md) | Telegram Bot Infrastructure — grammY + Webhook | 2026-02-26 | Принято |
| [022](022-tool-call-guardian.md) | Tool Call Guardian — детектор галлюцинаций | 2026-02-26 | Принято |
| [023](023-guardian-blocking-strategy.md) | Guardian Blocking Strategy — буферизация + блокировка | 2026-02-27 | Принято |
| [024](024-research-engine-pattern.md) | Research Engine Pattern — Perplexity + verify + classify | 2026-02-27 | Принято |
| [025](025-guardian-bypass-pattern.md) | Guardian Bypass Pattern — multi-step flows | 2026-02-27 | Принято |
| [026](026-background-briefing-architecture.md) | Background Briefing Architecture — Vercel Cron + Pipeline | 2026-02-27 | Принято |
| [027](027-lamejs-vercel-bundling.md) | lamejs Vercel Bundling — lazy loading + pnpm path + NFT | 2026-02-28 | Принято |
| [028](028-telegram-closed-groups.md) | Telegram Closed Groups — group message ingestion | 2026-02-28 | Принято |
| [029](029-developer-panel.md) | Developer Panel Architecture | 2026-02-28 | Принято |
| [030](030-pipeline-observability.md) | Pipeline Observability | 2026-03-01 | Принято |
| [031](031-onboarding-debug-architecture.md) | Onboarding Debug Architecture | 2026-03-01 | Принято |
| [032](032-meeting-recorder-architecture.md) | Meeting Recorder Architecture | 2026-03-02 | Принято |
| [033](033-pdfmake-serverless-pdf.md) | pdfmake для серверной генерации PDF | 2026-03-02 | Принято |
| [034](034-delivery-invariants-and-waituntil.md) | Delivery Invariants, waitUntil + Cost Coverage (ТЗ-COSTCTRL) | 2026-04-05 | Принято |
| [035](035-sdk-native-usage-tracking.md) | SDK Native Usage Tracking (ТЗ-TOKENS1) | 2026-04-06 | Принято |
| [036](036-cost-tracking-coverage-audit.md) | Cost Tracking Coverage Audit | 2026-04-06 | Принято / в работе (pipelines) |
| [037](037-total-usage-and-retry-logging.md) | Total Usage Accumulation + Retry-with-Logging | 2026-04-06 | Принято |
| [038](038-cost-tracking-architecture.md) | Архитектура учёта расходов (Cost Tracking) | 2026-04-06 | Принято |
| [039](039-pgvector-voyage-ai-rag-infrastructure.md) | pgvector + Voyage AI — RAG Infrastructure | 2026-04-06 | Принято |
| [040](040-mind-extract-retrieve-architecture.md) | MIND Extract + Retrieve — извлечение и использование памяти | 2026-04-06 | Принято |
| [041](041-mind-consolidation-profile-architecture.md) | MIND Consolidation + Profile Architecture | 2026-04-07 | Принято |
| [042](042-compaction-dual-strategy.md) | Compaction API — dual strategy (snapshot + compaction) | 2026-04-07 | Superseded by 054 |
| [043](043-minimax-simply-routing.md) | MiniMax M2.7 + маршрутизация модели для Simply Chat | 2026-04-08 | Принято |
| [044](044-extract-on-compression.md) | Extract-on-Compression для Simply Chat | 2026-04-08 | Принято |
| [045](045-podcast-minimax-migration.md) | Podcast Pipeline — Gemini → MiniMax | 2026-04-09 | Принято |
| [046](046-podcast-tts-revert-and-briefing-stability.md) | Podcast TTS Revert + Briefing Map-Reduce Rejected | 2026-04-10 | Принято |
| [047](047-core-model-registry.md) | Core Model Registry — Task-based Model Resolution | 2026-04-11 | Принято |
| [048](048-dev-switchboard-ui.md) | Dev Switchboard UI | 2026-04-12 | Принято |
| [049](049-minimax-anthropic-compat-mode.md) | MiniMax через Anthropic-compat режим как SSOT подключения | 2026-04-13 | Принято |
| [050](050-cache-breakpoints-strategy.md) | Стратегия 3-breakpoint кэширования + MIND transplant | 2026-04-13 | Принято |
| [051](051-pipeline-observability-and-targeted-caching.md) | Pipeline observability + targeted caching | 2026-04-13 | Принято |
| [052](052-context-management-strategy-per-provider.md) | Context Management Strategy per Provider | 2026-04-14 | Superseded by 054 |
| [053](053-aisdk-invocation-contract.md) | AI SDK invocation contract | 2026-04-18 | Принято |
| [054](054-single-strategy-compaction.md) | Single-strategy provider-agnostic compaction | 2026-04-20 | Принято |
| [055](055-capability-driven-attachment-routing.md) | Capability-Driven Attachment Routing | 2026-04-21 | Принято |
| [056](056-library-upload-collections-endpoint.md) | Library Upload via Collections Management API (content_type preservation) | 2026-04-23 | Принято |
| [057](057-xai-prompt-cache-prefix-stability.md) | xAI prompt cache — два условия стабильности префикса (`x-grok-conv-id` + стабильный messages array) | 2026-04-27 | Принято |

---

## Статусы

- **Принято** — решение действует
- **Superseded** — заменено более новым решением
- **Отклонено** — решение отклонено
- **Предложено** — на рассмотрении

---

## Когда создавать ADR

Создавай ADR когда:
- Выбираешь технологию или библиотеку
- Меняешь архитектуру системы
- Принимаешь решение с долгосрочными последствиями
- Отказываешься от чего-то важного

---

## Шаблон

См. [template.md](template.md)

---

**Обновлено:** 2026-04-27 — индекс восстановлен (029-056 catch-up) + добавлена запись ADR 057 (xAI prompt cache prefix stability)
