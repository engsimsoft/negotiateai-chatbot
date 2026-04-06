# ADR 038: Архитектура учёта расходов (Cost Tracking)

**Дата:** 2026-04-06
**Статус:** Принято
**Версия:** 3.69.0

## Контекст

Проект использует несколько платных AI-провайдеров. Нужна единая система учёта расходов для будущего биллинга (Pay-as-you-go) и текущего контроля.

## Архитектура

### Провайдеры и модели

| Провайдер | Модели | Где используются |
|-----------|--------|-----------------|
| **Anthropic** | claude-sonnet-4-6, claude-haiku-4-5 | Чаты, онбординг, briefing author, projects, artifacts |
| **Google** | gemini-2.0-flash, gemini-2.5-flash | Briefing filter, podcast script, vision-ocr |
| **Google TTS** | gemini-2.5-flash-preview-tts | Podcast озвучка |
| **Perplexity** | sonar-pro, sonar-deep-research | Deep Research tool (поиск источников) |
| **Deepgram** | nova-3 | Voice input (транскрипция голоса) |

### Точки записи usage (SSOT)

Все расходы пишутся в таблицу `ai_usage_log` через `logUsage()` из `lib/ai/usage-utils.ts`.

#### Streaming routes (чаты)

| Route | Модель | Как логируется | chatMode |
|-------|--------|---------------|----------|
| `/api/chat` | Sonnet 4.6 | `onFinish: ({ totalUsage })` | `chat`, `expertise`, `create` |
| `/api/service-chat` | Sonnet 4.6 / Haiku | `onFinish: ({ totalUsage })` | `service:ben`, `service:briefing-onboarding`, `service:project-manager` |
| `/api/projects/.../chat` | Sonnet/Haiku/Opus | `onFinish: ({ totalUsage })` | `project:expert`, `project:executor` |
| `/api/assistant/ben` | Haiku | `onFinish: ({ totalUsage })` | `legacy:ben` |

**Важно:** Используется `totalUsage` (сумма всех steps), НЕ `usage` (последний step). ADR 037.

#### Pipeline (batch generation)

| Pipeline | Модель | Как логируется | chatMode |
|----------|--------|---------------|----------|
| Briefing author | Sonnet 4.6 | `retryWithLogging()` → `logUsage()` per attempt | `briefing:author` |
| Briefing section | Sonnet 4.6 | `retryWithLogging()` → `logUsage()` per attempt | `briefing:section-author` |
| Briefing filter | Gemini 2.0 Flash | `logUsage()` после `generateObject` | `briefing:filter` |
| Podcast script | Gemini 2.5 Flash | `logUsage()` с accumulated usage | `podcast:script` |
| Podcast TTS | Gemini TTS | `logUsage()` с `costUsdOverride` (per-character) | `podcast:tts` |
| Meeting summary | Sonnet 4.6 | `logUsage()` после `generateText` | `meeting:summary` |

**Pipeline retry:** `maxRetries: 0` в AI SDK + `retryWithLogging()` (3 попытки). Каждая попытка логируется отдельно. ADR 037.

#### Tools (вызываются внутри чатов)

| Tool | Провайдер | Как логируется | chatMode |
|------|-----------|---------------|----------|
| Deep Research (pro) | Perplexity sonar-pro | `logUsage()` в deep-research.ts | `tool:deep-research` |
| Deep Research (deep) | Perplexity sonar-deep-research | `logUsage()` в deep-research.ts | `tool:deep-research` |
| Voice Input | Deepgram nova-3 | `logUsage()` с `costUsdOverride` | `tool:voice-input` |
| Vision OCR | Gemini 2.0 Flash | `logUsage()` в vision-ocr.ts | `tool:vision-ocr` |

#### Artifacts (создание/редактирование документов)

| Тип | Модель | Как логируется | chatMode |
|-----|--------|---------------|----------|
| Text | Sonnet 4.6 | `result.totalUsage` + `logUsage()` | `artifact:text` |
| Markdown | Sonnet 4.6 | аналогично | `artifact:markdown` |
| Excel | Sonnet 4.6 | аналогично | `artifact:excel` |
| Reveal (web) | Sonnet 4.6 | аналогично | `artifact:reveal` |
| PPTX (PowerPoint) | Sonnet 4.6 | аналогично | `artifact:pptx` |

#### Служебные вызовы

| Вызов | Модель | chatMode |
|-------|--------|----------|
| Auto-naming | Haiku | `util:auto-naming` |
| Task summarizer | Haiku | `clerk:task-summarizer` |
| Task reviewer | Opus | `professor:task-reviewer` |
| Snapshot creator | Haiku | `clerk:snapshot-creator` |
| File analyzer | Haiku | `clerk:file-analyzer` |

### Где данные используются

1. **`/admin/cost-audit`** — Дашборд для разработчика (dev mode). Агрегация по периодам, моделям, chatModes. Это основной источник для контроля расходов.

2. **DevPanel (chat)** — Per-message стоимость в реальном времени (из debug events, не из БД).

3. **Pipeline Trace** — Per-stage стоимость в Pipeline Trace Drawer (из trace data, не из БД).

4. **Будущий биллинг** — `ai_usage_log` станет основой для Pay-as-you-go расчётов.

### chatMode конвенция

```
service:*       — Сервисные чаты (ben, briefing-onboarding, project-manager)
professor:*     — Профессор (planning, task-review)
clerk:*         — Клерки (task-summarizer, snapshot-creator, file-analyzer)
briefing:*      — Pipeline брифинга (author, section-author, filter)
podcast:*       — Pipeline подкаста (script, tts)
tool:*          — Инструменты (deep-research, voice-input, vision-ocr)
meeting:*       — Pipeline встречи (summary, transcription)
util:*          — Утилиты (auto-naming)
project:*       — Чаты проектов (expert, executor)
artifact:*      — Документы (text, markdown, excel, reveal, pptx)
chat|expertise|create — Основные режимы чата
legacy:*        — Устаревшие endpoints (ben)
```

### Ключевые файлы

| Файл | Назначение |
|------|-----------|
| `lib/ai/usage-utils.ts` | `logUsage()` — единая точка записи |
| `lib/ai/retry-with-logging.ts` | `retryWithLogging()` — retry с per-attempt logging |
| `lib/ai/providers.ts` | `MODEL_PRICING_RUB` — цены моделей |
| `lib/ai/tokenlens-catalog.ts` | `calcCostUsd()` — расчёт стоимости через TokenLens |
| `lib/db/queries.ts` | `saveAiUsageLog()` — запись в БД |
| `lib/db/schema.ts` | `aiUsageLog` — схема таблицы |
| `app/api/admin/cost-audit/route.ts` | API дашборда расходов |
| `app/(dashboard)/admin/cost-audit/page.tsx` | UI дашборда расходов |

## Результат

Все платные API-вызовы в проекте логируются в единую таблицу. Дельта с Anthropic Console <1%.
