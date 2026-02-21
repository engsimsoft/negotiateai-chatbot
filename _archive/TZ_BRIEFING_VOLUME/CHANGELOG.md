# Changelog ТЗ-BRIEFING-VOLUME

> История изменений в рамках этого ТЗ.

---

## Сессия 1 — 2026-02-21

### Added
- MAX_CONTENT_LENGTH: 1000 → 6000 (мгновенный эффект на глубину контента)
- `volume` VARCHAR(20) DEFAULT 'standard' в BriefingSettings + миграция 0034
- `volume` в Zod-схеме briefingProfileSchema (compact/standard/detailed)
- `volume` в AuthorInput → buildUserMessage → user message для Gemini Pro
- Промпт автора v3 → v4 (таблицы объёмов, volume+briefingStyle взаимодействие)
- Промпт онбординга v7 → v8 (шаг 8.5 выбор volume, edit mode, edge cases)
- VOLUME_LABELS + отображение volume в BriefingProfilePreview
- volume в buildBriefingEditModeInjection (edit mode)

### Fixed
- page.tsx: initialProfile не передавал volume из settings в клиент (edit mode)
- briefing-article-view.tsx: React key uniqueness для CollapsibleSources

### Discovered (pre-existing bug, separate TZ)
- fullTextsMap keyed by source page URL, but candidates have individual article URLs → 0 full texts reach the author

### Files
```
lib/briefing/briefing-config.ts
lib/db/schema.ts
lib/db/migrations/0034_add-briefing-volume.sql
lib/db/migrations/meta/_journal.json
lib/db/queries.ts
app/(chat)/api/service-chat/route.ts
lib/briefing/briefing-author.ts
app/(chat)/api/briefing/generate/route.ts
lib/prompts/briefing/briefing-author.md
lib/prompts/service-chats/briefing-onboarding.md
app/(dashboard)/briefing/setup/components/briefing-profile-preview.tsx
app/(dashboard)/briefing/setup/page.tsx
components/briefing/briefing-article-view.tsx
```
