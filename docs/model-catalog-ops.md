# Model Catalog Operations — Workflow

> **Для Claude Code:** Используй этот документ при добавлении моделей, аудите цен и верификации capabilities.
> Каждое действие сопровождается конкретными командами и файлами.

**Файлы-участники:**

| Файл | Роль |
|------|------|
| `lib/ai/model-catalog.ts` | SSOT — все модели, pricing, capabilities |
| `lib/ai/task-assignments.ts` | Маппинг 39 задач → модель |
| `lib/ai/getModel.ts` | Резолв: taskId → override check → catalog → registry |
| `lib/ai/registry.ts` | AI SDK registry: 5 namespace (anthropic, minimax, minimaxLong, xai, openrouter) |
| `lib/ai/model-overrides.ts` | Client-safe: dev-gate, parse overrides |
| `lib/ai/model-overrides-node.ts` | Server-only: fs read/write `.simply-dev-overrides.json` |
| `lib/ai/providers.ts` | Cost calculation: `calculateCostRub`, `RUB_PER_USD` |

---

## 1. Архитектура

### Два типа AI-сервисов

**Registry-сервисы** (через `getModel(taskId)`) — переключаемые через Dev Switchboard:
- Anthropic Claude (Sonnet, Haiku, Opus)
- MiniMax M2.7
- xAI Grok (4.20, 4.1 Fast)
- OpenRouter (GLM, Qwen)

**Raw-fetch сервисы** (прямые API-вызовы) — НЕ переключаемые:

| Сервис | Файл | Модель | API |
|--------|------|--------|-----|
| Perplexity (deep research) | `lib/ai/tools/perplexity-client.ts` | sonar-pro, sonar-deep-research | Raw fetch |
| Deepgram (voice) | `lib/meeting/deepgram-transcribe.ts` | nova-3 | Raw fetch |
| Voyage AI (embeddings) | `lib/ai/memory/voyage-client.ts` | voyage-4, voyage-4-lite | Raw fetch |
| Gemini TTS (podcast) | `lib/podcast/tts-gemini.ts` | gemini-2.5-flash-preview-tts | @google/genai SDK |

Raw-fetch сервисы присутствуют в каталоге **только для cost tracking** (pricing). Они не проходят через `getModel()` и не переключаются через override. Подключение к switchboard — отдельное ТЗ.

### Как работает override (dev-mode)

```
.simply-dev-overrides.json (корень проекта, .gitignore)
  ↓ fs.readFileSync
model-overrides-node.ts → registerOverridesReader()
  ↓
getModel(taskId) → lookupOverride(taskId) → override ?? DEFAULT_TASK_MODELS[taskId]
  ↓
model-catalog.ts → resolveModelEntry(catalogId) → registry.ts → LanguageModel
```

Переключение через UI: `/dev/models` (полная карта) или DevPanel → Switchboard (per-message).

### Кэширование per provider

| Провайдер | Кэш в коде | Где настраивается | Состояние |
|-----------|-----------|-------------------|-----------|
| **Anthropic** | `cacheControl: { type: 'ephemeral' }` на system prompt | `app/(chat)/api/chat/route.ts`, ветка `isAnthropicModel` | ✅ Работает, cache_read виден в DevPanel |
| **MiniMax** | Нет | — | Не поддерживает prompt caching |
| **xAI Grok** | Нет в коде | `cachedInput` цены есть в каталоге | ⚠️ Цены есть, но `cacheControl` не подставляется в route.ts |
| **OpenRouter** | Нет в коде | `cachedInput` для GLM 5.1 / 5V Turbo | ⚠️ Аналогично Grok — цены есть, активация нет |

**Что это значит:** Cost tracking для Anthropic точный (учитывает cache_read/write). Для Grok/OpenRouter — всегда считает fresh price. Если провайдер кэширует автоматически, реальная стоимость ниже отображаемой.

### Compaction (управление длиной контекста)

Единая стратегия для всех провайдеров — **Simply Compaction middleware** (extract → summarize → verbatim). Капабилити `supportsCompaction` удалена из каталога — компактация применяется в `prepare-messages.ts` независимо от провайдера. Подробности → [ADR 054](decisions/054-single-strategy-compaction.md).

---

## 2. Как добавить модель

### Чеклист

- [ ] **1. Catalog entry** в `lib/ai/model-catalog.ts` → массив `ENTRIES[]`
  - `id` — уникальный идентификатор (обычно совпадает с modelId провайдера)
  - `provider` — один из `ProviderId`
  - `modelId` — физический ID у провайдера
  - `displayName` — для UI
  - `pricing` — `{ input, output, cachedInput, cacheWrite }` в USD/1M токенов
  - `capabilities` — использовать preset (`CAPS_CLAUDE`, `CAPS_GROK` и т.д.) или inline
  - `contextWindow` — в токенах
  - `maxOutput` — в токенах
  - `notes` — (опционально) пометки
