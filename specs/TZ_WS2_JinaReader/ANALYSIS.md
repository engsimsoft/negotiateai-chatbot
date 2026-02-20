# Анализ ТЗ-WS2: Jina Reader API + Каскадный Fallback

## Резюме

Добавить Jina Reader API как fallback в каскад `fetchPage()`. Если Readability + semantic fallback возвращают <200 символов — автоматически вызывается Jina Reader (headless Chrome на стороне Jina). Покрытие русскоязычных источников: ~40-50% → ~70-80%.

## Затронутые файлы (изучены)

- `lib/ai/tools/fetch-page.ts` — основная точка интеграции (каскад)
- `lib/ai/tools/fetch-url.ts` — потребитель fetchPage (tool для AI)
- `lib/briefing/source-fetchers/index.ts` — диспетчер briefing (case "jina")
- `lib/briefing/source-fetchers/web-fetcher.ts` — потребитель fetchPage
- `lib/briefing/briefing-config.ts` — константы

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.
> Все рекомендации согласованы с архитектором.

### ✅ Согласен с ТЗ
- Каскад Readability → Jina — правильная архитектура
- Отдельный файл `jina-reader.ts` — логично
- Порог <200 символов — совпадает с существующим `MIN_CONTENT_LENGTH`
- `forceJina` для briefing диспетчера — правильный подход
- Логирование HTTP 429/402 — критично для диагностики
- Lazy warning при отсутствии ключа

### ⚠️ Изменения (согласованы)
| # | Было (ТЗ) | Решение | Обоснование |
|---|-----------|---------|-------------|
| 1 | 4-й позиционный параметр forceJina | Options object `FetchPageOptions` | Чище API, 2 вызова обновить — 5 минут |
| 2 | Нет source tracking | Добавить `source: 'readability' \| 'semantic' \| 'jina'` в FetchPageResult | 2 минуты работы, критично для дебага |
| 3 | Readability timeout 15s + Jina 10s = 25s | Readability timeout 8s в каскаде + Jina 10s = 18s, fetchUrl wrapper 30s | Бюджет влезает, запас есть |
| 4 | Warning при старте | Lazy warning при первом вызове с флагом `warned` | В Next.js нет точки старта |
| 5 | Markdown от Jina чистить? | Оставить как есть | Gemini Flash и Sonnet нормально работают с markdown |
| 6 | `encoded_url` в URL Jina | Сырой URL без encodeURIComponent | Jina ожидает `r.jina.ai/https://example.com` |

## Потенциальные риски
- **Rate limit** — free tier 20 RPM, с ключом 100 RPM. Для нашего объёма достаточно.
- **Jina downtime** — graceful degradation, вернём результат Readability.

## Зависимости
- ТЗ-WS1 (выполнено, v3.34.0) — charset detection в fetchPage
- JINA_API_KEY получен от архитектора

## Оценка сложности
- [x] Простое (1 сессия)

## Текущее состояние в БД
- 12 источников с `fetchMethod: "jina"` — сейчас работают через Readability (заглушка)
- 23 источника с `fetchMethod: "rss"`
