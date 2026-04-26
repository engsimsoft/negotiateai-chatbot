# Roadmap ТЗ-BriefingStuckRecovery

**Создан:** 2026-04-25
**Версия проекта:** 3.99.0 → 3.99.1 (patch — bugfix + minor UX)
**Статус:** ✅ Завершён 2026-04-26

---

## Обзор

| Метрика | Значение |
|---|---|
| Этапов | 4 |
| Текущий этап | 1 |
| Сессий (оценка) | 1 (~0.5-0.8 как в SPEC) |

**Решения после ANALYSIS (подтверждены владельцем 2026-04-25):**
- В1: реализуем защищённо (баннер срабатывает всегда при stale-generating, покрывает любой UX-симптом)
- В2: watchdog в **двух местах** — cron + GET `/api/briefing/latest` (мгновенная самоочистка при заходе пользователя, не 24ч лаг)
- В3: новый явный helper `updateBriefingHistory({id, ...})`, не перегруз `saveBriefingHistory`
- В4: баннер поверх обычного UI, не отдельный recovery screen
- В5: concurrency guard (cron ↔ ручная кнопка) — выносим в новый backlog `TZ_BriefingConcurrencyGuard`

---

## Этап 1: Watchdog SQL + integration в cron, page.tsx и dashboard.tsx

**Статус:** ✅ Завершён 2026-04-26

**Цель:** Stuck-записи `'generating'` старше `STUCK_THRESHOLD_MINUTES` автоматически переводятся в `'failed'` в двух точках: при заходе пользователя на `/briefing` (мгновенно) и в начале cron-прогона (бэкап).

