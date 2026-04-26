# ТЗ-BriefingMiniMaxHang — silent hang briefing:author/section на AI SDK 6.0.168

**Статус:** Хвост, **High impact** (briefing полностью неработоспособен в production)
**Создано:** 2026-04-26 в ходе мануального тестирования ТЗ-BriefingStuckRecovery
**Связано с:**
- [lib/briefing/briefing-author.ts:210](../../lib/briefing/briefing-author.ts#L210)
- [lib/briefing/briefing-section-author.ts:189](../../lib/briefing/briefing-section-author.ts#L189)
- [lib/ai/registry.ts:42](../../lib/ai/registry.ts#L42) (`minimaxLong` factory с AbortSignal.timeout(180_000))
- [lib/ai/getModel.ts:124](../../lib/ai/getModel.ts#L124) (резолв `MiniMax-M2.7-long` → `minimaxLong:`)
- `package.json`: `ai@^6.0.116` (installed 6.0.168 после коммита `97af934` 2026-04-23)
- `vercel-minimax-ai-provider@^0.0.2`
- Полная диагностика — [AUDIT_BRIEFING.md § 4.1](../_archive/TZ_BriefingStuckRecovery/AUDIT_BRIEFING.md)

---

## Симптом

Pipeline briefing после filter-stage логирует `[Briefing] Full text hit: N/N candidates` и `[Briefing] volume: standard`, после чего наступает тишина. Запрос висит >11 минут (было замерено 26 апреля), не возвращается, не таймаутит. AbortSignal.timeout(180_000) в `minimaxLong`-фабрике не срабатывает.

В `ai_usage_log` за период 2026-04-23..2026-04-26 — НИ ОДНОГО успешного `briefing:author` или `briefing:section` вызова. Последний успех: 2026-04-23 19:04 UTC, durationMs=162161 (162с — близко к timeout, но в пределах).

После апгрейда `ai@6.0.116 → 6.0.168` (commit `97af934` 2026-04-23, фикс для xAI зависания Экспертизы) — briefing встал.

## Корневая причина — гипотеза

MiniMax M2.7 — reasoning-модель, отдаёт ответ через Anthropic-protocol с блоком `thinking`:

```json
{"content": [
  {"thinking": "...", "signature": "...", "type": "thinking"},
  {"text": "...", "type": "text"}
]}
```

Это подтверждено прямым `curl` на `https://api.minimax.io/anthropic/v1/messages` — HTTP 200 за 6.4с, ответ корректный. **API живой, ключ валиден, сетка работает.**

`vercel-minimax-ai-provider@0.0.2` правильно пробрасывает `fetch` опцию (проверено grep'ом по `node_modules/vercel-minimax-ai-provider/dist/index.js` — находит `fetch: options.fetch` и `fetch: this.config.fetch`).

Гипотеза: апгрейд `ai@6.0.168` сломал парсинг Anthropic-protocol stream с reasoning-chunks. Stream приходит, но `streamText`'s `await res.text` ждёт неприходящего close-события или зацикливается на reasoning-block reconciliation — отсюда отсутствие срабатывания AbortSignal.

Похожий паттерн уже наблюдался на xAI reasoning-моделях (см. `TZ_ExpertiseReasoningRestore` и `feedback_sdk_regression_check` в памяти владельца) — апгрейды `ai` SDK ломают reasoning streams на разных провайдерах.

## Что пробовали (валидирующая работа в ходе диагностики 2026-04-26)

1. **Прямой curl на MiniMax API** → HTTP 200 за 6.4с, ответ с reasoning + text. ✅ API живой.
2. **Inspect provider package** → `fetch` пробрасывается корректно. ✅ Provider OK.
3. **Override briefing:author/section на Grok 4.1 Fast non-reasoning через `.simply-dev-overrees.json`** → pipeline проходит за 37-39с, ✅ — это подтверждает что проблема в связке `MiniMax + AI SDK 6.0.168`, а НЕ в коде briefing-pipeline.

Override откачен по требованию владельца — production остаётся на MiniMax-M2.7-long.

## Варианты решения (для будущего ТЗ)

### 1. Downgrade `ai` до 6.0.116 (быстро, но регресс)

Откатывает фикс xAI зависания Экспертизы из коммита `97af934`. Не вариант без альтернативного фикса для xAI.

### 2. Upgrade `vercel-minimax-ai-provider` до latest (рекомендую первым)

В проекте `vercel-minimax-ai-provider@^0.0.2` — это alpha-prototype. Возможно есть свежие версии совместимые с `ai@6.0.168`. Проверить `npm info vercel-minimax-ai-provider versions`. Если есть 0.0.3+ — попробовать.

### 3. Миграция `briefing:author`/`section` на Grok (как `briefing:filter`)

Изменить в [lib/ai/task-assignments.ts:191-192](../../lib/ai/task-assignments.ts#L191):
```ts
"briefing:author":  "grok-4-1-fast-non-reasoning"   (было MiniMax-M2.7-long)
"briefing:section": "grok-4-1-fast-non-reasoning"
```

Это **разблокированная миграция** с 2026-04-16 (см. ROADMAP TЗ-XAI-XAI-6 хвост). Тест 26 апреля показал: 37-39с pipeline, качество секций OK (4 секции, 6 items, 16K токенов).

Минусы: требует тестирования качества выхода Author на Grok (verbosity/style). Author-промпт писан под MiniMax-style.

### 4. Изолированный reproducer + bug report Vercel

Минимальный скрипт `scripts/repro-minimax-hang.ts`: `streamText` → MiniMax-M2.7-long с реальным briefing-author промптом. Если воспроизводится — открыть issue в `vercel/ai`. Параллельно — issue в `vercel-minimax-ai-provider` (если есть upstream maintenance).

## Acceptance criteria

- [ ] Briefing генерируется в production за разумное время (<3 мин полного pipeline'а)
- [ ] В `ai_usage_log` появляются записи `briefing:author` со status success
- [ ] Watchdog ТЗ-BriefingStuckRecovery остаётся как страховка, но больше не срабатывает на каждый прогон
- [ ] `npx tsc --noEmit` зелёный
- [ ] Если выбран вариант 3 (миграция на Grok) — обновить [docs/ai-chats-map.md](../../docs/ai-chats-map.md)

## НЕ в scope

- Архитектурный пересмотр briefing pipeline (single-shot vs multi-stage)
- Замена MiniMax другими провайдерами кроме Grok
- Перепроектирование topics-catalog или source-fetchers

## Оценка

**0.5-1 сессия.** Самый дешёвый путь — Вариант 3 (миграция на Grok, ~30 мин) — мы уже видели что Grok работает.
Параллельно — вариант 2 (попробовать апгрейд провайдера, ~15 мин).
Вариант 1 откладываем до закрытия `TZ_ExpertiseReasoningRestore`.
