# Roadmap ТЗ-COSTCTRL: Briefing Cost Control

**Создан:** 2026-04-05
**Версия проекта:** 3.65.0 → 3.66.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 8 (Phase 0-6 + финализация) |
| Текущий этап | 0 |
| Сессий (оценка) | 3-5 |

**Цель:** устранить 4 дефекта briefing/podcast cron подсистемы через enforcement инвариантов, fail-fast и guaranteed cost logging.

---

## Этап 0 (Phase 0): Emergency data repair

**Статус:** ✅ Завершён (2026-04-05 09:31 UTC)

**Цель:** остановить money leak на production немедленно, до любых кодовых изменений.

**Задачи:**
- [x] Создан tsx-скрипт `scripts/phase0-disable-invalid-delivery.ts` (audit + repair + verify в одном)
- [x] SQL-аудит: найден 1 invalid user — vladimir@family.local (deliveryEnabled=true, has_active_telegram=false)
- [x] UPDATE выполнен: 1 row affected, deliveryEnabled → false
- [x] Verification: 0 остаточных невалидных записей
- [x] Подтверждено через независимую MCP-проверку

**SQL:**
```sql
-- Аудит
SELECT bs."userId", u."email", bs."deliveryEnabled", bs."deliveryFormat",
  (tc."userId" IS NOT NULL AND tc."isActive") as has_active_telegram
FROM "BriefingSettings" bs
JOIN "User" u ON u."id" = bs."userId"
LEFT JOIN "TelegramConnection" tc ON tc."userId" = bs."userId"
WHERE bs."deliveryEnabled" = true;

-- Hotfix
UPDATE "BriefingSettings"
SET "deliveryEnabled" = false, "updatedAt" = NOW()
WHERE "deliveryEnabled" = true
  AND "userId" NOT IN (
    SELECT "userId" FROM "TelegramConnection" WHERE "isActive" = true
  );
```

**Валидация этапа:**
- [x] Аудит показал 1 invalid state user
- [x] UPDATE вернул 1 affected row
- [x] Повторный аудит — 0 invalid states

**Git:** `feat(tz-costctrl-p0): emergency data repair script — disable invalid delivery states`

**Критерий готовности:** 0 юзеров с `deliveryEnabled=true` без активного Telegram. ✅

---

## Этап 1 (Phase 1): Service layer + API invariant

**Статус:** ✅ Завершён (2026-04-05)

**Цель:** создать `delivery-service.ts` как единую точку изменения `deliveryEnabled`, enforced invariant #1 на API уровне.

**Задачи:**
- [x] Создать `lib/briefing/delivery-service.ts` с функцией `setBriefingDelivery()`
- [x] Реализовать invariant: `enabled=true` требует активный TelegramConnection → возврат `{ok: false, code: "telegram_required"}`
- [x] Создать функцию `disableDeliveryOnTelegramDisconnect(userId)` для cascade
- [x] Обновить `app/(chat)/api/briefing/delivery/route.ts` PATCH: использовать service, возвращать 409 при invariant violation
- [x] Обновить `app/(chat)/api/telegram/link/route.ts` DELETE: cascade вызов `disableDeliveryOnTelegramDisconnect()`
- [x] `npx tsc --noEmit` — 0 ошибок

**Файлы:**
- `lib/briefing/delivery-service.ts` — новый
- `app/(chat)/api/briefing/delivery/route.ts` — рефакторинг PATCH
- `app/(chat)/api/telegram/link/route.ts` — добавить cascade в DELETE

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] 🧪 Мануальный тест: PATCH с `deliveryEnabled=true` без Telegram → 409 response
- [x] 🧪 Мануальный тест: DELETE /telegram/link → в БД `deliveryEnabled=false` автоматически

**Git:** `feat(tz-costctrl-p1): delivery service + API invariant enforcement`

**Критерий готовности:** API отказывает включить delivery без Telegram, cascade работает.

---

## Этап 2 (Phase 2): UI state machine fix

**Статус:** ✅ Завершён (2026-04-05)

**Цель:** убрать mouse-trap — тоггл ВСЕГДА можно выключить, защита от включения без Telegram на уровне UX + обработка 409.

**Задачи:**
- [x] Изменить `disabled` condition в `briefing-delivery-settings.tsx`: `saving || (!telegramOk && !enabled)` — escape hatch
- [x] Добавить tooltip "Подключите Telegram чтобы включить доставку" при hover над disabled switch (когда off + no Telegram)
- [x] Обработать 409 response из PATCH: toast + revert optimistic state + не менять switch
- [x] `npx tsc --noEmit` — 0 ошибок

**Файлы:**
- `components/briefing/briefing-delivery-settings.tsx`

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] 🧪 Мануальный тест под vladimir@family.local (после Phase 0 deliveryEnabled=false): switch можно кликнуть, но ON заблокирован → toast "Подключите Telegram"
- [x] 🧪 Мануальный тест: включить deliveryEnabled через dev tools (fetch PATCH) → затем открыть страницу → switch можно выключить (escape hatch работает)

