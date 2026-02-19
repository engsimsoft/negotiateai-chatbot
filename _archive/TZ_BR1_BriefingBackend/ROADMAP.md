# Roadmap ТЗ-BR1: Утренний брифинг — Backend

**Создан:** 2026-02-19
**Версия проекта:** 3.25.1 → 3.26.0
**Статус:** ✅ Завершён

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 5 |
| Текущий этап | 1 |
| Сессий (оценка) | 2-3 |

---

## Этап 1: БД + Конфигурация

**Статус:** ✅ Завершён

**Цель:** 3 новые таблицы в БД, конфигурация брифинга, каталог тем с реальными RSS-фидами.

**Задачи:**
- [x] Установить npm-пакеты: `rss-parser`, `cheerio`, `@mozilla/readability`, `jsdom`, `@types/jsdom`
- [x] Добавить 3 таблицы в `lib/db/schema.ts`: `briefingSettings`, `briefingSources`, `briefingHistory`
- [x] Добавить индексы: userId для всех, (userId, generatedAt DESC) для history
- [x] Сгенерировать Drizzle миграцию (`npm run db:generate`)
- [x] Применить миграцию (`npm run db:migrate`)
- [x] Добавить CRUD queries в `lib/db/queries.ts` (getBriefingSettings, upsertBriefingSettings, getBriefingSources, addBriefingSource, deleteBriefingSource, saveBriefingHistory, getBriefingHistory)
- [x] Создать `lib/briefing/briefing-config.ts` — константы (лимиты, таймауты, модели)
- [x] Создать `lib/briefing/topics-catalog.ts` — 10 тем × 3-5 источников с реальными RSS

**Файлы:**
- `lib/db/schema.ts` — +3 таблицы
- `lib/db/queries.ts` — +CRUD для briefing
- `lib/db/migrations/0031_*.sql` — автогенерация Drizzle
- `lib/briefing/briefing-config.ts` — новый
- `lib/briefing/topics-catalog.ts` — новый
- `package.json` — +зависимости

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] SQL: проверить что таблицы созданы (`SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'Briefing%'`)
- [x] 🧪 Мануальный тест: SQL-проверка колонок, FK, индексов — всё ОК

**Git (после валидации):**
```bash
git add lib/db/schema.ts lib/db/queries.ts lib/db/migrations/ lib/briefing/ package.json pnpm-lock.yaml
git commit -m "feat(tz-br1): database schema + config + topics catalog"
```

**Критерий готовности:** 3 таблицы в БД, конфиг и каталог тем готовы, TypeScript компилируется.

---

## Этап 2: Фетчеры источников

**Статус:** ✅ Завершён

**Цель:** 3 фетчера (RSS, Telegram, Web) с единым интерфейсом RawContent[].

**Задачи:**
- [x] Создать `lib/briefing/source-fetchers/types.ts` — интерфейсы RawContent, FetchResult
- [x] Создать `lib/briefing/source-fetchers/rss-fetcher.ts` — парсинг RSS/Atom через `rss-parser`, фильтр 24ч
- [x] Создать `lib/briefing/source-fetchers/telegram-fetcher.ts` — парсинг `t.me/s/{channel}` через cheerio, посты за 24ч
- [x] Создать `lib/briefing/source-fetchers/web-fetcher.ts` — fetch + `@mozilla/readability` + `jsdom`, извлечение контента
- [x] Создать `lib/briefing/source-fetchers/index.ts` — единый fetchSource dispatcher (по fetchMethod)

**Файлы:**
- `lib/briefing/source-fetchers/types.ts` — новый
- `lib/briefing/source-fetchers/rss-fetcher.ts` — новый
- `lib/briefing/source-fetchers/telegram-fetcher.ts` — новый
- `lib/briefing/source-fetchers/web-fetcher.ts` — новый
- `lib/briefing/source-fetchers/index.ts` — новый

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] 🧪 Мануальный тест: нет (backend-only, тестируется в Этапе 4 через API)