- [ ] **2. Task assignment** (если модель будет default для какой-то задачи)
  - Добавить taskId в тип `TaskId` в `task-assignments.ts`
  - Добавить маппинг в `DEFAULT_TASK_MODELS`
- [ ] **3. Registry namespace** (если новый провайдер)
  - Добавить в `lib/ai/registry.ts` → `createProviderRegistry()`
  - Добавить в `PROVIDER_TO_REGISTRY` в `getModel.ts`
  - Добавить ENV-key маппинг в `app/(dashboard)/dev/models/page.tsx` → `PROVIDER_ENV_MAP`
- [ ] **4. Верификация**
  - `npx tsc --noEmit`
  - Проверить на `/dev/models` что модель видна в каталоге
  - Если назначена задаче — отправить сообщение, проверить в DevPanel

### Capability presets (текущие)

```typescript
CAPS_CLAUDE          // streaming, tools, vision, documents, thinking, compaction
CAPS_MINIMAX         // streaming, tools, thinking (NO vision, NO documents, NO compaction)
CAPS_GROK            // streaming, tools, vision, thinking (NO documents, NO compaction)
CAPS_OPENROUTER_TEXT // streaming, tools (NO vision, NO thinking)
CAPS_OPENROUTER_VISION // streaming, tools, vision (NO thinking)
```

При добавлении модели: если ни один preset не подходит — используй spread `{ ...PRESET, field: value }` или inline object.

---

## 3. Аудит цен — источники истины

### Провайдеры и где проверять

| Провайдер | Источник истины | Как проверить |
|-----------|----------------|---------------|
| **Anthropic** | https://docs.anthropic.com/en/docs/about-claude/models | WebFetch или ручная проверка |
| **xAI Grok** | https://docs.x.ai/docs/models | WebFetch |
| **OpenRouter** | `https://openrouter.ai/api/v1/models` | **WebFetch → JSON API** (лучший способ) |
| **MiniMax** | https://platform.minimax.chat/document/Fast%20price | Ручная проверка |
| **Perplexity** | https://docs.perplexity.ai/guides/pricing | WebFetch |
| **Deepgram** | https://deepgram.com/pricing | Ручная проверка |
| **Voyage AI** | https://docs.voyageai.com/docs/pricing | WebFetch |
| **Google Gemini** | https://ai.google.dev/gemini-api/docs/pricing | WebFetch |

### Команды для аудита OpenRouter (JSON API)

```
WebFetch: https://openrouter.ai/api/v1/models
```

Из ответа для каждой нашей модели извлечь:
- `pricing.prompt` ($/token → ×1M = $/M для сверки с `pricing.input`)
- `pricing.completion` ($/token → ×1M для `pricing.output`)
- `context_length` (для `contextWindow`)
- `top_provider.max_completion_tokens` (для `maxOutput`)
- `architecture.modality` — содержит "image" если vision

### Формула конвертации OpenRouter pricing

OpenRouter возвращает цены в **$/token** (не $/M):
```
pricing.input (наш каталог, $/M) = pricing.prompt (OpenRouter, $/token) × 1_000_000
pricing.output (наш каталог, $/M) = pricing.completion (OpenRouter, $/token) × 1_000_000
```

### Команды для grep-аудита в коде

```bash
# Все модели в каталоге
grep -n "id:" lib/ai/model-catalog.ts | grep -v "//"

# Все task → model маппинги
grep -n '": "' lib/ai/task-assignments.ts

# Все hardcoded model IDs вне каталога (потенциальные пропуски)
grep -rn '"claude-\|"MiniMax\|"grok-\|"sonar-\|"nova-\|"voyage-\|"gemini-' lib/ app/ --include="*.ts" | grep -v model-catalog | grep -v task-assignments | grep -v node_modules
```

---

## 4. Верификация capabilities

### Что проверять для каждой модели

| Capability | Как проверить | Источник |
|-----------|---------------|----------|
| `vision` | Документация провайдера + OpenRouter `architecture.modality` | API / docs |
| `tools` | Документация: "function calling" / "tool use" | API / docs |
| `thinking` | Документация: "reasoning" / "extended thinking" | API / docs |
| `streaming` | Почти все LLM поддерживают; проверять для non-LLM | API / docs |
| `documents` | PDF/file upload support (только Anthropic) | API / docs |
| `embeddings` | Только для embedding-моделей (Voyage) | API / docs |

### Практическая проверка через Dev Switchboard

1. На `/dev/models` установить override на тестируемую модель
2. В Simply Chat отправить сообщение (или картинку для vision)
3. В DevPanel проверить что ответ пришёл без ошибки
4. Для caching: проверить `cache_read` в DevPanel (> 0 = кэш работает)

