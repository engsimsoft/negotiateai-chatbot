# Roadmap ТЗ-TG4a: Фоновая генерация брифинга

**Создан:** 2026-02-26
**Версия проекта:** 3.53.0 → 3.54.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 5 |
| Текущий этап | 3 |
| Сессий (оценка) | 2-3 |

**Согласованные решения (из ANALYSIS.md):**
- Vercel Cron + API route + waitUntil + p-limit (без Inngest)
- Текст ready → podcast параллельно, не блокирует доставку
- Используем существующее поле `generationTime` (не создаём `deliveryTime`)
- UI доставки в `/briefing/setup` — отдельный блок под профилем

---

## Этап 1: Извлечение pipeline в переиспользуемую функцию

**Статус:** ✅ Завершён

**Цель:** Вся логика генерации брифинга вынесена из route.ts в отдельную функцию, существующий browser flow работает как раньше.

**Задачи:**
- [x] Создать `lib/briefing/briefing-pipeline.ts` с функцией `runBriefingPipeline()`
  - Параметры: `{ userId, onProgress? }`
  - Возвращает: `BriefingPipelineResult` (article, sourcesChecked, itemsIncluded, duplicatesRemoved, tokensUsed, status, error?)
  - `onProgress` — опционально, для streaming в браузер
  - Вся логика из `route.ts` переносится сюда: load settings → fetch → filter → generate → save
- [x] Рефакторить `app/(chat)/api/briefing/generate/route.ts` — вызывать `runBriefingPipeline()` с `onProgress = emit`
- [x] Проверить что browser flow работает идентично (stream, progress events, error handling)

**Файлы:**
- `lib/briefing/briefing-pipeline.ts` — **новый** (core pipeline)
- `lib/briefing/briefing-types.ts` — добавить `BriefingPipelineResult` тип
- `app/(chat)/api/briefing/generate/route.ts` — рефакторинг (тонкая обёртка)

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: генерация брифинга через кнопку работает с progress bar (connecting → fetching → filtering → writing → complete)
- [x] 🧪 Мануальный тест: сгенерировать брифинг в браузере, проверить что все шаги отображаются

**Git (после валидации):**
```bash
git add lib/briefing/briefing-pipeline.ts lib/briefing/briefing-types.ts app/(chat)/api/briefing/generate/route.ts
git commit -m "refactor(tz-tg4a): extract briefing pipeline into reusable function"
```

**Критерий готовности:** `runBriefingPipeline()` работает и с onProgress (browser), и без него (silent/background). Существующий flow не сломан.

---

## Этап 2: Расширение БД + миграция

**Статус:** ✅ Завершён

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 1

**Цель:** Новые поля в БД для настроек доставки и статуса доставки per-выпуск.

**Задачи:**
- [x] Добавить поля в `BriefingSettings` (schema.ts):
  - `deliveryEnabled` (boolean, default false) — автоматическая генерация + доставка
  - `deliveryFormat` (varchar(20), default "text_audio") — "text" | "text_audio"
- [x] Добавить поле в `BriefingHistory` (schema.ts):
  - `deliveryStatus` (varchar(20), default "none") — "none" | "pending" | "sent" | "failed"
- [x] Обновить `upsertBriefingSettings()` в queries.ts — поддержка новых полей (deliveryEnabled, deliveryFormat)
- [x] Добавить query `updateBriefingDeliveryStatus()` в queries.ts — обновление deliveryStatus в BriefingHistory
- [x] Добавить query `getUsersForDelivery()` в queries.ts — выборка пользователей с deliveryEnabled=true и подходящим generationTime для текущего cron-слота
- [x] Применить миграцию: `drizzle-kit push --force`
- [x] Проверить миграцию через SQL-запрос к БД

**Файлы:**
- `lib/db/schema.ts` — 2 таблицы (BriefingSettings + BriefingHistory)
- `lib/db/queries.ts` — обновить upsertBriefingSettings, добавить 2 новые query

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] SQL: BriefingSettings — deliveryEnabled (boolean, false), deliveryFormat (varchar, "text_audio")
- [x] SQL: BriefingHistory — deliveryStatus (varchar, "none")
- [x] 🧪 Существующие данные не затронуты (проверено SQL)

