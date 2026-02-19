# Передача сессии ТЗ-A2: Briefing Onboarding

**Последнее обновление:** 2026-02-20
**Сессия:** 1 (анализ + планирование)

---

## Статус этапов

- [ ] Этап 1: БД + Queries + Промпт-файлы
- [ ] Этап 2: Backend — service-chat расширение
- [ ] Этап 3: Frontend — split layout + чат
- [ ] Этап 4: Edit mode + edge cases + polish
- [ ] Этап 5: Финализация

---

## Следующая сессия: начни с

1. Прочитай ROADMAP.md (Этап 1)
2. Запусти `npm run dev` — проверь текущее состояние
3. **Первая задача:** Добавить таблицу BriefingTopics в schema.ts

---

## Что сделано в последней сессии

- Создана папка `specs/TZ_A2_BriefingOnboarding/`
- Изучены ТЗ + промпты (TZ_A2_BRIEFING_ONBOARDING.md, briefing-onboarding-v2.md, briefing-onboarding-mode-injection.md)
- Глубокий анализ кодовой базы (service-chat, projects/new, briefing backend, providers, tools, prompts)
- Выявлены 6 технических проблем, все согласованы с архитектором
- Создан ANALYSIS.md с код-ревью и рекомендациями
- Создан ROADMAP.md (5 этапов)

---

## Ключевые решения

1. **Новая таблица BriefingTopics** — для хранения кастомных тем пользователя (topicId, topicName, emoji, orderIndex)
2. **Два tool вместо одного** — `updateBriefingPreview` (live) + `saveBriefingProfile` (final в БД)
3. **Mode injection строится программно** — как Manager `buildFirstContactMode()`, не через Handlebars
4. **Claude Sonnet 4.6** — model ID `claude-sonnet-4-6`, отдельный entry в providers.ts
5. **maxDuration 120** — глобальный ceiling для всего service-chat route
6. **stepCountIs динамический** — 8 для briefing-onboarding, 3 для остальных
7. **generationTime default** — "07:00" вместо "06:00"

---

## Блокеры / Вопросы

- Нет блокеров. Все вопросы согласованы с архитектором.

---

## Команды

```bash
npm run dev          # Dev сервер
npm run build        # Проверка сборки
npx tsc --noEmit     # Проверка TypeScript
npm run db:migrate   # Применить миграции
```
