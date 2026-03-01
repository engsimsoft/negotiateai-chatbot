# Анализ ТЗ-CACHE1: Prompt Caching

## Резюме

Включить Anthropic prompt caching (`cacheControl: { type: 'ephemeral' }`) в 3 streaming routes с `streamText()`. При повторных запросах в одном чате (и при multi-step tool calls внутри одного запроса) system prompt + история кэшируются, cache read стоит 0.1× от обычной цены.

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.
> Каждая рекомендация **согласована с архитектором** (см. разговор в сессии).

### ✅ Согласен с ТЗ
- Добавить `cacheControl` в `chat/route.ts` (standard streaming) — ОК, нет `providerOptions`, простое добавление
- Добавить `cacheControl` в `task expert chat/route.ts` — ОК, нет `providerOptions`, простое добавление
- Добавить `cacheControl` в `service-chat/route.ts` — ОК, но требует аккуратного мержа с существующим `providerOptions` для briefing-onboarding
- TTL: ephemeral (5 min) — ОК для нашего паттерна активного чата
- Не трогать Gemini endpoints, UI, формулу стоимости — ОК
- Не трогать одноразовые `generateText`/`generateObject` — ОК

### ⚠️ Рекомендую изменить (СОГЛАСОВАНО)

| # | Было (ТЗ) | Рекомендация | Обоснование из кода |
|---|-----------|--------------|-------------------|
| 1 | Секция 1A: "Professor Pipeline — добавить cacheControl в каждый streamText()" | **Исключить professor-pipeline из scope** | `professor-pipeline.ts` — 3 фазы с уникальными system prompts (ANALYZE_PROMPT, EXECUTE_PROMPT, SYNTHESIZE_PROMPT). Фазы 1-2: `generateText` (одноразовые). Фаза 3: `streamText` (одноразовый). Cache write 1.25× на Opus без cache read = чистый перерасход. Противоречит секции 2 ТЗ ("одноразовые вызовы не выигрывают"). |

**Статус:** Архитектор согласился: "Claude Code прав, я ошибся."

### ❓ Требует уточнения
- ~~TTL~~ — решено: ephemeral
- ~~generateText внутри routes~~ — решено: не трогать
- ~~Professor Pipeline~~ — решено: не трогать

Все вопросы закрыты.

## Дополнительные находки

### calculateCostRub() уже готов к cached токенам
`lib/ai/providers.ts:110-122` — формула корректно обрабатывает `cachedInputTokens`:
- Вычитает cached из input → считает по полной цене
- Cached считает по `pricing.cached` (0.1× base для Anthropic)
- Изменения не нужны

### Ключевая ценность: multi-step tool calls
Главная экономия — не только между сообщениями (5-min TTL), но **внутри одного запроса**. При `stepCountIs(5)` каждый step после первого получает cache read на весь предыдущий контекст. Для briefing-onboarding (`stepCountIs(30)`) экономия колоссальная.

## Потенциальные риски
- **Минимальный порог 1024 токенов**: Бен (Haiku) может иметь короткий промпт. Не проблема — запрос просто пройдёт без кэширования, API не сломается.
- Риски близки к нулю — `cacheControl` не меняет поведение модели, только ценообразование.

## Зависимости
- Нет

## Оценка сложности
- [x] Простое (1 сессия, 15-20 минут)
