# Отчёт: Тестирование моделей для кнопки «Думать» в Simply Chat

**Дата:** 2026-04-08
**Автор тестов:** Claude Code
**Цель:** Найти альтернативу Anthropic Sonnet для кнопки «Думать» — дешевле, без потери качества

---

## 1. Методология

### Что тестировали
Четыре модели через AI SDK v6 (`streamText`), одинаковый промпт для всех:

- **System:** "Ты опытный бизнес-консультант. Отвечай на русском языке. Давай глубокий, структурированный анализ."
- **User:** "Мой партнёр предлагает вложить 2 миллиона рублей в открытие кофейни в спальном районе Москвы. Стоит ли? Дай анализ рисков и возможностей."

### Провайдеры
| Модель | Провайдер | Пакет |
|--------|-----------|-------|
| Anthropic Claude Sonnet 4 | OpenRouter | `@openrouter/ai-sdk-provider` |
| Qwen 3.6 Plus | OpenRouter | `@openrouter/ai-sdk-provider` |
| Gemini 3.1 Pro Preview | OpenRouter | `@openrouter/ai-sdk-provider` |
| Gemini 3.1 Pro Preview | Google Direct | `@ai-sdk/google` |
| MiniMax M2.7 | vercel-minimax-ai-provider (Anthropic mode) | `vercel-minimax-ai-provider` |
| MiniMax M2.7 | vercel-minimax-ai-provider (OpenAI mode) | `vercel-minimax-ai-provider` |

### Режимы
- **Thinking ON** — reasoning/thinking включён через providerOptions
- **Default** — дефолтное поведение модели

---

## 2. Сводная таблица результатов

| Метрика | Sonnet 4 (baseline) | Qwen 3.6 Plus | Gemini 3.1 Pro (OR) | Gemini 3.1 Pro (direct) | MiniMax M2.7 |
|---------|:-------------------:|:-------------:|:-------------------:|:-----------------------:|:------------:|
| **TTFT (thinking)** | 1.1 сек | 1.1 сек | 3.2 сек | 17.4 сек | ~2 сек |
| **TTFT (default)** | 2.0 сек | 1.3 сек | — | 15.0 сек | ~2 сек |
| **Total time (thinking)** | 26 сек | 114 сек | 28 сек | 35 сек | ~8 сек |
| **Total time (default)** | 17 сек | 74 сек | — | 31 сек | ~8 сек |
| **Текст (chars)** | 2398 | 7485 | 5422 | 5315 | ~600 |
| **Качество русского** | 5/5 | 4/5 | 4/5 | 4.5/5 | 4/5 |
| **Reasoning видим в stream** | ✅ | ✅ | ✅ | ❌ (скрыт) | ✅ |
| **Reasoning отключается** | ✅ | ❌ always-on | ❌ always-on | ❌ always-on | ❌ always-on |
| **inputTokens** | 144 | 78 | 62 | 63 | 45 |
| **outputTokens** | 1315 | 4721 | 2933 | 3112 | 134 |
| **reasoningTokens** | 336 | 2187 | 1240 | 1440 | не отделены |
| **Стоимость за запрос** | $0.020 | $0.009 | $0.035 | ~$0.009* | ~$0.003 |
| **Usage полный** | ✅ | ✅ | ✅ | ✅ | ⚠️ зависит от режима |
| **Tool calling** | ✅ | не тестировали | не тестировали | не тестировали | ⚠️ баг провайдера |

\* Gemini direct — бесплатный tier / стандартная цена Google без наценки OR

---

## 3. Детали по каждой модели

### 3.1. Anthropic Claude Sonnet 4 (baseline)

**Провайдер:** OpenRouter (`anthropic/claude-sonnet-4`)

**Плюсы:**
- Лучший TTFT (1.1 сек с thinking)
- Единственная модель, где reasoning **управляемо** — можно включить/выключить
- Лучшее качество русского языка (5/5)
- Лаконичные, структурированные ответы
- Полный usage с разделением text/reasoning tokens

**Минусы:**
- Самая дорогая из тестируемых ($0.020 за запрос)
- Через OpenRouter — наценка посредника

**Вердикт:** Текущий оптимум. Работает, пользователи довольны.

---

### 3.2. Qwen 3.6 Plus

**Провайдер:** OpenRouter (`qwen/qwen3.6-plus`)

**Плюсы:**
- Дешёвый ($0.009 за запрос, в 2.2x дешевле Sonnet)
- Глубокий, детальный анализ
- Reasoning виден в stream

**Минусы:**
- **КРИТИЧНО: 74-114 секунд на ответ** — неприемлемо для интерактивного чата
- Многословный (7485 chars текста + 6961 chars reasoning)
- Reasoning всегда включён, нельзя отключить
- Thinking на английском, даже при ответе на русском

**Вердикт:** ❌ **Отпадает.** Время ответа неприемлемо для UX.

---

### 3.3. Gemini 3.1 Pro Preview

**Протестирован в двух режимах:**

#### Через OpenRouter (`google/gemini-3.1-pro-preview`)

**Плюсы:**
- TTFT 3.2 сек — приемлемо
- Reasoning виден в stream (OpenRouter пробрасывает)
- Детальный ответ (5422 chars)
- Полный usage с разделением tokens

**Минусы:**
- Самый дорогой через OR ($0.035 за запрос, в 1.75x дороже Sonnet!)
- Reasoning always-on

