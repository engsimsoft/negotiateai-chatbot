# MiniMax M2.7 — Интеграция в Simply

**Статус:** ✅ В production через официальный Anthropic-compatible режим
**Версия проекта:** 3.85.0 (после ТЗ-CacheAudit)
**Дата последнего аудита:** 2026-04-13

> Этот документ — единственный источник правды по MiniMax M2.7 в Simply.
> Актуальные ADR: [043-minimax-simply-routing.md](decisions/043-minimax-simply-routing.md), [046-podcast-tts-revert-and-briefing-stability.md](decisions/046-podcast-tts-revert-and-briefing-stability.md), [049-minimax-anthropic-compat-mode.md](decisions/049-minimax-anthropic-compat-mode.md).

---

## 1. Что такое MiniMax M2.7 для Simply

MiniMax M2.7 — основная текстовая LLM проекта для задач, где Claude избыточен по цене или нужна специфика MiniMax. Применяется в Simply Chat (текст), briefing pipeline (filter + author + section + podcast-script), memory (extract-batch + consolidate + profile).

| Параметр | Haiku 4.5 (было до v3.77) | MiniMax M2.7 (сейчас) |
|---|---|---|
| Intelligence Index | 31 | 50 (уровень Opus) |
| Input price | $0.80/M | **$0.30/M** |
| Output price | $4.00/M | **$1.20/M** |
| Cache read | $0.08/M (через явный `cache_control`) | $0.03–0.06/M (passive auto-cache + explicit через Anthropic-compat) |
| Context window | 200K | 204K |
| Vision | ✅ | ❌ (маршрутизация на Gemini 3 Flash для image/PDF) |

**Итог:** ~3–5× дешевле Haiku, Intelligence Index в 1.6× выше, официальная Anthropic-совместимая интеграция.

---

## 2. Архитектура маршрутизации

```
chatMode=simply (текст)         → MiniMax M2.7
chatMode=simply (вложения)      → Gemini 3 Flash (vision + docs)
chatMode=simply (Думать)        → Claude Haiku 4.5 (разово, след. сообщение → MiniMax)
chatMode=expertise              → Claude Sonnet
chatMode=create                 → Claude Sonnet
Projects (expert chat)          → Claude Haiku/Sonnet/Opus (tier-based)

Briefing Filter                 → MiniMax M2.7 (через minimaxLong, 180s timeout)
Briefing Author                 → MiniMax M2.7 (через minimaxLong, монолит 26K+ tokens)
Briefing Section                → MiniMax M2.7
Podcast Script                  → MiniMax M2.7
Podcast TTS                     → Gemini Flash TTS (не MiniMax, см. ADR 046)

MIND memory:extract-batch       → MiniMax M2.7
MIND memory:consolidate         → MiniMax M2.7
MIND memory:profile             → MiniMax M2.7
```

---

## 3. Технические детали подключения

### Провайдер

**Пакет:** `vercel-minimax-ai-provider@0.0.2` — официальный пакет MiniMax (автор `"MiniMax"`, maintainer `dyh_sjtu@163.com`). Последняя версия на npm, опубликована 10 января 2026.

**Фабрика:** `createMinimax()` — Anthropic-compatible режим (**default export пакета**, официально рекомендован самими MiniMax).

**Что это значит технически:** `createMinimax()` под капотом проксирует запросы через `AnthropicMessagesLanguageModel` из `@ai-sdk/anthropic/internal`. Это **тот же класс**, что используется для обычного Claude через AI SDK v6 — все фичи Anthropic provider (streamText, tool calling, generateObject, reasoning parts, explicit cacheControl) работают автоматически. Это не отдельная реализация, а тонкая обёртка с другим baseURL и заголовками.

### Registry (lib/ai/registry.ts)

```typescript
import { createMinimax } from "vercel-minimax-ai-provider";

// Default namespace — 60s fetch timeout (Simply Chat, короткие вызовы)
const minimax = createMinimax({
  apiKey: process.env.MINIMAX_API_KEY,
});

// Long-timeout namespace — 180s для briefing и memory pipelines с крупными промптами
const minimaxLong = createMinimax({
  apiKey: process.env.MINIMAX_API_KEY,
  fetch: async (url, init) =>
    fetch(url, { ...init, signal: AbortSignal.timeout(180_000) }),
});
```

