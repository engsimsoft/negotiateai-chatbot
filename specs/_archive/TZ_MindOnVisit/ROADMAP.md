# Roadmap ТЗ-MindOnVisit

**Создан:** 2026-04-21 (обновлён под 3-стратегийный scope)
**Версия проекта:** 3.95.0 → 3.96.0
**Статус:** 🔄 В работе

---

## Обзор

| Метрика | Значение |
|---|---|
| Этапов | 6 |
| Текущий этап | 1 |
| Сессий (оценка) | 1-2 |
| Коммитов | 1 (финализация, правило 7 WORKFLOW) |

---

## Этапы

### Этап 1: Миграция БД + query-функции

**Статус:** ⬜ Не начат

**Цель:** Добавить 2 поля в `memory_settings` + утилиты для on-visit.

**Задачи:**
- [ ] В [schema.ts](../../lib/db/schema.ts) добавить в `memorySettings`:
  - `factExtractionStrategy: text('factExtractionStrategy').notNull().default('always')` — enum в TS `'always' | 'on-visit' | 'cron'`
  - `lastMindCheckAt: timestamp('lastMindCheckAt')` — nullable
- [ ] Сгенерировать миграцию: `npx drizzle-kit generate`
- [ ] В [queries.ts](../../lib/db/queries.ts):
  - [ ] `claimMindCheck({ userId, debounceMs })` — атомарный UPDATE, возвращает true если claim получен
  - [ ] `getUnextractedMessagesForUser({ userId, sourceType, limit })` — обобщённая, принимает sourceType
  - [ ] `getUsersWithStaleMessagesByStrategy(strategy, minAgeMs)` — для cron, с фильтром `factExtractionStrategy IN (...)`
- [ ] В [context-limits.ts](../../lib/ai/context-limits.ts) добавить `MIND_CHECK_DEBOUNCE_MS = 30 * 60 * 1000`

**Валидация:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] ⚠️ **Предупредить владельца** перед `npm run build` (миграция!)
- [ ] SQL: `information_schema.columns` показывает оба новых поля

---

### Этап 2: API + UI (настройки памяти)

**Статус:** ⬜ Не начат

**Цель:** Пользователь видит выбор стратегии в настройках, может переключать.

**Задачи:**
- [ ] Расширить `GET /api/user/memory/settings` — возвращать `factExtractionStrategy`
- [ ] Расширить `PATCH /api/user/memory/settings` — принимать `factExtractionStrategy`, валидировать enum
- [ ] В [memory-section.tsx](../../components/settings/memory-section.tsx) добавить радио-группу под тумблером:
  - «🟢 Всегда актуально (on-visit + cron) — рекомендуется»
  - «💰 Только при работе (on-visit) — экономно»
  - «🌙 Только ночью (cron) — классика»
  - Описания каждого варианта (2-3 строки русского текста)
- [ ] Disable радио если `memoryEnabled=false`
- [ ] Toast при успешном переключении

