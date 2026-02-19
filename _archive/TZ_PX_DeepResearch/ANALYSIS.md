# Анализ ТЗ-PX + ТЗ-FU

## Резюме

Два связанных ТЗ, реализующих core capability для исследовательских режимов платформы:
1. **ТЗ-FU (fetchUrl)** — инструмент чтения веб-страниц (Readability + JSDOM)
2. **ТЗ-PX (deepResearch)** — инструмент глубокого исследования (Perplexity Sonar Pro / Deep Research)

Оба tool доступны в Экспертиза, Создать, Проекты. Недоступны в Chat (Haiku).
Блокируют ТЗ-А2 (онбординг брифинга).

## Вопросы для уточнения

Все вопросы заданы и разрешены в чате:
1. API ключ — получен от Владимира ✅
2. Dev-переключатель — встраивается в существующий `input-model-selector.tsx` ✅
3. Разграничение webSearch/deepResearch — добавить в tool description webSearch ✅

## Рекомендации разработчика (Код-ревью)

> Все рекомендации согласованы с архитектором.

### ✅ Согласен с ТЗ
- Архитектура tool (один tool, два режима depth) — ОК, чистый подход
- Паттерн `wrapToolExecution` + `tool()` из Vercel AI SDK — стандарт проекта
- Readability + JSDOM для fetchUrl — уже используется в `lib/briefing/source-fetchers/web-fetcher.ts`
- Tool Activity config — стандартный паттерн
- Фильтрация по chatMode — давно нужна, параметр `_chatMode` уже зарезервирован

### ⚠️ Рекомендации (согласованы)
| # | Тема | Решение |
|---|------|---------|
| 1 | Переиспользование web-fetcher.ts | Извлечь shared utility, не дублировать |
| 2 | Передача depth от клиента | Вариант A — расширить schema.ts, прокинуть через getStandardTools |
| 3 | Фильтрация по chatMode | Активировать в getActiveToolNames() — исключить для 'chat' |
| 4 | Порядок реализации | Сначала ТЗ-FU, потом ТЗ-PX |
| 5 | Dev-переключатель | Встроить в input-model-selector.tsx, не отдельный компонент |
| 6 | Разграничение webSearch/deepResearch | Обновить description webSearch |

## Потенциальные риски
- Perplexity Deep Research 30-120 сек — нужен надёжный UX-индикатор (ToolActivity покрывает)
- Perplexity API может вернуть неожиданный формат — обработать gracefully
- JSDOM в serverless (Vercel) — уже работает в briefing, значит ОК

## Зависимости
- `@mozilla/readability` v0.6.0 — уже в проекте ✅
- `jsdom` v28.1.0 — уже в проекте ✅
- `PERPLEXITY_API_KEY` — получен ✅
- Существующие файлы: `tool-wrapper.ts`, `chat-tools.ts`, `tool-activity-config.ts`, `chat-mode-config.ts`, `schema.ts`

## Оценка сложности
- [x] Простое (1-2 сессии)
