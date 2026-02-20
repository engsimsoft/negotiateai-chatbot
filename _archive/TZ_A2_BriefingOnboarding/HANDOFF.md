# ТЗ-A2: Briefing Onboarding — ЗАВЕРШЕНО

**Последнее обновление:** 2026-02-20
**Версия:** 3.30.0
**Статус:** ✅ Завершено (все 5 этапов)

---

## Статус этапов

- [x] Этап 1: БД + Queries + Промпт-файлы ✅ (commit `bc2db18`)
- [x] Этап 2: Backend — service-chat расширение ✅ (commit `b46cfc6`)
- [x] Этап 3: Frontend — split layout + чат ✅ (commit `0b2b04f`)
- [x] Этап 4: Edit mode + edge cases + polish ✅ (commit `c20d56b`)
- [x] Этап 5: Финализация ✅

---

## Результат

AI-собеседование для настройки утреннего брифинга:
- Split layout `/briefing/setup` (preview + чат)
- Claude Sonnet 4.6 проводит интервью, ищет источники через deepResearch
- Live preview с темами, источниками и tier badges
- Edit mode: загрузка сохранённых данных при повторном визите
- Роутинг `/briefing`: isActive → выпуск/заглушка, !isActive → лендинг
- Gemini 3 Pro Preview генерирует выпуски

---

## Ключевые решения

1. **Два tool вместо одного:** `updateBriefingPreview` (live preview) + `saveBriefingProfile` (save to DB)
2. **Mode injection строится программно** — create = static XML, edit = dynamic from DB
3. **stepCountIs динамический:** 8 для briefing-onboarding, 3 для остальных
4. **Модель:** `claude-sonnet-4-6` (отдельный entry в providers.ts)
5. **Standalone split layout** — useChat напрямую, не через ServiceChatCore
6. **Tool result extraction** — `tool-updateBriefingPreview` / `tool-saveBriefingProfile` part types + processedIdsRef
7. **Gemini 3 Pro ID:** `gemini-3-pro-preview` (с суффиксом `-preview`, без него API ошибка)
