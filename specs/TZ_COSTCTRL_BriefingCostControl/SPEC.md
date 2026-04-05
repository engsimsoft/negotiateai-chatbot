# ТЗ-COSTCTRL: Briefing Cost Control — Invariants, Fail-Fast, Observability

**Версия проекта:** 3.65.0 → 3.66.0
**Приоритет:** 🔴 CRITICAL — активная утечка денег на production
**Тип:** Bugfix + Architecture refactor (одним пакетом)

---

## Контекст — как нашли проблему

**Наблюдение пользователя:** ~$0.10/день списывается с Anthropic API без взаимодействия с приложением.

**Аудит (все факты из БД production):**

| Юзер | deliveryEnabled | TelegramConnection | Последний брифинг |
|------|-----------------|-------------------|-------------------|
| julia@family.local | false (выкл 2026-03-09) | ✅ isActive | 2026-03-09 |
| vladimir@family.local | **true** | **❌ отсутствует** | **2026-04-05 (ежедневно)** |

**4 вложенных дефекта:**

1. **Mouse-trap в UI**: `<Switch disabled={!telegramOk || saving}>` блокирует тоггл когда `deliveryEnabled=true` и нет Telegram. Пользователь не может выключить через UI.

2. **Cron без fail-fast**: `runBriefingPipeline()` (генерация статьи Claude Sonnet) + `runPodcastPipeline()` (Gemini Flash + TTS) выполняются **до** проверки `getTelegramConnection()`. Каждое утро тратит ~$0.15 на undeliverable content.

3. **Fire-and-forget logUsage в cron**: `logUsage(...)` вызывается без `await` в 6 местах. В Vercel Serverless контейнер замораживается после `Response.json()` → inserts в `ai_usage_log` теряются. С 2026-03-10 по 2026-04-05 — **0 записей** для `briefing:*` / `podcast:*`, хотя брифинги генерировались. Расходы невидимы в аудите.

4. **costUsd=NULL в 17 записях**: Gemini 2.0/2.5 Flash, Gemini TTS, Deepgram не покрыты TokenLens catalog, нет hardcoded fallback → `calcCostUsd()` возвращает `null` → в БД пишется NULL → при суммировании эти вызовы не учитываются.

**Суммарный эффект:** Система тратит деньги на непригодный к доставке контент, не логирует эти расходы, при этом UX не даёт остановить утечку.

---

## Философия фикса

**Не точечные заплатки** — каждый дефект выше это симптом **архитектурной проблемы**, которые надо устранить на уровне инвариантов:

| Симптом | Корневая причина |
|---------|------------------|
| #1 Mouse-trap | State invariant не enforced: `deliveryEnabled=true ⇒ TelegramConnection must exist` позволено системой |
| #2 Cron тратит впустую | Pipeline не соблюдает "fail-fast": expensive work до валидации prerequisites |
| #3 Fire-and-forget | Неправильный async pattern для serverless (не использует `waitUntil`) |
| #4 NULL costUsd | Pricing coverage неполная, нет гарантии "every AI call has a cost estimate" |

---

## Инварианты системы (enforced)

### Инвариант 1: Delivery coherence
> `BriefingSettings.deliveryEnabled=true` **требует** существования активной `TelegramConnection` для того же `userId`.

Точки enforcement:
- **Service layer** (`lib/briefing/delivery-service.ts`) — единственная точка изменения `deliveryEnabled`
- **API PATCH /api/briefing/delivery** — возвращает 409 Conflict при нарушении
- **Cascade** — при `DELETE /api/telegram/link` автоматически `deliveryEnabled=false`
- **Migration** — при деплое все невалидные комбинации автоматически исправляются

### Инвариант 2: Deliverability pre-check
> Cron **обязан** проверить pre-conditions (TelegramConnection, BriefingSettings валидны) **до** любого AI-вызова.

Точки enforcement:
- **Cron handler** делает pre-flight check → пропускает user и логирует reason
- **getUsersForDelivery()** JOIN-ит TelegramConnection, возвращает только deliverable users

