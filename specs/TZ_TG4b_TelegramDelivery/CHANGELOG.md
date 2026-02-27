# Changelog ТЗ-TG4b: Доставка брифинга в Telegram

## Сессия 1 — 2026-02-28

### Added
- `lib/telegram/briefing-delivery.ts` — модуль доставки (formatBriefingMessage + deliverBriefingToTelegram + error handling)

### Changed
- `app/api/cron/briefing/route.ts` — generateForUser → generateAndDeliver, интеграция deliverBriefingToTelegram
- `lib/db/queries.ts` — getUsersForDelivery: Hobby plan daily cron (return all deliveryEnabled), Pro plan filter as comment

### Files
- lib/telegram/briefing-delivery.ts (new)
- app/api/cron/briefing/route.ts (modified)
- lib/db/queries.ts (modified)
- CHANGELOG.md (updated)
- SIMPLY_STATUS.md (updated)
- CLAUDE.md (updated)
- package.json (3.54.0 → 3.55.0)
