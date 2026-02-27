# Передача сессии ТЗ-FIX3

**Дата:** 2026-02-27
**Сессия:** 1 (подготовка)

## Статус этапов
- [ ] Этап 1: route.ts — единый набор инструментов ← НАЧАТЬ ЗДЕСЬ
- [ ] Этап 2: Промпт v11
- [ ] Этап 3: Финализация

## Следующая сессия: начни с
1. `Read specs/TZ_FIX3_OnboardingRestore/ROADMAP.md` → Этап 1
2. Реализовать изменения в `app/(chat)/api/service-chat/route.ts`
3. `npx tsc --noEmit` → 0 ошибок
4. `npm run build` → успешен
5. Мануальный тест → Этап 2

## Контекст

**Проблема:** ТЗ-FIX2 (v3.52.0) сломал онбординг брифинга:
- В create mode заменил 5 инструментов на 1 тяжёлый (startResearch)
- maxSteps снизил с 30 до 10
- AI вызывает startResearch на каждое сообщение (включая "сохрани") → $2 за диалог
- Диалог стал тупым, нет обратной связи о сохранении

**Решение:** Вернуть create mode те же 5 инструментов (deepResearch, fetchUrl, readTelegramChannel, updateBriefingPreview, saveBriefingProfile) и maxSteps=30.

## Уже сделано
- [x] Починен saveBriefingProfile: убран сломанный verifiedSourceUrls filter (коммит `e418045`)
- [x] Подтверждено: 3 темы + 7 источников сохраняются в БД
- [x] ANALYSIS.md: 4 рекомендации согласованы архитектором
- [x] ROADMAP.md: 3 этапа спланированы

## Коммиты этой сессии (ТЗ-TG4a + FIX3)
- `03af57b` — feat(tz-tg4a): vercel cron + background briefing generation
- `944bc7d` — fix(podcast): improve script generator retry strategy
- `e418045` — fix(tz-fix3): remove broken verifiedSourceUrls filter + prepare TZ-FIX3

## Связанное: ТЗ-TG4a (на паузе)
ТЗ-TG4a (Background Briefing) на паузе — Этапы 1-3 завершены, Этапы 4-5 ждут после FIX3.
HANDOFF: `specs/TZ_TG4A_BackgroundBriefing/HANDOFF.md`

## Два аккаунта в системе
- `vladimir@family.local` (bed95407) — тестовый, БД очищена и пересоздана (3 темы, 7 источников)
- `julia@family.local` (c4ea7c18) — старый аккаунт, 4 темы, 20 источников, не трогать