### Инвариант 3: Guaranteed usage logging
> Каждый AI-вызов гарантированно пишет запись в `ai_usage_log` перед завершением request/cron.

Точки enforcement:
- **`waitUntil`** из `@vercel/functions` для всех fire-and-forget `logUsage`
- **Batch insert** в конце `runBriefingPipeline()` как альтернатива
- **Retention log** — `cron_run_log` таблица с summary каждого cron invocation

### Инвариант 4: Non-null cost
> `ai_usage_log.costUsd` **никогда не NULL** для успешных AI-вызовов.

Точки enforcement:
- **`calcCostUsd()`** fallback chain: TokenLens → `MODEL_PRICING_RUB` → `costRub / RUB_PER_USD`
- **MODEL_PRICING_RUB** покрывает все используемые в проекте провайдеры (Anthropic, Google, Perplexity, Deepgram)

---

## Scope — что делаем

### Phase 0: Emergency data repair (немедленно, отдельный коммит)

Разовая SQL-миграция: найти и исправить все невалидные состояния в production БД.

```sql
-- Отключить delivery для юзеров без активного TelegramConnection
UPDATE "BriefingSettings"
SET "deliveryEnabled" = false, "updatedAt" = NOW()
WHERE "deliveryEnabled" = true
  AND "userId" NOT IN (
    SELECT "userId" FROM "TelegramConnection" WHERE "isActive" = true
  );
```

Запускается **до** деплоя нового кода через `npm run db:studio` или SQL migration file.

**Результат:** Утечка остановлена немедленно, без ожидания деплоя.

---

### Phase 1: Service layer + invariant enforcement

**Новый файл: `lib/briefing/delivery-service.ts`**

```typescript
// Single point of truth for briefing delivery state changes
export async function setBriefingDelivery({
  userId,
  enabled,
  format,
  time,
  timezone,
}: {
  userId: string;
  enabled?: boolean;
  format?: string;
  time?: string;
  timezone?: string;
}): Promise<
  | { ok: true; settings: BriefingSettings }
  | { ok: false; code: "telegram_required" | "invalid_format" | "invalid_time" }
> {
  // Invariant 1: enabling requires active Telegram
  if (enabled === true) {
    const tg = await getTelegramConnection({ userId });
    if (!tg || !tg.isActive) {
      return { ok: false, code: "telegram_required" };
    }
  }

  // Disabling is always allowed (escape hatch)
  const settings = await upsertBriefingSettings({ userId, deliveryEnabled: enabled, ... });
  return { ok: true, settings };
}

// Cascade: called from DELETE /api/telegram/link
export async function disableDeliveryOnTelegramDisconnect(userId: string): Promise<void> {
  await upsertBriefingSettings({ userId, deliveryEnabled: false });
}
```

**API `/api/briefing/delivery` PATCH:**
- Заменить прямой `upsertBriefingSettings` на `setBriefingDelivery`
- При `telegram_required` → `409 Conflict` с JSON `{ error: "telegram_required", message: "..." }`

**API `/api/telegram/link` DELETE:**
- После успешного отключения Telegram → `disableDeliveryOnTelegramDisconnect(userId)`

---

### Phase 2: UI state machine fix

**`components/briefing/briefing-delivery-settings.tsx`:**

```typescript
// Escape hatch: turning OFF always allowed
// Turning ON requires Telegram connection
const toggleDisabled = saving || (!telegramOk && !enabled);

// Time/format controls: disabled when delivery is off OR saving
const controlsDisabled = !enabled || saving;
```

UX: Если юзер пытается включить тоггл без Telegram → toast с CTA "Подключить Telegram" (ссылка на /settings).

**Обработка ошибки от API:**
```typescript
if (res.status === 409) {
  const err = await res.json();
  if (err.error === "telegram_required") {
    toast({ type: "error", description: "Подключите Telegram в настройках" });
    setEnabled(false);  // revert optimistic
    return;
  }
}
```

---

### Phase 3: Fail-fast cron pipeline

**`app/api/cron/briefing/route.ts`:**

Изменить порядок в `generateAndDeliver(userId, format)`:

