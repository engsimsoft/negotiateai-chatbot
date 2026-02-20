# Changelog ТЗ-WS2: Jina Reader API + Каскадный Fallback

## Сессия 1 — 2026-02-21

### Added
- `lib/ai/tools/jina-reader.ts` — Jina Reader API utility (headless Chrome)
- `JINA_READER_TIMEOUT = 10_000` в briefing-config.ts
- `JINA_API_KEY` в .env.local
- `source: 'readability' | 'semantic' | 'jina'` в FetchPageResult
- `FetchPageOptions` interface (maxLength, timeoutMs, forceJina)

### Changed
- `fetch-page.ts` — refactored to options object + Jina cascade + source tracking
- `MIN_CONTENT_LENGTH` — 200 → 5000 (агрессивный fallback на Jina)
- `CASCADE_TIMEOUT_MS = 8_000` — укороченный timeout для Readability в каскаде
- `fetch-url.ts` — новая сигнатура + timeout 30s + source в ответе
- `web-fetcher.ts` — новая сигнатура + forceJina option
- `index.ts` (dispatcher) — case "jina" → fetchWeb с forceJina: true

### Files
- lib/ai/tools/jina-reader.ts (новый)
- lib/ai/tools/fetch-page.ts
- lib/ai/tools/fetch-url.ts
- lib/briefing/briefing-config.ts
- lib/briefing/source-fetchers/web-fetcher.ts
- lib/briefing/source-fetchers/index.ts
