# Roadmap ТЗ-BILLING1: Full Cost Coverage

**Создан:** 2026-04-06
**Версия проекта:** 3.67.0 → 3.68.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 3 |
| Завершено | 0 / 3 |
| Текущий этап | 1 |
| Сессий (оценка) | 1 |

**Критерий успеха:** SQL-запрос `SELECT * FROM ai_usage_log WHERE costUsd IS NULL AND createdAt > NOW() - INTERVAL '1 day'` возвращает 0 строк для chat/expertise/create chatModes + tool:voice-input + util:vision-ocr.

---

## Этапы

### Этап 1: Deepgram voice usage logging

**Статус:** ✅ Завершён (ожидает мануальный тест)
**Цель:** После завершения голосовой записи — отправить длительность на сервер и залогировать расход Deepgram в `ai_usage_log`.

**Задачи:**

**1.1 — Хук: трекинг длительности + POST на сервер:**
- [ ] `hooks/use-voice-recorder.ts`:
  - Добавить `startTimeRef = useRef<number>(0)`
  - В `startRecording()` → `startTimeRef.current = Date.now()`
  - В `stopRecording()` → вычислить `durationSeconds = (Date.now() - startTimeRef.current) / 1000`
  - POST `/api/deepgram/usage` с `{ durationSeconds }` (fire-and-forget, не блокирует UI)
  - Если запись <0.5с → не логировать (случайное нажатие)

**1.2 — Серверный endpoint:**
- [ ] `app/(chat)/api/deepgram/usage/route.ts` — новый файл:
  - POST handler: auth check (session.user.id), parse body `{ durationSeconds }`
  - Validate: `durationSeconds > 0 && durationSeconds <= 300` (max 5 мин, с запасом)
  - Вызов `logUsage()`:
    ```typescript
    logUsage({
      userId: session.user.id,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } as LanguageModelUsage,
      modelId: "deepgram-nova-3",
      chatMode: "tool:voice-input",
      durationMs: Math.round(durationSeconds * 1000),
      costUsdOverride: calculateDeepgramCostUsd(durationSeconds),
    });
    ```
  - Вернуть `{ ok: true }`

- [ ] `npx tsc --noEmit` → 0 ошибок

**Файлы:**
- `hooks/use-voice-recorder.ts` — startTimeRef + POST в stopRecording
- `app/(chat)/api/deepgram/usage/route.ts` — новый endpoint

**Валидация этапа:**
- [ ] `npx tsc --noEmit` → 0 ошибок
- [ ] `npm run build` → успешен
- [ ] Git commit: `feat(tz-billing1): deepgram voice usage logging`

🧪 **Мануальный тест:**
1. Открой чат, нажми микрофон, надиктуй 5-10 секунд, остановись
2. SQL-проверка:
```sql
SELECT "chatMode", "modelId", "costUsd", "durationMs", "createdAt"
FROM "ai_usage_log"
WHERE "chatMode" = 'tool:voice-input'
ORDER BY "createdAt" DESC
LIMIT 5;
```
3. Проверь что `costUsd > 0` и `durationMs` примерно соответствует длительности записи
4. Проверь что `costUsd ≈ durationSeconds × $0.0043 / 60` (допуск ±20% из-за округления)

⛔ **СТОП — дождаться подтверждения пользователя.**

---

### Этап 2: Vision OCR — гарантированный userId

**Статус:** ⬜ Не начат
**Цель:** Все вызовы `extractTextFromImage` / `extractTextFromPDF` в контексте чата получают `userId` → Gemini-расход логируется в `ai_usage_log`.

**Задачи:**

**2.1 — Пробросить userId через tool closure:**
- [ ] `lib/ai/tools/read-document.ts`:
  - Функция `readDocumentTool()` (или аналогичная фабрика) должна принимать `userId: string`
  - Передавать `userId` в `extractTextFromImage(buffer, mediaType, userId)` и `extractTextFromPDF(buffer, userId)`
  - Проверить сигнатуру: если tool создаётся как объект — замкнуть userId в closure

