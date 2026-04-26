# ТЗ-BriefingStuckRecovery — self-recovery для застрявшего /briefing

**Статус:** Хвост, **High impact** (полный блок фичи, пользователь не может восстановиться сам)
**Создано:** 2026-04-21 — воспроизведено на engsimsoft@gmail.com (запись `BriefingHistory.eddcdb57-7e93-482c-b742-088fd68ec56c`, `status='generating'`, `briefingJson.sections = null`). Ручная разблокировка через `UPDATE status='failed'`.
**Источник:** Инцидент 2026-04-21 + память `project_briefing_corruption` от 2026-04-09
**Связано с:** [lib/briefing/briefing-pipeline.ts](../../lib/briefing/briefing-pipeline.ts), [lib/db/queries.ts:2733](../../lib/db/queries.ts) (`saveBriefingHistory`), [app/(chat)/api/briefing/latest/route.ts](../../app/(chat)/api/briefing/latest/route.ts), [components/briefing/briefing-page-client.tsx](../../components/briefing/briefing-page-client.tsx), [components/briefing/briefing-sidebar.tsx](../../components/briefing/briefing-sidebar.tsx)

---

## Контекст

Пользователь зашёл на `/briefing` — UI завис. В БД лежит запись `status='generating'` с `sections=null`, созданная hourly cron. Pipeline упал где-то между INSERT('generating') и финальным INSERT('ready'|'failed') без срабатывания catch-блока (вероятные причины: SIGKILL от Vercel при превышении cron timeout, crash Lambda, неперехваченная ошибка в вложенном async, OOM).

**Критическая проблема:** пользователь **не может восстановиться сам** — stuck-запись невидимо блокирует UI, никакой кнопки «сбросить» / «перезапустить» нет. Каждая hourly cron-итерация может воспроизвести. В обычном production без доступа к Claude / SQL пользователь остаётся заблокирован до следующего штатного прогона (и то не гарантированно, если cron не очищает stuck-записи).

## Симптомы

- Самая свежая `BriefingHistory` row: `status='generating'`, `briefingJson->'sections' IS NULL`, давность > N минут (cron timeout ~5 мин на Hobby, реальный pipeline ≤ 3 мин)
- `/briefing` либо крашится (React key duplicate, null sections), либо бесконечно показывает loader
- Следующая hourly cron создаёт **новую** `generating` запись поверх — `deleteOldBriefingHistory({keepLast:1})` оставляет хвост

## Корневые причины

1. **`saveBriefingHistory` = INSERT, не UPSERT.** Pipeline вставляет две строки: `'generating'` в начале и `'ready'|'failed'` в конце. При падении процесса до второго INSERT — `'generating'` остаётся «бессмертной». [lib/db/queries.ts:2754](../../lib/db/queries.ts)
2. **Нет watchdog / cleanup.** Нет периодической проверки «есть ли `generating`-записи старше X минут — пометить `failed`».
3. **Нет guard в UI** для case `status='generating'` старше N минут — UI не отличает «в процессе сейчас» от «застряло навсегда».
4. **Нет self-service reset** — пользователь не может руками запустить генерацию заново.
5. (Из старой памятки) Duplicate `topicId` из MiniMax Author — отдельная корневая причина коррапта, но не блокер UI после исправлений ниже.

## Что предлагается (в порядке приоритета)

### 1. UI-guard и self-recovery (критично, High)

В [app/(chat)/api/briefing/latest/route.ts](../../app/(chat)/api/briefing/latest/route.ts) и/или [components/briefing/briefing-page-client.tsx](../../components/briefing/briefing-page-client.tsx):

- Если `latest.status === 'generating'` и `Date.now() - latest.generatedAt > STUCK_THRESHOLD_MINUTES` (рекомендация: **10 минут**, cron-pipeline реалистично укладывается в 3-5 мин) — трактовать как failed:
  - Показывать экран «Предыдущая генерация не завершилась», кнопка **«Запустить заново»**
  - При открытии страницы автоматически делать `UPDATE BriefingHistory SET status='failed' WHERE id=$1` для stuck-записи (idempotent)
- Либо fallback на предыдущий `status='ready'` брифинг (их может быть >1 за счёт `keepLast:1`) + баннер «Новая генерация застряла»

### 2. Server-side watchdog (критично, High)

В cron-ручке `/api/cron/briefing` (или отдельный cron) в начале прогона — **транзакционно** пометить все `status='generating'` записи старше 10 минут как `failed`:

```sql
UPDATE "BriefingHistory"
SET status = 'failed',
    "briefingJson" = jsonb_set(COALESCE("briefingJson", '{}'::jsonb), '{error}', '"stuck generation detected by watchdog"')
WHERE status = 'generating' AND "generatedAt" < NOW() - INTERVAL '10 minutes';
```

Этим покрываются все юзеры (не только текущий), каждый час.

### 3. Pipeline: INSERT('generating') → UPDATE при финализации (Medium)

Вместо второго INSERT — `UPDATE BriefingHistory SET status=..., briefingJson=..., ... WHERE id=$startedId`. Тогда:
- Одна строка на прогон, а не две
- `deleteOldBriefingHistory` перестаёт плодить историю
- stuck-записи проще найти (одна на userId)

Требует рефакторинга `saveBriefingHistory` или нового helper `updateBriefingHistory({ id, ... })`.

### 4. (Опционально) Валидация `topicId` uniqueness в Author-output (Low)

В [lib/briefing/briefing-author.ts](../../lib/briefing/briefing-author.ts) / [lib/briefing/briefing-pipeline.ts](../../lib/briefing/briefing-pipeline.ts) — перед сохранением проверять `new Set(sections.map(s => s.topicId)).size === sections.length`. Если нарушено — дедупить + лог. Из старой памятки `project_briefing_corruption` (MiniMax генерировал 5× `"vibe-coding"`); возможно уже неактуально после миграции author на Grok, но guard copy-paste дешёвый.

## Acceptance criteria

- [ ] Пользователь открывает `/briefing` при stuck-записи — видит понятный экран, не краш, есть кнопка перезапуска
- [ ] Watchdog в cron переводит `generating > 10 min` в `failed` (SQL-тест: вручную создать запись с `generatedAt = now - 15 min`, прогнать cron, убедиться что статус сменился)
- [ ] Pipeline не создаёт дубли записей на один прогон (одна row `status='ready'|'failed'` вместо пары)
- [ ] Старые `status='ready'` брифинги продолжают открываться при наличии stuck нового (fallback)
- [ ] `npx tsc --noEmit` зелёный
- [ ] Ручной smoke: имитировать падение — `throw new Error` после INSERT('generating') в pipeline dev-режиме, открыть `/briefing`, убедиться в recovery-экране

## НЕ в scope

- Разбор почему конкретно упал pipeline 2026-04-21 (логи Vercel за тот час могут быть уже ротированы; root cause = устойчивость, не конкретный инцидент)
- Рефакторинг `briefingJson` формата, переход на relational sections
- Переписывание briefing author / filter / section-author логики
- Retry pipeline после фейла (пользователь сам нажмёт «Запустить заново»)

## Оценка

**0.5-0.8 сессии:**
- UI guard + self-recovery endpoint (0.3)
- Watchdog в cron (0.1)
- UPSERT/UPDATE в pipeline (0.2-0.3)
- Тесты + CHANGELOG + commit (0.1-0.2)