### Endpoint

`https://api.minimax.io/anthropic/v1` — hardcoded в пакете, заголовок `anthropic-version: 2023-06-01` ставится автоматически.

### ENV

```
MINIMAX_API_KEY=<ключ с platform.minimax.io>
```

Загружается из `.env.local` локально и из Vercel Environment Variables в production.

### Задачи в task-assignments.ts

Все `MiniMax-M2.7` taskId резолвятся через `getModel(taskId) → registry.languageModel("minimax:MiniMax-M2.7")` или `"minimaxLong:MiniMax-M2.7"` (для briefing/memory). Model-catalog содержит алиасы для разделения namespace.

---

## 4. Кнопка «Думать» в Simply

Видима только при `chatMode === "simply"`. Поведение:

- **Не нажата** → MiniMax M2.7 (быстро, дёшево)
- **Нажата** → `simply-chat-think` taskId → **Claude Haiku 4.5** (разово, одно сообщение)
- **Следующее сообщение** → автоматически снова MiniMax M2.7

Кнопка = «получить качественный ответ от Anthropic модели». Какой именно Claude резолвится — определяется `DEFAULT_TASK_MODELS['simply-chat-think']` в `task-assignments.ts` (сейчас Haiku 4.5). Может быть переопределено через Dev Switchboard `/dev/models`.

**Важно:** кнопка «Думать» не связана с внутренним thinking/reasoning режимом MiniMax. MiniMax M2.7 всегда использует interleaved thinking, его нельзя отключить — это фича модели, не наш параметр.

---

## 5. Prompt caching

