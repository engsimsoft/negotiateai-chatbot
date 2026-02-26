# Анализ ТЗ-FIX1: Tool Call Guardian

## Резюме

Модель иногда описывает вызовы инструментов текстом вместо реальных `tool_call`. Нужен детектор галлюцинаций на уровне AI-layer, который анализирует стрим по step-boundaries и логирует/реагирует.

**Утверждена Фаза 1:** Detection & Logging (без буферизации, без retry).

---

## Ответы архитектора (утверждены)

| # | Вопрос | Ответ |
|---|--------|-------|
| 1 | UX: буферизация vs коррекция | Буферизации нет. Пропускаем текст + коррекция после |
| 2 | Scope | service-chat + chat, остальное позже |
| 3 | Retry | Ноль на Фазе 1 |
| 4 | False positives | Детектор агрессивнее — мы только логируем |
| 5 | Метрики | `ai_usage_log`, поле `guardian_flags jsonb` |

---

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.
> Каждая рекомендация согласована с архитектором.

### ✅ Согласен с ТЗ

- **Shared модуль `lib/ai/tool-call-guardian.ts`** — правильный подход, единая точка логики
- **Паттерны детекции** — regex + keyword lists для tool names и глаголов-маркеров
- **Разделение "утверждение о результате" vs "описание плана"** — критически важно для снижения false positives
- **Логирование `[Guardian]`** — совпадает с существующим паттерном `[Tool:Simply]`, `[Performance]`
- **Callback `onHallucination`** — полезен для аналитики

### ⚠️ Изменения относительно ТЗ (согласованы)

| # | Было (ТЗ) | Фаза 1 | Обоснование из кода |
|---|-----------|--------|-------------------|
| 1 | Буферизация step → валидация → flush/retry | **Без буферизации**. Текст стримится как обычно, детекция на `step-finish` | `text-delta` чанки стримятся немедленно в `instrumentedStream` (chat/route.ts:672-746). Буферизация убивает UX |
| 2 | Retry с inject системного сообщения | **Retry = 0 на Фазе 1**. Только логирование | `streamText` — один API call, нельзя inject mid-stream. Retry = новый `streamText` = полная переделка lifecycle |
| 3 | Все routes включая briefing/generate | **Только chat + service-chat** | `/api/briefing/generate` не использует `streamText` — там ручной NDJSON pipeline. Галлюцинации tool_call невозможны |
| 4 | `createGuardedStream` обёртка над `toUIMessageStream` | **Логика внутри `instrumentedStream`** (chat) + рефакторинг service-chat | Chat route уже имеет ReadableStream intercept (chat/route.ts:672). Service-chat использует `toUIMessageStreamResponse()` — нужен рефакторинг на `createUIMessageStream` паттерн |
| 5 | Честное сообщение пользователю при 2 retry | **Фаза 1: нет** — только `console.warn` + запись в `ai_usage_log.guardian_flags` | Фаза 2 добавит коррекцию |

### ❓ Отложено на Фазу 2

- **Post-step коррекция**: если галлюцинация → показать "Сейчас проверю..." → новый streamText с системным сообщением
- **`data-guardian-warning` event** клиенту для будущего UI-индикатора
- **Task-expert route** (`/api/projects/[id]/tasks/[taskId]/chat/route.ts`) — аналогичен chat, добавится тривиально

---

## Архитектурный анализ кода

### Два стриминг-паттерна

**Паттерн A — Chat + Task Expert (уже есть intercept):**
```
streamText() → result.toUIMessageStream() → instrumentedStream (ReadableStream) → dataStream.merge()
```
- `instrumentedStream` уже перехватывает `tool-input-start`, `tool-output-available`
- Guardian логика добавляется ВНУТРЬ этого ReadableStream
- Нужно: считать tool_calls per step, собирать text per step, на `step-finish` вызвать `detectToolHallucination()`

**Паттерн B — Service Chat (нет intercept):**
```
streamText() → result.toUIMessageStreamResponse()
```
- One-liner, нет точки перехвата
- **Требует рефакторинг** на `createUIMessageStream` + writer + merge
- Это затронет все 4 контекста: ben, project-creation, project-manager, briefing-onboarding
- Рефакторинг безопасен — паттерн идентичен chat route

### AI SDK v5 события в стриме

| Event | Значение | Для Guardian |
|-------|----------|-------------|
| `step-start` | Новый step начался | Сброс счётчиков step |
| `step-finish` | Step завершён | **Точка детекции**: анализ собранного текста vs tool_calls |
| `tool-input-start` | Tool call начался | Инкремент toolCallCount |
| `tool-output-available` | Tool result получен | — |
| `text-delta` | Чанк текста | Аккумуляция текста step |

### Таблица `ai_usage_log` — текущая схема

```
id, chatId, userId, modelId, inputTokens, outputTokens, thinkingTokens,
cacheWriteTokens, cacheReadTokens, costUsd, chatMode, durationMs, createdAt
```

Нужно: ALTER TABLE ADD COLUMN `guardianFlags jsonb DEFAULT NULL`

Формат `guardianFlags`:
```json
{
  "detected": true,
  "count": 2,
  "details": [
    {
      "step": 3,
      "confidence": 0.85,
      "toolMentioned": "readTelegramChannel",
      "pattern": "result_claim",
      "textSnippet": "канал живой, 15 постов за неделю"
    }
  ]
}
```

---

## Потенциальные риски

1. **False positives в логах** — модель может легитимно сказать "я нашёл 5 источников" после реального tool_call. Нужно проверять toolCallCount в конкретном step, а не глобально
2. **Service-chat рефакторинг** — переход с `toUIMessageStreamResponse()` на `createUIMessageStream` может затронуть поведение для всех 4 контекстов. Нужно тестировать каждый
3. **Performance** — regex на каждом step-finish добавляет ~1ms, пренебрежимо

---

## Зависимости

- Нет блокирующих зависимостей
- AI SDK v5 (`ai@5.0.123`) — все нужные события доступны
- Drizzle ORM — миграция для `guardian_flags` колонки

---

## Оценка сложности

- [x] Простое (1-2 сессии)
- [ ] Среднее (3-5 сессий)
- [ ] Сложное (5+ сессий)

Фаза 1 — чистая: 1 новый файл, 2 изменения в routes, 1 миграция БД.
