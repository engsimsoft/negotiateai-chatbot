# Changelog ТЗ-BR1: Утренний брифинг — Backend

## Сессия 3 — 2026-02-19 (разработка — Этапы 2-4)

### Added
- Source fetchers: RSS (`rss-parser`), Telegram (cheerio `t.me/s/`), Web (Readability + JSDOM)
- Единый dispatcher `fetchSource()` по fetchMethod
- AI filter: Gemini 2.0 Flash — дедупликация, фильтрация → FilteredItem[]
- AI analyzer: Gemini 3 Pro — анализ, группировка → BriefingJSON
- Zod-схемы для structured output (filteredItemSchema, briefingJsonSchema)
- API endpoint `POST /api/briefing/generate` (auth, fetch, filter, analyze, save)
- Seed-скрипт `lib/db/seed-briefing.ts` (20 источников × 10 тем)
- npm script `db:seed-briefing`

### Fixed
- Убран `thinkingBudget: 0` из Gemini вызовов (ошибка "Budget 0 is invalid")

### Test Results
- 20 источников → 196 статей → 28 кандидатов → 14 новостей
- 8 тем в брифинге, ~56K токенов, HTTP 200

### Files
- lib/briefing/source-fetchers/types.ts
- lib/briefing/source-fetchers/rss-fetcher.ts
- lib/briefing/source-fetchers/telegram-fetcher.ts
- lib/briefing/source-fetchers/web-fetcher.ts
- lib/briefing/source-fetchers/index.ts
- lib/briefing/briefing-filter.ts
- lib/briefing/briefing-analyzer.ts
- app/(chat)/api/briefing/generate/route.ts
- lib/db/seed-briefing.ts
- package.json

### Git
- `6af1f9d` feat(tz-br1): source fetchers (RSS, Telegram, Web)
- `f4ca99d` feat(tz-br1): AI pipeline (filter + analyzer)
- `a91cb62` feat(tz-br1): API endpoint + seed script

---

## Сессия 2 — 2026-02-19 (разработка — Этап 1)

### Added
- 3 таблицы в `lib/db/schema.ts`: briefingSettings, briefingSources, briefingHistory
- Индексы: userId для всех, (userId, generatedAt) для history
- Миграция `0031_briefing-tables.sql` (ручная, applied)
- 7 CRUD queries в `lib/db/queries.ts`: getBriefingSettings, upsertBriefingSettings, getBriefingSources, addBriefingSource, deleteBriefingSource, saveBriefingHistory, getBriefingHistory
- `lib/briefing/briefing-config.ts` — константы (лимиты, таймауты, модели)
- `lib/briefing/topics-catalog.ts` — 10 тем × 3-4 источника с реальными RSS
- Зависимости: rss-parser, cheerio, @mozilla/readability, jsdom, @types/jsdom

### Files
- lib/db/schema.ts
- lib/db/queries.ts
- lib/db/migrations/0031_briefing-tables.sql
- lib/db/migrations/meta/_journal.json
- lib/briefing/briefing-config.ts
- lib/briefing/topics-catalog.ts
- package.json
- pnpm-lock.yaml

### Git
- `7dddf30` feat(tz-br1): database schema + config + topics catalog

---

## Сессия 1 — 2026-02-19 (анализ + планирование)

### Added
- ANALYSIS.md — анализ ТЗ, вопросы (закрыты), рекомендации (согласованы)
- ROADMAP.md — план реализации (5 этапов)
- CHANGELOG.md — лог изменений
- HANDOFF.md — передача между сессиями

### Decisions
- Route group: `app/(chat)/api/briefing/` (auth единообразие)
- Web-фетчер: `@mozilla/readability` + `jsdom`
- Gemini 3 Pro: `gemini-3-pro` (подтверждён графиком)
- Seed: скрипт `lib/db/seed-briefing.ts`
- Дефолт: 10 тем × 2 источника
