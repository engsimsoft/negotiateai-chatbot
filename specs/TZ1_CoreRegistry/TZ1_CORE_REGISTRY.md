# ТЗ-1: Core Registry — Model-Agnostic архитектура

**Версия:** v3.79.0
**Предусловие:** аудит 31 AI-точки (предоставлен отдельно)

---

## Цель

Вынести выбор моделей из route-файлов в единый конфиг. После этого ТЗ любая из 31 AI-точек получает модель через `getModel(taskId)`, а не хардкод.

---

## Что создать

### 1. `lib/ai/registry.ts` — Provider Registry

AI SDK v6 `createProviderRegistry`. Регистрирует 4 LLM-провайдера:

| Provider ID | Пакет | ENV |
|---|---|---|
| `anthropic` | `@ai-sdk/anthropic` (есть) | `ANTHROPIC_API_KEY` |
| `minimax` | `vercel-minimax-ai-provider` (есть) | `MINIMAX_API_KEY` |
| `xai` | `@ai-sdk/xai` (**установить**) | `XAI_API_KEY` |
| `openrouter` | `@ai-sdk/openai-compatible` (есть) | `OPENROUTER_API_KEY` |

OpenRouter: `createOpenAICompatible({ baseURL: 'https://openrouter.ai/api/v1' })`.

Non-LLM провайдеры (Voyage, Deepgram, Google TTS, Perplexity) — отдельные экспорты из этого же файла, без registry (у них нет AI SDK provider interface).

Экспортирует функцию `getModel(taskId)` — единственная точка получения модели во всём приложении.

### 2. `lib/ai/model-catalog.ts` — Каталог моделей

Каждая модель: `id`, `provider`, `modelId`, `displayName`, `pricing` (USD/1M: input, output, cachedInput, cacheWrite), `capabilities` (vision, tools, thinking, documents, embeddings, streaming), `contextWindow`, `maxOutput`, `defaultParams`, `notes`.

Стартовый набор: все модели из аудита + Grok (grok-4.20-reasoning, grok-4.20-non-reasoning, grok-4-1-fast-reasoning, grok-4-1-fast-non-reasoning, grok-4) + OpenRouter тестовые (glm-5.1, qwen3.6-plus — model ID уточнить в OpenRouter docs).

Добавление модели = одна запись в каталоге → доступна для любой задачи.

### 3. `lib/ai/task-assignments.ts` — Маппинг задач

Простая константа `DEFAULT_TASK_MODELS` — объект `taskId → modelId` для всех 31 точки из аудита. Текущие модели остаются defaults. Промпты НЕ дублируем — они остаются в существующей системе `lib/prompts/`.

### 4. Pricing интеграция

`calcCostUsd(modelId, usage)` берёт цены из `model-catalog.ts`. TokenLens остаётся primary, каталог — fallback. `RUB_PER_USD` без изменений.

Добавить колонку `provider` в таблицу `ai_usage_log` (Drizzle migration).

---

## Что изменить

### Миграция 31 AI-точки

Все хардкоженные модели в route-файлах заменить на `getModel(taskId)`. Полный список файлов — в аудите.

Кнопка «Думать»: модель берётся из `getModel('chat-simply-think')` вместо хардкода. Логика переключения остаётся.

ENV-переменные `PROFESSOR_MODEL`, `SUMMARIZER_MODEL`, `SNAPSHOT_CLERK_MODEL` — удалить, их роль берёт `task-assignments.ts`.

---

## Ограничения

- Поведение приложения НЕ меняется — те же модели, те же промпты, те же параметры
- Никаких изменений UI — страница `/dev/models` будет в отдельном ТЗ-2
- Overrides (переключение моделей на лету) — в ТЗ-2
- Production работает на defaults из `task-assignments.ts`

---

## Тестирование

По одному запросу на каждый тип: chat-simply, chat-simply-think, expertise, briefing, memory extract, vision-ocr. Проверить в DevPanel что модель и стоимость отображаются корректно.
