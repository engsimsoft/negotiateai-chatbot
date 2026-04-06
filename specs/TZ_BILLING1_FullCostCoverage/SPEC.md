# ТЗ-BILLING1: Full Cost Coverage

**Дата:** 2026-04-06
**Приоритет:** Высокий (блокирует запуск pay-as-you-go)
**Версия проекта:** 3.67.0 → 3.68.0

---

## Контекст

ТЗ-TOKENS1 (v3.67.0) закрыл учёт расходов для основных чатов (Claude models). Однако в системе есть 2 платных провайдера, чьи расходы **не логируются или логируются частично** при использовании в основном чате:

1. **Deepgram nova-3 (voice-to-text)** — WebSocket из браузера, $0.0043/мин. Длительность записи не отправляется на сервер → расход не в `ai_usage_log`.

2. **Gemini 2.5 Flash (Vision OCR)** — обработка загруженных фото/PDF. Логируется через `logUsage()`, но **только если передан userId**. Нужна проверка всех callsites.

При масштабе (1000+ пользователей, pay-as-you-go):
- Deepgram: 50 мин/день × 30 дней × $0.0043/мин = **$6.45/мес на пользователя** — прямой убыток без учёта
- Vision OCR: ~$0.01-0.05 за фото, при активном использовании $1-3/мес — теряем margin

## Цель

**Каждый платный API-вызов в режиме чата логируется в `ai_usage_log` с корректным `costUsd`.** Ноль слепых зон для платных провайдеров.

## Требования

### R1: Deepgram usage logging в чате

**Сейчас:** WebSocket Deepgram открывается напрямую из браузера (`use-voice-recorder.ts`). Сервер не знает длительность записи. Формула `calculateDeepgramCostUsd()` существует в `providers.ts`, но вызывается только в meeting pipeline.

**Нужно:** После завершения голосовой записи — отправить `durationSeconds` на сервер → `logUsage()` с `costUsdOverride`.

**Поток:**
```
use-voice-recorder.ts → onRecordingEnd(durationSeconds)
  → POST /api/deepgram/usage { durationSeconds, chatId }
  → logUsage({ chatMode: "tool:voice-input", modelId: "deepgram-nova-3", costUsdOverride })
```

### R2: Vision OCR — гарантированный userId

**Сейчас:** `processImageOCR()` / `processPdfOCR()` в `vision-ocr.ts` вызывает `logUsage()` с optional `userId`. Если userId не передан — запись в лог не создаётся.

**Нужно:** Проверить все callsites в 3 chat routes + tool implementations. Убедиться что userId из сессии ВСЕГДА передаётся.

### R3: Coverage audit в admin dashboard

**Нужно:** На странице `/admin/cost-audit` — индикатор полноты покрытия. Если за период есть вызовы провайдеров без соответствующих записей в `ai_usage_log` — показать warning.

## Scope

### Входит
- Deepgram в чате (voice input)
- Vision OCR (фото/PDF в чате)
- Проверка coverage в admin UI

### НЕ входит
- Brave Search (free tier)
- Jina Reader (free tier)
- Open-Meteo (бесплатно)
- Telegram (бесплатно)
- ExcelJS (локально)
- Pipelines (briefing, meeting, podcast) — отдельное ТЗ
