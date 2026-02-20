# Changelog ТЗ-WS1: Charset Detection + Унификация Web Fetcher

## Сессия 1 — 2026-02-20/21

### Added
- Charset detection pipeline в `fetchPage()` (HTTP header → meta → chardet → UTF-8)
- `chardet` + `iconv-lite` зависимости
- Improved fallback: JSDOM `querySelectorAll('p, h1-h6, li')` вместо regex strip

### Changed
- `web-fetcher.ts` — заменена дублирующая логика на вызов `fetchPage()` (-42 строки)

### Fixed
- Русскоязычные сайты на windows-1251/koi8-r теперь корректно читаются

### Files
- `lib/ai/tools/fetch-page.ts` — charset detection + improved fallback
- `lib/briefing/source-fetchers/web-fetcher.ts` — унификация через fetchPage()
- `package.json` — chardet, iconv-lite, version bump