**Git (после валидации):**
```bash
git add lib/briefing/source-fetchers/
git commit -m "feat(tz-br1): source fetchers (RSS, Telegram, Web)"
```

**Критерий готовности:** Все 3 фетчера компилируются, возвращают RawContent[].

---

## Этап 3: AI-пайплайн

**Статус:** ✅ Завершён

**Цель:** Двухэтапный AI-пайплайн: фильтрация (Gemini Flash) → анализ (Gemini 3 Pro).

**Задачи:**
- [x] Создать `lib/briefing/briefing-filter.ts` — Этап 1: Gemini 2.0 Flash, дедупликация, фильтрация → FilteredItem[]
- [x] Создать `lib/briefing/briefing-analyzer.ts` — Этап 2: Gemini 3 Pro, анализ, группировка → BriefingJSON
- [x] Определить Zod-схемы для FilteredItem и BriefingJSON (для generateObject) — внутри filter.ts и analyzer.ts

**Файлы:**
- `lib/briefing/briefing-filter.ts` — новый
- `lib/briefing/briefing-analyzer.ts` — новый

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] 🧪 Мануальный тест: нет (тестируется в Этапе 4 через API)

**Git (после валидации):**
```bash
git add lib/briefing/briefing-filter.ts lib/briefing/briefing-analyzer.ts
git commit -m "feat(tz-br1): AI pipeline (filter + analyzer)"
```

**Критерий готовности:** Оба модуля компилируются, принимают/возвращают правильные типы.

---

## Этап 4: API Endpoint + Seed

**Статус:** ✅ Завершён

**Цель:** Рабочий endpoint POST /api/briefing/generate + seed-скрипт для тестирования.

**Задачи:**
- [x] Создать `app/(chat)/api/briefing/generate/route.ts` — POST endpoint (auth, fetch, filter, analyze, save)
- [x] Добавить `maxDuration = 60` в route.ts
- [x] Создать `lib/db/seed-briefing.ts` — seed-скрипт (settings + 10-15 источников)
- [x] Добавить `"db:seed-briefing": "tsx lib/db/seed-briefing.ts"` в package.json scripts
- [x] Запустить seed для тестового пользователя
- [x] Протестировать полный пайплайн через curl

**Файлы:**
- `app/(chat)/api/briefing/generate/route.ts` — новый
- `lib/db/seed-briefing.ts` — новый
- `package.json` — +script

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Seed выполнен успешно (20 источников в БД)
- [x] `POST /api/briefing/generate` возвращает briefingJson с реальными новостями (14 items, 8 тем, 56K токенов)
- [x] 🧪 Мануальный тест: curl → 200 OK, реальные новости на русском

**Git (после валидации):**
```bash
git add app/(chat)/api/briefing/ lib/db/seed-briefing.ts package.json
git commit -m "feat(tz-br1): API endpoint + seed script"
```

**Критерий готовности:** curl → 200 OK, briefingJson содержит реальные новости, сгруппированные по темам.

---

## Этап 5: Финализация

**Статус:** ✅ Завершён

**Цель:** Документация, версия, архив.

**Задачи:**
- [x] SQL-проверка БД (таблицы, колонки, FK, индексы)
- [x] Финальное мануальное тестирование (пользователь) — подтверждено в Этапе 4
- [x] Обновить главный `CHANGELOG.md`
- [x] Обновить `SIMPLY_STATUS.md`
- [x] Обновить `CLAUDE.md` (добавить секцию Briefing)
- [x] Обновить `package.json` версию → 3.26.0
- [x] Переместить папку в `_archive/`

**Валидация:**
- [x] `npm run build` — успешен
- [x] Документация актуальна
- [x] Версия 3.26.0

**Git (после валидации):**
```bash
git add CHANGELOG.md SIMPLY_STATUS.md CLAUDE.md package.json
git commit -m "docs: changelog + version bump to v3.26.0"
```

**Критерий готовности:** Документация обновлена, ТЗ в архиве, версия 3.26.0.
