# Changelog ТЗ-TG1: Telegram Phase 1

## Сессия 1 — 2026-02-25

### Added
- ANALYSIS.md — анализ ТЗ, код-ревью, согласованные решения
- ROADMAP.md — план внедрения (5 этапов + финализация)
- CHANGELOG.md
- HANDOFF.md
- `lib/telegram/types.ts` — shared типы (TelegramPost, TelegramParseResult, ParseTelegramOptions)
- `lib/telegram/utils.ts` — утилиты URL (normalizeChannelUrl, extractChannelHandle)
- `lib/telegram/parser.ts` — shared парсер (parseTelegramChannel: cheerio, hasMedia, isValid, опции)

### Commits
- `f1ff307` — feat(tz-tg1): shared Telegram parser (types, utils, parser)

### Completed
- Этап 1: Shared Telegram Parser ✅ (tsc + build passed)

### Files
- specs/TZ_TG1_PeContract/ANALYSIS.md
- specs/TZ_TG1_PeContract/ROADMAP.md
- specs/TZ_TG1_PeContract/CHANGELOG.md
- specs/TZ_TG1_PeContract/HANDOFF.md
- lib/telegram/types.ts
- lib/telegram/utils.ts
- lib/telegram/parser.ts
