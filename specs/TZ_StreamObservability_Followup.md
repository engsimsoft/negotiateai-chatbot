# ТЗ-StreamObservability (Follow-up из TZ_LegacyChatCleanup, Finding #5)

**Импакт:** medium · **Оценка:** 0.5 сессии · **Создано:** 2026-04-13

## Цель

Заменить молчаливый stream-level error handler в chat route на полноценное логирование. Сейчас любая ошибка в стриме (LLM упал, провайдер вернул 500, network glitch) превращается в строку «Oops, an error occurred!» без `console.error`, без `emitDebugError` — невозможно отлаживать редкие сбои.

## Где находится

[app/(chat)/api/chat/route.ts](app/(chat)/api/chat/route.ts) — секция `onError` в `createUIMessageStream`:

```ts
onError: () => {
  return "Oops, an error occurred!";
},
```

После Этапа 1 TZ_LegacyChatCleanup строка примерно ~1551 (нужно проверить актуальный номер при работе над ТЗ).

## Что нужно

1. **Принимать `error` параметр**: `onError: (error) => { ... }`
2. **Логировать в console**: `console.error("[Chat Stream onError]", error)` — минимум, чтобы в server logs хоть что-то было
3. **Эмитить в DevPanel** (если возможно): `emitDebugError(dataStream, { source: "server:chat-stream-onError", message: ..., stack: ... })`
   - **ОСТОРОЖНО**: к моменту вызова `onError` `dataStream` может быть уже закрыт. Нужно проверить через try/catch или `if (dataStream.controller?.desiredSize !== null)`. `emitDebugError` уже имеет внутренний try/catch (см. `lib/ai/debug-events.ts`), но всё равно проверить
4. **Возвращать пользователю осмысленную строку**: вместо «Oops» — «Произошла ошибка при генерации ответа: <тип>. Попробуйте повторить запрос.» или включить error.message если безопасно (без stack/internals)

## Подход

1. Прочитать текущий код `onError` и его контекст в `route.ts`
2. Применить паттерн из других emit-сайтов в этом же файле (см. `emitDebugError(dataStream, { source: "server:professor-pipeline", ... })` в Professor pipeline ветке — там готовый пример)
3. Применить **тот же fix** в `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — там тоже есть `createUIMessageStream` с `onError`. Проверить grep'ом
4. Smoke test: специально вызвать ошибку (например, передать невалидный chatMode или сломать API key одного из провайдеров на короткое время) и проверить что:
   - `console.error` сработал в server logs
   - DevPanel показал ошибку в Errors & Warnings секции
   - Пользователь увидел осмысленное сообщение

## Definition of Done

- `onError` в обоих chat routes (chat + projects task expert) логирует через console.error + emitDebugError (если dataStream не закрыт)
- Возвращаемая строка осмысленна (не «Oops»)
- Smoke test: специально сломать что-то — все три точки видят ошибку (console, DevPanel, user)
- `tsc --noEmit` = 0
