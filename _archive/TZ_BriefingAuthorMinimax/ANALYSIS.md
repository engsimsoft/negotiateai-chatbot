# Анализ ТЗ-Briefing-1: Author Sonnet → MiniMax M2.7

## Резюме

Заменить модель генерации текста брифинга с Claude Sonnet 4.6 ($3/$15 за 1M) на MiniMax M2.7 ($0.30/$1.20 за 1M) — снижение стоимости Author-шага в ~10 раз. Два файла: `briefing-author.ts` (полный брифинг) и `briefing-section-author.ts` (обновление секции). Паттерн `generateText + JSON.parse + Zod` уже обкатан в MIND pipeline.

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.
> Каждая рекомендация требует согласования с архитектором.

### ✅ Согласен с ТЗ

- **Пункт 1 (модель в конфиге)** — ОК. `AUTHOR_MODEL` в `briefing-config.ts:33` — единственная точка конфигурации, используется обоими файлами
- **Пункт 2-3 (generateObject → generateText + JSON.parse + Zod)** — ОК. Паттерн 1:1 с MIND pipeline (`extract.ts:300-325`, `consolidate.ts:140-155`). Включая cleanup `text.replace(/```json\s*|```\s*/g, "").trim()`
- **Пункт 4 (pricing/логирование)** — ОК. `MODEL_PRICING_RUB` уже содержит `"MiniMax-M2.7"` (`providers.ts:154-156`). `retryWithLogging` уже пишет `modelId` — подхватится автоматически
- **Пункт 5 (shared provider)** — ОК. Используем `minimaxM27` export из `providers.ts:53-59`

### ⚠️ Рекомендую изменить

| # | Было (ТЗ) | Рекомендация | Обоснование из кода |
|---|-----------|--------------|-------------------|
| 1 | ТЗ не упоминает удаление Anthropic-импортов | **Удалить Anthropic provider** из обоих файлов | `briefing-author.ts:5,28-30` и `briefing-section-author.ts:5,18-20` — `createAnthropic` + `const anthropic` станут dead code. Чистый рефакторинг |
| 2 | "Добавить в промпт инструкцию вернуть JSON" (текст в коде) | **Добавить JSON-инструкцию программно** (не менять .md файл) | `briefing-author.md` — shared prompt для Author. Менять его = coupling с провайдером. Лучше инжектировать `\n\nОтветь строго в формате JSON. Без markdown-обёртки, без пояснений.\n\nJSON-схема:\n{schema}` программно, как делает MIND pipeline |
| 3 | ТЗ не упоминает JSON-схему в промпте | **Включить JSON-схему в user message** | `generateObject()` автоматически передаёт schema модели. При переходе на `generateText()` модель НЕ ЗНАЕТ какой JSON нужен. Необходимо сериализовать Zod-схему в текст и добавить в промпт. Паттерн из `extract.ts`: схема описана прямо в system prompt |
| 4 | Retry при JSON parse error | **Обернуть JSON.parse в try-catch внутри retryWithLogging callback** | Сейчас `retryWithLogging` ловит throw из callback. Если JSON.parse бросает SyntaxError — retry сработает автоматически. Но нужно убедиться что Zod-ошибка тоже триггерит retry (проверил — да, `schema.parse()` бросает ZodError, retryWithLogging поймает) |

### ❓ Требует уточнения

1. **Temperature.** ТЗ говорит "0.7 (не 0, вызовет ошибку)". Но MIND pipeline (`extract.ts:305`, `consolidate.ts:145`) использует `temperature: 0.1` и работает в проде. Варианты:
   - MiniMax API молча clamp-ит к минимуму (не бросает ошибку)
   - Ограничение снято в новой версии API
   - Для авторинга брифинга 0.7 всё равно подходит (креативный текст)
   
   **Моя рекомендация:** использовать `temperature: 0.7` для Author (креативный текст), но стоит проверить реальное поведение при < 0.7.

## Потенциальные риски

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| MiniMax генерирует невалидный JSON (не парсится) | Средняя | retryWithLogging (3 попытки) + JSON cleanup regex |
| MiniMax опускает обязательные поля Zod-схемы | Низкая | Zod `.parse()` кинет ошибку → retry. В MIND pipeline проблем нет |
| Качество текста ниже Sonnet | Низкая | Intelligence Index 50 (уровень Opus). Подтверждено в Simply Chat |
| maxOutputTokens не поддерживается MiniMax | Низкая | Проверить — если нет, убрать параметр (MiniMax имеет 204K контекст) |
| Промпт briefing-author.md слишком длинный для JSON-режима | Низкая | Промпт ~2-3K токенов, MiniMax контекст 204K — запас огромный |

## Зависимости

- `minimaxM27` export в `providers.ts` — **уже существует**, новый код не нужен
- `MODEL_PRICING_RUB["MiniMax-M2.7"]` — **уже существует**
- `retryWithLogging` — **уже используется** обоими файлами
- Zod-схемы `briefingArticleSchema` / `sectionSchema` — **не меняются**
- Промпт `briefing-author.md` — **не меняется** (JSON-инструкция инжектируется программно)

## Затронутые файлы

| Файл | Изменение |
|------|-----------|
| `lib/briefing/briefing-config.ts` | `AUTHOR_MODEL` → `"MiniMax-M2.7"` |
| `lib/briefing/briefing-author.ts` | generateObject → generateText + JSON.parse + Zod, убрать Anthropic import |
| `lib/briefing/briefing-section-author.ts` | То же самое |
| (опционально) `lib/ai/providers.ts` | Ничего, всё уже есть |

## Оценка сложности

- [x] Простое (1-2 сессии)
- [ ] Среднее (3-5 сессий)
- [ ] Сложное (5+ сессий)

Основная работа — механическая замена по проверенному паттерну. Один этап разработки + тестирование.
