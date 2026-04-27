# ТЗ-XAI-1 — Фундамент: registry, catalog, task-assignments

**Дата:** 2026-04-14  
**Серия:** Миграция на xAI (ТЗ-XAI-1 → ТЗ-XAI-6)  
**Цель:** Подготовить инфраструктуру моделей для миграции. Ноль изменений поведения — все taskId продолжают указывать на текущие модели.  
**После этого ТЗ:** Можно начинать переключать taskId по одному в последующих ТЗ.

---

## Контекст

Simply мигрирует с зоопарка провайдеров (MiniMax + Anthropic + OpenRouter) на архитектуру **xAI + Anthropic**:

| Роль | Модель | API |
|---|---|---|
| KITT (дворецкий), MIND pipeline | Grok 4.1 Fast (non-reasoning) | Chat Completions |
| Думать, Создать, Экспертиза | Grok 4.20 | Chat Completions |
| Vision/OCR (вложения) | Claude Haiku 4.5 | Messages API (как сейчас) |
| Профессор (проекты, по выбору клиента) | Claude Opus | Messages API (как сейчас) |
| Embeddings | Voyage AI | Без изменений |

**Принцип:** Chat Completions — индустриальный стандарт. Позволяет менять провайдера за минуты. Responses API — только для будущего multi-agent (отдельная ветка, не в этой серии ТЗ).

---

## Что сделать

### 1. registry.ts — проверить namespace `xai`

Namespace `xai` через `createXai` уже существует. Проверить:
- `XAI_API_KEY` передаётся корректно
- Никаких кастомных baseURL не нужно (дефолт `https://api.x.ai/v1` — правильный)
- **Не создавать** namespace для Responses API — это Chat Completions only на данном этапе

**Не трогать:** `anthropic`, `minimaxLong`, `openrouter` — они ещё используются, удалим в ТЗ-XAI-6.  
**Не трогать:** `minimax` — тоже удалим позже.

### 2. model-catalog.ts — актуализировать записи

**Проверить существующие xAI записи** (6 штук по аудиту) на соответствие официальной документации xAI (https://docs.x.ai/developers/models):

| Поле | Что проверить |
|---|---|
| `modelId` | Точное совпадение с xAI API (`grok-4-1-fast-non-reasoning`, `grok-4.20-0309` и т.д.) |
| `pricing` | Input/Output/CacheRead/CacheWrite в USD/1M tokens по актуальным данным xAI |
| `contextWindow` | 2 000 000 для всех Grok 4.x (декларативно от xAI) — обновить если стоят консервативные значения |
| `maxOutput` | Проверить по документации, обновить |
| `capabilities.tools` | `true` для всех Grok (function calling поддерживается) |
| `capabilities.vision` | `true` для Grok 4.20 и Grok 4.1 Fast (image input поддерживается через Chat Completions) |
| `capabilities.thinking` | `true` для reasoning-вариантов, `false` для non-reasoning |
| `capabilities.supportsCompaction` | `false` для всех Grok (это Anthropic-only фича) |

**Важно по reasoning:**
- `grok-4.20-0309` и `grok-4-1-fast` — рассуждают **автоматически**, параметр `reasoning_effort` **НЕ поддерживается** (будет ошибка)
- `grok-4.20-multi-agent-0309` — единственная модель где `reasoning_effort` контролирует количество агентов (low/medium = 4, high/xhigh = 16)
- `presence_penalty` и `frequency_penalty` — **НЕ поддерживаются** reasoning-моделями

**Добавить** `CAPS_GROK` preset (если ещё нет) по аналогии с `CAPS_CLAUDE` / `CAPS_MINIMAX`:
```ts
const CAPS_GROK: ModelCapabilities = {
  streaming: true,
  tools: true,
  vision: true,  // Grok 4.x поддерживает image input
  documentSupport: 'native',  // или проверить по доке
  thinking: false,  // default, override per-model для reasoning вариантов
  embeddings: false,
  supportsCompaction: false,
};
```

### 3. task-assignments.ts — НЕ МЕНЯТЬ маппинги

**Не переключать ни один taskId.** Это делается в последующих ТЗ по одному.

Единственное что нужно: убедиться что тип `TaskId` содержит все нужные ключи для будущих режимов. Если не хватает — добавить, но не назначать.

### 4. getModel.ts — проверить совместимость

Убедиться что `getModel(taskId)` корректно резолвит xAI модели из каталога через registry. Тест:

```ts
// Должно работать без ошибок:
getModel('simply-chat')        // → текущая модель (пока MiniMax)
// После ручной подстановки в task-assignments:
// getModel('simply-chat')     // → xai:grok-4-1-fast-non-reasoning
```

Проверить что `PROVIDER_TO_REGISTRY` map содержит `xai` → `xai` (или что xAI модели корректно резолвятся по текущей логике).

### 5. providers.ts — добавить pricing для Grok

Функция `calculateCostRub` и `extractUsageForPricing` должны корректно считать стоимость для xAI моделей. Проверить:
- Pricing берётся из catalog (SSOT) — тогда ничего не менять
- Если есть хардкод по провайдерам — добавить xAI
- `RUB_PER_USD = 100` — без изменений (Владимир контролирует)

---

## Что НЕ делать

- **Не переключать** ни один taskId на Grok — это ТЗ-XAI-2+
- **Не удалять** MiniMax / OpenRouter из registry — это ТЗ-XAI-6
- **Не трогать** chat/route.ts, providerOptions, tools, strip-функции
- **Не добавлять** Responses API / `xai.responses()` — это отдельная ветка для multi-agent
- **Не добавлять** Qwen/Dashscope — решение отменено

---

## Критерий готовности

1. `npm run build` проходит без ошибок
2. Все существующие тесты проходят (если есть)
3. Приложение работает как раньше — ни одна модель не переключена
4. xAI модели в каталоге имеют корректные pricing/capabilities по официальной документации
5. `getModel()` способен зарезолвить xAI модели из каталога (можно проверить console.log)

---

## Ссылки

- **Официальная документация xAI:** https://docs.x.ai/developers/models
- **AI SDK xAI provider:** https://ai-sdk.dev/providers/ai-sdk-providers/xai
- **Аудит registry/catalog:** предоставлен в сессии 2026-04-14 (таблица 1)
- **ADR текущей архитектуры:** `docs/decisions/047-core-model-registry.md`
