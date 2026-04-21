# ТЗ-MindOnVisit — Выбор стратегии обработки хвостов памяти (on-visit / cron / оба)

**Дата:** 2026-04-21
**Источник:** решение владельца после обсуждения в сессии Claude Code.
**Версия:** v1.0

---

## Проблема

После ТЗ-COMPACTION-UNIFY (v3.95.0, коммит 969b0b4) факты в MIND попадают **только** через compaction cycle — когда контекст чата заполняется до ~50%. Это значит:

1. Короткие сессии во всех 4 режимах (Simply, Expertise, Create, Projects) не доходят до compaction → факты из них висят в сообщениях с `extractedAt=NULL`, в памяти их нет.
2. Существующий ночной cron (`app/api/cron/memory-profile/`) **покрывает только Simply** (`sourceType: "simply"`, фильтр `chatMode='simply'`). Expertise / Create / Projects остаются без safety net.
3. Cron запускается каждую ночь в 3:00 МСК независимо от активности пользователей — минимальные но постоянные фоновые расходы (SQL-запрос к БД), ненулевая вероятность тихой поломки (слетел `CRON_SECRET` / сломался Vercel cron config).

## Решение

**Дать пользователю выбор стратегии обработки хвостов** через настройки памяти (компонент [components/settings/memory-section.tsx](../../components/settings/memory-section.tsx)). Реализовать все 3 стратегии в коде + расширить cron на все 4 chat-режима (сейчас только simply).

### 3 стратегии для пользователя

| Режим UI | Техника | Описание |
|---|---|---|
| 🟢 **Всегда актуально** (on-visit + cron) — **дефолт, рекомендуется** | Оба механизма | Обработка при визитах + ночная уборка. Память свежая и полная. |
| 💰 **Только при работе** (on-visit) — экономно | Только on-visit | Обработка когда пользователь сам зашёл. Ночью сервер молчит. 0 затрат при неактивности. |
| 🌙 **Только ночью** (cron) — классика | Только cron | Обработка раз в сутки в 3:00 МСК. Факты с задержкой до 24ч. |

### Обоснование Why-3-вариантов

- **Вариант «on-visit + cron»** — оптимальный для большинства: active users получают быстрый on-visit, пассивные покрываются cron как safety net.
- **Вариант «on-visit only»** — для пользователей с нерегулярным паттерном: месяцами не заходят, но когда приходят — активно пользуются. Абсолютный 0 затрат когда не пользуются.
- **Вариант «cron only»** — для пользователей которые не хотят никакой фоновой работы в своих сессиях (например, заметное лаговое окно сервера при большом объёме хвостов).

Briefing и другие автономные pipelines **не читают MIND** (подтверждено владельцем) — значит нет внешних потребителей «свежести» фактов, можно доверить выбор пользователю.

## Scope

### Что делаем

1. **Поле `factExtractionStrategy` в `memory_settings`** (string enum):
   - `'always'` — дефолт, on-visit + cron
   - `'on-visit'` — только on-visit
   - `'cron'` — только cron
   Миграция Drizzle.

2. **UI в `components/settings/memory-section.tsx`** — добавить радио-группу под текущим тумблером «Извлечение фактов». 3 варианта с описаниями на русском (как в финальной таблице SPEC выше) + PATCH-запрос на `/api/user/memory/settings`.

3. **API endpoint `/api/user/memory/settings`** — расширить PATCH для записи нового поля. Валидация enum.

4. **On-visit trigger (через Next.js `after()`):**
   - Helper `processStaleFactsOnVisit({ userId, sourceType, chatId })` в `lib/ai/memory/on-visit.ts`
   - Перед вызовом: проверить `factExtractionStrategy` → если `'cron'`, return (ничего не делаем)
   - Дебаунс: поле `lastMindCheckAt` в `memory_settings`, константа `MIND_CHECK_DEBOUNCE_MS = 30 * 60 * 1000` в `context-limits.ts`
   - Атомарный claim через `UPDATE ... WHERE lastMindCheckAt < NOW() - 30min RETURNING`
   - Интеграция в 2 route handler-а: `app/(chat)/api/chat/route.ts` (simply/expertise/create) и `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` (project)
   - Цикл обработки: пока есть хвосты — вызывать `batchExtractFacts` пачками по 50 (не превращать в один гигантский запрос)

