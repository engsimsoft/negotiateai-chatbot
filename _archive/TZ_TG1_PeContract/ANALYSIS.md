# Анализ ТЗ-TG1: Telegram Phase 1 — PE Contract

## Резюме

Добавить tool `readTelegramChannel` для чтения публичных Telegram-каналов через AI-чат. Включает: shared парсер (`lib/telegram/`), tool для AI SDK, размещение SKILL.md от PE, миграцию briefing-фетчера на shared parser.

## Вопросы для уточнения

> Все вопросы заданы и отвечены (2026-02-25).

1. **Scope?** → Всё вместе: Tool + Skill + shared parser + миграция briefing fetcher
2. **SKILL.md?** → Взять as-is от PE-специалиста, разместить без изменений
3. **Refactoring?** → Shared utility `lib/telegram/parser.ts`, один парсер — два потребителя (DRY)
4. **Briefing onboarding update?** → Отложен, не в этом ТЗ
5. **Tool в Haiku (chat mode)?** → Да, включить везде. Скрейпинг t.me = 2-5 сек, не "дорогой" tool

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.
> Каждая рекомендация согласована с архитектором.

### Согласен с ТЗ

- SKILL.md (90 строк) — качественный, соответствует шаблону `_template/SKILL.md`, покрывает все use cases
- Категория `research/telegram-channel-reading` — правильная (рядом с `web-research`)
- Формат вывода tool совпадает с ожиданиями SKILL.md (`isValid`, `hasMedia`, `totalFetched`, даты)

### Рекомендовал изменить (согласовано)

| # | Было (ТЗ) | Рекомендация | Обоснование из кода | Решение |
|---|-----------|--------------|---------------------|---------|
| 1 | Один парсер vs два | Shared utility `lib/telegram/parser.ts` | `telegram-fetcher.ts` имеет жёсткие briefing-зависимости (FRESHNESS_HOURS, MAX_CONTENT_LENGTH). Нужна параметризация | Согласовано: shared parser с опциями |
| 2 | Tool activation | Доступен во всех режимах включая Haiku | Скрейпинг 2-5 сек, 0 токенов внешних API. Кейс "о чём последний пост" — типичный quick chat | Согласовано: НЕ добавлять в CHAT_MODE_EXCLUDED_TOOLS |
| 3 | Briefing onboarding | Отложить обновление | Текущий онбординг уже находит TG-каналы через deepResearch. Обновление — cosmetic, не блокирует | Согласовано: отложено |
| 4 | redirect: "manual" | Добавить опцию followRedirects для обратной совместимости | Briefing fetcher сейчас следует 302 redirect-ам. Смена поведения = регрессия | Согласовано |

## Потенциальные риски

1. **Регрессия briefing** — миграция фетчера может сломать существующий TG-парсинг в брифингах. Митигация: `followRedirects: true` для briefing consumer, `false` для tool.
2. **Telegram HTML stability** — t.me может сменить CSS-классы. Риск есть и сейчас, exposure не растёт.
3. **Token cost** — 50 постов в контексте = 10-20K токенов. Митигация: `maxPosts` параметр позволяет AI ограничивать.

## Зависимости

- `cheerio` — уже в зависимостях (используется в текущем `telegram-fetcher.ts`)
- Никаких новых npm-пакетов не нужно
- БД не затрагивается

## Оценка сложности

- [x] Простое (1-2 сессии)
