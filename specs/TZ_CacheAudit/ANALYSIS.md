# Анализ ТЗ-CacheAudit

**Дата анализа:** 2026-04-12

---

## Изученная документация (Правило 1 WORKFLOW.md)

### Anthropic Prompt Caching

**Источник:** [platform.claude.com/docs/en/build-with-claude/prompt-caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)

**Ключевые факты:**
- До **4 cache_control breakpoints** на запрос.
- TTL: 5 мин (бесплатный) / 1 час (write cost × 2).
- Pricing: write 1.25×, read 0.1× (скидка 90% на повторные префиксы).
- Минимум токенов зависит от модели: Sonnet 4.6 — 2048, Haiku 4.5 — 4096, Opus — 4096.
- Кэшируются `tools`, `system`, `messages`, `tool_use`, `images`.
- Иерархия инвалидации: Tools → System → Messages (изменение верхнего уровня инвалидирует нижние).
- Beta header `anthropic-beta` **больше не требуется** (работает через стандартный `cache_control` в body).

### Vercel AI SDK v6 @ai-sdk/anthropic

**Источник:** [ai-sdk.dev/providers/ai-sdk-providers/anthropic](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic)

**Ключевые факты:**
- Синтаксис на уровне content-part:
  ```ts
  { type: 'text', text: '...', providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } } }
  ```
- TTL: `{ type: 'ephemeral', ttl: '1h' }`.
- Usage поля в response: `cacheCreationInputTokens`, `cacheReadInputTokens` в `inputTokenDetails`.
- **Tool-level cacheControl** — синтаксис уточняется на Этапе 0 (content-part подтверждён, tool-level надо дочитать).

### MiniMax — ДВА стандарта подключения одновременно

#### OpenAI-compatible

