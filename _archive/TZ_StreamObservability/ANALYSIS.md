# ANALYSIS — TZ_StreamObservability

**ТЗ-источник:** `SPEC.md` (promoted из `specs/_backlog/TZ_StreamObservability.md`, Finding #5 из TZ_LegacyChatCleanup)
**Дата:** 2026-04-13
**Автор:** Claude Opus 4.6
**Статус:** Анализ завершён, готов к ROADMAP

---

## 1. Изученная документация (WORKFLOW правило 1)

### 1.1 Внешние технологии задачи

Задача — server-side обработчик ошибок для streaming endpoint'ов. Затрагивает:

1. **Vercel AI SDK v6** — `createUIMessageStream`, `onError`, `streamText`, error types
2. **Vercel AI SDK v6 error classes** — `APICallError` и другие `AI_*` errors (через `isInstance`)

Deepgram / Anthropic SDK прямо не затрагиваются — мы только ловим ошибки, которые *всплывают* из них в AI SDK stream.

### 1.2 Ссылки (прочитано WebFetch 2026-04-13)

| Источник | URL | Что взято |
|---|---|---|
| AI SDK UI — `createUIMessageStream` | https://ai-sdk.dev/docs/reference/ai-sdk-ui/create-ui-message-stream | Сигнатура `onError: (error: unknown) => string`, поведение в merged streams |
| AI SDK UI — Error Handling | https://ai-sdk.dev/docs/ai-sdk-ui/error-handling | Best practice: наружу — generic message, внутрь — console.error с деталями |
| AI SDK Core — Error Handling | https://ai-sdk.dev/docs/ai-sdk-core/error-handling | Паттерн: `try/catch` на server + stream error parts |
| AI SDK Errors — APICallError | https://ai-sdk.dev/docs/reference/ai-sdk-errors/ai-api-call-error | `isInstance` pattern, fields (`statusCode`, `url`, `responseBody`, `isRetryable`, `cause`) |

### 1.3 Ключевые находки

**Сигнатура onError (v6):**
```ts
onError: (error: unknown) => string
```
- Параметр типа `unknown` — обязательно narrow через `instanceof Error` / `APICallError.isInstance(error)` перед доступом к полям
- Возвращает `string` — сообщение, которое клиент покажет пользователю
- Default behaviour: вернуть `error.message` (если мы ничего не пишем — клиент увидит сырой текст от провайдера)
- Вызывается когда **в merged streams** (т.е. в `writer.merge(streamText(...).toUIMessageStream())` внутри `execute`) поднимается ошибка. Это покрывает: Anthropic 5xx, rate limit 429, network glitch, tool execution crash, guardian instrumented stream throw

**Безопасное логирование наружу (docs recommendation):**
> "Show generic error messages to users — such as 'Something went wrong' — to avoid exposing server-side information."

Значит возвращаемая строка **не должна** содержать stack/API key/URL/raw provider body. Можно:
- `error.message` (верхняя строка, обычно безопасна, но бывают исключения)
- Или ещё безопаснее — category + совет повторить

**Error narrowing паттерн:**
```ts
import { APICallError } from "ai";

if (APICallError.isInstance(error)) {
  // error.statusCode, error.url, error.isRetryable ...
}
```

**Тип `dataStream` в onError scope:**
`onError` — это sibling `execute` на уровне параметров `createUIMessageStream({...})`. **`dataStream` НЕ попадает в его scope через деструктуризацию** (деструктурируется только внутри execute). Нужен closure capture: объявить `let dataStreamRef: UIMessageStreamWriter | null = null` выше, заполнить в первой строке `execute`, читать в onError. Тогда `emitDebugError` получит writer и напишет в DevPanel — если stream ещё не закрыт.

**Поведение при закрытом stream:**
Документация явно не описывает. Но `emitDebugError` в [lib/ai/debug-events.ts:324-340](lib/ai/debug-events.ts#L324-L340) **уже обёрнут в try/catch** — если write упадёт из-за закрытого стрима, исключение проглотится молча. Безопасно вызывать без дополнительных проверок.

### 1.4 Установленная версия SDK в проекте

`package.json`:
- `"ai": "^6.0.116"` — main SDK
- `"@ai-sdk/react": "^3.0.118"`
- `"@ai-sdk/anthropic": "^3.0.58"`
- `"@ai-sdk/xai": "^3.0.82"`

Все совместимы с изученными docs (v6 current).

### 1.5 Красные флаги

- **`APICallError.isInstance` vs `instanceof`** — используем именно `isInstance`, потому что error может пересекать module boundaries (особенно через streamText merge) и `instanceof` ломается
- **Generic message наружу, детали в console** — если вернуть сырой `error.message` от Anthropic 401, клиент увидит "Invalid x-api-key" → утечка. Надо category-based message
- **`dataStream` closure capture** — очень легко забыть и получить `null` при вызове `emitDebugError`. Явный guard `if (dataStreamRef) emitDebugError(...)` — дешёвая страховка
- **Локализация сообщения** — проект русскоязычный. Пользователь увидит строку в UI, она должна быть на русском: «Произошла ошибка при генерации ответа. Попробуйте повторить.» вместо "An error occurred"

---

## 2. Контекст кода

### 2.1 Текущее состояние (точки вмешательства)

**Файл 1:** [app/(chat)/api/chat/route.ts:1537-1539](app/(chat)/api/chat/route.ts#L1537-L1539)
```ts
onError: () => {
  return "Oops, an error occurred!";
},
```
- `createUIMessageStream` начинается на строке 536, `execute: async ({ writer: dataStream }) =>` на 538
- `emitDebugError` УЖЕ импортирован (строка 59)
- `emitDebugError` УЖЕ используется 3 раза внутри execute: professor pipeline (890), guardian max retries (1296), guardian stream-error (1391)
- Значит паттерн готов, нужна только закрывающая секция `onError`

**Файл 2:** [app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts:745-747](app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts#L745-L747)
```ts
onError: () => {
  return "Oops, an error occurred!";
},
```
- `emitDebugError` **НЕ импортирован** — нужно добавить в существующий import block (строка 19-29)
- Уже импортированы `emitDebugStep`, `emitDebugGuardian`, `emitDebugFinish`, `emitDebugPrompt`, `emitDebugCompaction`, `emitDebugWarning` — добавляем `emitDebugError` к ним

### 2.2 Паттерн из Professor pipeline (готовая reference-реализация)

[app/(chat)/api/chat/route.ts:890-897](app/(chat)/api/chat/route.ts#L890-L897):
```ts
} catch (error) {
  console.error("[Professor] Pipeline error:", error);
  emitDebugError(dataStream, {
    source: "server:professor-pipeline",
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack?.slice(0, 2000) : undefined,
    context: { chatId: id, userId: session.user.id },
  });
  // ... continue
}
```

Этот шаблон нужно **адаптировать**, но не копировать дословно — там есть `dataStream` в scope, а в `onError` его нет.

### 2.3 `emitDebugError` сигнатура

[lib/ai/debug-events.ts:324-340](lib/ai/debug-events.ts#L324-L340):
```ts
export function emitDebugError(
  dataStream: DataStreamWriter,
  data: Omit<DebugErrorData, "timestamp"> & { timestamp?: number },
): void {
  if (!isSimplyDevMode) return;   // gate: prod тихо
  try {
    dataStream.write({ type: "data-debug-error", data: { ... } });
  } catch {
    // swallow — never fail request from logging
  }
}
```
- Внутренний try/catch → можно звать без страха
- `isSimplyDevMode` gate → в проде ничего не пишет, только в dev (user видит в DevPanel)
- `DebugErrorData` (см. строку 290-ish): `source`, `message`, `stack?`, `context?`, `timestamp`

---

## 3. Подход (конкретика для ROADMAP)

### 3.1 Паттерн closure capture dataStream

```ts
// Перед createUIMessageStream:
let dataStreamRef: Parameters<Parameters<typeof createUIMessageStream>[0]["execute"]>[0]["writer"] | null = null;
// (или проще — import тип UIMessageStreamWriter и использовать его)

const stream = createUIMessageStream({
  originalMessages: uiMessages,
  execute: async ({ writer: dataStream }) => {
    dataStreamRef = dataStream;  // capture в первой строке
    // ... остальной execute как был
  },
  onError: (error: unknown) => {
    console.error("[Chat Stream onError]", error);

    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack?.slice(0, 2000) : undefined;

    if (dataStreamRef) {
      emitDebugError(dataStreamRef, {
        source: "server:chat-stream-onError",
        message,
        stack,
        context: { chatId: id, userId: session.user.id },
      });
    }

    // Generic user-facing message (без утечки деталей)
    return "Произошла ошибка при генерации ответа. Попробуйте повторить.";
  },
});
```

**Обоснование выбора типа:** `Parameters<...>` — zero-cost type extraction, не требует добавления нового импорта. Если в AI SDK публично экспортирован `UIMessageStreamWriter` — предпочтительнее. Проверю при реализации.

### 3.2 Почему `if (dataStreamRef)` а не прямо вызов

`emitDebugError` уже self-guarded. Внешняя проверка нужна только потому что type `dataStreamRef` — nullable (TS narrowing). Без неё TS ругается `Argument of type 'X | null'`. Это дешевле чем `!` bang operator или as cast.

### 3.3 APICallError narrowing — включать ли в Stage 1?

**НЕ включаю в базовый фикс.** Причина:
- Базовая задача (SPEC): console.error + emitDebugError + осмысленное сообщение. Всё покрывается без `isInstance` — `error instanceof Error` даёт всё нужное
- `APICallError` полезно для category-based сообщений ("временно недоступно" при 5xx/429 vs "ошибка конфигурации" при 401). Но это **уточнение**, не блокер
- Если при smoke тестах окажется что сообщения недостаточно информативны — добавим `isInstance` веткой **в том же ТЗ** как Stage 2. А пока избегаем premature abstraction

---

## 4. Риски

| # | Риск | Митигация |
|---|---|---|
| R1 | `dataStreamRef` остаётся `null` потому что `onError` вызывается раньше чем первая строка execute (edge case: ошибка в самом старте streamText до merge) | Defensive `if (dataStreamRef)`. Console.error сработает в любом случае — это минимальная гарантия observability |
| R2 | Stream уже закрыт к моменту emit → `dataStream.write` бросает | `emitDebugError` внутренний try/catch (уже есть) |
| R3 | Утечка чувствительного текста в user-facing message | Возвращаем фиксированную локализованную строку, НЕ `error.message` |
| R4 | Breaking в TypeScript из-за nullable closure | Тесты: `tsc --noEmit` после каждого файла |
| R5 | Project task expert route — `emitDebugError` не импортирован, забыть добавить = TS break | Явный step в ROADMAP: «добавить emitDebugError в import block» ПЕРЕД редактированием onError |
| R6 | Smoke test сложно воспроизвести ошибку локально | Временно добавить `throw new Error("test")` в начало execute, убедиться что видим все 3 точки, потом удалить. Альтернатива: сломать Anthropic API key на минуту (НЕ делать — другие разработчики) |

---

## 5. Definition of Done

1. Оба route имеют `onError` с сигнатурой `(error: unknown) => string`
2. `console.error` пишется в server logs (всегда, даже в prod)
3. `emitDebugError` отправляет событие в DevPanel (dev-only gate внутри функции)
4. User-facing строка локализована и не утекает детали
5. `npx tsc --noEmit` → 0 ошибок
6. `npm run build` → exit 0
7. Мануальный smoke test подтверждён пользователем:
   - Вызвана искусственная ошибка (временный `throw`)
   - В server logs — `[Chat Stream onError]` с объектом
   - В DevPanel Errors & Warnings секции — карточка error
   - В UI чата — строка «Произошла ошибка при генерации ответа. Попробуйте повторить.»
8. ROADMAP.md отмечен ✅
9. CHANGELOG.md (root) + SIMPLY_STATUS.md + CHANGELOG.md (локальный) обновлены
10. Папка перенесена в `_archive/TZ_StreamObservability/`
11. Backlog/README.md: строка про TZ_StreamObservability удалена из «Открытые долги», добавлена в «Закрытые»

---

## 6. Оценка

**0.5 сессии** (совпадает с SPEC):
- Stage 1 (chat/route.ts): 10 мин
- Stage 2 (task expert route): 10 мин + import block
- Stage 3 (tsc + build): 5 мин
- Stage 4 (smoke test с пользователем): 10-15 мин
- Stage 5 (финализация/архив): 10 мин

Итого ~45-60 мин чистого времени.
