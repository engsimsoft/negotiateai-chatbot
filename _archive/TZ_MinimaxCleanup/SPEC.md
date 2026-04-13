# ТЗ: MiniMax M2.7 + Расчистка (v3.76.0)

**Дата:** 2026-04-08
**Цель:** Заменить Haiku на MiniMax M2.7 в chatMode=simply, добавить маршрутизацию по типу сообщения, удалить устаревший код.

---

## Что делаем

### 1. Маршрутизация модели в chatMode=simply

В `route.ts` — новая логика выбора модели для chatMode=simply. Определяется через переменную `modelToUse` (механизм уже существует для `think` → Sonnet).

**Логика (порядок приоритетов):**

```
if (think) → Anthropic Sonnet (как сейчас, без изменений)
else if (сообщение содержит вложения: image, PDF, document) → Gemini 3 Flash
else → MiniMax M2.7
```

**Определение вложений:** проверить `message.parts` последнего user-сообщения на наличие `type: "image"`, `type: "file"` с mimeType PDF/document. Текстовые файлы (text/plain) — НЕ считаются вложениями, для них MiniMax достаточно.

### 2. Подключение MiniMax M2.7

**Провайдер:** `minimax` (default export из `vercel-minimax-ai-provider`) — Anthropic-совместимый режим. Это важно: именно `minimax`, НЕ `minimaxOpenAI` — у него полный usage.

**Установка:** `npm install vercel-minimax-ai-provider`

**Env:** `MINIMAX_API_KEY` — добавить в `.env` и Vercel.

**Конфигурация модели:**
- Model ID: `MiniMax-M2.7`
- Temperature: `0.7` (ВАЖНО: MiniMax не принимает 0, диапазон строго (0.0, 1.0])
- Reasoning: всегда включён, отключить нельзя. Это нормально.
- `sendReasoning: true` — уже включено в `toUIMessageStream`, reasoning-блоки пойдут в UI автоматически.

**Stream pipeline:** НЕ ТРОГАТЬ. Текущий `result.toUIMessageStream({ sendReasoning: true })` + `createUIMessageStream` работает с MiniMax из коробки (проверено тестами).

**Tools:** НЕ подключать к MiniMax. saveFact удаляется (см. п.4), других tools в simply нет.

### 3. Подключение Gemini 3 Flash для вложений

**Провайдер:** `@ai-sdk/google` (уже установлен в проекте).

**Модель:** `google("gemini-3-flash")`

**Когда:** chatMode=simply + сообщение с изображением/PDF/документом (кроме text/plain).

**Streaming:** тот же pipeline `toUIMessageStream`. Проверить что работает с Google провайдером (должно — briefing уже использует `@ai-sdk/google`).

**System prompt:** тот же что для MiniMax/simply. Gemini получает контекст KITT.

### 4. Удалить saveFact

- `lib/ai/tools/save-fact.ts` — удалить файл
- `lib/ai/tools/chat-tools.ts` — убрать импорт и подключение saveFact для chatMode=simply
- Промпт Simply (system prompt) — удалить блок инструкций saveFact (если есть в system prompt, а не только в PE)

### 5. Откатить скользящее окно

- `lib/ai/context-limits.ts` — удалить константу `SIMPLY_SLIDING_WINDOW_SIZE = 20`
- `route.ts` ~строка 339-347 — убрать ограничение на 20 сообщений для isSimply. Загружать все сообщения (как для остальных chatMode)
- `trimToUserStart()` — если используется только для simply, удалить. Если используется в других местах — оставить.

### 6. Отключить Extract на каждое сообщение

- `route.ts` ~строка 1192-1218 — в `onFinish`: закомментировать или удалить вызов `extractAndStoreFacts()` для chatMode=simply. Оставить для других chatMode если они его используют.
- НЕ удалять `lib/ai/memory/extract.ts` — он понадобится для Extract при сжатии (следующее ТЗ).

### 7. Обновить pricing

`lib/ai/providers.ts` → `MODEL_PRICING_RUB` — добавить:

```typescript
"MiniMax-M2.7": {
  input: 0.03,      // $0.30/1M → RUB за 1K при RUB_PER_USD=100
  output: 0.12,     // $1.20/1M
  cached: 0.006,    // $0.06/1M (cache read)
  cacheWrite: 0.0375 // $0.375/1M
},
"gemini-3-flash": {
  input: 0.05,      // $0.50/1M
  output: 0.30,     // $3.00/1M
  cached: 0.0,      // уточнить
  cacheWrite: 0.0   // уточнить
},
```

### 8. Обновить extractUsageFields()

`lib/ai/usage-utils.ts` — текущая функция работает с AI SDK v6 usage format. MiniMax через Anthropic-совместимый провайдер возвращает usage в том же формате (inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens) — проверено тестами. Дополнительных изменений скорее всего не нужно, но **проверить** что usage корректно записывается в `ai_usage_log` при реальном запросе через MiniMax.

### 9. Обновить chat-mode-config.ts

Строка 29 — для chatMode=simply сейчас стоит `claude-haiku`. Изменить на `MiniMax-M2.7` (или создать отдельную конфигурацию, если config используется для pricing/display).

---

## Что НЕ делать

- Не трогать chatMode=expertise, create, projects — остаются на Anthropic
- Не трогать MIND, RAG, Voyage AI, briefing, Telegram, Stenogramma
- Не трогать stream pipeline (toUIMessageStream, createUIMessageStream)
- Не трогать lib/ai/memory/extract.ts — нужен для следующего ТЗ
- Не трогать DevPanel — reasoning уже отображается через sendReasoning

---

## Критерии приёмки

Проверить в браузере:

1. **Текстовое сообщение в Simply:** ответ от MiniMax M2.7 (проверить в DevPanel — model должен быть MiniMax-M2.7)
2. **Кнопка «Думать»:** ответ от Anthropic Sonnet (как раньше)
3. **Отправить фото с вопросом:** ответ от Gemini 3 Flash (проверить в DevPanel)
4. **DevPanel:** usage показывает корректные inputTokens/outputTokens, стоимость в рублях считается по новым ценам
5. **Скользящее окно:** отправить 25+ сообщений — все видны, все отправляются модели (не обрезается до 20)
6. **saveFact:** tool не существует, модель не пытается его вызвать
7. **Extract:** после отправки сообщения в Simply — в логах НЕТ вызова extractAndStoreFacts

---

## Справочные документы

- `SIMPLY_MINIMAX_M27_REFERENCE.md` — полный справочник MiniMax M2.7
- `TEST_REPORT_THINK_MODELS.md` — результаты тестов всех моделей
- Тестовые скрипты: `scripts/test-minimax.ts`, `scripts/test-think-models.ts`