```typescript
async function generateAndDeliver(userId, format) {
  // Pre-flight 1: Telegram connection
  const tg = await getTelegramConnection({ userId });
  if (!tg || !tg.isActive) {
    console.warn(`[cron/briefing] User ${userId}: no Telegram — skipping (invariant violation)`);
    // Auto-repair: disable delivery to prevent future wasted work
    await upsertBriefingSettings({ userId, deliveryEnabled: false });
    return { userId, status: "skipped_no_telegram" };
  }

  // Pre-flight 2: Idempotency (уже есть)
  const existing = await getBriefingHistory({ userId, limit: 1, status: "ready" });
  if (existing.length > 0 && existing[0].generatedAt >= todayStart) {
    return { userId, status: "skipped_idempotent" };
  }

  // Only now: expensive pipeline
  const result = await runBriefingPipeline({ userId });
  // ... rest unchanged
}
```

**Дополнительно:** `getUsersForDelivery()` делает `INNER JOIN` на `TelegramConnection.isActive=true` — возвращает только deliverable users. Pre-flight в cron остаётся как defense-in-depth.

---

### Phase 4: Guaranteed usage logging

**Вариант: `waitUntil` из `@vercel/functions`**

```typescript
import { waitUntil } from "@vercel/functions";

// Было:
logUsage({...});  // fire-and-forget

// Стало:
waitUntil(logUsage({...}));
```

Изменить в 6 call-sites:
- `lib/briefing/briefing-author.ts:214`
- `lib/briefing/briefing-filter.ts:120`
- `lib/briefing/briefing-section-author.ts:180`
- `lib/podcast/script-generator.ts:145`
- `lib/podcast/tts-gemini.ts:82, 116`

**Новая таблица: `cron_run_log`**

```typescript
export const cronRunLog = pgTable("cron_run_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  cronPath: varchar("cronPath", { length: 100 }).notNull(),  // "/api/cron/briefing"
  invokedAt: timestamp("invokedAt").notNull().defaultNow(),
  usersFound: integer("usersFound").notNull().default(0),
  usersProcessed: integer("usersProcessed").notNull().default(0),
  usersSkipped: integer("usersSkipped").notNull().default(0),
  totalCostUsd: numeric("totalCostUsd", { precision: 10, scale: 6 }),
  totalDurationMs: integer("totalDurationMs"),
  errors: jsonb("errors"),  // array of {userId, error}
  results: jsonb("results"),  // full results array for forensics
});
```

В конце cron handler — `await insertCronRunLog({...})` (обязательно с `await`, не fire-and-forget).

---

### Phase 5: Complete cost coverage

**`lib/ai/providers.ts` → `MODEL_PRICING_RUB`:**

```typescript
const MODEL_PRICING_RUB: Record<string, ModelPricing> = {
  // Anthropic (existing) ...
  // Google Gemini (existing) ...

  // Google Gemini TTS ($4/1M chars. Avg ~15 chars/sec. $0.06/1K audio-sec)
  "gemini-2.5-flash-preview-tts": { input: 0, output: 0.6, cached: 0 },  // billed by chars, approximate

  // Perplexity (add all variants)
  "sonar-deep-research": { input: 0.20, output: 0.80, cached: 0 },  // $2/1M in, $8/1M out

  // Deepgram Nova-3 ($0.0043/minute → ~$0.258/hour)
  "deepgram-nova-3": { input: 0, output: 0, cached: 0 },  // billed by audio-seconds, not tokens — handled separately
};
```

**`lib/ai/tokenlens-catalog.ts` → `calcCostUsd()` fallback chain:**

```typescript
export async function calcCostUsd(modelId: string, usage: LanguageModelUsage): Promise<number | null> {
  // 1. Try TokenLens (live prices)
  const tlCost = tryTokenLens(modelId, usage);
  if (tlCost != null) return tlCost;

  // 2. Fallback: hardcoded RUB table / RUB_PER_USD
  const pricing = MODEL_PRICING_RUB[modelId];
  if (!pricing) {
    console.warn(`[calcCostUsd] No pricing for modelId=${modelId}`);
    return null;  // only fail when truly unknown model
  }

  const costRub = calculateCostRub(modelId, {
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
  });
  return costRub / RUB_PER_USD;
}
```