### Красные флаги

- Модель помечена `vision: false` но провайдер заявляет поддержку изображений → **ИСПРАВИТЬ**
- Модель помечена `thinking: true` но не выдаёт reasoning tokens → **ИСПРАВИТЬ**
- ~~`grok-4` не в docs.x.ai → **DEPRECATED, пометить или удалить**~~ — удалён в v3.88.0 (ТЗ-XAI-1)

---

## 5. Non-LLM сервисы — специальный pricing

Эти модели используют нестандартные единицы (не $/M токенов):

| Модель | Единица | Цена | Функция расчёта |
|--------|---------|------|-----------------|
| Deepgram nova-3 | $/минута | $0.0043/мин | `calculateDeepgramCostUsd(audioSeconds)` в `providers.ts` |
| Gemini TTS | $/символ | $4/1M символов | `calculateGeminiTtsCostUsd(charCount)` в `providers.ts` |
| Voyage 4 | $/M токенов | $0.06/M | `calcVoyageCostUsd(model, tokens)` в `voyage-client.ts` |
| Voyage 4 Lite | $/M токенов | $0.02/M | То же |

При аудите: проверять и каталог (для отображения), и функцию расчёта (для cost tracking).

---

## 6. Чеклист регулярного аудита

> **Когда запускать:** при добавлении моделей, еженедельно, или по запросу пользователя.

### Фаза 1: Сбор актуальных данных

- [ ] **OpenRouter** — `WebFetch https://openrouter.ai/api/v1/models` → выгрузить данные по нашим моделям:
  - `z-ai/glm-4.6`, `z-ai/glm-5.1`, `qwen/qwen3.6-plus`, `z-ai/glm-4.6v`, `z-ai/glm-5v-turbo`
  - Для каждой: pricing (prompt/completion), context_length, max_completion_tokens, modality
- [ ] **xAI Grok** — `WebFetch https://docs.x.ai/docs/models` → проверить:
  - Какие модели существуют (убрать deprecated)
  - Pricing per model
  - Capabilities (vision, reasoning)
- [ ] **Anthropic** — проверить актуальность Claude Sonnet 4.6 / Haiku 4.5 / Opus 4.6:
  - Цены, context window, max output
  - Новые модели? (Claude 4.7? Haiku 4.6?)
- [ ] **MiniMax** — проверить M2.7:
  - Цены, capabilities, context window
  - Новые модели?
- [ ] **Non-LLM** — Perplexity, Deepgram, Voyage, Gemini TTS:
  - Pricing не менялся?
  - Новые модели у провайдера?

### Фаза 2: Сверка с каталогом

Для КАЖДОЙ модели в `lib/ai/model-catalog.ts`:

- [ ] `pricing.input` совпадает с провайдером?
- [ ] `pricing.output` совпадает?
- [ ] `pricing.cachedInput` актуален? (0 если провайдер не поддерживает)
- [ ] `pricing.cacheWrite` актуален?
- [ ] `capabilities.vision` соответствует реальности?
- [ ] `capabilities.tools` соответствует?
- [ ] `capabilities.thinking` соответствует?
- [ ] `contextWindow` совпадает с провайдером?
- [ ] `maxOutput` совпадает?
- [ ] Модель не deprecated?

### Фаза 3: Исправление

- [ ] Обновить все расхождения в `model-catalog.ts`
- [ ] Если добавлены новые модели — добавить catalog entries
- [ ] Если удалены модели — пометить `notes: "DEPRECATED"` или удалить
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Проверить на `/dev/models` что данные выглядят корректно

### Фаза 4: Фиксация

- [ ] Git commit: `chore: model catalog audit YYYY-MM-DD`
- [ ] Обновить `notes` в записях с датой последней проверки (опционально)

---

## 7. Известные ограничения

1. **Tiered pricing** (OpenRouter): Qwen 3.6 Plus имеет тарификацию по порогам (≤256K = $0.325, >256K = $1.30). Каталог хранит только base tier — cost tracking занижает для длинных контекстов.
2. **Cache activation gap**: Grok и OpenRouter имеют `cachedInput` цены в каталоге, но `cacheControl` в `chat/route.ts` подставляется ТОЛЬКО для Anthropic. Cost tracking для этих провайдеров всегда считает fresh price.
3. **Raw-fetch сервисы** не переключаемы через Dev Switchboard — требуется отдельное ТЗ.
4. **Deepgram / Gemini TTS** используют per-minute / per-character pricing — стандартное поле `pricing` в каталоге пустое, реальные функции расчёта в `providers.ts`.

---

**Версия:** 1.0
**Создано:** 2026-04-12
**Обновлено:** 2026-04-12
