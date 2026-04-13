# CHANGELOG — TZ_StreamObservability

## 2026-04-14 — session 1 (ТЗ закрыто, v3.87.2)

### Подготовка
- Промоут из `specs/_backlog/TZ_StreamObservability.md` → `specs/TZ_StreamObservability/SPEC.md`
- Прочитаны 4 страницы официальной документации AI SDK v6 (WORKFLOW правило 1):
  - `createUIMessageStream` — сигнатура `onError: (error: unknown) => string`, поведение в merged streams
  - `useChat` — status transitions, `clearError` semantics
  - AI SDK UI Error Handling — best practice generic message
  - AI SDK Core Error Handling + APICallError reference
- Проанализированы оба chat route (`chat/route.ts`, `projects/.../chat/route.ts`), найден reference-pattern `emitDebugError` в Professor pipeline
- Написан ANALYSIS.md с closure-capture паттерном и рисками (R1–R6)
- Написан ROADMAP.md с этапами 0–5

### Код

**Stage 1 — server observability (обе chat routes):**
- `app/(chat)/api/chat/route.ts`:
  - +`type UIMessageStreamWriter` в import из `ai`
  - +`let dataStreamRef: UIMessageStreamWriter | null = null` перед `createUIMessageStream`
  - +`dataStreamRef = dataStream` первой строкой в `execute`
  - `onError` полностью переписан: console.error + emitDebugError через closure-ref + локализованная строка
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts`:
  - то же самое + добавлен `emitDebugError` в существующий import block из `@/lib/ai/debug-events`

**Smoke test 1 (stage 1):**
- Временный `throw new Error("TEST: stream observability smoke")` в execute
- User отправил сообщение → server logs показали `[Chat Stream onError]` с полным stack, DevPanel Session Errors popup с локализованной строкой, UI показал user-facing текст
- User confirm: ✅

**Stage 2b — recovery UX (расширенный скоуп на основе smoke test):**
- Обнаружено: `useChat` status после error идёт в `"error"`, а `MultimodalInput.onSubmit` блокировал всё что `!== "ready"` → пользователь застревал до reload страницы
- Ре-проверка AI SDK docs: `clearError()` — отдельный обязательный вызов перед resend, sendMessage **не** чистит error state автоматически
- `components/chat.tsx`: +`clearError` в useChat destructuring, +проп в `<MultimodalInput>`
- `components/projects/task-chat.tsx`: то же
- `components/multimodal-input.tsx`:
  - +`clearError?: UseChatHelpers<ChatMessage>["clearError"]` в props
  - Submit guard переписан: block только на `submitted`/`streaming`, error → `clearError?.()` + `submitForm()`
  - `disabled={status !== "ready"}` на voice + attachments buttons → `disabled={status === "submitted" || status === "streaming"}`

**Smoke test 2 (stage 2b):**
- Throw повторён, пользователь отправил первое сообщение → error
- **Без reload** отправил второе → улетело, toast не появился, поле не заблокировано
- User confirm: «отправил два сообщения вышло две ошибки» ✅

### Валидация
- `npx tsc --noEmit` после каждого stage → 0 ошибок
- `npm run build` → exit 0, `Compiled successfully`, `Generating static pages (61/61)`

### Финализация
- `package.json` version 3.87.1 → 3.87.2
- CHANGELOG.md (root): новый раздел `[3.87.2]` с полным описанием обоих stage, Изученная документация
- SIMPLY_STATUS.md: версия 3.87.2, новая секция `ТЗ-StreamObservability ✅ ЗАВЕРШЁН`, lesson learned про расширение скоупа
- CLAUDE.md: версия 3.87.2, префикс ТЗ в списке Завершены
- specs/_backlog/README.md: TZ_StreamObservability удалён из «Открытые долги», добавлен в «Закрытые долги»
- Эта папка → `_archive/TZ_StreamObservability/`

### Не реализовано (осознанно, YAGNI)
- **`APICallError.isInstance` narrowing** — ANALYSIS предусматривал, но решили НЕ включать в Stage 1. Обоснование: базовая задача (console.error + emitDebugError + осмысленное сообщение) покрывается без `isInstance`. `APICallError` полезен для category-based сообщений («5xx — временно недоступно» vs «401 — ошибка конфигурации»), но это **уточнение**, не блокер. Если в будущем понадобится более дифференцированное UX — добавлять как follow-up, а не premature abstraction.

### Lessons learned

1. **Empirical smoke test перед написанием финализации.** Именно smoke test выявил вторую проблему (recovery UX), которую текст SPEC не предвидел. Если бы сразу после tsc перешёл к CHANGELOG — ТЗ бы закрылся с нерешённой UX-проблемой, и пользователь бы пришёл с follow-up баг-репортом через час.

2. **Расширение скоупа в том же ТЗ > отложенный follow-up**, когда обнаруженная проблема блокирует **цель** исходного ТЗ. Цель StreamObservability — чтобы пользователь мог отладить и продолжить работу. Без recovery UX пользователь может отладить, но не продолжить. Half-done ≠ done.

3. **Документация перед кодом на каждом уточнении.** На этапе Stage 2b я снова WebFetch'ил use-chat docs, чтобы подтвердить поведение `clearError` vs `sendMessage`. Не по памяти. Это сэкономило потенциальный bug "sendMessage на error state должен был сам сбросить" — docs явно сказали что нет.

4. **Non-programmer feedback критически важен.** Владимир указал на UX-проблему коротким сообщением, которое 99% разработчиков бы описали как «useChat status stuck in streaming state» — но он сказал «нет информации что нужно для этого сделать чтобы сбросить ошибку». Это формулирование заставило меня искать решение уровня clearError/recovery, а не «лучше лог при падении».
