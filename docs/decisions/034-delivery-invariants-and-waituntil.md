# ADR 034: Delivery Invariants, waitUntil, and Cost Coverage (ТЗ-COSTCTRL)

**Дата:** 2026-04-05
**Статус:** Принято
**Версия:** 3.66.0

---

## Контекст

Обнаружены 4 дефекта в briefing/podcast cron подсистеме:

1. **Money leak** — cron запускал AI-pipeline для юзеров у которых `deliveryEnabled=true` но нет активного Telegram. AI вызовы происходили, данные никуда не доставлялись.
2. **Потеря usage логов** — `logUsage()` вызывался без `waitUntil` на Vercel serverless. Функция завершалась до записи в БД.
3. **NULL costUsd** — Deepgram и Gemini TTS не имеют token-based pricing, `calcCostUsd()` возвращал null.
4. **Mouse-trap в UI** — после отключения Telegram switch доставки нельзя было выключить.

## Решение

### Инвариант 1: deliveryEnabled требует активный Telegram

Единая точка мутации `deliveryEnabled` — `lib/briefing/delivery-service.ts`:
- `setBriefingDelivery(userId, enabled)` — проверяет TelegramConnection.isActive перед включением
- `disableDeliveryOnTelegramDisconnect(userId)` — cascade при DELETE /telegram/link
- API возвращает 409 при нарушении инварианта

### Инвариант 2: Cron — fail-fast перед AI

`getUsersForDelivery()` использует INNER JOIN на `TelegramConnection.isActive=true` — invalid users физически не попадают в выборку. Defense-in-depth: pre-flight check в cron handler с auto-repair.

### waitUntil для usage logging

В Vercel serverless без `waitUntil` fire-and-forget промисы обрываются при завершении Response. Все 6 call-sites `logUsage()` в cron/background контекстах обёрнуты в `waitUntil()`.

### costUsdOverride для non-token провайдеров

Добавлен `costUsdOverride?: number` в `LogUsageInput`. Провайдеры с character/time-based pricing передают точную стоимость:
- Deepgram Nova-3: `calculateDeepgramCostUsd(audioSeconds)` — $0.0043/min
- Gemini TTS: `calculateGeminiTtsCostUsd(charCount)` — $4/1M chars

`calcCostUsd()` получил fallback chain: TokenLens → MODEL_PRICING_RUB → null.

### UI escape hatch

Switch "Доставка" always-disableable: `disabled={saving || (!telegramOk && !enabled)}`. Tooltip при попытке включить без Telegram. 409 response → toast + revert optimistic state.

## Последствия

- Cron никогда не тратит AI на undeliverable users
- Каждый cron run оставляет запись в `CronRunLog` для forensics
- `costUsd IS NULL` для новых записей = 0 (100% coverage)
- Admin dashboard `/admin/cost-audit` для мониторинга (gated by dev mode)
