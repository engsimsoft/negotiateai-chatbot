# Анализ ТЗ-COSTCTRL: Briefing Cost Control

## Резюме

Фиксим 4 вложенных дефекта в briefing/podcast cron подсистеме одним архитектурным рефакторингом:
1. Mouse-trap в UI (нельзя выключить delivery без Telegram)
2. Cron без fail-fast (тратит $ на undeliverable content)
3. Fire-and-forget `logUsage` в serverless (теряет данные)
4. `costUsd=NULL` для Gemini/Deepgram/TTS

Корневая причина всех четырёх — отсутствие enforced state invariants и неправильный async pattern для serverless.

**6 фаз + hotfix Phase 0** (SQL migration выполняется сразу, до деплоя кода).

---

## Рекомендации разработчика (Код-ревью)

> ТЗ составлял сам (на основе аудита кодовой базы). Ниже — технические уточнения и вопросы, которые требуют решения архитектора/продукта.

### ✅ Архитектурные принципы (базовые)

- **State invariants enforced at service layer** — единственная точка изменения `deliveryEnabled` (`setBriefingDelivery`). UI и cron дергают через service, не напрямую в DB.
- **Fail-fast pipeline** — expensive operations только после prerequisites check.
- **`waitUntil` для serverless async** — штатный Vercel механизм, `@vercel/functions` уже в dependencies (`^2.0.0`).
- **Cascade on Telegram disconnect** — не полагаемся на идеальное поведение клиента, при `DELETE /telegram/link` автоматически `deliveryEnabled=false`.

### ⚠️ Технические решения требующие согласования

| # | Решение | Альтернатива | Обоснование |
|---|---------|--------------|-------------|
| 1 | Новая таблица `cron_run_log` | Просто console.log + Vercel logs | Vercel logs retention ограничен, для forensics нужна БД. Также даст возможность алертов |
| 2 | `calcCostUsd` fallback возвращает non-null всегда когда модель в MODEL_PRICING_RUB | Оставить как есть, возвращать null → просто дополнить TokenLens catalog | Fallback надёжнее: не зависим от TokenLens uptime. Но создаёт риск divergence между TokenLens и hardcoded |
| 3 | Phase 0 как отдельный SQL вне миграций Drizzle | Drizzle migration file | Phase 0 — разовая репарация для текущего production состояния, не часть schema evolution |
| 4 | `waitUntil` вместо batch insert | Накапливать usage events в массив → один insert в конце pipeline | `waitUntil` проще (6 строк), batch требует проброса context вниз по цепочке |

### ✅ Решения архитектора (согласовано)

| # | Решение | Обоснование |
|---|---------|-------------|
| Q1 | **Auto-repair invalid state** с warning-логом | Cost leak > риск замаскировать баг. Warnings в логах покажут race conditions |
| Q2 | **Cascade: telegram disconnect → deliveryEnabled=false** | Invariant enforced во всех mutation points |
| Q3 | **Defense-in-depth: UI disabled switch + API 409** | Бизнес-инвариант проверяется на API layer всегда |
| Q4 | **90 дней retention, без auto-cleanup** | 1 cron/day × 365 = копейки. Не over-engineer |
| Q5 | **`isSimplyDevMode` gate** для admin endpoint | 2 юзера в системе, роли избыточны |
| Q6 | **Точное pricing**: Deepgram per-minute, TTS per-character | Мы знаем input text, считаем точно |
| Q7 | **Podcast fail-fast вместе с briefing** | Нет Telegram → весь cron run бесполезен. UI flow работает отдельно |

### Вопросы (уже закрыты)

**Q1. Auto-repair в cron pre-flight:**
Текущее предложение: если cron видит `deliveryEnabled=true` но нет Telegram, он **автоматически ставит `deliveryEnabled=false`** и логирует warning.
- **Плюс:** self-healing, невалидные состояния не повторяются.
- **Минус:** может скрыть другие баги (например, race condition при Telegram reconnect).
- **Альтернатива:** только логировать, не менять state.
→ Как решаем?

**Q2. Cascade при disconnect Telegram:**
Когда юзер отключает Telegram (`DELETE /api/telegram/link`), автоматически выключать `deliveryEnabled`?
- **Плюс:** enforce invariant жёстко.
- **Минус:** если юзер переключает Telegram (отключил → подключает заново через 5 минут), настройки доставки теряются.
- **Альтернатива:** оставить `deliveryEnabled=true`, но cron всё равно skip (pre-flight поймает).
→ Я за cascade (Q1 + Q2 вместе), но это продуктовое решение.

**Q3. 409 Conflict vs optimistic UI при включении без Telegram:**
Текущее предложение: API возвращает 409 если нет Telegram при `deliveryEnabled=true`, UI показывает toast "Подключите Telegram".
- **Альтернатива A:** UI сам не даёт включить без Telegram (disabled при `!telegramOk && !enabled`), API не проверяет.
- **Альтернатива B:** API сам подключает Telegram (невозможно без UX) или перенаправляет.
→ Я за оба уровня защиты (UI + API) — defense-in-depth. Но UI может раздражать, если юзер хочет "подготовить настройки" до подключения.