**Источник:** [platform.minimax.io/docs/api-reference/text-openai-api.md](https://platform.minimax.io/docs/api-reference/text-openai-api.md)

- Base URL: `https://api.minimax.io/v1`
- Env: `OPENAI_BASE_URL`, `OPENAI_API_KEY`
- **Работает:** chat completions, system prompts, streaming, tool calling (`tools`), `temperature` (0, 1], `top_p`, `max_tokens`, stop sequences.
- **MiniMax-специфичное:** `reasoning_split=True` → выносит thinking в `reasoning_details`, либо `<think>`-теги в контенте.
- **НЕ поддерживается:** vision / image input, audio input, `n > 1`, deprecated `function_call`, `presence_penalty` / `frequency_penalty` / `logit_bias`, response format / JSON mode, `logprobs`.

#### Anthropic-compatible

**Источник:** [platform.minimax.io/docs/api-reference/text-anthropic-api.md](https://platform.minimax.io/docs/api-reference/text-anthropic-api.md)

- Base URL: `https://api.minimax.io/anthropic`
- Env: `ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic`
- **Полностью работает:** tools (`tools` + `tool_choice`), streaming, system prompts, extended thinking через `thinking` param, max_tokens, temperature (0, 1], top_p, metadata.
- **Partial:** `messages.content` — только text и tool calls, **без image/document input**.
- **НЕ поддерживается / игнорируется:** vision, document input, top_k, stop sequences, service tier, MCP servers, context management, container.
- Temperature строго `(0, 1]` — за диапазоном ошибка.

#### Prompt caching — оба стандарта

**OpenAI-compat caching** — [platform.minimax.io/docs/api-reference/text-prompt-caching](https://platform.minimax.io/docs/api-reference/text-prompt-caching):
- Автоматический passive cache от **512 токенов**, без параметров в запросе.
- Порядок prefix matching: `tools → system → user messages`.
- Поле в response: `prompt_tokens_details.cached_tokens` (OpenAI-style).
- Нет explicit control.

**Anthropic-compat caching** — [platform.minimax.io/docs/api-reference/anthropic-api-compatible-cache](https://platform.minimax.io/docs/api-reference/anthropic-api-compatible-cache):
- Синтаксис идентичен Anthropic: `"cache_control": {"type": "ephemeral"}`.
- **4 breakpoints** максимум (если больше — последние 4 с конца).
- TTL: 5 минут с автопродлением при hit.
- Поля response: `cache_creation_input_tokens`, `cache_read_input_tokens`, `input_tokens` (последний = non-cached после последнего breakpoint).
- Формула: `total_input = cache_read + cache_creation + input_tokens`.
- Pricing M2.7: base $0.3/M, cache write $0.375/M (1.25×), cache read $0.03-0.06/M (~0.1×).

#### Tool calling

**Источник:** [platform.minimax.io/docs/api-reference/text-m2-function-call-refer.md](https://platform.minimax.io/docs/api-reference/text-m2-function-call-refer.md)

- Работает одинаково в обоих стандартах.
- JSON Schema.
- Interleaved thinking: в Anthropic-compat через стандартные thinking blocks в response.content, в OpenAI-compat через `reasoning_split=True` или парсинг `<think>`-тегов.

### Локальный пакет `vercel-minimax-ai-provider` v0.0.2

**Источник:** `node_modules/vercel-minimax-ai-provider/README.md`

> **«Note: The default `minimax` instance uses the Anthropic-compatible API format, which provides better support for advanced features. If you need the OpenAI-compatible format, use `minimaxOpenAI` instead.»**

**Фабрики** (из `dist/index.d.ts:44`):
- `minimax` = `minimaxAnthropic` = `createMinimaxAnthropic()` — **Anthropic-compat (default)**
- `createMinimax` = `createMinimaxAnthropic` — **Anthropic-compat**
- `minimaxOpenAI` = `createMinimaxOpenAI()` — **OpenAI-compat (наш текущий выбор)**

**Зависимости:** `@ai-sdk/anthropic: 3.0.6`.

---

## Резюме находок

1. **Anthropic подключение чистое** — `lib/ai/registry.ts:24` использует `createAnthropic({ apiKey })` без обёрток, baseURL дефолтный `api.anthropic.com`. Ни костылей, ни заплаток.
2. **MiniMax подключён в не-default стандарт** — `lib/ai/registry.ts:18,29` использует `createMinimaxOpenAI()`. Официальный README провайдера рекомендует `minimax`/`createMinimax` (Anthropic-compat) как default, потому что «better support for advanced features».
3. **Anthropic cache используется на 25%** — `app/(chat)/api/chat/route.ts:1022` ставит `cacheControl` только на первый system message. Доступно 4 breakpoints, используем 1. Tools (12+ инструментов = крупный блок) и история не кэшируются.
4. **MiniMax cache — метрический слепой угол** — OpenAI-compat режим кэширует автоматически от 512 tok, но возвращает поле `prompt_tokens_details.cached_tokens` (OpenAI-style), а `extractUsageFields` в [lib/ai/usage-utils.ts:58-78](lib/ai/usage-utils.ts#L58-L78) читает только Anthropic-style (`inputTokenDetails.cacheReadTokens`). В DevPanel и UsageLog всегда ноль для MiniMax.
5. **Метрики для Anthropic работают правильно** — AI SDK v6 `@ai-sdk/anthropic` автомапинг в `inputTokenDetails` → `extractUsageFields` → DevPanel + UsageLog + `calculateCostRub` со скидками 1.25× / 0.1×.
6. **Костылей нет:**
   - `retryWithLogging` + `maxRetries: 0` — намеренный observability паттерн (ТЗ-PIPELINE1).
   - `minimaxLong` с кастомным `fetch` — законный способ выставить 180s timeout для pipelines.

---

## Feature matrix: OpenAI-compat vs Anthropic-compat MiniMax

| Feature | OpenAI-compat | Anthropic-compat | Используется в коде? |
|---|:---:|:---:|:---:|
| Tool / function calling | ✅ | ✅ | ✅ 12+ tools в Simply Chat |
| Streaming | ✅ | ✅ | ✅ везде |
| System prompts | ✅ | ✅ | ✅ везде |
| Temperature, top_p, max_tokens | ✅ | ✅ | ✅ |
| **Explicit cache (4 breakpoints)** | ❌ | ✅ | 🎯 цель ТЗ |
| Passive auto-cache (≥512 tok) | ✅ | ✅ | неявно |
| Metrics field | `prompt_tokens_details.cached_tokens` | `cache_creation_input_tokens` / `cache_read_input_tokens` | — |
| **Auto-mapping в AI SDK v6** | ❌ | ✅ | 🎯 |
| Thinking / reasoning | ✅ (reasoning_split или `<think>`) | ✅ (стандартные blocks) | ✅ через AI SDK |
| HTTP stop sequences | ✅ | ❌ ignored | ❌ не используется (только SDK-level `stopWhen: stepCountIs`) |
| Image / vision | ❌ | ❌ | n/a (фото/PDF уходят на Gemini Flash) |
| Document input | ❌ | ❌ | n/a (см. выше) |
| JSON mode / response_format | ❌ | ❌ | `generateObject` работает через tool calling в обоих |
| n > 1, presence/freq penalty, logprobs | ❌ | n/a | ❌ |
| Top-K | n/a | ❌ ignored | ❌ |
| MCP servers | n/a | ❌ ignored | ❌ |
| Context management (Claude Compaction) | n/a | ❌ ignored | ⚠️ используется только для Anthropic, не MiniMax |

### Вывод по стандарту: Anthropic-compat — однозначный выбор

**Приобретаем:**
1. ✅ Explicit prompt cache с 4 breakpoints — цель ТЗ, иначе не решается.
2. ✅ Автомапинг usage полей в AI SDK v6 без нового кода.
3. ✅ Стандартная обработка thinking через reasoning parts.
4. ✅ Официально рекомендованный default режим провайдера.
5. ✅ Консистентность с Anthropic code path — единый `providerOptions.anthropic.cacheControl`.

**Теряем (ничего не используется):**
- HTTP stop sequences — не используются
- Vision/image — уже идёт на Gemini
- `reasoning_split`, `<think>`-теги — grep пуст
- presence/frequency penalty, logprobs, n>1 — не используются

---

## Потенциальные риски

| Риск | Вероятность | Влияние | Митигация |
|---|---|---|---|
| MiniMax Anthropic-compat ломает `generateObject` в MIND extract | Средняя | Высокое (блокер перехода) | Smoke-тест Этапа 1.6 — если ломается, fallback на OpenAI-compat namespace только для MIND pipelines |
| Различие в поведении streaming между двумя стандартами (edge case) | Низкая | Среднее | Smoke-тесты всех MiniMax точек Этапа 1 |
| MIND transplant в user-message ломает точность фактов | Средняя | Среднее | Ручной тест Этапа 4, fallback на вариант А (MIND как отдельный system, 2 breakpoints) |
| AI SDK v6 tool-level cacheControl синтаксис — не найден в предварительном анализе | Средняя | Низкое | WebFetch на Этапе 0 до написания кода Этапа 2 |
| Смена baseURL `/v1` → `/anthropic` ломает существующие тесты или скрипты | Низкая | Низкое | Grep на `api.minimax.io/v1` в кодовой базе |

---

## Ответы на открытые вопросы (согласовано с пользователем)

1. **Scope pipelines:** chat routes + **полный smoke всех MiniMax-точек** (briefing + podcast + MIND extract через `generateObject`). Включено в Этап 1 как обязательные smoke-тесты перед Этапом 2.
2. **MIND dynamic block:** **Вариант Б** — переносится в `content`-part последнего user message (3 breakpoints, максимум экономии). С обязательным тестом что факты памяти продолжают использоваться моделью корректно. Fallback на вариант А если тест покажет деградацию.
3. **Имя ТЗ:** `TZ_CacheAudit` (аудит кэширования + подключения провайдеров).
4. **Целевая версия:** 3.85.0.

---

## Зависимости

**Что нужно до начала:**
- [x] Официальная документация Anthropic + MiniMax прочитана (WebFetch)
- [x] README локального пакета `vercel-minimax-ai-provider` прочитан
- [ ] AI SDK v6 Anthropic docs — синтаксис cacheControl на tool-level (Этап 0)
- [ ] SQL baseline UsageLog для MiniMax (Этап 0)
- [ ] Probe OpenAI-compat автокэша через curl (Этап 0) — подтверждение фактического поведения

**Затронутые файлы:**

### Меняются
- `lib/ai/registry.ts` — замена фабрики MiniMax
- `app/(chat)/api/chat/route.ts` — расширение breakpoints + MIND transplant
- `app/(chat)/api/service-chat/route.ts` — расширение breakpoints
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — расширение breakpoints + projectManifest cache

### Документация
- `docs/ai-providers.md`, `docs/ai-minimax.md` — feature matrix, pricing
- `docs/decisions/049-minimax-anthropic-compat-mode.md` — новый ADR
- `docs/decisions/050-cache-breakpoints-strategy.md` — новый ADR
- `SIMPLY_STATUS.md`, `CHANGELOG.md`, `CLAUDE.md`, `package.json`

### Проверяются smoke-тестами
- `lib/briefing/briefing-author.ts`, `briefing-filter.ts`, `briefing-section-author.ts`
- `lib/podcast/script-generator.ts`
- `lib/ai/memory/extract.ts`, `consolidate.ts`

### Референс (не меняется)
- `lib/ai/usage-utils.ts`, `lib/ai/providers.ts` — автоматически заработают для MiniMax после переключения
- `components/dev-panel/sections/tokens-section.tsx`, `cost-breakdown-section.tsx`

---

## Оценка сложности

- [x] Среднее (3-5 сессий)

**Обоснование:**
- Этап 1 (переключение registry + smoke всех pipelines) = 1 сессия, критический риск
- Этап 2 (chat route breakpoints + MIND transplant + тест) = 1 сессия
- Этап 3 (service-chat + task-expert) = 0.5 сессии
- Этап 4 (валидация + SQL-проверки) = 0.5-1 сессия
- Этап 5 (финализация + 2 ADR + документация) = 0.5 сессии

---

## Этап 0: результаты pre-flight (2026-04-12)

### Критическое переосмысление

В процессе Этапа 0 обнаружены **два слоя дезинформации** в проекте:

1. **`docs/ai-minimax.md:75`** утверждает: «используется `minimaxOpenAI`, НЕ `minimax`. Причина: Anthropic endpoint не возвращает cache tokens».
2. **`scripts/test-minimax.ts:221-225`** сравнительная таблица заявляет: в Anthropic-compat `textDelta` не работает, tool params пустые.
3. **`docs/ai-minimax.md:199`** утверждает: «generateObject не работает (провайдер не реализует responseFormat)».

**Всё это проверено независимым тестом и оказалось неправдой.**

### Исходник пакета `vercel-minimax-ai-provider@0.0.2`

`node_modules/vercel-minimax-ai-provider/dist/index.mjs:1-40`:

```js
import { AnthropicMessagesLanguageModel } from "@ai-sdk/anthropic/internal";

function createMinimaxAnthropic(options = {}) {
  const baseURL = "https://api.minimax.io/anthropic/v1";
  const getHeaders = () => ({
    "anthropic-version": "2023-06-01",
    "x-api-key": loadApiKey({ environmentVariableName: "MINIMAX_API_KEY" }),
  });
  return new AnthropicMessagesLanguageModel(modelId, {
    provider: "minimax.messages",
    baseURL,
    headers: getHeaders,
  });
}
```

**Ключевой факт:** Anthropic-compat mode в пакете — это **тонкая обёртка над официальным классом `AnthropicMessagesLanguageModel` из `@ai-sdk/anthropic`**. Всё, что работает для Claude через AI SDK v6 (cacheControl, reasoning parts, tool calls, generateObject, streaming), работает и здесь автоматически — потому что это **тот же класс**.

OpenAI-compat, наоборот — кастомная собственная реализация MiniMax в `minimax-openai-language-model.ts`, написанная с нуля.

### Актуальность и авторство пакета

- Package author: `"MiniMax"`, maintainer `dyh_sjtu@163.com`
- Публичный репозиторий `github.com/MiniMax-AI/minimax-ai-sdk-provider`
- Версия 0.0.2 опубликована 10 января 2026 — последняя
- 0.0.1 была 5 декабря 2025, новее нет

**Это официальный пакет, поддерживаемый производителем модели.**

### Реальное состояние `ai_usage_log` за 14 дней (SQL baseline)

| Модель | n | avg cacheRead | avg cacheWrite | avg input | max cacheRead |
|---|---|---|---|---|---|
| MiniMax-M2.7 (OpenAI-compat) | 112 | **2282** | **0** | 9143 | **39158** |
| Claude Sonnet 4.6 | 50 | 2720 | 1123 | 13090 | 47415 |
| Claude Haiku 4.5 | 44 | 3658 | 7648 | 16260 | 16315 |

**Корректировка первичного диагноза:**
- Мой первый вывод «MiniMax cache — метрический слепой угол, всегда 0» — **неверен**
- Реальность: `cacheReadTokens` OpenAI-compat **записывается** в базу (~25% от input)
- Но `cacheWriteTokens` всегда 0 — **это настоящая дыра в учёте** (не знаем расходы на cache creation)
- Cache hit rate ~25% — автокэш работает, но без explicit control неоптимально

### Независимый тест: `scripts/test-minimax-anthropic-compat.ts`

Запущен на текущей установленной версии 0.0.2, с `createMinimax()` (Anthropic-compat). 4 теста, все PASS:

| # | Тест | Результат | Предыдущий агент заявлял |
|---|---|---|---|
| 1 | streamText basic (русский, 4 text chunks) | ✅ PASS | «textDelta не работает» — **ложь** |
| 2 | Tool calling с Zod, параметры доставлены | ✅ PASS `paramsWorked=true` | «tool params = empty {}» — **ложь** |
| 3 | generateObject (mode:tool) — 3 факта извлечены | ✅ PASS `facts=3` | «не работает, возвращает Markdown» — **ложь** |
| 4 | Explicit cacheControl (2 запроса подряд) | ✅ PASS | Не тестировалось |

**Test 4 детально:**
- Запрос 1: `cache_creation_input_tokens: 2111`, `cache_read_input_tokens: 0`
- Запрос 2: `cache_creation_input_tokens: 0`, `cache_read_input_tokens: 2111`
- **100% cache hit** на system prompt между двумя независимыми запросами
- AI SDK v6 usage поля мапятся корректно: `inputTokenDetails.cacheReadTokens: 2111`, `inputTokenDetails.cacheWriteTokens: 2111` (запрос 1) / 0 (запрос 2)

### Вывод Этапа 0

План Этапа 1 (переключение фабрики) **возвращается к оригиналу без изменений**, но с уточнённым обоснованием в ADR 049:

> **ADR 049 (обновлено):** Предыдущее решение использовать `createMinimaxOpenAI` в ТЗ-MiniMaxCleanup (v3.76) базировалось на ложных утверждениях о неработоспособности Anthropic-compat режима. Независимый тест на той же версии пакета (`scripts/test-minimax-anthropic-compat.ts`) доказал, что все 4 критичные для проекта функции — streamText, tool calling с параметрами, generateObject(mode:tool), explicit cacheControl — работают корректно. Возвращаемся на официально рекомендованный режим `createMinimax` в соответствии с документацией MiniMax и исходником пакета (тонкая обёртка над `AnthropicMessagesLanguageModel` из `@ai-sdk/anthropic`).

### Доп. находки для Этапа 2

- Cacheable block минимум для Sonnet 4.6 / аналог для MiniMax = ~2000 токенов. Системный промпт Simply Chat `simply-chat.md` — всего ~400 символов. **Сам по себе он недостаточен для кэширования** — нужно либо объединять с блоком стабильных инструкций / tools definitions, либо ставить breakpoint на (system + tools), чтобы суммарно превысить порог.
- Проверить `lib/ai/providers.ts` → MODEL_PRICING_RUB для MiniMax — должны быть ставки `cached` и `cacheWrite` (для корректного отображения стоимости после переключения).
- Pricing MODEL_PRICING_RUB уже содержит `cached: 0.006` и `cacheWrite: 0.0375` для MiniMax-M2.7 (согласно `_archive/TZ_MinimaxCleanup/SPEC.md:74-81`) — проверить в текущем коде, не было ли удалено.

---

## Рекомендации разработчика (Код-ревью ТЗ)

### ✅ Согласен с целью ТЗ
- Аудит подключения в соответствии с официальной документацией — необходимая гигиена перед новыми фичами.
- Выбор стандарта MiniMax «один раз» — правильная тактика: переключение фабрики дорого по тестам, но легковесно по коду.

### ⚠️ Рекомендую изменить

| # | Было в плане | Рекомендация | Обоснование |
|---|---|---|---|
| 1 | Кэшировать `projectManifest` в task-expert route | Проверить что `projectManifest` действительно стабилен в рамках задачи | Если переменный (например, обновляется при каждом ответе эксперта) — кэширование даст нулевую выгоду и потратит breakpoint впустую. Проверить на Этапе 3 до включения. |
| 2 | Tool-level cacheControl через `providerOptions` на последнем tool | Уточнить синтаксис через WebFetch AI SDK docs **до** Этапа 2 | Это единственный момент, который я точно не знаю — если AI SDK его не поддерживает напрямую, придётся ставить cacheControl через `experimental_providerMetadata` или на system message описанием tools. Перед кодом — узнать. |
| 3 | `minimaxLong` (180s timeout) — переключить на Anthropic-compat одновременно | OK, но **протестировать отдельно** что briefing pipelines не требуют больше 180s в Anthropic-compat режиме | В Anthropic-compat thinking blocks могут делать ответы дольше. Если отваливаются по timeout — увеличить до 240-300s. |

### ❓ Требует внимания

- **Pricing MiniMax в `MODEL_PRICING_RUB`** — проверить, что текущие цены `lib/ai/providers.ts` учитывают cached rate для MiniMax. Если нет — обновить после Этапа 1.
- **MIND transplant семантика** — модель может по-разному интерпретировать факты памяти в system vs user. Обязательно мануальный тест: задать вопрос, где ответ зависит от факта памяти.