**Git (после валидации):**
```bash
git add lib/db/schema.ts lib/db/queries.ts lib/db/migrations/
git commit -m "feat(tz-tg4a): add delivery settings and status to briefing tables"
```

**Критерий готовности:** Миграция применена, новые поля видны в БД, типы корректны, старые данные не затронуты.

---

## Этап 3: Vercel Cron + Background generation route

**Статус:** ✅ Завершён (тесты пройдены, ожидает мануальный тест podcast в браузере)

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 2

**Цель:** Cron каждые 15 минут триггерит API route, который находит пользователей для генерации и запускает pipeline в фоне.

**Задачи:**
- [x] Создать `vercel.json` с cron-расписанием (каждые 15 минут)
- [x] Создать `app/api/cron/briefing/route.ts` — cron endpoint:
  - Проверка CRON_SECRET (авторизация cron)
  - Вызов `getUsersForDelivery()` с текущим UTC-слотом
  - Для каждого пользователя: p-limit(3) конкурентность
  - Идемпотентность: skip если ready-брифинг есть за сегодня (UTC)
  - После успеха → `updateBriefingDeliveryStatus(briefingId, 'pending')`
  - Если deliveryFormat === 'text_audio' → `waitUntil(runPodcastPipeline(...))` non-blocking
- [x] Извлечь podcast core logic в `lib/podcast/podcast-pipeline.ts`:
  - Функция `runPodcastPipeline({ userId, briefingId?, topicIds?, onProgress? })`
  - Работает с onProgress (browser streaming) и без (background/cron)
- [x] Рефакторить `app/(chat)/api/briefing/podcast/generate/route.ts` — тонкая обёртка (auth + stream)
- [x] Добавить константы в `briefing-config.ts`: CRON_INTERVAL_MINUTES, CRON_CONCURRENCY_LIMIT, CRON_MAX_DURATION
- [x] `maxDuration = 240` в cron route (литерал, Next.js требует)
- [ ] Добавить `CRON_SECRET` в `.env.local` и Vercel env vars

**Файлы:**
- `vercel.json` — **новый** (cron config)
- `app/api/cron/briefing/route.ts` — **новый** (cron handler)
- `lib/podcast/podcast-pipeline.ts` — **новый** (extracted podcast core)
- `app/(chat)/api/briefing/podcast/generate/route.ts` — рефакторинг (вызов podcast-pipeline)
- `lib/briefing/briefing-config.ts` — добавить CRON_INTERVAL_MINUTES = 15

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Тест cron endpoint: 200 OK, `{"ok":true,"usersProcessed":1,"results":[{"status":"generated"}]}`
- [x] Pipeline запустился: ready, 16 items, deliveryStatus='pending'
- [x] Идемпотентность: повторный вызов → `{"status":"skipped"}`
- [x] Auth: неверный CRON_SECRET → 401 Unauthorized
- [x] Middleware: добавлено исключение `/api/cron/` (не требует JWT)
- [ ] 🧪 Browser podcast generation — ожидает мануальный тест пользователя

**Git (после валидации):**
```bash
git add vercel.json app/api/cron/briefing/route.ts lib/podcast/podcast-pipeline.ts lib/briefing/briefing-config.ts app/(chat)/api/briefing/podcast/generate/route.ts middleware.ts
git commit -m "feat(tz-tg4a): vercel cron + background briefing generation"
```

**Критерий готовности:** Cron endpoint генерирует брифинг для пользователей с deliveryEnabled без браузера. Идемпотентность работает. Podcast запускается параллельно без блокировки.

---

## Этап 4: UI настроек доставки

**Статус:** ✅ Завершён (ожидает мануальный тест)

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 3

**Цель:** Пользователь может включить/выключить автоматическую генерацию, выбрать время и формат доставки.

