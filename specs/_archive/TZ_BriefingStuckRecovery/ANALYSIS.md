# Анализ ТЗ-BriefingStuckRecovery

**Дата:** 2026-04-25
**Статус:** Phase 1 — Анализ, ждём ответы владельца

---

## Изученная документация (Правило 1)

| Технология | Версия в проекте | Источник | Ключевая находка |
|---|---|---|---|
| Drizzle ORM | `^0.45.2` | [orm.drizzle.team/docs/update](https://orm.drizzle.team/docs/update) | `.update(table).set({...}).where(eq(...)).returning()` — стандарт. JSONB-операции через `sql\`jsonb_set(...)\`` хелпер. Транзакции `db.transaction(async tx => ...)` без изменений |
| Vercel Cron (Hobby) | — | [vercel.com/docs/cron-jobs](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Functions duration](https://vercel.com/docs/functions/configuring-functions/duration) | **Hobby = только раз в сутки.** Vercel **не делает retry** при фейле. maxDuration: default 300с / max 300с (с fluid compute, включён по умолчанию). При превышении — Vercel terminate'ит функцию (то есть SIGKILL без срабатывания JS-catch'а) |
| `vercel.json` (наш) | `0 5 * * *` | [vercel.json](../../vercel.json) | Briefing cron — **ОДИН РАЗ В СУТКИ** в 05:00 UTC (08:00 МСК). **SPEC и SIMPLY_STATUS пишут «hourly cron» — это неверно**, Hobby-план это и не позволил бы. Stuck-запись живёт ~24ч до следующего cron, не ~1ч |

**Красные флаги для ТЗ:**

1. **Cron retry = нет.** Если pipeline убит по timeout — на следующий день pipeline стартует с чистого листа, но stuck-запись из вчерашнего прогона остаётся. Watchdog должен идти ПЕРВЫМ шагом cron.
2. **maxDuration 240с** настроен в [api/cron/briefing/route.ts:22](../../app/(chat)/api/cron/briefing/route.ts#L22) и в [api/briefing/generate/route.ts:10](../../app/(chat)/api/briefing/generate/route.ts#L10). Запас 60с до жёсткого Hobby-предела (300с).

---

## Резюме ТЗ

`/briefing` ломается / показывает «нет брифингов» когда в `BriefingHistory` есть stuck-запись `status='generating'` без `sections`. Pipeline упал между двумя `INSERT`'ами (текущая архитектура — два отдельных INSERT'а вместо одного UPSERT). Пользователь не может восстановиться сам — нет UI-кнопки сброса, нет cron-watchdog.

Предлагается 4 шага: UI-guard, server watchdog в cron, UPDATE вместо второго INSERT, опциональная валидация `topicId` uniqueness.

---

## Что я нашёл в коде (поверка SPEC)

### ⚠️ Расхождения SPEC ↔ реальный код

| # | SPEC | Реальность в коде | Вывод |
|---|---|---|---|
| 1 | «hourly cron», «каждая часовая итерация может воспроизвести» | `vercel.json: "0 5 * * *"` — daily. Hobby ограничен daily | Stuck живёт **до 24ч**, не ~1ч. Watchdog один раз в сутки = недостаточно |
| 2 | «pipeline упал ... без срабатывания catch-блока» | Catch-блок есть ([briefing-pipeline.ts:359-388](../../lib/briefing/briefing-pipeline.ts#L359)) и сохраняет 'failed' второй записью. Stuck остаётся **только** при SIGKILL (Vercel terminate по timeout / OOM / Lambda crash) | Catch не помогает — корень в архитектуре «два INSERT'а», а не в его отсутствии |
| 3 | «UI либо крашится (React key duplicate, null sections), либо бесконечно показывает loader» | [latest/route.ts:14](../../app/(chat)/api/briefing/latest/route.ts#L14) и [page.tsx:58](../../app/(dashboard)/briefing/page.tsx#L58) **фильтруют по `status='ready'`**. Stuck 'generating' напрямую в UI не попадает — UI должен показать `NoBriefingsYet` | **Симптом «UI висит» в SPEC возможно misdiagnosed.** Нужно подтверждение от владельца — что именно он видел |
| 4 | «`deleteOldBriefingHistory({keepLast:1})` оставляет хвост» | [queries.ts:3195-3263](../../lib/db/queries.ts#L3195) — keepIds выбираются ТОЛЬКО `status='ready'`, удаляются ВСЕ остальные (включая stuck 'generating'!) | Каждый успешный прогон **самоочищает stuck-записи**. Они копятся только если **подряд** идут фейлы pipeline'а. SPEC переоценил масштаб. |

### ✅ Что в SPEC точно (подтверждено кодом)

- 4 call-site'а `saveBriefingHistory` в pipeline — все INSERT'ы ([briefing-pipeline.ts:104,171,327,365](../../lib/briefing/briefing-pipeline.ts)). Корень для UPSERT-фикса.
- `getPreviousBriefing` правильно возвращает только 'ready' ([queries.ts:3270](../../lib/db/queries.ts#L3270)) — на dedup pipeline'а stuck-запись не влияет.
- Хвост в БД при подряд-фейлах действительно растёт.

### Дополнительные находки

- **Концурренси:** `CRON_CONCURRENCY_LIMIT = 3` ([briefing-config.ts:33](../../lib/briefing/briefing-config.ts#L33)). Если **два прогона** на одного юзера запустятся параллельно (cron + ручная кнопка «Сгенерировать»), оба сделают свой INSERT('generating'). Сейчас защиты нет. Тоже относится к scope.
- **`/api/briefing/generate` (POST)** ([generate/route.ts](../../app/(chat)/api/briefing/generate/route.ts)) — нет idempotency-проверки «уже идёт генерация для userId». В cron такая проверка есть ([cron/briefing/route.ts:133-150](../../app/api/cron/briefing/route.ts#L133-L150) — «уже есть ready на сегодня — skip»), но она про success, не про in-progress.
- **`mergeAndUploadPodcast`** вызывается отдельно в cron route — это вне scope текущего ТЗ.

---

## Вопросы для уточнения (нужны до ROADMAP)

### Вопрос 1 (критичный): что конкретно ты видел при инциденте 2026-04-21

SPEC пишет «UI крашится / висит». Код фильтрует `status='ready'` — должен показать landing. Уточни:
- (a) UI **реально крашился** (React error overlay, белый экран)?
- (b) UI показывал **«no briefings yet» landing с кнопкой «Сгенерировать»**, но кнопка не помогала (повторно зависала / валилась)?
- (c) Был ли у тебя **до** инцидента 'ready' брифинг, который перестал отображаться?

От ответа зависит scope UI-guard — то ли это error-screen, то ли «warning banner про предыдущую неудачную попытку».

### Вопрос 2: масштаб watchdog и его место

SPEC предлагает SQL `UPDATE ... WHERE status='generating' AND generatedAt < NOW() - INTERVAL '10 minutes'` в начале cron. С учётом что cron daily — это закроет stuck с 24-часовым лагом (плохо).

Варианты:
- (A) Watchdog в **cron начале + в `/api/briefing/latest` GET** (idempotent SQL, сработает при первом заходе пользователя — мгновенно).
- (B) Только в cron (просто, но 24ч задержка).
- (C) Отдельный cron `/api/cron/briefing-watchdog` с другой частотой — **не пройдёт на Hobby** (только раз в сутки).

Рекомендую (A): SQL-cleanup идемпотентный (10 строк, без побочек), запускать на каждом GET `/briefing` — пользователь моментально видит чистое состояние.

### Вопрос 3: scope «UPSERT» — насколько глубоко рефакторить

Реальный путь — два INSERT'а заменить одним INSERT 'generating' → возвращаем `id` → UPDATE по `id` в финале/catch'е.
- (A) **Чистый рефакторинг** `saveBriefingHistory` — добавить параметр `existingId?` → если передан, делается UPDATE; иначе INSERT. Pipeline вызывает с id во 2-м, 3-м, 4-м call-сайтах.
- (B) **Новый helper** `updateBriefingHistory({id, ...})` — отдельная функция, более явная семантика. Pipeline хранит локальный `briefingId` после первого INSERT.

Рекомендую (B) — явнее, меньше неожиданных побочек. Все 4 call-сайта переписываем согласованно.

### Вопрос 4: UI — где именно показывать «застряло»

Если ответ на В1 = (b) (landing + бесполезная кнопка), правильно:
- В page.tsx или latest endpoint **дополнительно** грузим `getBriefingHistory({limit:1})` (без status-фильтра) → если последняя `'generating'` старше 10 мин и нет 'ready' за сегодня → флажок `staleGeneration: true`.
- На фронте — баннер «Предыдущая генерация прервалась. Запустить заново.» поверх обычного UI.

Альтернатива — отдельный recovery screen. Но это лишний UI-state, по моему опыту такие экраны со временем гниют.

Рекомендую баннер.

### Вопрос 5: concurrency guard (out of scope?)

Гонка cron-запуска и ручной «Сгенерировать»: если делать честно, нужна или partial unique index `(userId) WHERE status='generating'` (как сделано для simply-chat), или оптимистичный lock через `SELECT FOR UPDATE`. Хочешь это в scope этого ТЗ или отдельный хвост?

Если оставлять — это четвёртый этап, +0.2 сессии. Если выносить — backlog `TZ_BriefingConcurrencyGuard`.

---

## Рекомендации разработчика (Код-ревью SPEC)

### ✅ Согласен с ТЗ

- **UPSERT (UPDATE) вместо двух INSERT'ов** — это архитектурно правильный фикс корня. Критичен.
- **Watchdog в cron** — нужен как defense-in-depth для SIGKILL.
- **UI-guard** — нужен, без него юзер слепой.
- **Валидация topicId uniqueness — пункт 4 SPEC.** Согласен оставить опциональным; цена copy-paste, лечит остаточный риск с любых моделей.

### ⚠️ Рекомендую изменить

| # | Было (SPEC) | Рекомендация | Обоснование из кода |
|---|---|---|---|
| 1 | «hourly cron» в контексте | Документировать что cron daily; watchdog должен также сидеть в `/api/briefing/latest` GET | `vercel.json` daily; Hobby plan limit; см. Вопрос 2 |
| 2 | UI: отдельный recovery screen «Предыдущая не завершилась» с кнопкой | **Баннер поверх существующего UI**, без отдельного state | Меньше state-машины; см. Вопрос 4 |
| 3 | `STUCK_THRESHOLD_MINUTES = 10` | OK, но **зафиксировать как const в `lib/briefing/briefing-config.ts`** рядом с `CRON_CONCURRENCY_LIMIT` | SSOT |
| 4 | UPDATE c `jsonb_set` для error-сообщения в watchdog | Простой `set({status:'failed', briefingJson: sql\`...\`})` — но достаточно `briefingJson: { error: 'stuck', timeoutMinutes: 10 }` (валидный JSON, без jsonb_set) | Drizzle docs показывают чистый sql-helper; запись overwrite'ится новым валидным JSON, jsonb_set не нужен |

### ❓ Требует уточнения

- **Concurrency guard** (Вопрос 5) — расширять ли scope.
- **`/api/briefing/generate` POST idempotency** — если в течение генерации пользователь жмёт кнопку второй раз, делать ли пред-проверку «уже идёт» и возвращать ошибку?

---

## Потенциальные риски

1. **Регрессия на работающих юзерах при рефакторинге `saveBriefingHistory`.** 4 call-сайта в pipeline + ещё 4 update-сайта в queries.ts (`updateBriefingDeliveryStatus`, `updateBriefingMetadata` и др., строки 2564, 3087, 3147, 3180). Менять только `saveBriefingHistory` flow в pipeline; остальные uppdate-сайты не трогать.

2. **Watchdog SQL и concurrency.** Если watchdog отметит stuck запись 'failed' пока другой процесс делает свой UPDATE по тому же id — race. Mitigation: watchdog UPDATE по `WHERE status='generating' AND id != $currentRunId` (передаваемому из pipeline'а в локальную переменную).

3. **Тестируемость.** Воспроизвести SIGKILL локально нельзя. Имитация в dev — `throw new Error()` после первого INSERT. Это покрывает (b) сценарий, но не (a) истинный SIGKILL. OK для smoke, но в acceptance criteria это нужно явно зафиксировать.

4. **Old format briefingJson.** При watchdog UPDATE мы перезаписываем `briefingJson` на `{error:...}`. Но изначальный INSERT 'generating' писал `briefingJson: {}`. Так что данных мы не теряем. ОК.

5. **Двойная обработка stuck-записи.** Watchdog в cron + watchdog в GET — оба могут запустить UPDATE одновременно. Drizzle `.update()` с фильтром `WHERE status='generating' AND ...` — идемпотентен (UPDATE не сработает если статус уже изменился). OK.

---

## Зависимости

- **Что нужно сделать ДО:** ничего, ТЗ изолированный.
- **Какие компоненты затронуты:**
  - `lib/briefing/briefing-pipeline.ts` (4 call-сайта)
  - `lib/db/queries.ts` (`saveBriefingHistory` рефакторинг + новый `updateBriefingHistory` + новый `markStuckBriefingsAsFailed` watchdog)
  - `lib/briefing/briefing-config.ts` (новая const `STUCK_THRESHOLD_MINUTES`)
  - `app/api/cron/briefing/route.ts` (вызов watchdog в начале)
  - `app/(chat)/api/briefing/latest/route.ts` (вызов watchdog в начале + возврат `staleGeneration` флага)
  - `app/(dashboard)/briefing/page.tsx` (опционально — pass-through флага)
  - `components/briefing/briefing-page-client.tsx` (баннер «Предыдущая не завершилась» при `staleGeneration`)
- **Trigger-файлы по Правилу 6:**
  - `lib/db/queries.ts` — без триггера для docs/ (queries не SSOT-документ)
  - Никаких `task-assignments.ts`/`model-catalog.ts`/`schema.ts` изменений — docs/ai-chats-map / docs/architecture **не трогаем**.

---

## Оценка сложности

- [x] **Простое (1 сессия, ~0.5-0.8 как в SPEC)**
- [ ] Среднее
- [ ] Сложное

**Этапы (предварительно):**
1. Watchdog SQL helper + cron + latest endpoint (~0.2)
2. UPSERT-рефакторинг `saveBriefingHistory` + 4 call-сайта (~0.3)
3. UI-баннер staleGeneration (~0.2)
4. Smoke + dev-симуляция SIGKILL + commit (~0.1)

Опционально (если расширим scope):
- Concurrency guard через partial unique index (~0.2)
- topicId uniqueness валидация (~0.1)

---

## Стоп — нужны ответы на В1-В5 перед созданием ROADMAP.md