**Deepgram + TTS** — отдельные helpers для non-token pricing:
- `calculateDeepgramCostUsd(audioSeconds)` — $0.0043/minute
- `calculateTtsCostUsd(audioSeconds)` — используем существующий `calculateTtsCostRub` и делим на `RUB_PER_USD`

Заменить вызовы `logUsage` для Deepgram/TTS на вариант с `costUsdOverride` параметром.

---

### Phase 6: Admin cost audit endpoint

**Новый route: `/api/admin/cost-audit` (только для dev mode или admin)**

Возвращает JSON:
```json
{
  "invalidStateUsers": [
    {"userId": "...", "deliveryEnabled": true, "telegramConnected": false}
  ],
  "lastCronRuns": [...],
  "costByDay": [{"day": "2026-04-05", "totalUsd": 0.1234, "records": 17}],
  "costByChatMode": [{"chatMode": "briefing:author", "totalUsd": 0.0987}],
  "nullCostRecords": [{"modelId": "...", "chatMode": "...", "count": 13}]
}
```

Используется в будущем для мониторинга + CI-алертов.

---

## Что **НЕ** делаем в этом ТЗ

- Не меняем tier/модели (AUTHOR_MODEL, FILTER_MODEL остаются Claude Sonnet + Gemini Flash)
- Не трогаем podcast pipeline кроме добавления `waitUntil`
- Не делаем полноценный admin dashboard — только endpoint для аудита
- Не меняем `TelegramConnection` схему — cascade только logical, не FK

---

## Тестирование

### Автоматические проверки
- `tsc --noEmit` — 0 ошибок
- `npm run build` — успешен
- SQL-миграция проверяет invariants после Phase 0

### Мануальные сценарии (после Phase 1-2)
1. **Включить delivery без Telegram** → PATCH возвращает 409, UI показывает toast
2. **Выключить delivery без Telegram** (существующий невалидный state) → PATCH проходит, UI работает
3. **Отключить Telegram** → cascade: `deliveryEnabled` становится `false`
4. **Cron run** (с симуляцией: `curl -H "Authorization: Bearer $CRON_SECRET" /api/cron/briefing`) → если все skipped, логи чёткие

### Метрики после Phase 3-4
- `cron_run_log` содержит запись по каждому cron invocation
- `ai_usage_log.costUsd IS NULL` count уменьшается до 0 (для новых записей)
- `briefing:*` / `podcast:*` записи появляются в `ai_usage_log` после cron

---

## Ожидаемый результат

| До | После |
|----|-------|
| $0.15/день на недоставленный контент | $0 (fail-fast skip) |
| 0 записей в `ai_usage_log` из cron | 1 запись на каждый AI-вызов в cron |
| 17 записей с `costUsd=NULL` | 0 (full coverage) |
| Нельзя выключить delivery без Telegram | Можно всегда |
| Нет history of cron runs | `cron_run_log` с полным forensics |
| Hidden state bugs | `/api/admin/cost-audit` показывает все инварианты |

---

## Git strategy

7 коммитов (по одному на фазу) + финальный `chore` с документацией:

```
feat(tz-costctrl-p0): data repair migration — disable delivery for users without Telegram
feat(tz-costctrl-p1): delivery service + API invariant enforcement
feat(tz-costctrl-p2): UI state machine — escape hatch for disabled telegram users
feat(tz-costctrl-p3): fail-fast cron pre-flight checks
feat(tz-costctrl-p4): guaranteed usage logging via waitUntil + cron_run_log
feat(tz-costctrl-p5): complete cost coverage — MODEL_PRICING_RUB + calcCostUsd fallback
feat(tz-costctrl-p6): admin cost audit endpoint
chore(tz-costctrl): finalization — docs, version bump 3.65.0 → 3.66.0
```

**Phase 0 может быть выполнена немедленно, отдельно от остальных фаз.**
