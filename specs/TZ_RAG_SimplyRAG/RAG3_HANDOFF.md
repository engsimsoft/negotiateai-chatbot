# Передача сессии ТЗ-RAG3

**Дата:** 2026-04-07
**Сессия:** 1

## Статус этапов
- [x] Этап 1: Включить Compaction API + критические фиксы ✅
- [ ] Этап 2: Очистить snapshot из Sonnet/Opus routes ← СЛЕДУЮЩИЙ
- [ ] Этап 3: Cost tracking + DevPanel polish
- [ ] Этап 4: Финализация

## Ключевое открытие сессии
**Haiku 4.5 НЕ поддерживает Compaction API.** Только Sonnet 4.6 и Opus 4.6. Стратегия изменена: двойная система — snapshot для Haiku, compaction для Sonnet/Opus. Snapshot-файлы НЕ удаляются.

## Критический баг найден и исправлен
**Сообщения не сохранялись в БД** — `createUIMessageStream` без `originalMessages` не активировал persistence mode. Фикс: добавлен `originalMessages: uiMessages` + фильтрация новых сообщений в onFinish.

## Следующая сессия: начни с
1. Прочитать RAG3_ROADMAP.md → Этап 2
2. Очистить snapshot-логику из task chat route (полностью)
3. Обернуть snapshot в chat route в `if (chatMode === "chat")`
4. Сделать ContextIndicator условным

## Блокеры / Вопросы
- Нет