5. **Cron — расширить, не удалять:**
   - Изменить SQL-функцию: вместо `getUsersWithStaleSimplyMessages` → `getUsersWithStaleMessages` (без фильтра `chatMode`, все 4 режима)
   - В `app/api/cron/memory-profile/route.ts` — обрабатывать sourceType каждого сообщения корректно
   - Добавить фильтр по `factExtractionStrategy` — cron НЕ трогает пользователей со стратегией `'on-visit'`

6. **SQL-функция `getUnextractedMessagesForUser({ userId, sourceType, limit })`** — обобщённая версия, используется и on-visit, и cron.

7. **Документация:**
   - `MIND_ARCHITECTURE.md §1` — диаграмма с развилкой по стратегии
   - `MIND_ARCHITECTURE.md §2` — обновить таблицу «Кто что вызывает» под новую реальность (3 режима)
   - `MIND_ARCHITECTURE.md §5` — добавить `MIND_CHECK_DEBOUNCE_MS`
   - В UI-секции — упоминание что стратегия настраивается пользователем

### Что НЕ делаем

- **Не трогаем `batchExtractFacts` и consolidation-цепочку** — работают корректно.
- **Не трогаем compaction middleware** — он срабатывает независимо от стратегии, факты из compaction всегда попадают в память сразу.
- **Не меняем модели** — та же Grok 4.1 Fast non-reasoning.
- **Не делаем миграцию существующих пользователей** — у всех текущих `factExtractionStrategy = 'always'` по дефолту поля.

## Acceptance Criteria

1. **UI.** В настройках памяти видна радио-группа «Стратегия обработки хвостов» с 3 вариантами и русскими описаниями. Переключение сохраняет значение (подтверждается через toast). При перезагрузке страницы текущий выбор сохранён.

2. **Режим `always` (дефолт).** Короткая сессия в любом из 4 режимов → on-visit обрабатывает хвосты через 5 сек после визита (лог `[MIND on-visit] strategy=always processed=... stored=...`). Ночью в 3:00 МСК cron также может сработать как safety net.

3. **Режим `on-visit`.** Та же сессия → on-visit срабатывает. Cron для этого пользователя **пропускает** (лог `[cron/memory-profile] user=... skipped (strategy=on-visit)`).

4. **Режим `cron`.** Та же сессия → on-visit **НЕ срабатывает** (лог `[MIND on-visit] strategy=cron, skip`). Факты попадают в память только после ночного cron (проверить на следующий день SQL).

5. **Дебаунс on-visit.** Режимы `always` и `on-visit`: повторный заход в течение 30 минут не вызывает повторную проверку БД (лог `[MIND on-visit] debounced`).

6. **Cron расширен на 4 режима.** После запуска cron (вручную через `curl`) — факты из expertise/create/projects попадают в память (не только из simply).

7. **`npx tsc --noEmit`** → 0 ошибок.

8. **Мануальный тест всех 3 режимов.** Владелец переключает в UI, пишет сообщение в каждом из 4 chat-режимов, проверяет поведение по логам и SQL.

9. **MIND_ARCHITECTURE обновлён.** Новая диаграмма с развилкой по стратегии + таблица операций + константа `MIND_CHECK_DEBOUNCE_MS`.

## Оценка

**1 сессия (0.5-1 день работы Claude Code).** Один коммит в финализации (Правило 7 WORKFLOW).

## Риски

1. **Race condition**: пользователь открывает 4 чата за 2 секунды → 4 вызова `processStaleFactsInBackground` → 4 попытки extract. Смягчается дебаунсом через `lastMindCheckAt` + атомарное обновление через transaction.
2. **Долгий первый заход после месяца неактивности**: большой батч сообщений обрабатывается дольше. Fire-and-forget не блокирует UI, но нагрузка на сервер повыше. Приемлемо для разового события.
3. **Потеря истории после удаления cron**: таблица `CronRunLog` больше не пополняется. Доля observability теряется — но on-visit проще логируется в обычных server logs.
