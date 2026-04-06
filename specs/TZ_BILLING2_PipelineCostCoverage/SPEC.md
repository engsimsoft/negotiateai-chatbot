# ТЗ-BILLING2: Pipeline Cost Coverage (Briefing + Podcast)

**Дата:** 2026-04-06
**Приоритет:** Высокий (блокирует pay-as-you-go)
**Версия проекта:** 3.68.0 → 3.69.0

---

## Контекст

ТЗ-TOKENS1 (v3.67.0) и ТЗ-BILLING1 (v3.68.0) закрыли учёт расходов для основного чата. Остались **pipeline-сервисы** — briefing и podcast — которые используют несколько моделей от разных провайдеров.

## Карта AI-вызовов в pipelines

### Briefing Pipeline

| # | Стадия | Модель | Провайдер | logUsage? | costUsd в БД? |
|---|--------|--------|-----------|-----------|---------------|
| 1 | **Filter** | `gemini-2.0-flash` | Google | ✅ Есть | ❌ **NULL** (известный баг) |
| 2 | **Author** | `claude-sonnet-4-6` | Anthropic | ✅ Есть | ✅ OK |
| 3 | **Author fallback** | `claude-sonnet-4-5-20250929` | Anthropic | ✅ Есть | ✅ OK |
| 4 | **Section Author** | `claude-sonnet-4-6` | Anthropic | ✅ Есть | ✅ OK |
| 5 | **Research** | `sonar-pro` (Perplexity) | Perplexity | ❌ **НЕТ** | ❌ **Не логируется** |

### Podcast Pipeline

| # | Стадия | Модель | Провайдер | logUsage? | costUsd в БД? |
|---|--------|--------|-----------|-----------|---------------|
| 6 | **Script** | `gemini-2.5-flash` | Google | ✅ Есть | ✅ OK |
| 7 | **TTS** | `gemini-2.5-flash-preview-tts` | Google | ✅ Есть (costUsdOverride) | ✅ OK |

### Бесплатные стадии (не требуют учёта)

- RSS fetch, Telegram fetch, Web fetch (Readability/Jina) — бесплатно
- Audio converter (lamejs, локально) — бесплатно
- Audio merger (MP3 concat + Blob upload) — бесплатно

## Проблемы

### P1: briefing:filter — NULL costUsd
`briefing-filter.ts` вызывает `logUsage()` с Gemini usage, но `calcCostUsd()` возвращает NULL. Вероятная причина: modelId передаётся в формате, не совпадающем с ключами `MODEL_PRICING_RUB`.

### P2: research-engine — Perplexity не логируется
`research-engine.ts` вызывает `callPerplexity()` и строит `AiCallTrace`, но **не вызывает `logUsage()`**. Расход Perplexity виден только в pipeline-trace (DevPanel), но не в `ai_usage_log` → не будет в биллинге.

## Цель

Все 7 AI-вызовов в briefing+podcast pipeline логируются в `ai_usage_log` с корректным `costUsd ≠ NULL`.

## Scope

### Входит
- Fix NULL costUsd для briefing:filter (Gemini 2.0 Flash)
- Добавить logUsage для research-engine (Perplexity sonar-pro)
- Верификация всех остальных стадий (author, section-author, script, TTS)

### НЕ входит
- Meeting pipeline (отдельный scope)
- Project pipelines (professor, clerk, expert)
