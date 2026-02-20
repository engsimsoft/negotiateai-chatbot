# Анализ ТЗ-HF1: Briefing PE Update

**Дата анализа:** 2026-02-20

---

## Резюме

Hotfix: обновление промптов онбординга (v4) и автора (v2), добавление поля `briefingStyle` (per-topic инструкция автору), увеличение maxSteps для поддержки 5+ тем. Блокирует тестирование брифинга.

---

## Вопросы для уточнения

1. **[Миграция]:** Оставляем `briefingStyle` nullable без backfill? → **Да, промпт v2 обрабатывает отсутствие.**
2. **[Промпты]:** Файлы v4/v2 — полная замена текущих .md? → **Да, плейсхолдеры совпадают 1:1.**
3. **[maxSteps]:** 12 достаточно? → **Ставим 15. Worst case: 5 тем x 2 + 2 fetchUrl + save = 13.**

---

## Дополнения от разработчика (принято)

1. **`buildBriefingEditModeInjection()`** — добавить `briefingStyle` в форматирование тем для edit mode. Без этого модель потеряет стиль при редактировании.
2. **Preview component** — показывать `briefingStyle` обязательно (не опционально), мелким шрифтом под названием темы.

---

## Потенциальные риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Миграция ломает существующие данные | Низкая | Высокое | nullable, без default, без backfill |
| Новый промпт v4 меняет поведение онбординга | Средняя | Среднее | Тестирование create + edit mode |
| maxSteps 15 увеличивает стоимость | Низкая | Низкое | stepCountIs — это лимит, не обязательный расход |

---

## Зависимости

**Что нужно до начала:**
- [x] Промпты v4 и v2 — получены
- [x] Ответы на вопросы — получены

**Затронутые компоненты:**
- `lib/db/schema.ts` — добавить briefingStyle в briefingTopics
- `lib/db/queries.ts` — обновить addBriefingTopic()
- `app/(chat)/api/service-chat/route.ts` — Zod-схема, saveBriefingProfile, maxSteps, editModeInjection
- `lib/briefing/briefing-author.ts` — форматирование topics с briefingStyle
- `lib/prompts/service-chats/briefing-onboarding.md` — замена на v4
- `lib/prompts/briefing/briefing-author.md` — замена на v2
- `app/(dashboard)/briefing/setup/page.tsx` — прокинуть briefingStyle в edit mode
- `app/(dashboard)/briefing/setup/components/briefing-profile-preview.tsx` — интерфейс + отображение

---

## Оценка

- [x] Простое (1 сессия)

**Обоснование:** 8 файлов, все изменения точечные (добавление одного поля + замена двух .md файлов + maxSteps). Нет новых компонентов, нет новой логики.
