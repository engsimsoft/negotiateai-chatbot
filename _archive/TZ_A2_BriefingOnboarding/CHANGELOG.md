# Changelog ТЗ-A2: Briefing Onboarding

> История изменений в рамках этого ТЗ.
> После завершения — переносится в главный CHANGELOG.md

---

## Сессия 1 — 2026-02-20

### Added
- Таблица `BriefingTopics` (userId, topicId, topicName, emoji, orderIndex, createdAt) + unique index
- Миграция `0032_briefing-topics.sql` (применена к production БД)
- Query `getBriefingTopics(userId)` — получение тем пользователя
- Query `addBriefingTopic(...)` — добавление темы
- Query `deleteAllBriefingTopicsByUser(userId)` — удаление всех тем пользователя
- Query `deleteAllBriefingSourcesByUser(userId)` — удаление всех источников пользователя
- Промпт `lib/prompts/service-chats/briefing-onboarding.md` (из PE v2 + updateBriefingPreview)
- Mode injection `lib/prompts/service-chats/briefing-onboarding-mode-injection.md` (справочный)
- Модель `claude-sonnet-4-6` в `lib/ai/providers.ts`
- Рабочие файлы ТЗ: SPEC.md, ANALYSIS.md, ROADMAP.md, HANDOFF.md

### Changed
- Default `generationTime` в `upsertBriefingSettings`: "06:00" → "07:00"

### Files
```
lib/db/schema.ts
lib/db/queries.ts
lib/db/migrations/0032_briefing-topics.sql
lib/db/migrations/meta/_journal.json
lib/ai/providers.ts
lib/prompts/service-chats/briefing-onboarding.md
lib/prompts/service-chats/briefing-onboarding-mode-injection.md
specs/TZ_A2_BriefingOnboarding/*
```