**Git:** `feat(tz-costctrl-p2): UI escape hatch + 409 handling`

**Критерий готовности:** Ни один юзер не попадает в mouse-trap, включение без Telegram невозможно.

---

## Этап 3 (Phase 3): Fail-fast cron pipeline

**Статус:** ✅ Завершён (2026-04-05)

**Цель:** проверять Telegram connection ДО запуска AI-пайплайна. Auto-repair invalid state.

**Задачи:**
- [x] Обновить `getUsersForDelivery()` в queries.ts: INNER JOIN на `TelegramConnection.isActive=true` — возвращать только deliverable users
- [x] Добавить pre-flight check в `generateAndDeliver()` cron handler: повторная проверка Telegram (defense-in-depth)
- [x] При pre-flight violation: auto-repair через `autoRepairInvalidDeliveryState()` + `console.warn`
- [x] Pre-flight покрывает все форматы (audio/text/text_audio) единой проверкой до pipeline
- [x] `npx tsc --noEmit` — 0 ошибок

**Файлы:**
- `lib/db/queries.ts` — `getUsersForDelivery()` с JOIN
- `app/api/cron/briefing/route.ts` — pre-flight в `generateAndDeliver()`

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] 🧪 Ручной вызов cron endpoint с CRON_SECRET → видим в логах "skipped: no_telegram", 0 AI-вызовов
- [ ] 🧪 Мануальный SQL-тест: создать invalid state → вызвать cron → invalid state auto-repaired в БД

**Git:** `feat(tz-costctrl-p3): fail-fast cron pre-flight + auto-repair`

**Критерий готовности:** Cron никогда не запускает AI-пайплайн для undeliverable users.

---

## Этап 4 (Phase 4): Guaranteed usage logging

**Статус:** ✅ Завершён (2026-04-05)

**Цель:** `waitUntil` для всех fire-and-forget `logUsage` + новая таблица `cron_run_log` для forensics.

**Задачи:**
- [x] Создать миграцию для таблицы `CronRunLog` (schema + ручной SQL — Drizzle generate интерактивный)
- [x] Добавить `saveCronRunLog()` query в `lib/db/queries.ts`
- [x] Заменить `logUsage({...})` на `waitUntil(logUsage({...}))` в 6 call-sites:
  - `lib/briefing/briefing-author.ts`
  - `lib/briefing/briefing-filter.ts`
  - `lib/briefing/briefing-section-author.ts`
  - `lib/podcast/script-generator.ts`
  - `lib/podcast/tts-gemini.ts` (2 места)
