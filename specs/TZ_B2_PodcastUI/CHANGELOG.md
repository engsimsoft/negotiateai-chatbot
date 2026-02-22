# Changelog ТЗ-Б2: PodcastUI

> История изменений в рамках этого ТЗ.
> После завершения — переносится в главный CHANGELOG.md

---

## Сессия 1 — 2026-02-22

### Added
- Папка `specs/TZ_B2_PodcastUI/` со всеми файлами ТЗ
- ANALYSIS.md: полный анализ кодовой базы, 7 рекомендаций (все согласованы), 6 вопросов (все отвечены)
- ROADMAP.md: 6 этапов разработки
- Client-safe аудио типы в `lib/briefing/briefing-types.ts` (`AudioStatus`, `AudioUrls`, `AudioDurations`)
- Audio props pipeline: server component → BriefingPageClient → BriefingIssueContent / BriefingIssueHeader

### Changed
- `app/(dashboard)/briefing/page.tsx` — извлекает audioStatus/audioUrls/audioDurations из DB
- `components/briefing/briefing-page-client.tsx` — новые props + useState для audio state
- `components/briefing/briefing-issue-content.tsx` — принимает audioStatus prop
- `components/briefing/briefing-issue-header.tsx` — принимает audioStatus prop

### Files
```
lib/briefing/briefing-types.ts
app/(dashboard)/briefing/page.tsx
components/briefing/briefing-page-client.tsx
components/briefing/briefing-issue-content.tsx
components/briefing/briefing-issue-header.tsx
specs/TZ_B2_PodcastUI/*
```