**Q4. cron_run_log retention:**
Сколько дней хранить историю cron runs? Предлагаю 90 дней (auto-cleanup).
- Текущий объём: 1 cron/день × 365 дней = 365 записей/год — копейки.
- Но если в будущем будет еще cron или частота выше — нужна ротация.
→ Ок с 90 дней?

**Q5. Admin cost-audit endpoint — кто имеет доступ?**
Предложение: гейтится через `isSimplyDevMode` (как DevPanel) или whitelist userId в env.
→ Какой подход? Сейчас нет admin role в user table.

**Q6. Deepgram/TTS pricing точность:**
- Deepgram Nova-3: $0.0043/minute — точная цена от Deepgram.
- Gemini TTS: $4/1M chars → сложно перевести в $/sec (зависит от speech rate).
→ Готов ли архитектор на **"approximate" pricing с warning-комментарием в коде**, или нужна точная модель (per-character tracking для TTS)?

**Q7. Podcast pipeline тоже fail-fast?**
Сейчас cron делает: briefing → podcast → merge → deliver. Если Telegram не подключен, podcast тоже не нужен. Но podcast может иметь value сам по себе (аудио-файл в Blob для скачивания).
→ Podcast **обязан идти только если есть Telegram** или имеет independent value?

### 🎯 Что точно в scope (не обсуждается)

- Phase 0 SQL hotfix (остановить утечку)
- Phase 1 setBriefingDelivery service
- Phase 2 UI escape hatch (можно выключить всегда)
- Phase 3 cron pre-flight (critical bug, даже без Q1)
- Phase 4 waitUntil для 6 call-sites
- Phase 5 MODEL_PRICING_RUB для Gemini Flash (sonar-deep-research, gemini-2.0-flash, gemini-2.5-flash)

---

## Потенциальные риски

### Высокий риск
- **Phase 4 `waitUntil` может не работать локально** — `@vercel/functions` waitUntil полагается на Vercel runtime, в `npm run dev` может fire-and-forget как раньше. Нужен мануальный тест на Vercel preview deployment.
- **Phase 5 cost divergence** — после добавления fallback в `calcCostUsd` для Gemini/Deepgram, возможно другие места в коде (pipeline-trace) начнут давать другие цифры. Нужно проверить pipeline-trace.ts и DevPanel cost display.

### Средний риск
- **Phase 1 API 409 response** — фронтенд везде где делается PATCH `/api/briefing/delivery` нужно обработать 409. Сейчас это только `briefing-delivery-settings.tsx`, но если есть другие вызовы — сломается.
- **cron_run_log insertion failure** — если БД недоступна в момент завершения cron, весь summary теряется. Решение: try-catch, логировать ошибку в console.

### Низкий риск
- **Миграция cron_run_log таблицы** — Drizzle generate должен создать migration file корректно, стандартный paттерн.

---

## Зависимости

### Затронутые файлы (основные)

**Новые:**
- `lib/briefing/delivery-service.ts` — single point for delivery state changes
- `app/api/admin/cost-audit/route.ts` — audit endpoint
- `lib/db/schema.ts` + migration — `cron_run_log` table

**Изменения:**
- `app/(chat)/api/briefing/delivery/route.ts` — используем service, 409 response
- `app/(chat)/api/telegram/link/route.ts` DELETE — cascade disable
- `components/briefing/briefing-delivery-settings.tsx` — escape hatch + 409 handling
- `app/api/cron/briefing/route.ts` — pre-flight + await logUsage
- `lib/db/queries.ts` → `getUsersForDelivery()` — JOIN на TelegramConnection
- `lib/briefing/briefing-author.ts` — `waitUntil(logUsage(...))`
- `lib/briefing/briefing-filter.ts` — то же
- `lib/briefing/briefing-section-author.ts` — то же
- `lib/podcast/script-generator.ts` — то же
- `lib/podcast/tts-gemini.ts` — то же (2 call sites)
- `lib/ai/providers.ts` → `MODEL_PRICING_RUB` — добавить Gemini TTS, Deepgram, sonar-deep-research
- `lib/ai/tokenlens-catalog.ts` → `calcCostUsd` fallback chain

### Что нужно сделать до начала

- Согласовать ответы на Q1-Q7 с архитектором
- Phase 0 SQL hotfix на production (**до деплоя кода!**)

### Что нельзя сломать

- Живой чат (`app/(chat)/api/chat/route.ts`) — не трогаем
- Streaming endpoints — не трогаем
- DevPanel display — не ломаем после изменений в calcCostUsd

---

## Оценка сложности

- [x] **Среднее (3-5 сессий)**

Обоснование: 
- 7 фаз, каждая ~1 коммит
- Phase 0 — 5 минут (SQL)
- Phase 1-2 — 1 сессия (service + API + UI)
- Phase 3 — 1 сессия (cron refactor + JOIN в query)
- Phase 4 — 1 сессия (waitUntil × 6 + cron_run_log table + migration)
- Phase 5 — 0.5 сессии (MODEL_PRICING_RUB + fallback)
- Phase 6 — 0.5 сессии (admin endpoint)
- Финализация — 1 сессия (docs, ADR, verification)

Risks: Phase 4 `waitUntil` — нужен preview deployment на Vercel для реального теста, локально не проверить.
