# TZ_SimplyChatBillingLeak

**Impact:** 🟥 critical — реальные деньги. xAI Grok 4.1 Fast: 94K input × $0.20/M = $0.019 за каждый короткий turn. И каждый следующий turn — ещё больше, цена растёт нелинейно.
**Создано:** 2026-04-28 при разборе TZ_SimplyChatLoadPerf — найдены реальные цифры из `ai_usage_log`.
**Связано:** `TZ_EstimatorIgnoresAttachments` (backlog) — расхождение estimator'а и реального provider count. Возможно общий root cause.

## Факты (из БД `ai_usage_log` для Simply chat `3353a183`)

| createdAt | input | cache_read | output | thinking | Что было в turn'e |
|---|---|---|---|---|---|
| 08:55:43 | **1524** | 160 | 99 | 0 | «Привет» — все 342 старых extracted=true, прошла compaction |
| 08:56:42 | **54313** | 160 | 141 | 0 | «PDF вал» — добавлен файл, PDF парсится как ~50K токенов |
| **10:22:45** | **94014** | 160 | 154 | 0 | «Хотел узнать сколько токенов» — короткий текст, +40K из ниоткуда |

**Причина критическая:**

1. **+40K на одном коротком turn'e между 08:56 (54K) и 10:22 (94K)** — в `Message_v2` за это время **не появилось ни одного нового сообщения**. Должно было быть 54K + 32 + ~assistant ≈ 54.5K. Получили 94K. **+40K влилось до того как модель что-либо вернула** (output всего 154 токена) → не от модели, а из payload.

2. **`cacheReadTokens = 160` на каждом turn'e** — при том что v3.100.1 + ADR-057 чинили xAI prompt cache prefix stability. Сейчас факт: кеш отдаёт только baseline 160 токенов, история не кешируется. Каждый turn оплачивается **полностью** заново.

3. Владелец сообщил что **скачок происходит за одно сообщение** (быстрый последовательный тест: первое короткое → 54K, следующее короткое в той же сессии → 94K). Не «накопление за час». Это означает что что-то **на каждом turn'e заново раздувает payload**, а не однократный леак.

## Гипотезы (по убыванию вероятности)

| # | Гипотеза | Чем подтвердить |
|---|---|---|
| H1 | **Повторный парсинг PDF в payload каждый turn.** PDF из msg `91d3b122` сидит в визуальном окне, на каждом turn'е заново уходит в xAI и платится как ~30-50K токенов | diag-log: размер attachments-converted части |
| H2 | **MIND retrieve injection** в system prompt без лимита. Voyage embedding делается каждый turn (видим `voyage-4` записи в ai_usage_log), результаты складываются в system → раздувает на 30-40K | diag-log: размер mind-injection части |
| H3 | **Compaction summary разросся / удваивается** между turn'ами | `LENGTH("compactionSummary")` сейчас = 6916 chars (~1.5K токенов) — гипотеза слабая |
| H4 | **Tools schema раздулся** (новые tools / большой description) | diag-log: размер tools schema |
| H5 | **Картинки / blob URLs** в history — `chat-history v3.100.3` чинил, регрессия | grep `parts::text` на blob URLs в visible window |
| H6 | **Prompt cache prefix instability (регрессия ADR-057)** объясняет cache_read=160 — может быть связано с любым из H1-H5 (если что-то меняется turn-to-turn в начале prompt → cache invalidates) | diag-log: byte-diff system prompt между двумя turn'ами одного чата |

## Цели (что должны достичь)

1. Найти **точную причину** +40K на коротком turn'e (одна из H1-H5 либо комбинация).
2. Восстановить **prompt cache hit rate** (cacheReadTokens должен быть >> 160 на коротких турнах в длинной истории).
3. Зафиксировать в коде защиту: лимиты на mind-injection, явная обработка attachments в history (один раз парсить, потом по reference / extracted text).

## Метрики «решено»

- На Simply chat `3353a183` после фикса: следующий короткий turn даёт **input ≈ предыдущий input + 200 токенов** (длина короткого вопроса + ответа), не +5K и не +40K.
- `cacheReadTokens >= input * 0.7` на коротких турнах в длинной истории (xAI кеширует префикс).
- Один turn в pristine короткой истории не превышает 2K input.

## Out of scope

- TTI оптимизации (это `TZ_SimplyChatLoadPerf`, заморожен на время этого ТЗ).
- Глобальный рефакторинг estimator'а под все типы вложений (это `TZ_EstimatorIgnoresAttachments` в backlog — возможно подхватится в финализации).
- xAI compaction tuning — отдельная тема.

## План диагностики (Фаза 1 → ANALYSIS.md)

1. Добавить **временный** diag-log в [app/(chat)/api/chat/route.ts](../../app/(chat)/api/chat/route.ts) ПЕРЕД вызовом `streamText`, который выводит размеры (chars и токены-оценка) каждой части prompt:
   - system prompt
   - tools schema (JSON)
   - compaction summary
   - mind retrieve injection
   - history messages (count + total bytes)
   - attachments converted (PDF/image refs)
2. Один turn в Simply chat — короткий вопрос. Прочитать diag-log, сравнить с input от провайдера (94K).
3. Удалить diag-log сразу после установления виновника.
4. Записать в ANALYSIS.md конкретный root cause + предлагаемое решение.

## Файлы (предполагаемые при внедрении фикса)

- `app/(chat)/api/chat/route.ts` — место где собирается prompt, скорее всего фикс здесь
- `lib/ai/memory/retrieve.ts` (или подобное) — если виновник MIND
- `lib/ai/compaction/prepare-messages.ts` — если виновник compaction logic
- `lib/prompts/...` — если виновник system prompt раздулся
- `lib/ai/tools/...` — если виновник tools schema
- Возможно отдельный helper для file/image handling в history

## Связанные документы

- ADR-057 [docs/decisions/057-...] (xAI prompt cache prefix stability) — referенс что цель.
- [_backlog/TZ_EstimatorIgnoresAttachments.md](../_backlog/TZ_EstimatorIgnoresAttachments.md) — родственный долг, может быть один root cause.
- [TZ_SimplyChatLoadPerf](../TZ_SimplyChatLoadPerf/SPEC.md) — заморожен на время этого ТЗ.