- [ ] `lib/ai/tools/chat-tools.ts`:
  - Убедиться что `getStandardTools({ userId })` пробрасывает userId в readDocument tool
  - Если readDocument создаётся внутри getStandardTools — добавить userId в closure

**2.2 — Убрать тихий пропуск в vision-ocr:**
- [ ] `lib/ai/vision-ocr.ts`:
  - `extractTextFromImage()` — сделать `userId` обязательным параметром (не optional)
  - `extractTextFromPDF()` — сделать `userId` обязательным параметром
  - Если кто-то вызывает без userId — TypeScript покажет ошибку компиляции (обнаружим все callsites)

- [ ] Починить все callsites, где TSC покажет ошибки (ожидаются в read-document.ts, возможно в других tools)

- [ ] `npx tsc --noEmit` → 0 ошибок

**Файлы:**
- `lib/ai/vision-ocr.ts` — userId обязательный
- `lib/ai/tools/read-document.ts` — пробросить userId
- `lib/ai/tools/chat-tools.ts` — пробросить userId в tool factory

**Валидация этапа:**
- [ ] `npx tsc --noEmit` → 0 ошибок
- [ ] `npm run build` → успешен
- [ ] Git commit: `fix(tz-billing1): vision-ocr always receives userId`

🧪 **Мануальный тест:**
1. Открой чат, загрузи любое фото (скриншот) → AI должен описать/прочитать текст
2. SQL-проверка:
```sql
SELECT "chatMode", "modelId", "inputTokens", "outputTokens", "costUsd", "createdAt"
FROM "ai_usage_log"
WHERE "chatMode" = 'util:vision-ocr'
ORDER BY "createdAt" DESC
LIMIT 5;
```
3. Проверь что появилась запись с `costUsd > 0` и `modelId = 'gemini-2.5-flash'`

⛔ **СТОП — дождаться подтверждения пользователя.**

---

### Этап 3: Финализация

**Статус:** ⬜ Не начат
**Цель:** Документация, version bump, archive.

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать `DOCUMENTATION_GUIDE.md` → пройти чеклист.

**Задачи:**

- [ ] ⛔ Прочитать `DOCUMENTATION_GUIDE.md`
- [ ] Обновить `CHANGELOG.md` (секция 3.68.0)
- [ ] Обновить `SIMPLY_STATUS.md` (версия, дата)
- [ ] Обновить `CLAUDE.md` (завершённые ТЗ + если нужно секция "Структура кода")
- [ ] Обновить `package.json` → 3.68.0
- [ ] SQL coverage audit:
```sql
SELECT "chatMode", COUNT(*), COUNT(*) FILTER (WHERE "costUsd" IS NULL) AS null_cost
FROM "ai_usage_log"
WHERE "createdAt" > NOW() - INTERVAL '1 day'
GROUP BY "chatMode"
ORDER BY "chatMode";
```
- [ ] `npm run build` → успешен
- [ ] Git commit: `docs(tz-billing1): finalization — v3.68.0`
- [ ] Перенести `specs/TZ_BILLING1_FullCostCoverage/` → `_archive/`

**Критерий готовности:** `null_cost = 0` для chat/expertise/create/tool:voice-input/util:vision-ocr.

---

## Файлы затронутые рефакторингом

**Deepgram (Этап 1):**
- `hooks/use-voice-recorder.ts` — startTimeRef + POST
- `app/(chat)/api/deepgram/usage/route.ts` — новый endpoint

**Vision OCR (Этап 2):**
- `lib/ai/vision-ocr.ts` — userId обязательный
- `lib/ai/tools/read-document.ts` — пробросить userId
- `lib/ai/tools/chat-tools.ts` — userId в tool factory

**Документация (Этап 3):**
- `CHANGELOG.md`, `SIMPLY_STATUS.md`, `CLAUDE.md`, `package.json`
