# ROADMAP: ТЗ-BRIEFING-VOLUME

**Версия:** v3.36.0
**Цель:** Поднять MAX_CONTENT_LENGTH + добавить briefingVolume (compact/standard/detailed)

---

## Этап 1: MAX_CONTENT_LENGTH (мгновенный эффект) ✅

- [x] 1.1 `lib/briefing/briefing-config.ts` — изменить MAX_CONTENT_LENGTH: 1000 → 6000
- [x] 1.2 `npx tsc --noEmit` → 0 ошибок

---

## Этап 2: DB Schema + Migration ✅

- [x] 2.1 `lib/db/schema.ts` — добавить поле `volume` VARCHAR(20) DEFAULT 'standard' в `briefingSettings`
- [x] 2.2 Создать SQL миграцию `0034_add-briefing-volume.sql`
- [x] 2.3 Применить миграцию: `npm run db:migrate`
- [x] 2.4 `npx tsc --noEmit` → 0 ошибок

---

## Этап 3: Query + Tool (сохранение volume) ✅

- [x] 3.1 `lib/db/queries.ts` — upsertBriefingSettings: добавить `volume` в сигнатуру, update и insert
- [x] 3.2 `app/(chat)/api/service-chat/route.ts` — briefingProfileSchema.settings: добавить `volume` в Zod
- [x] 3.3 `app/(chat)/api/service-chat/route.ts` — saveBriefingProfile.execute: передать volume в upsertBriefingSettings
- [x] 3.4 `npx tsc --noEmit` → 0 ошибок

---

## Этап 4: Author pipeline (передача volume автору) ✅

- [x] 4.1 `lib/briefing/briefing-author.ts` — AuthorInput: добавить `volume?: string`
- [x] 4.2 `lib/briefing/briefing-author.ts` — buildUserMessage: принять volume, вставить строку в user message
- [x] 4.3 `app/(chat)/api/briefing/generate/route.ts` — передать `settings?.volume ?? "standard"` в generateArticle
- [x] 4.4 `npx tsc --noEmit` → 0 ошибок

---

## Этап 5: Промпты ✅

- [x] 5.1 `lib/prompts/briefing/briefing-author.md` — замена v3 → v4
- [x] 5.2 `lib/prompts/service-chats/briefing-onboarding.md` — патч v7 → v8 (10 изменений)
- [x] 5.3 Проверить что промпты корректно читаются (нет синтаксических проблем)

---

## Этап 6: Edit mode + UI Preview ✅

- [x] 6.1 `app/(chat)/api/service-chat/route.ts` — buildBriefingEditModeInjection: показать текущий volume в settingsLines
- [x] 6.2 `app/(dashboard)/briefing/setup/components/briefing-profile-preview.tsx` — BriefingSettings: добавить `volume?`
- [x] 6.3 Там же — отобразить volume в секции settings summary (между language и maxItems)
- [x] 6.4 `npx tsc --noEmit` → 0 ошибок

---

## Этап 7: Финализация ✅

- [x] 7.1 `npm run build` → успех
- [x] 7.2 Мануальный тест — диагностический прогон с 5 DIAG-точками
  - DIAG-1: MAX_CONTENT_LENGTH = 6000 ✅
  - DIAG-2: 13 items fetched, контент до 6000 chars ✅
  - DIAG-3: 27 candidates after filter ✅
  - DIAG-4: Volume = "detailed" доходит до автора ✅
  - DIAG-5: 2 секции ~330 слов (мало для detailed) — выявлен баг fullText URL mismatch (pre-existing, отдельное ТЗ)
