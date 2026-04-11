# Передача сессии ТЗ-2: Dev Switchboard UI

**Дата:** 2026-04-12
**Сессия:** 1 (планирование)

---

## Статус этапов

- [x] Этап 0: Baseline — зелёный
- [x] Этап 1: Backend overrides + Footer badge — **✅ завершён, протестирован end-to-end, Haiku override виден в footer**
- [ ] Этап 2: Страница `/dev/models` ← **следующий**
- [ ] Этап 3: Per-message Switcher в DevPanel
- [ ] Этап 4: Polish + edge cases
- [ ] Этап 5: Финализация

## Финальная архитектура Этапа 1 (rev 3, file-based)

- `.simply-dev-overrides.json` в корне проекта — SSOT для dev-overrides
- `lib/ai/model-overrides.ts` — client-safe shared (dev-gate, parse, serialize, reader callback)
- `lib/ai/model-overrides-node.ts` — server-only (`import "server-only"`), `fs.readFileSync`/`writeFileSync`
- `app/api/dev/set-override/route.ts` — GET endpoint (`?task=X&model=Y`, `?clear=1`)
- middleware bypass для `/api/dev/*`
- Отказались от cookies (Chrome DevTools ненадёжен) и AsyncLocalStorage (избыточен для dev-tool)

---

## Следующая сессия: начни с

1. Прочитать `ROADMAP.md` → Этап 2 полностью
2. Подтверждение мануального теста Этапа 1 от пользователя (если ещё нет)
3. Начать с `app/(dev)/layout.tsx` + `app/(dev)/dev/models/page.tsx` (Server Component, auth + dev-gate)
4. Затем Server Actions `actions.ts` и API `/api/dev/env-status`

---

## В процессе

_Этап 1 полностью написан, tsc + build зелёные. Ждёт мануального теста пользователя._

**Что проверить вручную (Этап 1):**
1. Открыть Simply Chat → отправить сообщение → ожидаем модель по умолчанию (MiniMax M2.7), никакого OVERRIDE badge
2. DevTools → Application → Cookies → добавить `x-model-overrides` со значением `{"simply-chat":"claude-opus-4-6"}` (path=/, без httpOnly)
3. Отправить сообщение в Simply Chat → ожидаем:
   - Footer показывает Opus 4.6
   - Footer показывает жёлтый «⚙ OVERRIDE» badge
   - Открыть DevPanel Drawer → секция Model: Task ID = `simply-chat`, Override = `MiniMax-M2.7 → claude-opus-4-6`
4. Удалить cookie → следующее сообщение снова MiniMax без badge
5. Briefing cron / memory pipelines должны игнорировать cookie (background scope, `cookies()` бросает, try/catch глотает)

---

## Ключевой контекст (что знать старту)

### Архитектурные решения (согласованы)
- **Cookie threading** — НЕ через `context.requestCookies`. Используем `next/headers.cookies()` **внутри** `lookupOverride()`. Ноль изменений в 35+ call-sites.
- **Capability-фильтр** — нет. Все модели в dropdown + warning-иконка.
- **Placement** — `/dev/models` (полная карта) + секция в существующем `DevPanelDrawer` (per-message).
- **Scope** — только cookie + localStorage. БД не трогаем.
- **Providers UI** — две секции: LLM (5) + Raw (3).
- **Apply UX** — toast + undo 5s.

### Несоответствия ТЗ с кодом
- «31 taskId» → реально **40** (см. ANALYSIS.md)
- «Реестр провайдеров 8» → 5 в registry + 3 raw = 8 в каталоге, но это 2 разных уровня

### Dev-gate — 3 уровня защиты
1. `lookupOverride()` — возвращает null если `!isSimplyDevMode`
2. `app/(dev)/dev/models/page.tsx` — `notFound()` в prod
3. Server Actions `setOverride/resetAll` — throw в prod

### Ключевые файлы для Этапа 1
- `lib/ai/getModel.ts` — [lookupOverride stub](../../lib/ai/getModel.ts#L56-L62)
- `lib/ai/debug-events.ts` — где добавить `overrideActive`
- `lib/ai/retry-with-logging.ts` или `lib/ai/usage-utils.ts` — где эмитится step data (TBD, уточнить на Этапе 1)
- `components/dev-panel/dev-panel-footer.tsx` — строка 60-64 уже показывает modelId, добавляем только badge

---

## Блокеры / Вопросы

_Нет. Все 6 вопросов из ANALYSIS.md согласованы архитектором 2026-04-12._

---

## Версия проекта

`3.83.0` → цель `3.84.0` после ТЗ-2.
