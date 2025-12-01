# Phase 2 – Streaming Optimization Tests

_Date:_ 2025-12-02

## Build & Static Verification
- `npm run build` ✅ (Next.js 15.3.0-canary.31)
- SmoothStream enabled in `app/(chat)/api/chat/route.ts` with `chunking: "word"`.
- TTFT instrumentation logs to server console as `[Performance] Chat <id>: first chunk = <ms>` followed by `[Performance] Chat <id>: TTFT = <ms>, Total = <ms>`.
- Provider configuration exposes both `gemini-2.5-pro` and `gemini-2.5-flash`; UI model list now includes "Gemini 2.5 Flash (Быстрый)".

## Manual Benchmark Checklist
| Scenario | Model | TTFT (ms) | Total Time (ms) | Notes |
| --- | --- | --- | --- | --- |
| Простой чат ("Привет!") | Pro | | | |
| Простой чат ("Привет!") | Flash | | | |
| Детальный запрос ("Расскажи подробно о переговорах") | Pro | 5 | 24567 | Логи `[Performance] Chat 230d360f-b952-4f58-8ed1-9919290caaac` (порт 3003)
| Детальный запрос ("Расскажи подробно о переговорах") | Flash | 2 | 11347 | Логи `[Performance] Chat a67bbd86-d513-46bc-89b4-64825642db5b` (порт 3003)
| Многократные параллельные запросы (3 вкладки) | Mixed | | | |

_Как собрать значения:_
1. Запусти `npm run dev` и отправь запросы через UI.
2. В серверных логах ищи строки `[Performance] Chat ...` – первые показывают Time To First Token, вторые фиксируют полное время ответа.
3. Зафиксируй TTFT/Total в таблице выше, чтобы сравнить Pro против Flash (Flash должен быть ощутимо быстрее на старте).

## Observations / Next Actions
- Ожидается, что Flash даёт на 30–50% меньший TTFT на простых запросах.
- Если TTFT остаётся >5s для простых запросов, проверь сетевые задержки или инструменты (они могут запускаться при выбранной модели).
- После заполнения таблицы обнови этот файл реальными цифрами или приложи скриншоты DevTools/консоли для контроля истории.