**Задачи:**
- [x] ⛔ Прочитать `docs/design-system.md` перед началом работы с UI
- [x] Создать компонент `components/briefing/briefing-delivery-settings.tsx`:
  - Toggle: включить/выключить автоматическую генерацию (`deliveryEnabled`)
  - Time picker: выбор времени (HH:MM) — Label "Время доставки" (`generationTime`)
  - Format selector: текст / текст + аудио (`deliveryFormat`)
  - Статус Telegram: подключён/нет (читаем из telegramConnection), ссылка на /settings#connections
  - Disable все контролы если Telegram не подключён (с пояснением)
  - Семантические токены, Apple-стиль, mobile-first
- [x] Создать API route `app/(chat)/api/briefing/delivery/route.ts`:
  - GET: текущие настройки доставки (deliveryEnabled, generationTime, deliveryFormat, timezone) + telegram status
  - PATCH: обновить настройки доставки (вызывает upsertBriefingSettings)
- [x] Интегрировать компонент в `/briefing/setup`:
  - Добавлен как отдельная секция под preview (border-t) в aside
- [ ] Показывать блок доставки также на странице /briefing (в шестерёнке или header)

**Файлы:**
- `components/briefing/briefing-delivery-settings.tsx` — **новый**
- `components/ui/switch.tsx` — **новый** (shadcn Switch)
- `app/(chat)/api/briefing/delivery/route.ts` — **новый**
- `app/(dashboard)/briefing/setup/briefing-setup-client.tsx` — интеграция (import + aside)

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: на /briefing/setup видны настройки доставки (Popover от иконки Clock в header)
- [x] Браузер: toggle включает/выключает, время сохраняется, формат переключается (3 формата: text/audio/text_audio)
- [x] Браузер: без Telegram — контролы disabled с подсказкой
- [x] 🧪 Мануальный тест пройден

**Git (после валидации):**
```bash
git add components/briefing/briefing-delivery-settings.tsx app/(chat)/api/briefing/delivery/route.ts app/(dashboard)/briefing/setup/components/briefing-profile-preview.tsx
git commit -m "feat(tz-tg4a): delivery settings UI on briefing setup page"
```

**Критерий готовности:** Пользователь может настроить доставку из UI, данные сохраняются в БД, Telegram-зависимость отражена.

---

## Этап 5: Финализация

**Статус:** ✅ Завершён

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 4
⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../DOCUMENTATION_GUIDE.md) — пройти чеклист.

**Задачи:**

**Проверка БД (Claude делает):**
- [x] SQL: все таблицы существуют
- [x] SQL: BriefingSettings — новые колонки (deliveryEnabled, deliveryFormat)
- [x] SQL: BriefingHistory — новая колонка (deliveryStatus)

**Документация (обязательная):**
- [x] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти "✅ Чек-лист при изменениях"
- [x] Обновить главный CHANGELOG.md
- [x] Обновить SIMPLY_STATUS.md
- [x] Обновить CLAUDE.md (новые файлы: briefing-pipeline.ts, podcast-pipeline.ts, cron route, delivery settings)
- [x] Обновить package.json: 3.53.0 → 3.54.0

**Документация (по чеклисту — оценить каждый пункт):**
- [x] ADR нужен? → **Да:** `docs/decisions/026-background-briefing-architecture.md`
- [x] docs/architecture.md нужно обновить? → **Да** (cron infrastructure, background pipeline)
- [x] docs/ai-tools.md нужно обновить? → Нет (AI инструменты не менялись)
- [x] docs/ai-chats-map.md нужно обновить? → Нет (AI модели не меняются)
- [x] docs/ai-agents.md нужно обновить? → Нет
- [x] docs/design-system.md нужно обновить? → Нет (Switch — стандартный shadcn, Popover уже задокументирован)

**Верификация docs против кода:**
- [x] CLAUDE.md → пути файлов и описания актуальны
- [x] vercel.json задокументирован (в architecture.md + CLAUDE.md)

**Завершение:**
- [x] Мануальное тестирование пройдено пользователем (Этап 3 + Этап 4)
- [ ] Переместить папку в `_archive/`

**Валидация:**
- [ ] `npm run build` — успешен
- [x] Документация актуальна (проверено по чеклисту выше)

**Git (после валидации):**
```bash
git add -A
git commit -m "chore(tz-tg4a): finalize v3.54.0 — BackgroundBriefing"
```