MiniMax через Anthropic-compatible endpoint поддерживает **оба** уровня кэширования по документации [platform.minimax.io/docs/api-reference/anthropic-api-compatible-cache](https://platform.minimax.io/docs/api-reference/anthropic-api-compatible-cache):

### Passive auto-cache (без параметров)

- Срабатывает **автоматически** от 512 input tokens
- Порядок prefix-matching: `tools → system → user messages`
- TTL 5 минут с автообновлением при каждом hit
- Метрика в response: `cache_read_input_tokens` → AI SDK v6 мапит в `inputTokenDetails.cacheReadTokens` → читается нашим `extractUsageFields()`

**Production validation (Этап 1 ТЗ-CacheAudit, 2026-04-13):**
- Simply Chat msg 1 (cold): `cacheReadTokens = 0`, `inputTokens = 14280`, cost $0.0044
- Simply Chat msg 2 (follow-up): `cacheReadTokens = 13883` (**96.8% hit**), cost $0.0011
- Экономия ~4× на втором сообщении без единой строки explicit cacheControl

### Explicit cache control

Доступен до **4 breakpoints** на запрос через тот же синтаксис, что у Anthropic API:

```typescript
messages: [
  {
    role: 'system',
    content: systemPromptText,
    providerOptions: {
      anthropic: { cacheControl: { type: 'ephemeral' } }
    }
  },
  // ...
]
```

На уровне tools — `providerOptions.anthropic.cacheControl` ставится на tool object. TTL option: `{ type: 'ephemeral', ttl: '1h' }` (по умолчанию 5m).

**Метрики:** `cache_creation_input_tokens` (cache write) и `cache_read_input_tokens` — возвращаются через стандартные поля AI SDK v6 `inputTokenDetails.cacheWriteTokens` и `inputTokenDetails.cacheReadTokens`.

**Pricing для M2.7:**
- Fresh input — $0.30/M (1×)
- Cache write — $0.375/M (1.25×)
- Cache read — $0.03–0.06/M (~0.1× = **скидка 90%**)
- Output — $1.20/M

Формула `calculateCostRub()` в `lib/ai/providers.ts` учитывает все три input-ставки через disjoint fields.

---

## 6. Ограничения MiniMax

| Фича | Статус | Комментарий |
|---|---|---|
| Текст | ✅ | Полная поддержка |
| Streaming | ✅ | Нативно через AnthropicMessagesLanguageModel |
| System prompts | ✅ | Полная поддержка |
| Tool calling (function call) | ✅ | JSON Schema, interleaved thinking работает |
| `generateObject(mode: "tool")` | ✅ | Работает через tool calling под капотом AI SDK v6 |
| Extended thinking | ✅ | Всегда включён, отключить нельзя (фича модели) |
| Images на входе | ❌ | Не поддерживается ни в одном режиме → маршрутизация на Gemini 3 Flash |
| Documents на входе (PDF/DOCX) | ❌ | То же самое → Gemini |
| Temperature = 0 | ❌ | Диапазон строго `(0.0, 1.0]` — вызов с 0 вернёт ошибку |
| `stop_sequences` | ❌ | Игнорируется в Anthropic-compat mode (нам не нужен — используем SDK-level `stopWhen`) |
| `top_k` | ❌ | Игнорируется |
| Anthropic MCP servers | ❌ | Не поддерживается (нам не нужно) |
| Anthropic Context Management (Claude Compaction) | ❌ | Игнорируется MiniMax API (мы её применяем только к Claude через `isSimplyNonAnthropicModel` флаг) |

**Temperature в Simply Chat:** 0.7 для MiniMax, 1.0 для Claude. Управляется переменной `isSimplyNonAnthropicModel` в `app/(chat)/api/chat/route.ts`.

---

## 7. Контекстное окно

- **Максимум:** 204,800 tokens
- **Стратегия в Simply:** `SIMPLY_CONTEXT_LIMIT` в `lib/ai/context-limits.ts` с extract-on-compression (при 60% / 80% полного контекста → batch extract facts → исключение обработанных сообщений)
- **Compaction (Claude Compaction API):** отключён для MiniMax, работает только для Claude-моделей в expertise/create/projects chatModes

---

## 8. Валидация биллинга

**Метод:** сумма `costUsd` из `ai_usage_log` `WHERE "modelId" = 'MiniMax-M2.7'` сравнивается с реальным списанием баланса на `platform.minimax.io → Balance`.

**При расхождении >10%** — проверить ставки в `lib/ai/model-catalog.ts` (секция MiniMax) и сверить с актуальным pricing на https://platform.minimax.io/docs/guides/pricing.

---

## 9. Файлы в проекте

| Файл | Роль |
|---|---|
| `lib/ai/registry.ts` | `minimax` + `minimaxLong` namespace через `createMinimax()` |
| `lib/ai/getModel.ts` | Резолв `simply-chat`/`briefing:*`/`memory:*` taskId → Minimax через registry |
| `lib/ai/model-catalog.ts` | `MiniMax-M2.7` + `MiniMax-M2.7-long` entries с pricing |
| `lib/ai/task-assignments.ts` | `DEFAULT_TASK_MODELS` — все MiniMax taskId |
| `lib/ai/providers.ts` | Pricing helpers: `calculateCostRub`, `extractUsageForPricing` |
| `lib/ai/usage-utils.ts` | `extractUsageFields` + `logUsage` — универсальны для всех провайдеров включая MiniMax |
| `app/(chat)/api/chat/route.ts` | Simply Chat route, `isSimplyNonAnthropicModel` флаг, `stripLegacyOpenAICompatToolParts` (legacy compat), `stripMediaPartsForTextModel` (media → placeholder) |
| `lib/briefing/briefing-filter.ts` | Briefing Filter через `getModel("briefing:filter")` |
| `lib/briefing/briefing-author.ts` | Briefing Author через `getModel("briefing:author")`, 180s timeout через `minimaxLong` |
| `lib/briefing/briefing-section-author.ts` | Per-section refresh |
| `lib/podcast/script-generator.ts` | Podcast script через `getModel("briefing:podcast-script")` |
| `lib/ai/memory/extract.ts` | MIND batch extraction + consolidation |
| `lib/ai/memory/profile.ts` | MIND user profile |
| `scripts/test-minimax-anthropic-compat.ts` | **Референсный валидатор** всех фич провайдера (streamText, tool calling, generateObject mode:tool, explicit cacheControl) — запускать при обновлении пакета |
| `scripts/test-minimax-via-registry.ts` | Integration smoke-тест резолва через `getModel → registry → language model` |
| `components/dev-panel/sections/model-section.tsx` | MODEL_DISPLAY mapping для UI |
| `.env.example` | `MINIMAX_API_KEY` template |

---

## 10. Legacy compatibility: `stripLegacyOpenAICompatToolParts`

До ТЗ-CacheAudit (2026-04-13) MiniMax подключался через `createMinimaxOpenAI()` — OpenAI-совместимый endpoint (устаревшая кастомная реализация в том же пакете). Он хранил tool calls как inline parts с `toolCallId` в формате `call_function_*` без соответствующего `tool_result` сообщения.

После переключения на `createMinimax()` все новые tool calls идут в нативном Anthropic формате (`toolu_*`) с обязательной парой `tool_use + tool_result`. Но в БД **остаются legacy сообщения** в старом формате — orphan `tool_use` блоки вызывают 400 ошибку в `AnthropicMessagesLanguageModel` (которая одинакова для Claude и MiniMax Anthropic-compat).

Функция `stripLegacyOpenAICompatToolParts()` в `app/(chat)/api/chat/route.ts` применяется ко всем сообщениям `chatMode=simply` перед `convertToModelMessages()` и чистит legacy parts по префиксу `call_function_`. При отсутствии таких parts — no-op.

**Когда можно удалить:** через 30+ дней после деплоя, когда все legacy сообщения либо будут вручную почищены, либо не попадут в контекст. Перед удалением — SQL: `SELECT COUNT(*) FROM "Message_v2" WHERE parts::text LIKE '%call_function_%'` должен вернуть 0.

---

## 11. История миграций

| Версия | ТЗ | Что сделано |
|---|---|---|
| v3.77.0 | ТЗ-MinimaxCleanup | MiniMax M2.7 для Simply Chat (text). Костыль: использовался OpenAI-compat factory на основании ошибочных выводов — через 8 версий исправлено |
| v3.80.0 | ТЗ-Briefing-1 | Briefing Filter + Author переведены с Gemini/Sonnet на MiniMax M2.7. Цена брифинга $0.074 → $0.011 (6.6×) |
| v3.81.0 | ТЗ-Briefing-2 | Podcast Script + TTS переведены на MiniMax |
| v3.82.0 | ТЗ-MapReduce | TTS откачен на Gemini Flash TTS (качество + 53× дешевле); Script остался на MiniMax. Map-Reduce для Author отклонён (streamText socket bug) |
| **v3.85.0** | **ТЗ-CacheAudit (2026-04-13)** | **Возврат к официальному Anthropic-compat режиму через `createMinimax()`. Удалён костыль `config.includeUsage = true` из `getModel.ts` (не нужен в новой реализации). Подтверждено independent тестом (`test-minimax-anthropic-compat.ts`): streamText, tool calling с параметрами, generateObject(mode:tool), explicit cacheControl — всё работает. Предыдущее решение использовать OpenAI-compat (v3.77) базировалось на ошибочных выводах агента, который не смог правильно протестировать Anthropic-compat** |

---

## 12. Краткая справка для ТЗ

При написании ТЗ, затрагивающих `chatMode=simply` или MiniMax pipelines:

- Модель резолвится через `getModel('simply-chat' | 'briefing:*' | 'memory:*')`, не через direct factory
- Text-only: для изображений/PDF → Gemini 3 Flash (автоматическая маршрутизация по media parts)
- Кэш: passive auto-cache работает из коробки (512+ tokens), explicit cache control доступен через стандартный Anthropic синтаксис `providerOptions.anthropic.cacheControl`
- Temperature: 0.7 для MiniMax, не ставить 0 (API вернёт ошибку)
- Compaction API: отключён для MiniMax (`isSimplyNonAnthropicModel` флаг)
- Tools: полная поддержка, включая `generateObject(mode: 'tool')` для structured output
- Thinking/Reasoning: модель сама решает когда думать, отключить нельзя, reasoning parts стримятся через AI SDK v6 reasoning events автоматически
- Валидировать новые версии пакета — запускать `npx tsx scripts/test-minimax-anthropic-compat.ts` (все 4 теста должны PASS)
