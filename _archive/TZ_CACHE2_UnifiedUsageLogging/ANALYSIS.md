# Анализ ТЗ-CACHE2: Unified Usage Logging

## Резюме

Задача — обеспечить полную видимость расхода AI-токенов по всем точкам вызовов. Три направления:
1. Создать утилиты извлечения usage (`extractUsageFields` + `buildUsageLogParams`)
2. Исправить 6 существующих вызовов `saveAiUsageLog` (добавить cache/thinking токены)
3. Добавить `saveAiUsageLog` во все новые точки (оригинал: 15, расширено архитектором до ~24)

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.
> Согласованы с архитектором 2026-03-02.

### ✅ Согласен с ТЗ
- `extractUsageFields()` — нужная утилита, уберёт россыпь `(usage as any)`
- Паттерн fire-and-forget `.catch(() => {})` — корректный
- Конвенция chatMode (`service:*`, `professor:*`, `clerk:*` и т.д.) — логичная
- DB-схема уже готова — колонки `cacheReadTokens`, `cacheWriteTokens`, `thinkingTokens` есть
- `saveAiUsageLog` уже принимает все 5 полей — менять сигнатуру не нужно

### ⚠️ Изменения по согласованию с архитектором
| # | Было (ТЗ) | Решение | Обоснование |
|---|-----------|---------|-------------|
| 1 | Только `extractUsageFields()` | + `buildUsageLogParams()` хелпер | Сэкономит ~150 строк boilerplate. Включает `calcCostUsd` + извлечение + формирование объекта |
| 2 | Точка #3 (Guardian meta log) — добавить 3 поля | Убрать из scope | Токенов нет (hardcoded 0), это метаданные детекции |
| 3 | Ben: userId "из request" | Добавить `auth()`, пропускать если не авторизован | Request body не содержит userId. FK constraint не позволяет placeholder |
| 4 | Placeholder `"system"` для userId | Пробросить `userId?: string` в параметры | Никаких placeholder-ов. Все точки вызываются из contexts с auth |

### Расширение scope (по решению архитектора)
| # | Точка | chatMode | Провайдер | Примечание |
|---|-------|----------|-----------|------------|
| A | `lib/podcast/tts-gemini.ts` | `podcast:tts` | Google GenAI (raw) | Нет token usage! Только durationMs |
| B | `lib/ai/tools/deep-research.ts` | `tool:deep-research` | Perplexity (raw fetch) | promptTokens/completionTokens доступны |
| C | `lib/briefing/research-engine.ts` | `briefing:research` | Perplexity (raw fetch) | Per-topic usage, уже есть trace |
| D | `lib/meeting/meeting-pipeline.ts` (summarize) | `meeting:summarize` | Anthropic (AI SDK) | usage доступен |
| E | `lib/meeting/meeting-pipeline.ts` (transcribe) | `meeting:transcribe` | Deepgram (raw fetch) | Нет token usage! Только durationMs |
| F | `app/(chat)/api/meeting/regenerate/route.ts` | `meeting:summarize` | Anthropic (AI SDK) | Использует `summarizeTranscript()` |

### ❓ Особенности выявленные при анализе

1. **Deepgram** — API не возвращает token usage. `inputTokens=0, outputTokens=0, costUsd=null, durationMs=X`. Полезно для трекинга вызовов, но стоимость не считается per-token.

2. **Podcast TTS** — `@google/genai` API (не AI SDK). Нет token counts в ответе. Можем логировать `durationMs` и `audioDurationSeconds`. Cost — по audio duration, не по токенам.

3. **Perplexity** — raw fetch, свой формат usage (`promptTokens`, `completionTokens`, `searchQueries`). Маппинг: `promptTokens → inputTokens`, `completionTokens → outputTokens`.

4. **`cacheWriteTokens`** — AI SDK v5 Anthropic provider скорее всего НЕ пробрасывает `cache_creation_input_tokens`. Проверим runtime, запишем 0 + TODO.

5. **Vision OCR** — 2 функции (`extractTextFromImage`, `extractTextFromPDF`), обе используют Gemini. Нужно 2 лога или 1 общий chatMode.

## Потенциальные риски

1. **Объём** — 27+ точек модификации. Высокий risk опечаток в chatMode строках.
2. **Проброс userId** — 7 utility-функций требуют нового параметра. Breaking change для вызывающего кода.
3. **Perplexity calls в tools** — `deep-research.ts` вызывается через AI SDK tool wrapper. userId доступен в route handler, но не в tool execute. Нужен механизм передачи.

## Зависимости

- ✅ DB-схема готова (колонки есть)
- ✅ `saveAiUsageLog` принимает все поля
- ✅ `calcCostUsd` работает для Anthropic моделей
- ⚠️ TokenLens поддержка Gemini моделей — проверить runtime

## Оценка сложности

- [x] Среднее (2-3 сессии)