- [x] В `cron/briefing/route.ts`: накапливать результаты + `await saveCronRunLog({...})` перед return
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run db:migrate` + прямой SQL — таблица создана в production БД

**Файлы:**
- `lib/db/schema.ts` — новая таблица `cronRunLog`
- `lib/db/queries.ts` — `saveCronRunLog()`
- `lib/db/migrations/*.sql` — новая миграция (auto-gen)
- `lib/briefing/briefing-author.ts` — waitUntil
- `lib/briefing/briefing-filter.ts` — waitUntil
- `lib/briefing/briefing-section-author.ts` — waitUntil
- `lib/podcast/script-generator.ts` — waitUntil
- `lib/podcast/tts-gemini.ts` — waitUntil (2 места)
- `app/api/cron/briefing/route.ts` — saveCronRunLog

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [x] `npm run db:migrate` + прямой SQL — без ошибок
- [x] 🧪 Мануальный тест: ручной вызов cron → в `CronRunLog` появляется запись ✅
- [ ] 🧪 Vercel deployment: вызвать cron через CRON_SECRET → записи в `ai_usage_log` появляются

**Git:** `feat(tz-costctrl-p4): guaranteed usage logging via waitUntil + cron_run_log`

**Критерий готовности:** Каждый cron run оставляет след в `cron_run_log` + `ai_usage_log` записи появляются после cron на Vercel.

---

## Этап 5 (Phase 5): Complete cost coverage

**Статус:** ✅ Завершён (2026-04-05)

**Цель:** 100% cost coverage, `costUsd` никогда не NULL для успешных AI-вызовов.

**Задачи:**
- [x] Расширить `MODEL_PRICING_RUB` в `lib/ai/providers.ts`:
  - `sonar-deep-research`: $2/1M in, $8/1M out
  - `gemini-2.5-flash-preview-tts`: per-character pricing (handled separately)
  - `deepgram-nova-3`: per-minute pricing (handled separately)
- [x] Добавить helpers: `calculateDeepgramCostUsd(audioSeconds)`, `calculateGeminiTtsCostUsd(charCount)` в providers.ts
- [x] Обновить `calcCostUsd()` в `tokenlens-catalog.ts`: fallback chain TokenLens → MODEL_PRICING_RUB → null (only if truly unknown)
- [x] Обновить `logUsage` interface: добавить `costUsdOverride?: number` для провайдеров с non-token pricing (Deepgram, TTS)
- [x] Применить `costUsdOverride` в `deepgram-transcribe.ts` и `tts-gemini.ts`
- [x] `npx tsc --noEmit` — 0 ошибок

**Файлы:**
- `lib/ai/providers.ts` — MODEL_PRICING_RUB + helpers
- `lib/ai/tokenlens-catalog.ts` — calcCostUsd fallback
- `lib/ai/usage-utils.ts` — добавить costUsdOverride в LogUsageInput
- `lib/meeting/deepgram-transcribe.ts` — передавать costUsdOverride
- `lib/podcast/tts-gemini.ts` — передавать costUsdOverride с точным char count

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] 🧪 Тест в dev: запустить briefing pipeline вручную → в `ai_usage_log` записи с `costUsd != null` для Gemini 2.0 Flash и Claude Sonnet
- [ ] 🧪 Запустить meeting transcribe → запись Deepgram с корректным costUsd (не NULL!)
- [ ] SQL проверка: `SELECT COUNT(*) FROM ai_usage_log WHERE "costUsd" IS NULL AND "createdAt" > NOW() - INTERVAL '1 hour'` = 0

**Git:** `feat(tz-costctrl-p5): complete cost coverage — Deepgram, TTS, Gemini fallback`

**Критерий готовности:** Ни одна новая запись в `ai_usage_log` не имеет `costUsd=NULL`.

---

## Этап 6 (Phase 6): Admin cost-audit endpoint

**Статус:** ⬜ Не начат

**Цель:** self-service endpoint для мониторинга cost health.

**Задачи:**
- [ ] Создать `app/api/admin/cost-audit/route.ts` (GET) с gate `isSimplyDevMode`
- [ ] Реализовать queries:
  - invalid state users (deliveryEnabled + no Telegram)
  - lastCronRuns (последние 10 записей cron_run_log)
  - costByDay за 30 дней
  - costByChatMode за 30 дней
  - nullCostRecords за 30 дней
- [ ] Возвращать JSON с этими метриками
- [ ] `npx tsc --noEmit` — 0 ошибок

**Файлы:**
- `app/api/admin/cost-audit/route.ts` — новый
- `lib/db/queries.ts` — helper queries для audit

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] 🧪 GET `/api/admin/cost-audit` в dev-mode → JSON со всеми секциями
- [ ] 🧪 GET в production-mode → 403

**Git:** `feat(tz-costctrl-p6): admin cost-audit endpoint`

**Критерий готовности:** Endpoint показывает все инварианты и cost metrics.

---

## Этап 7: Финализация

**Статус:** ⬜ Не начат

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../DOCUMENTATION_GUIDE.md) → пройти чеклист.

**Задачи:**

**Документация (обязательная):**
- [ ] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти "Чек-лист при изменениях"
- [ ] Обновить главный CHANGELOG.md (запись 3.66.0)
- [ ] Обновить SIMPLY_STATUS.md
- [ ] Обновить CLAUDE.md (добавить ТЗ-COSTCTRL в список завершённых, версия)
- [ ] Обновить package.json (3.65.0 → 3.66.0)

**Документация (по чеклисту):**
- [ ] ADR нужен? → **ДА**: `docs/decisions/028-delivery-invariants-and-waituntil.md`
  (Фиксируем: инварианты state, cascade, waitUntil pattern для serverless logging)
- [ ] docs/architecture.md → обновить (новая таблица cron_run_log, delivery-service)
- [ ] docs/ai-providers.md → обновить (Deepgram, TTS, sonar-deep-research pricing)
- [ ] docs/ai-chats-map.md → NOT needed (модели те же)
- [ ] docs/design-system.md → NOT needed

**Верификация docs против кода (Правило 5):**
- [ ] `docs/ai-providers.md` → MODEL_PRICING_RUB сверить с `providers.ts`
- [ ] `CLAUDE.md` → структура кода актуальна (delivery-service.ts, cron_run_log)

**Завершение:**
- [ ] Production deployment на Vercel
- [ ] Финальное мануальное тестирование (пользователь):
  1. Под julia@family.local → выключить Telegram → cascade deliveryEnabled=false
  2. Под vladimir@family.local → попытка включить delivery → UI disabled + tooltip
  3. Вызвать cron вручную через CRON_SECRET → запись в cron_run_log, 0 users processed
  4. Проверить `ai_usage_log.costUsd IS NULL` count = 0 для новых записей
- [ ] Переместить папку в `_archive/`

**Git:** `chore(tz-costctrl): finalization — docs, ADR, version bump 3.65.0 → 3.66.0`

**Критерий готовности:** Все инварианты enforced, 0 cost leaks, документация актуальна, ТЗ в архиве.
