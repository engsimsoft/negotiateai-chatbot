# Changelog ТЗ-HF1: Briefing PE Update

> История изменений в рамках этого ТЗ.

---

## Сессия 1 — 2026-02-20

### Added
- `briefingStyle` (text, nullable) в таблицу `BriefingTopics` + миграция 0033
- `briefingStyle` в Zod-схему `briefingProfileSchema` для saveBriefingProfile
- `briefingStyle` в preview-компонент (мелким шрифтом под названием темы)
- Параметр `status?` в `getBriefingHistory()` для SQL-фильтрации

### Changed
- `addBriefingTopic()` — принимает и сохраняет `briefingStyle`
- `buildUserMessage()` (briefing-author.ts) — форматирует topics с briefingStyle
- `buildBriefingEditModeInjection()` — показывает briefingStyle в edit mode
- `maxSteps`: 8 → 30 (блокер при множественных fetchUrl)
- Промпт онбординга: v4 → v5 → v6 (обязательная верификация fetchUrl, приоритет тем)
- Промпт автора: v2 → v3 (приоритет тем из briefingStyle, крупные события)
- `getBriefingHistory()` вызовы — передают `status: "ready"` вместо клиентской фильтрации

### Fixed
- Исчезновение истории брифингов из сайдбара — `limit: 10` заполнялся `generating`-строками

### Files
```
lib/db/schema.ts
lib/db/queries.ts
lib/db/migrations/0033_add-briefing-style.sql
lib/db/migrations/meta/_journal.json
app/(chat)/api/service-chat/route.ts
app/(chat)/api/briefing/latest/route.ts
app/(dashboard)/briefing/page.tsx
app/(dashboard)/briefing/[date]/page.tsx
app/(dashboard)/briefing/setup/page.tsx
app/(dashboard)/briefing/setup/components/briefing-profile-preview.tsx
lib/briefing/briefing-author.ts
lib/prompts/service-chats/briefing-onboarding.md
lib/prompts/briefing/briefing-author.md
```
