# ТЗ-BriefingConcurrencyGuard — гонка cron ↔ ручная кнопка «Сгенерировать»

**Статус:** Хвост, **Medium impact** (двойная работа + риск overwrite готового брифинга при race)
**Создано:** 2026-04-26 в B5 ANALYSIS ТЗ-BriefingStuckRecovery (вынесен из scope)
**Связано с:**
- [lib/briefing/briefing-pipeline.ts:109](../../lib/briefing/briefing-pipeline.ts#L109) (первый INSERT 'generating' с UPSERT-семантикой ТЗ-BriefingStuckRecovery)
- [app/api/cron/briefing/route.ts](../../app/api/cron/briefing/route.ts) (cron prebrief idempotency check `getBriefingHistory({status:"ready"})` — фильтрует по success, не по in-progress)
- [app/(chat)/api/briefing/generate/route.ts](../../app/(chat)/api/briefing/generate/route.ts) (user-triggered, нет idempotency check)
- Прецедент: [_archive/TZ_SimplyChatRaceCondition/](../_archive/) — partial unique index `(userId) WHERE chatMode='simply'`

---

## Контекст

ТЗ-BriefingStuckRecovery после UPSERT-рефакторинга гарантирует **одну** запись `BriefingHistory` на pipeline-прогон. Но если **два прогона** запустятся параллельно (cron в 5 UTC + user нажал «Сгенерировать» в то же время), оба сделают свой `INSERT('generating')`, потом оба независимо сделают `UPDATE` своей записи в финале.

Сценарии плохого исхода:
1. **Двойная работа.** Pipeline дорогой (~₽0.4 за прогон). Два параллельных прогона = двойной расход на ничто.
2. **Overwrite готового брифинга.** Если cron финиширует первым (status='ready'), а ручной отстаёт и финиширует вторым — у пользователя в БД два готовых брифинга разного качества; `getBriefingHistory({limit:1})` отдаст последний по времени, не лучший.
3. **deleteOldBriefingHistory({keepLast:1})** в начале каждого pipeline'а удаляет non-ready записи параллельного прогона до его завершения → второй прогон UPDATE'нёт несуществующий `id` → exception в catch'е → оба прогона приходят в 'failed'.

Сейчас защиты нет. На Hobby cron daily — вероятность low (узкое окно), но при ручном retry'е после failed cron — реальная.

## Что предлагается

### 1. Partial unique index (рекомендую)

Аналогично `TZ_SimplyChatRaceCondition` (commit `84c5fb5`):

```sql
CREATE UNIQUE INDEX briefing_history_user_generating_idx
ON "BriefingHistory" ("userId")
WHERE status = 'generating';
```

В pipeline.ts перед `INSERT('generating')` ловить `unique_violation` и отдавать пользователю `409 Conflict` с сообщением «Уже идёт генерация — подожди или дождись завершения». В `/api/briefing/generate` route — корректный 409 в стриме.

Cron при таком 409 — пропускать пользователя в этот час (не fatal).

### 2. Optimistic lock через SELECT FOR UPDATE

`db.transaction(async tx => { lockedRow = SELECT ... WHERE userId=$ AND status='generating' FOR UPDATE; if (lockedRow) throw; INSERT(...) })`. Сложнее, требует Drizzle transaction.

### 3. Idempotency-key через timestamp window

Перед INSERT — `SELECT ... WHERE userId=$ AND status='generating' AND generatedAt > NOW() - INTERVAL '5 minutes'`. Если есть — отказ. Без unique index, soft.

## Acceptance criteria

- [ ] При параллельных запросах cron и user-triggered — только один доходит до UPDATE 'ready', второй получает 409 Conflict
- [ ] Watchdog ТЗ-BriefingStuckRecovery продолжает работать (если concurrency-проигравший прервался не дождавшись релиза lock'а)
- [ ] `npx tsc --noEmit` зелёный
- [ ] Миграция БД через `drizzle-kit generate` или ручной SQL + journal entry

## НЕ в scope

- Расширение конкуренси внутри cron (несколько пользователей параллельно — это `CRON_CONCURRENCY_LIMIT`, отдельный механизм)
- Идемпотентность по дате (cron-проверка «уже есть ready на сегодня» — есть, не трогать)

## Оценка

**0.3-0.5 сессии:**
- Partial unique index + миграция (0.1)
- Pipeline catch unique_violation + return 409 path (0.2)
- Тесты + cron поведение (0.1)
