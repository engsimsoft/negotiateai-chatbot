# Roadmap ТЗ-HF1: Briefing PE Update

**Создан:** 2026-02-20
**Версия проекта:** 3.33.0 → 3.33.1
**Статус:** ✅ Завершён

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 5 |
| Текущий этап | ✅ Все |
| Сессий (оценка) | 1 |

---

## Этап 1: Миграция БД + queries

**Статус:** ✅ Завершён

**Цель:** Поле `briefingStyle` существует в таблице `BriefingTopics` и поддерживается в queries.

**Задачи:**
- [x] Добавить `briefingStyle: text("briefing_style")` в `briefingTopics` (schema.ts)
- [x] Сгенерировать миграцию Drizzle
- [x] Применить миграцию (`npm run db:migrate`)
- [x] Обновить `addBriefingTopic()` — принимает и сохраняет `briefingStyle`
- [x] Проверить `getBriefingTopics()` — возвращает `briefingStyle` (через select *)

**Файлы:**
- `lib/db/schema.ts` — добавить поле
- `lib/db/queries.ts` — обновить addBriefingTopic
- `lib/db/migrations/0033_add-briefing-style.sql` — миграция

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — ожидает общий build
- [x] Миграция применена к БД

**Git:** `git commit -m "feat(tz-hf1): add briefingStyle to BriefingTopics schema"`

**Критерий готовности:** Поле briefingStyle в БД, queries обновлены.

---

## Этап 2: Zod-схемы + saveBriefingProfile + maxSteps

**Статус:** ✅ Завершён

**Цель:** Онбординг может передавать и сохранять briefingStyle. maxSteps = 30.

**Задачи:**
- [x] Добавить `briefingStyle` в `briefingProfileSchema` → topics
- [x] В `saveBriefingProfile` execute → передавать `briefingStyle` в `addBriefingTopic()`
- [x] Поменять maxSteps: 8 → 30

**Файлы:**
- `app/(chat)/api/service-chat/route.ts` — schema, save, maxSteps

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен

**Критерий готовности:** briefingStyle проходит от модели через Zod-валидацию до БД.

---

## Этап 3: Промпты + автор + edit mode injection

**Статус:** ✅ Завершён

**Цель:** Промпты обновлены, автор получает briefingStyle, edit mode показывает стиль.

**Задачи:**
- [x] Заменить `lib/prompts/service-chats/briefing-onboarding.md` содержимым v4
- [x] Заменить `lib/prompts/briefing/briefing-author.md` содержимым v2
- [x] Обновить `buildUserMessage()` в `briefing-author.ts` — включить briefingStyle
- [x] Обновить `buildBriefingEditModeInjection()` — показывать briefingStyle по темам

**Файлы:**
- `lib/prompts/service-chats/briefing-onboarding.md` — замена
- `lib/prompts/briefing/briefing-author.md` — замена
- `lib/briefing/briefing-author.ts` — форматирование topics
- `app/(chat)/api/service-chat/route.ts` — editModeInjection

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен

**Критерий готовности:** Промпты заменены (onboarding v6, author v3), автор форматирует topics с briefingStyle.

---

## Этап 4: Setup page + preview component

**Статус:** ✅ Завершён

**Цель:** Edit mode загружает briefingStyle, preview отображает его.

**Задачи:**
- [x] `setup/page.tsx` — добавить `briefingStyle` в маппинг topics при edit mode
- [x] `briefing-profile-preview.tsx` — добавить `briefingStyle` в BriefingTopic interface
- [x] `briefing-profile-preview.tsx` — отобразить briefingStyle мелким шрифтом под названием темы

**Файлы:**
- `app/(dashboard)/briefing/setup/page.tsx` — edit mode
- `app/(dashboard)/briefing/setup/components/briefing-profile-preview.tsx` — interface + UI

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] 🧪 Мануальный тест: полный flow (create + edit + generate)

**Критерий готовности:** briefingStyle видно в preview, загружается в edit mode.

---

## Этап 5: Финализация

**Статус:** ✅ Завершён

**Задачи:**
- [x] Финальное мануальное тестирование (пользователь)
- [x] Обновить CHANGELOG.md (локальный)
- [x] Обновить главный CHANGELOG.md
- [x] Обновить SIMPLY_STATUS.md
- [x] Обновить CLAUDE.md
- [x] Обновить package.json (3.33.0 → 3.33.1)
- [x] Переместить папку в _archive/

**Валидация:**
- [x] `npm run build` — успешен
- [x] Все функции работают в браузере
- [x] Документация актуальна
