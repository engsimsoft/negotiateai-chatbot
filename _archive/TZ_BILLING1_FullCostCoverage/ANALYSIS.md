# Анализ ТЗ-BILLING1: Full Cost Coverage

## Резюме

Закрыть 2 дыры в учёте расходов: Deepgram voice-to-text (нет логирования вообще) и Vision OCR (userId не передаётся → лог не создаётся). Добавить coverage audit в admin dashboard.

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.

### ✅ Согласен с ТЗ
- R1 (Deepgram logging) — критично, формула `calculateDeepgramCostUsd()` уже есть
- R2 (Vision OCR userId) — реальный баг, подтверждён кодом
- R3 (Coverage audit) — полезен как страховка

### ⚠️ Рекомендую изменить

| # | Было (ТЗ) | Рекомендация | Обоснование из кода |
|---|-----------|--------------|-------------------|
| 1 | POST /api/deepgram/usage — новый endpoint | **Использовать существующий POST /api/deepgram/token** — добавить action "log-usage" | Меньше кода, один endpoint уже знает userId из session. `app/(chat)/api/deepgram/token/route.ts:10` уже делает auth check |
| 2 | Vision OCR — передавать userId через tool | **Расширить `getStandardTools()` чтобы получал userId** и пробрасывал в readDocument → extractText* | `lib/ai/tools/chat-tools.ts:46` — `getStandardTools({ chatId, userId })` уже принимает userId, но `readDocument` tool не передаёт его в vision-ocr. Достаточно добавить closure |
| 3 | R3 — coverage audit в admin dashboard | **Отложить до следующего ТЗ** — нет серверных логов (кроме ai_usage_log) для Deepgram/Vision, нечего сверять. После R1+R2 все вызовы будут в ai_usage_log | Нет смысла строить audit без baseline |

### ❓ Требует уточнения
- Нет вопросов, scope чёткий

## Детальный анализ кода

### Deepgram voice recording

**Текущий поток:**
```
Браузер                           Deepgram                   Сервер
   |                                  |                         |
   |--POST /api/deepgram/token------->|                         |
   |<----- { apiKey, expiresAt } -----|                         |
   |                                  |                         |
   |==WebSocket wss://api.deepgram.com/v1/listen===============|
   |------- PCM audio chunks -------->|                         |
   |<------ transcript JSON ----------|                         |
   |                                  |                         |
   |--stopRecording() (local only)----|                         |
   |                                  |                         |
   ← duration НИГДЕ не отправляется на сервер                   |
```

**Что доступно на клиенте (use-voice-recorder.ts):**
- `audioContext.currentTime` (line 186) — можно вычислить duration = stopTime - startTime
- WebSocket message содержит `duration` в metadata — но не экспортируется
- Хук NOT имеет onEnd callback (VoiceRecorderOptions не содержит)

**Реализация:**
1. Добавить `startTimeRef` в хук
2. В `stopRecording()` — вычислить duration = Date.now() - startTime
3. POST duration на сервер
4. Сервер → `logUsage({ costUsdOverride: calculateDeepgramCostUsd(durationSeconds) })`

### Vision OCR

**Проблема (подтверждена grep'ом):**

`lib/ai/tools/read-document.ts:168`:
```typescript
const content = await extractTextFromImage(buffer, mediaType);
// ← userId НЕ передаётся
```

`lib/ai/tools/read-document.ts:190`:
```typescript
const result = await extractTextFromPDF(buffer);
// ← userId НЕ передаётся
```

`lib/ai/vision-ocr.ts:83-91`:
```typescript
if (userId) {
  logUsage({ ... });
}
// ← если userId нет — молча пропускает
```

**Цепочка:** `chat/route.ts → getStandardTools({ userId }) → readDocument tool → extractText*(buffer)` — userId доступен в `getStandardTools`, но не доходит до vision-ocr.

**Fix:** В `chat-tools.ts` при создании readDocument tool — замкнуть userId в closure, пробросить в extractText*.

### Meeting Deepgram (reference implementation)

Уже работает правильно в `lib/meeting/deepgram-transcribe.ts:153-163`:
```typescript
logUsage({
  userId,
  usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } as any,
  modelId: "deepgram-nova-3",
  chatMode: "meeting:transcribe",
  costUsdOverride: calculateDeepgramCostUsd(data.metadata.duration),
});
```

Паттерн `costUsdOverride` + zero tokens — стандарт для non-token провайдеров. Переиспользуем.

## Потенциальные риски

1. **Deepgram duration accuracy:** Вычисление через `Date.now()` менее точно чем metadata из Deepgram API. Но для биллинга достаточно (разница <1с при 3мин записи = <0.6% погрешность).
2. **Vision OCR race condition:** Если tool execution завершается, но logUsage fails — потеряем запись. Риск минимальный (fire-and-forget, как в meeting).

## Зависимости

- Инфраструктура TOKENS1 (`logUsage`, `costUsdOverride`, `calculateDeepgramCostUsd`) — уже готова
- Никаких миграций БД — `ai_usage_log` уже имеет все нужные колонки

## Оценка сложности

- [x] Простое (1 сессия, ~2-3 часа)