**Валидация:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run dev` — открыть настройки, переключить между всеми 3 вариантами, перезагрузить страницу → выбор сохранён
- [ ] 🧪 Мануальный тест владельцем

---

### Этап 3: On-visit trigger

**Статус:** ⬜ Не начат

**Цель:** Модуль on-visit + интеграция в оба chat route через `after()`.

**Задачи:**
- [ ] Создать `lib/ai/memory/on-visit.ts` с `processStaleFactsOnVisit({ userId, sourceType, chatId })`:
  - Читать `memory_settings.factExtractionStrategy` → если `'cron'`, return
  - `claimMindCheck` (30 мин дебаунс) → если не получен, return
  - Цикл: пока `getUnextractedMessagesForUser` возвращает сообщения → `batchExtractFacts` → повтор
  - Логирование: `[MIND on-visit] user=... strategy=... processed=... stored=... iterations=...`
- [ ] Экспорт из `lib/ai/memory/index.ts`
- [ ] В [chat/route.ts](../../app/(chat)/api/chat/route.ts): `after(async () => processStaleFactsOnVisit(...))` перед `return`
- [ ] Аналогично в [tasks/[taskId]/chat/route.ts](../../app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts)
- [ ] sourceType определяется по chatMode (simply/expertise/create) или 'project' для task chat

**Валидация:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — зелёный
- [ ] 🧪 Мануальный тест:
  1. Режим `always` → короткое сообщение в Simply → через 5 сек в логах `[MIND on-visit] strategy=always processed=...`
  2. Режим `on-visit` — то же
  3. Режим `cron` → сообщение → в логах `[MIND on-visit] strategy=cron, skip`
  4. Дебаунс: в режиме `always`/`on-visit` повторное сообщение через 5 мин → `[MIND on-visit] debounced`
  5. Повторить (1) для Expertise, Create, Project

---

### Этап 4: Расширение cron на все режимы + учёт стратегии

**Статус:** ⬜ Не начат

**Цель:** Cron обрабатывает все 4 sourceType, но только пользователей со стратегией `always` или `cron`.

**Задачи:**
- [ ] Переписать `getUsersWithStaleSimplyMessages` → `getUsersWithStaleMessagesByStrategy(strategies: string[], minAgeMs)` — без фильтра `chatMode`, с JOIN на `memory_settings`, фильтром по `factExtractionStrategy IN strategies`
- [ ] В [app/api/cron/memory-profile/route.ts](../../app/api/cron/memory-profile/route.ts):
  - Вызывать с `strategies = ['always', 'cron']`
  - Для каждого пользователя — запрашивать сообщения через `getUnextractedMessagesForUser` с корректным sourceType (определять из `chatMode` сообщения)
  - Лог пропусков: `[cron/memory-profile] user=... skipped (strategy=on-visit)` — только если пользователь есть но стратегия исключает
- [ ] Проверить что `CronRunLog` продолжает писаться корректно

**Валидация:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] Триггер cron вручную: `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/memory-profile`
- [ ] SQL: факты из expertise/create/projects появились после срабатывания cron
- [ ] SQL: пользователь со стратегией `on-visit` НЕ обработан cron'ом

---

### Этап 5: Документация

**Статус:** ⬜ Не начат

**Цель:** MIND_ARCHITECTURE.md отражает новую реальность (3 стратегии + on-visit).

**Задачи:**
- [ ] [MIND_ARCHITECTURE.md §1 диаграмма] — добавить развилку: compaction → [if stale after compaction] on-visit trigger OR cron trigger (в зависимости от стратегии)
- [ ] [§2 таблица] — новая колонка «Кто триггерит» (compaction / on-visit / cron) с учётом стратегии
- [ ] [§5 параметры] — добавить `MIND_CHECK_DEBOUNCE_MS = 30min`, описать `factExtractionStrategy`
- [ ] Раздел «UI настройки памяти» — краткое упоминание радио-выбора стратегии со ссылкой на [memory-section.tsx](../../components/settings/memory-section.tsx)

---

### Этап 6: Финализация

**Статус:** ⬜ Не начат

**Цель:** Единый коммит ТЗ, архивация.

**Задачи:**
- [ ] `package.json` → `3.96.0`
- [ ] `CHANGELOG.md` (главный) — запись о ТЗ
- [ ] Единый коммит: `feat(tz-mind-on-visit): выбор стратегии обработки хвостов памяти (on-visit / cron / оба)` + короткое тело 3-5 строк (правило 7)
- [ ] Перенести папку в `specs/_archive/TZ_MindOnVisit/`

---

## Финальная валидация

**SQL:**
```sql
-- Поля существуют
SELECT column_name FROM information_schema.columns
WHERE table_name='memory_settings' AND column_name IN ('factExtractionStrategy','lastMindCheckAt');

-- Распределение стратегий
SELECT "factExtractionStrategy", COUNT(*) FROM memory_settings GROUP BY 1;

-- Факты по источникам за последний час (после теста)
SELECT "sourceType", COUNT(*) FROM memory_entry
WHERE "createdAt" > NOW() - INTERVAL '1 hour' GROUP BY 1;
```

**Мануальный тест владельца (все 3 стратегии + все 4 режима):**
1. `always` + Simply короткая сессия → факт в базе через 5 сек (on-visit)
2. `always` + Expertise → факт в базе через 5 сек (on-visit)
3. `on-visit` + Create → факт в базе через 5 сек, cron пропускает ночью
4. `cron` + Project task → факт НЕ в базе сразу, появляется утром после cron
