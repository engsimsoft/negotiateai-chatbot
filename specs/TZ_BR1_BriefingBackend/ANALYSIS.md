# Анализ ТЗ-BR1: Утренний брифинг — Backend

## Резюме

Backend для утреннего брифинга: сбор новостей из RSS/Telegram/веб-источников, двухэтапная AI-обработка (Gemini Flash → Gemini 3 Pro), сохранение структурированного JSON. Результат — API endpoint `POST /api/briefing/generate`.

## Вопросы для уточнения

> Все вопросы закрыты (ответы получены 2026-02-19).

1. **Gemini 3 Pro model ID** → `gemini-3-pro` (подтверждено графиком использования — 87 запросов). Fallback: `gemini-2.5-pro`.
2. **Telegram-фетчер** → Cheerio для MVP, осознанный риск хрупкости. Без over-engineering.
3. **Web-фетчер** → Использовать `@mozilla/readability` + `jsdom` вместо наивного cheerio.
4. **Каталог тем** → Claude Code подбирает самостоятельно, проверяет рабочесть RSS.
5. **Дефолтный набор** → Все 10 тем по 2 источника (~20 штук). Seed — полный набор.
6. **Route group** → `app/(chat)/api/briefing/generate/route.ts` (единообразие с auth).

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.
> Все рекомендации согласованы с архитектором.

### ✅ Согласен с ТЗ
- 3 таблицы БД — структура логичная, соответствует паттерну проекта (uuid PK, FK → User)
- Двухэтапный AI-пайплайн — грамотная архитектура
- Promise.allSettled для фетчеров — правильный подход
- Gemini уже в стеке (`@ai-sdk/google`, `GOOGLE_GENERATIVE_AI_API_KEY`) — расширяем, не добавляем
- Файловая структура `lib/briefing/` — изолированная, не ломает ничего

### ⚠️ Изменения (согласованы)
| # | Было (ТЗ) | Решение | Обоснование |
|---|-----------|---------|-------------|
| 1 | `app/api/briefing/` | `app/(chat)/api/briefing/` | Auth middleware общий для route group `(chat)` |
| 2 | Web-фетчер: простой fetch + cheerio | `@mozilla/readability` + `jsdom` | Наивный cheerio даёт мусор |
| 3 | Seed как API endpoint или скрипт | Скрипт `lib/db/seed-briefing.ts` + `db:seed-briefing` | Паттерн проекта (`db:seed`, `db:seed-agents`) |

### ❓ Закрытые уточнения
- Gemini 3 Pro model ID → подтверждён (`gemini-3-pro`)
- Telegram-парсинг хрупкость → MVP-подход принят

## Потенциальные риски
- **Таймаут 60 сек на Vercel** — 20 параллельных fetch + 2 AI-вызова. На Pro плане — ОК.
- **RSS-фиды могут меняться/ломаться** — graceful degradation через Promise.allSettled
- **Telegram HTML-структура** — может сломаться, чиним при необходимости
- **Gemini 3 Pro preview** — если ограничения, fallback на `gemini-2.5-pro`

## Зависимости
- **Новые npm-пакеты:** `rss-parser`, `cheerio`, `@mozilla/readability`, `jsdom`, `@types/jsdom`
- **Существующие:** `@ai-sdk/google` (уже установлен), `zod` (для generateObject)
- **Drizzle миграция:** Одна миграция для 3 таблиц

## Оценка сложности
- [x] Среднее (2-3 сессии)