**Задачи:**
- [x] Добавить `STUCK_THRESHOLD_MINUTES = 10` в [lib/briefing/briefing-config.ts](../../lib/briefing/briefing-config.ts) рядом с `CRON_CONCURRENCY_LIMIT`
- [x] Добавить query-хелпер `markStuckBriefingsAsFailed({userId, thresholdMinutes})` в [lib/db/queries.ts](../../lib/db/queries.ts) рядом с `saveBriefingHistory`
- [x] Вызвать watchdog в начале [api/cron/briefing/route.ts](../../app/api/cron/briefing/route.ts) — глобальный sweep
- [x] Вызвать watchdog в [api/briefing/latest/route.ts](../../app/(chat)/api/briefing/latest/route.ts) — defense-in-depth (orphan endpoint, см. FINDINGS #1)
- [x] **+ side-effect (sheet-stage):** добавлен watchdog в [briefing/page.tsx](../../app/(dashboard)/briefing/page.tsx) (server component)
- [x] **+ side-effect (sheet-stage):** добавлен watchdog в [dashboard/page.tsx](../../app/(dashboard)/dashboard/page.tsx) — **корень UX-блока:** карточка «Утренний брифинг» при `status='generating'` non-clickable, watchdog здесь критичен
- [x] `npx tsc --noEmit` → 0 ошибок

**Файлы:**
- `lib/briefing/briefing-config.ts` — новая const
- `lib/db/queries.ts` — новый хелпер `markStuckBriefingsAsFailed` (одна функция, ~15 строк, идемпотентный SQL UPDATE)
- `app/api/cron/briefing/route.ts` — вызов watchdog (sweep)
- `app/(chat)/api/briefing/latest/route.ts` — вызов watchdog (per-user)

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — ⚠️ предупредить владельца перед запуском (auto-migrations)
- [ ] 🧪 Мануальный тест:
  1. Через `mcp__postgres__query` вставить искусственную stuck-запись для текущего user'а: `INSERT INTO "BriefingHistory"(...) status='generating', generatedAt=now()-interval '15 min', briefingJson='{}'`
  2. Открыть `/briefing` (или `/api/briefing/latest`)
  3. SQL-проверить: stuck-запись теперь `status='failed'`, `briefingJson` содержит `{error:'stuck'...}`

**Критерий готовности:** SQL-тест: ручная stuck-запись после захода на `/briefing` → 'failed' автоматически. tsc green.

⛔ СТОП: Этап 2 не начинать без подтверждения владельца.

---

## Этап 2: UPSERT-рефакторинг pipeline (один INSERT + UPDATE'ы)

**Статус:** ⬜ Не начат

**Цель:** Pipeline создаёт **одну запись** на прогон. Первый INSERT('generating') возвращает `id`, далее UPDATE по этому `id` в трёх финальных точках. Stuck-запись становится самоочищающейся при любом нормальном завершении (success или fail через catch).

**Задачи:**
- [ ] Добавить `updateBriefingHistory({id, ...})` в [lib/db/queries.ts](../../lib/db/queries.ts) — отдельный явный хелпер
- [ ] [lib/briefing/briefing-pipeline.ts:104](../../lib/briefing/briefing-pipeline.ts#L104) — `saveBriefingHistory` уже возвращает `created`; зафиксировать `briefingId` в локальной переменной (выходит за пределы try{} → доступен в catch'е)
- [ ] [lib/briefing/briefing-pipeline.ts:171](../../lib/briefing/briefing-pipeline.ts#L171) (no content fetched, status='failed') — заменить на `updateBriefingHistory({id: briefingId, ...})`
- [ ] [lib/briefing/briefing-pipeline.ts:327](../../lib/briefing/briefing-pipeline.ts#L327) (success, status='ready') — заменить на `updateBriefingHistory({id: briefingId, ...})`
- [ ] [lib/briefing/briefing-pipeline.ts:365](../../lib/briefing/briefing-pipeline.ts#L365) (catch, status='failed') — заменить на `updateBriefingHistory({id: briefingId, ...})` (в catch'е может быть undefined если упало до первого INSERT — guard)
- [ ] `npx tsc --noEmit` → 0 ошибок

**Файлы:**
- `lib/db/queries.ts` — новый хелпер
- `lib/briefing/briefing-pipeline.ts` — 4 call-сайта → 1 INSERT + 3 UPDATE'а

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — ⚠️ предупредить владельца перед запуском
- [ ] 🧪 Мануальный тест:
  1. На `/briefing` нажать «Сгенерировать»
  2. Подождать завершения
  3. SQL: `SELECT id, status, generatedAt FROM "BriefingHistory" WHERE userId=$me ORDER BY generatedAt DESC LIMIT 5` — должна быть **одна свежая запись** на прогон со status='ready' (не пара 'generating'+'ready')
  4. Симуляция fail: добавить временный `throw new Error('test')` после первого INSERT в pipeline → запустить генерацию → SQL: одна запись со status='failed', briefingJson содержит сообщение об ошибке. Откатить тестовый throw.

**Критерий готовности:** SELECT возвращает одну row на прогон в любом сценарии. tsc green.

⛔ СТОП: Этап 3 не начинать без подтверждения владельца.

---

## Этап 3: UI-баннер staleGeneration

**Статус:** ⬜ Не начат

**Цель:** Если stuck-запись существует на момент захода (теоретически возможно если watchdog не сработал или race), пользователь видит понятный баннер «Предыдущая генерация прервалась. Запустить заново» поверх обычного UI, а не белый экран / висящий loader / тишину.

**Задачи:**
- [ ] [api/briefing/latest/route.ts](../../app/(chat)/api/briefing/latest/route.ts) — после watchdog'а сделать второй запрос `getBriefingHistory({userId, limit:1})` (без status-фильтра) → если последняя 'generating' и старше threshold → возвращать `staleGeneration: true` (только если watchdog почему-то не справился — например race с активным cron'ом)
- [ ] [app/(dashboard)/briefing/page.tsx](../../app/(dashboard)/briefing/page.tsx) — pass-through `staleGeneration` через server props
- [ ] [components/briefing/briefing-page-client.tsx](../../components/briefing/briefing-page-client.tsx) — при `staleGeneration && !hasValidArticle` показать `Alert` shadcn-баннер с кнопкой «Запустить заново» (вызывает существующий `startGeneration`)
- [ ] `npx tsc --noEmit` → 0 ошибок

**Файлы:**
- `app/(chat)/api/briefing/latest/route.ts` — добавить второй query + флаг
- `app/(dashboard)/briefing/page.tsx` — pass-through (если используется этот endpoint, иначе skip)
- `components/briefing/briefing-page-client.tsx` — баннер

**Note:** возможно баннер не понадобится в проде если watchdog Этапа 1 надёжен. Но это **defense-in-depth** на случай race'ов и для UX'а — пользователь видит честное состояние, а не пустоту. Цена — ~30 строк кода.

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — ⚠️ предупредить владельца перед запуском
- [ ] 🧪 Мануальный тест:
  1. SQL: вставить stuck-запись с `generatedAt = now() - interval '15 min'` для текущего user'а
  2. **Временно отключить watchdog в latest/route.ts** (закомментировать вызов) — чтобы баннер показался, иначе watchdog мгновенно зачистит запись
  3. Открыть `/briefing` → должен быть виден баннер «Предыдущая генерация прервалась…» с кнопкой
  4. Кликнуть кнопку — должна стартовать генерация, по завершении баннер исчезает, появляется свежий брифинг
  5. Откатить временный комментарий

**Критерий готовности:** Баннер виден в искусственно-созданном stuck-сценарии, кнопка восстанавливает генерацию.

⛔ СТОП: Этап 4 не начинать без подтверждения владельца.

---

## Этап 4: Финализация

**Статус:** ⬜ Не начат

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../../DOCUMENTATION_GUIDE.md) — пройти чеклист.

**Задачи:**

**Документация (обязательная):**
- [ ] ⛔ Прочитать DOCUMENTATION_GUIDE.md
- [ ] Обновить главный [CHANGELOG.md](../../CHANGELOG.md) — запись о ТЗ-BriefingStuckRecovery в v3.99.1
- [ ] Обновить [SIMPLY_STATUS.md](../../SIMPLY_STATUS.md):
  - Версия 3.99.0 → 3.99.1
  - Из секции «Известные проблемы 🟥 High impact» убрать `TZ_BriefingStuckRecovery`
  - **Housekeeping:** добавить в секцию «🟧 Medium impact» запись `TZ_ExpertiseReasoningRestore` (была пропущена в SIMPLY_STATUS, существует с 2026-04-23)
  - Обновить footer «Обновлено» с описанием изменения
- [ ] Обновить [package.json](../../package.json) — версия 3.99.0 → 3.99.1
- [ ] ⛔ [CLAUDE.md](../../CLAUDE.md) — НЕ редактировать. `wc -l CLAUDE.md` ≤ 220 (если > 220 — STOP, доложить).

**Backlog обработка:**
- [ ] Удалить запись `TZ_BriefingStuckRecovery` из [specs/_backlog/README.md](../../specs/_backlog/README.md) (секция High impact)
- [ ] **Housekeeping:** добавить запись `TZ_ExpertiseReasoningRestore` в [specs/_backlog/README.md](../../specs/_backlog/README.md) (секция Medium impact) — файл существует с 2026-04-23 но не отражён в README
- [ ] Создать новый файл-заготовку `specs/_backlog/TZ_BriefingConcurrencyGuard.md` — В5 (concurrency cron ↔ ручная кнопка), записать в README.md
- [ ] Добавить запись о закрытии `TZ_BriefingStuckRecovery` в [specs/_archive/BACKLOG_CLOSED.md](../../specs/_archive/BACKLOG_CLOSED.md)

**Документация (по чеклисту Правила 6 WORKFLOW):**
- [ ] `git diff --stat master...HEAD` — посмотреть triggered файлы
- [ ] `lib/db/queries.ts` — НЕ trigger ни для одного docs/ файла (проверено)
- [ ] `lib/briefing/*` — НЕ trigger
- [ ] `app/(dashboard)/briefing/*` — потенциально triggers `docs/architecture.md` если меняли структуру роутов; в нашем случае только page.tsx mod, route group не новая → не нужно
- [ ] `components/briefing/*` — НЕ trigger (briefing-page-client.tsx — изменение, не новый компонент)
- [ ] `lib/db/schema.ts` — **НЕ менялся** (UPDATE без новых колонок)
- [ ] **ADR не требуется** — это bugfix, не архитектурное решение. Никаких новых паттернов

**Финализация (Правило 7 — единый коммит):**
- [ ] Финальное мануальное тестирование владельцем
- [ ] `git status` — проверить файлы
- [ ] `git add` явно перечисленные файлы (не `-A`)
- [ ] `git commit -m "fix(tz-briefing-stuck-recovery): self-recovery для застрявшего /briefing — v3.99.1"` (HEREDOC, тело 3-5 строк)
- [ ] `mv specs/TZ_BriefingStuckRecovery/ specs/_archive/`

**Валидация:**
- [ ] `npm run build` — успешен
- [ ] Production URL работает после деплоя
- [ ] Документация актуальна (проверено по чеклисту)

**Критерий готовности:** Один коммит создан, ТЗ в `_archive/`, SIMPLY_STATUS отражает закрытие.
