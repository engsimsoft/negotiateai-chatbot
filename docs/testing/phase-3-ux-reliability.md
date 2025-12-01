# Phase 3 – UX & Reliability Verification

_Date:_ 2025-12-05

## Build & Static Verification
- `npm run build`
- Ensure `.env.local` has working Postgres credentials (build now runs drizzle migrations up-front; transient `ECONNRESET` errors indicate DB connectivity issues, not code regressions).
- Confirm `components/chat.tsx`, `components/artifact.tsx`, and `lib/errors.ts` compile without type drift (`pnpm tsc --noEmit`).
- Clear application cache (`localStorage`, `sessionStorage`) before manual tests so retry/timeout indicators start in a known state.

## Manual Test Matrix
| Scenario | Steps | Expected Result |
| --- | --- | --- |
| **S1 – Client Timeout** | 1. Start `npm run dev`. 2. In DevTools > Network set throttling to "Slow 3G". 3. Send длинный запрос ("Сгенерируй стратегию переговоров на 10 шагов"). | After 30s header shows «Ответ задерживается…»; after 60s toast «Запрос занял слишком много времени…», stream stops and state resets to idle. |
| **S2 – Automatic Retries** | 1. В Chrome DevTools временно включи «Offline» сразу после отправки. 2. Через ~2с верни Connection на «Online». | `toast` с текстом из `clientErrorMessages.retry`; счётчик ретраев в консоли (`[Retry] attempt …`) показывает ≤3 попыток, итоговое сообщение доставлено. |
| **S3 – Rate Limit / Quota** | 1. В `app/(chat)/api/chat/route.ts` временно сделай `throw new ChatSDKError("rate-limit")`. 2. Отправь запрос. | Toast: «Сервер отвечает слишком часто. Подождите и попробуйте снова.»; input остаётся активным без дублирования сообщений. |
| **S4 – Tool Progress HUD** | 1. Вставь файл в чат, чтобы запустить OCR/Sheet tool. 2. Раскрой артефакт. | Верхний блок показывает прогресс ("Читаю документ…", «Исполняю запрос…»), секунды таймера растут пока tool не завершит работу. |
| **S5 – Abort Controller** | 1. Запусти запрос и сразу нажми «Остановить». | Slow/timeout таймеры сбрасываются, `delayState` возвращается в "normal", дополнительных toasts нет. |
| **S6 – Error Mapping Smoke** | 1. Форсируй 500 ошибку (например, `throw new Error("boom")` в route). | Toast использует локализованное сообщение из `clientErrorMessages.internal`; в консоли есть `[Chat] categorized error: internal`. |

## Observations & Artifacts Checklist
- [ ] В логах клиента видно `Retry attempt X` и `Retry success`.
- [ ] В DevTools > Components `MultimodalInput` prop `delayState` проходит значения `"normal" → "slow" → "timeout"` в сценарии S1.
- [ ] В `artifacts/actions.ts` события `tool.status` публикуются и отображаются в `Artifact` компоненте.
- [ ] После завершения tool-операции `ToolProgress` скрывается и таймер останавливается.
- [ ] Никаких незавершённых `AbortController` warnings в консоли.

## Regression Notes
- Переключение модели (Flash/Pro) не должно обнулять `retryState` до отправки нового сообщения; при смене модели во время активного запроса в логах не должно быть `undefined model` ошибок.
- `useChat` `onError` хук теперь агрегирует `ChatSDKError` — убедись, что server-side stack traces доступны в logs для дальнейшего анализа.
- Если во время миграций `npm run build` падает с `ECONNRESET`, повторите команду после восстановления VPN/DB; это не блокирует Phase 3 функциональность.