#### Напрямую через `@ai-sdk/google`

**Плюсы:**
- Дешевле (нет наценки OR, ~$0.009)
- Полный usage
- Хорошее качество ответа (4.5/5)

**Минусы:**
- **TTFT 15-17 секунд** — пользователь долго ждёт первый символ
- **Reasoning НЕ виден** — `@ai-sdk/google` не пробрасывает thinking-блоки в stream
- Reasoning always-on

**Вердикт для кнопки «Думать»:**
- Через OpenRouter — ✅ **возможен**, но дороже Sonnet
- Напрямую — ❌ TTFT 15 сек и скрытый reasoning делают неприемлемым для интерактивного UX

**Вердикт для фоновых задач (briefing, extract):**
- Напрямую — ✅ дешёво, качественно, TTFT не важен

---

### 3.4. MiniMax M2.7

**Протестирован через `vercel-minimax-ai-provider` в двух режимах:**

#### Anthropic-совместимый (default export `minimax`)

**Плюсы:**
- Быстрый (~8 сек total)
- Usage полный (inputTokens, outputTokens, cache fields)
- Самый дешёвый (~$0.003 за запрос)
- Reasoning виден в stream
- Stream format Anthropic-совместимый

**Минусы:**
- **Tool calling сломан** — провайдер бандлит `@ai-sdk/anthropic@3.0.6` (наш проект: 3.0.58), из-за чего Zod-схема не конвертируется в JSON Schema. `input_schema: { properties: {} }` — пустая
- Reasoning always-on, нельзя отключить

#### OpenAI-совместимый (`minimaxOpenAI`)

**Плюсы:**
- Tool calling работает (Zod → JSON Schema конвертация корректна)
- Быстрый

**Минусы:**
- **Usage полностью пустой** — `{ inputTokenDetails: {}, outputTokenDetails: {} }` — нет ни inputTokens, ни outputTokens
- Для биллинга/cost tracking неприемлемо

**Вердикт:**
- Привлекательная модель по цене и скорости
- **Блокер:** tool calling (Anthropic mode) или пустой usage (OpenAI mode)
- Баг в провайдере (dependency mismatch) — ждать обновления или тестировать через OpenRouter
- Через OpenRouter **не тестировали** — потенциально решит оба бага

---

## 4. Технические находки

### 4.1. AI SDK v6: `inputSchema` vs `parameters`

В AI SDK v6 tool definition требует поле **`inputSchema`**, а не `parameters`:

```typescript
// ✅ Правильно (AI SDK v6)
tool({
  inputSchema: z.object({ message: z.string() }),
  execute: async ({ message }) => ...
})

// ❌ Неправильно — schema будет пустой
tool({
  parameters: z.object({ message: z.string() }),
  execute: async ({ message }) => ...
})
```

Наш продакшн-код (`save-fact.ts`) использует `inputSchema` — корректно.

### 4.2. `part.textDelta` vs `part.text`

В `fullStream` итерации разные провайдеры используют разные поля:
- Anthropic: `part.textDelta`
- Google, MiniMax: `part.text`

**Не влияет на продакшн** — `toUIMessageStream()` абстрагирует это. Проблема только в тестовых скриптах с ручной итерацией.

### 4.3. Reasoning always-on

Все альтернативные модели (Qwen, Gemini, MiniMax) **всегда думают** — reasoning нельзя отключить. Sonnet — единственная модель, где thinking управляется параметром. Это влияет на архитектуру кнопки «Думать»: если альтернативная модель используется, кнопка переключает не thinking on/off, а **модель целиком**.

### 4.4. Google API — геоблокировка

Google Generative AI API блокирует запросы с определённых IP (datacenter-провайдеры, некоторые регионы). **Не влияет на продакшн** — Vercel serverless (регион iad1, США) не попадает под блокировку. Влияет только на локальную разработку без VPN.

---

## 5. Рекомендации

### Для кнопки «Думать» в Simply Chat

| Приоритет | Модель | Провайдер | Обоснование |
|-----------|--------|-----------|-------------|
| **1** | Sonnet 4 | Напрямую (Anthropic) | Текущий, лучший UX, управляемый reasoning |
| **2** | MiniMax M2.7 | OpenRouter (нужен тест) | Самый дешёвый, быстрый, но нужен тест через OR |
| **3** | Gemini 3.1 Pro | OpenRouter | Хорошее качество, видимый reasoning, но дорогой |

### Следующие шаги

1. **Протестировать MiniMax M2.7 через OpenRouter** — если tools и usage работают, это лучший кандидат по цене ($0.003 vs $0.020)
2. **Решить архитектуру переключения моделей** — reasoning always-on у альтернатив меняет логику кнопки
3. **Gemini 3.1 Pro напрямую — для фоновых задач** — дешевле OR, TTFT не критичен для pipelines

---

## 6. Тестовые скрипты

Скрипты сохранены в репозитории (не для продакшна):
- `scripts/test-minimax.ts` — тесты MiniMax M2.7 (оба провайдера)
- `scripts/test-think-models.ts` — сравнительный тест Sonnet / Qwen / Gemini

---

## 7. Стоимость тестирования

| Провайдер | Потрачено (оценка) |
|-----------|--------------------|
| OpenRouter | ~$0.10 (5 запросов) |
| MiniMax Direct | ~$0.01 (6 запросов) |
| Google Direct | ~$0.02 (2 запроса) |
| **Итого** | **~$0.13** |
