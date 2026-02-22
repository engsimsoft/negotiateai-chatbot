# Передача сессии ТЗ-BF5: Дедупликация контента между брифингами

**Дата:** 2026-02-22
**Сессия:** 1

## Статус этапов
- [ ] Этап 1: Backend — queries + prompt + author ← ТЕКУЩИЙ
- [ ] Этап 2: Интеграция в routes (generate + refresh-section)
- [ ] Этап 3: Финализация

## Следующая сессия: начни с
1. Прочитать ROADMAP.md → Этап 1
2. Открыть `lib/db/queries.ts` — модифицировать `deleteOldBriefingHistory()`
3. Добавить `getPreviousBriefing()` в queries.ts
4. Работать по чеклисту Этапа 1

## Ключевые решения (согласовано с архитектором)
- `getPreviousBriefing()` возвращает полный `BriefingArticle`, не предформатированные headlines
- Передавать все `sources[].title` из каждой секции (не один headline)
- Section-author тоже получает дедупликацию (включено в scope)
- Версия: 3.44.0 → 3.45.0

## Документы PE
- `specs/TZ_BF5_BriefingDedup/briefing-author-dedup-v6.md` — промпт и формат данных

## Блокеры / Вопросы
- (нет)
