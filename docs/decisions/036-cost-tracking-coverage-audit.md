# ADR 036: Cost Tracking Coverage Audit (2026-04-06)

**Дата:** 2026-04-06
**Статус:** Принято (основной чат) / В работе (pipelines)

## Контекст

По итогам ТЗ-TOKENS1 (v3.67.0) и ТЗ-BILLING1 (v3.68.0) проведён полный аудит учёта расходов AI-провайдеров в системе Simply. Цель — подготовка к pay-as-you-go биллингу.

## Результаты аудита

### Основной чат (chat / expertise / create) — ✅ ГОТОВ

| Провайдер | Модель | chatMode | costUsd | Δ с Console |
|-----------|--------|----------|---------|-------------|
| Anthropic Claude | Haiku 4.5 | chat | ✅ | 0.16% |
| Anthropic Claude | Sonnet 4.6 | expertise | ✅ | 0.06% |
| Anthropic Claude | Sonnet 4.6 | create | ✅ | 0.40% |
| Deepgram | nova-3 | tool:voice-input | ✅ | — |
| Google Gemini | 2.5 Flash | util:vision-ocr | ✅ | — |
| Perplexity | sonar-pro/deep | tool:deep-research | ✅ | — |
| Brave Search | — | — | N/A (free) | — |
| Jina Reader | — | — | N/A (free) | — |

Все платные провайдеры логируются в `ai_usage_log`. NULL costUsd = 0.

### Briefing pipeline — ❌ КРИТИЧЕСКИЕ ПРОБЛЕМЫ

Тест 2026-04-06: Anthropic Console показал **43 873 input tokens**, наша БД залогировала **8 774** (20%).

| Проблема | Файл | Потери |
|----------|------|--------|
| AI SDK `maxRetries: 2` (default) → 3 платных вызова при failure, ни один failed retry не логируется | briefing-author.ts | ~$0.20 на Sonnet 4.6 (3 retry) |
| Fallback на legacy Sonnet 4.5 → лишний расход | briefing-author.ts | ~$0.13 (только $0.07 залогировано) |
| Pipeline crash "Controller is already closed" → section-author не запускается | briefing-pipeline.ts → generate/route.ts | $0.02 Sonnet 4.6 |
| Perplexity research не вызывает logUsage | research-engine.ts | Неизвестно |

**Итого потеряно: 78% расхода Anthropic.**

### Podcast pipeline — ⚠️ НЕ ПРОВЕРЕН

TTS (costUsdOverride) и script (Gemini) — теоретически логируются, мануальный тест не проведён.

## Решение

### Фаза 1 (завершена): Основной чат
- `TokenUsageForPricing` disjoint контракт (ADR 035)
- `AppUsage` с `costRub` breakdown + кумулятивный аккумулятор
- `MODEL_CONTEXT_WINDOW` с актуальными данными Anthropic docs
- Deepgram voice logging endpoint
- Vision OCR обязательный userId

### Фаза 2 (следующее ТЗ): Pipeline reliability + observability
Требования (согласованы с пользователем 2026-04-06):
1. `maxRetries: 0` в AI SDK + собственная retry-логика с логированием КАЖДОЙ попытки
2. Убрать fallback Sonnet 4.5
3. Fix pipeline crash ("Controller is already closed")
4. Perplexity logUsage
5. **DevPanel для брифинга** — прозрачность всех вызовов, retry'ев, стоимостей, детекция галлюцинаций
6. Гарантия: БД === Anthropic Console (допуск <5%)

## Доступность инструментов по chatMode

| Tool | chat (Haiku) | expertise (Sonnet) | create (Sonnet) | project |
|------|:---:|:---:|:---:|:---:|
| deepResearch (Perplexity) | ❌ | ✅ | ✅ | ✅ |
| fetchUrl (Jina) | ❌ | ✅ | ✅ | ✅ |
| webSearch (Brave) | ✅ | ✅ | ✅ | ✅ |
| readDocument (Vision OCR) | ✅ | ✅ | ✅ | ❌ (project files) |
| Все остальные | ✅ | ✅ | ✅ | ✅ |

Source: `lib/ai/tools/chat-tools.ts:99` — `CHAT_MODE_EXCLUDED_TOOLS`.

## Модели и контекстные окна (verified Anthropic docs April 2026)

| Модель | ID | Context | Input $/M | Output $/M | Cache read | Cache write (5m) |
|--------|-----|---------|-----------|------------|------------|------------------|
| Haiku 4.5 | claude-haiku-4-5-20251001 | 200K | $1 | $5 | $0.10 | $1.25 |
| Sonnet 4.6 | claude-sonnet-4-6 | 1M | $3 | $15 | $0.30 | $3.75 |
| Opus 4.6 | claude-opus-4-6 | 1M | $5 | $25 | $0.50 | $6.25 |

Sonnet/Opus 4.6: 1M **native** (no beta flag). Flat pricing across full window.

Source: platform.claude.com/docs/en/about-claude/models/overview (verified 2026-04-06).
