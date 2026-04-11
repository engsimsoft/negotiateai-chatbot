# Анализ ТЗ-1: Core Registry

**Дата:** 2026-04-10
**Разработчик:** Claude (senior)
**Основание:** аудит 31 AI-точки + чтение `providers.ts`, `chat/route.ts`, `chat-mode-config.ts`, `tokenlens-catalog.ts`, `schema.ts`, `package.json`

---

## Резюме

ТЗ-1 выносит выбор модели из route-файлов в единый конфиг. Технически реализуемо за 1-2 сессии. **Core-часть простая** (registry + catalog + task-assignments + миграция БД). **Рискованная часть — миграция 31 точки**: затрагивает 20+ файлов, включая `chat/route.ts` (~1000 строк, горячий путь). Поведение не должно измениться — каждая точка требует прогона.

В процессе анализа нашёл несколько **расхождений между ТЗ и реальным кодом** — они ниже в разделе «Рекомендую изменить». Все требуют решения до старта.

Оценка сложности: **среднее (3 сессии)**.

---

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе чтения кода. Каждая требует согласования.

### ✅ Согласен с ТЗ

- **Структура «registry → catalog → task-assignments»** — чистый 3-слойный подход, правильное разделение ответственности
- **Центральный `getModel(taskId)`** — совпадает с паттерном уже существующего `getModelForChatMode()` в [chat-mode-config.ts](lib/ai/chat-mode-config.ts), просто шире
- **Non-LLM провайдеры вне registry** — Voyage, Deepgram, Perplexity, Google TTS используют raw fetch, у них нет LanguageModel interface → правильно не тащить в provider registry
- **Удаление env-переменных `PROFESSOR_MODEL`/`SUMMARIZER_MODEL`/`SNAPSHOT_CLERK_MODEL`** — это реально мёртвый паттерн из ранних ТЗ. В коде они используются только в [task-reviewer.ts:124](lib/ai/professors/task-reviewer.ts#L124), [task-summarizer.ts:144](lib/ai/clerks/task-summarizer.ts#L144), [snapshot-creator.ts:164](lib/ai/clerks/snapshot-creator.ts#L164), [plan/route.ts:160](app/(chat)/api/projects/[id]/plan/route.ts#L160). В `.env.example` их нет (перепроверил) — значит и в проде скорее всего не установлены. **Нужно подтверждение от пользователя.**
- **Добавление колонки `provider` в `ai_usage_log`** (из дополнения) — ок, но см. замечание №8 ниже
- **Дополнение «getModel первым делом смотрит в overrides»** — корректное предусловие для ТЗ-2, надо заложить заглушку сразу
- **Дополнение «MODEL_PRICING_RUB → deprecated fallback»** — см. замечание №3 (там больше нюансов)

### ⚠️ Рекомендую изменить

| # | Было (ТЗ) | Рекомендация | Обоснование из кода |
|---|-----------|--------------|---------------------|
| 1 | OpenRouter через `@ai-sdk/openai-compatible` (отмечено «есть») | Использовать `@openrouter/ai-sdk-provider` (dedicated) | Пакет `@ai-sdk/openai-compatible` **НЕ установлен**, а `@openrouter/ai-sdk-provider@2.5.0` **уже установлен** ([package.json:39](package.json#L39)) и даже используется в [scripts/test-think-models.ts:12](scripts/test-think-models.ts#L12). Dedicated provider — официально рекомендуемый путь, лучше типизирован. |
| 2 | `@ai-sdk/xai` — «установить» | Ок, установить. Но важно: ENV `XAI_API_KEY` **сейчас нигде не фигурирует** — ни в `.env.example`, ни в `.env.local`. Нужен ключ + его добавление в `.env.example` + Vercel. | [.env.example](.env.example) проверен — только OPENROUTER_API_KEY присутствует. |
| 3 | «TokenLens остаётся primary, каталог — fallback» | **TokenLens уже полностью обойдён.** Правда — SSOT = `MODEL_PRICING_RUB` из providers.ts. `tokenlens-catalog.ts:39-53` честно говорит: «TokenLens formula is additive... — bypassed» и всегда вызывает `calculateCostRub`. После ТЗ-1 SSOT становится `model-catalog.ts`. **Предлагаю: полностью убрать TokenLens** (пакет `tokenlens` из package.json и файл `tokenlens-catalog.ts` → заменить на тонкий shim, который зовёт catalog). Иначе остаются две «мёртвые» абстракции. | [tokenlens-catalog.ts:36-53](lib/ai/tokenlens-catalog.ts#L36-L53) — формула обойдена. `unstable_cache` дергает API 1×/24ч впустую. |
| 4 | «Pricing (USD/1M: input, output, cachedInput, cacheWrite) в каталоге» | Ок по содержанию. **Но** сейчас `calculateCostRub()` / `calculateCostBreakdownRub()` используют RUB/1K и экспортируются в 10+ мест (DevPanel, cost-audit, context popover). Рекомендую: хранить в каталоге USD/1M (SSOT как у вендоров), а публичный API `calculateCostRub` оставить как есть — внутри он просто будет читать из каталога и конвертировать через `RUB_PER_USD`. Callers не меняются. | `calculateCostRub` используется в [providers.ts:330](lib/ai/providers.ts#L330) (getStepCostRub), [tokenlens-catalog.ts:44](lib/ai/tokenlens-catalog.ts#L44) и в client-компонентах DevPanel. Ломать его API = лишняя работа. |
| 5 | «Все хардкоженные модели в route-файлах заменить на `getModel(taskId)`» | Корректно, но **уже есть два промежуточных слоя** с таким же назначением — `chat-mode-config.ts` (chatMode→model) и `model-tiers.ts` (tier→model). Нужно решить: (a) поглощаем их в `task-assignments.ts` → SSOT один, но меняется много call-sites; (b) оставляем как «frontend» для task-assignments (chatMode mapping → taskId → getModel). **Я рекомендую (b)** — меньше изменений, сохраняется доменная семантика. | [chat-mode-config.ts:22-45](lib/ai/chat-mode-config.ts#L22-L45), [model-tiers.ts:43-65](lib/ai/model-tiers.ts#L43-L65) |
| 6 | «Кнопка „Думать": модель через `getModel('chat-simply-think')`» | Ок, **но** фактическая маршрутизация в Simply Chat — 3-путевая: `think → Sonnet`, `attachments → **Haiku** (не Gemini!)`, `default → MiniMax M2.7` ([chat/route.ts:590-600](app/(chat)/api/chat/[id]/route.ts#L590-L600)). Нужны 3 разных taskId: `simply-chat`, `simply-chat-think`, `simply-chat-vision`. В аудите и CLAUDE.md было «Gemini 3 Flash для vision» — это **устаревшая информация**, реально используется Claude Haiku. | `modelToUse = claudeHaiku` на [chat/route.ts:595](app/(chat)/api/chat/route.ts#L595) |
| 7 | `createProviderRegistry` из AI SDK v6 | Ок, но сейчас используется `customProvider` (не путать с `createProviderRegistry`). Это разные абстракции: `customProvider` — алиасы внутри одного provider; `createProviderRegistry` — объединение нескольких провайдеров. Для мультипровайдера — правильный выбор именно `createProviderRegistry`. **Но** `customProvider` всё ещё нужен внутри для моков в тестах ([providers.ts:20-36](lib/ai/providers.ts#L20-L36), ветка `isTestEnvironment`). Нужно решить: (a) registry в тестах тоже через моки; (b) `getModel()` имеет test-branch как сейчас. Рекомендую (a) — один путь кода. | |
| 8 | «Добавить колонку `provider` в `ai_usage_log`» (из дополнения) | Ок + уточнения. **Nullable** — правильно. **Backfill**: рекомендую вычислять парсером `modelId → provider` один раз в миграции (SQL `CASE WHEN modelId LIKE 'claude%' THEN 'anthropic' WHEN modelId LIKE 'MiniMax%' THEN 'minimax' WHEN modelId LIKE 'voyage%' THEN 'voyage' WHEN modelId LIKE 'sonar%' THEN 'perplexity' ELSE NULL END`). Неизвестные оставить NULL. Для будущих записей `logUsage()` должен принимать `provider` как обязательное поле. | [schema.ts:536-566](lib/db/schema.ts#L536-L566), [usage-utils.ts](lib/ai/usage-utils.ts) |
| 9 | ТЗ не упоминает `app/(chat)/actions.ts` и `lib/ai/tools/request-suggestions.ts` | Эти 2 точки тоже используют `myProvider.languageModel("title-model")` / `"artifact-model"` — входят в 31. Явно включить в ROADMAP миграции. | [actions.ts:29](app/(chat)/actions.ts#L29), [request-suggestions.ts:48](lib/ai/tools/request-suggestions.ts#L48) |
| 10 | ТЗ: "текущие модели остаются defaults" | Ок, но есть **скрытые defaults через env-переменные** (пункт 6 ТЗ их удаляет). Нужно зафиксировать fallback-значения из env как hardcoded в `task-assignments.ts`: Professor → `claude-opus`, Summarizer → `claude-haiku`, Snapshot → `claude-haiku`. | Файлы в пункте «Согласен» выше. |

### ❓ Требует уточнения (вопросы ниже)

- `customProvider` алиасы (`"claude-sonnet"` → `"claude-sonnet-4-6"`, `"title-model"`, `"artifact-model"`) — что с ними: переносятся в catalog как отдельные записи с `modelId` указывающим на физическую модель, или исчезают?
- Grok — 5 моделей сразу или только 1-2 для MVP?
- Gemini text (не TTS) — нужен в каталоге? Если да — нужен `@ai-sdk/google` (сейчас НЕ установлен; есть только `@google/genai` для TTS raw)

---

## Вопросы для уточнения

1. **ENV-ключи.** Есть ли у тебя (a) `XAI_API_KEY` и (b) `OPENROUTER_API_KEY` прямо сейчас в `.env.local` и в Vercel production? Без них Grok/OpenRouter пути не смогут быть протестированы.

2. **OpenRouter провайдер.** Согласен использовать уже установленный `@openrouter/ai-sdk-provider` вместо `@ai-sdk/openai-compatible`? (я рекомендую — см. замечание №1)

3. **Модели OpenRouter.** ТЗ говорит «glm-5.1, qwen3.6-plus — model ID уточнить». В [test-think-models.ts](scripts/test-think-models.ts) уже есть упоминание Qwen 3.6 Plus — возьмём ID оттуда или ты хочешь другие? (могу сверить с OpenRouter docs)

4. **Grok модели.** В ТЗ 5 штук (`grok-4.20-reasoning`, `grok-4.20-non-reasoning`, `grok-4-1-fast-reasoning`, `grok-4-1-fast-non-reasoning`, `grok-4`). Все сразу в каталог или минимум 1-2? Есть ли приоритет какая для какой задачи?

5. **Gemini text.** Нужны ли Gemini text-модели (1.5 Flash / 2.0 Flash / 3 Pro Preview) в каталоге как альтернатива для задач? Если да — придётся установить `@ai-sdk/google`. Если нет — Gemini остаётся только для TTS (raw fetch, вне registry).

6. **`chat-mode-config.ts` и `model-tiers.ts`.** Поглощаем в `task-assignments.ts` (SSOT, но больше правок) или оставляем как тонкий «frontend» над getModel (меньше правок, сохраняется семантика)? (я рекомендую второй)

7. **`customProvider` алиасы.** Текущие алиасы: `"claude-sonnet"`, `"claude-haiku"`, `"claude-opus"`, `"title-model"`, `"artifact-model"`, `"claude-sonnet-4-6"`. Они используются в ~20 местах. Выбор:
   - (a) переносим в `model-catalog.ts` как полноценные записи (modelId таких записей указывает на физические ID)
   - (b) убираем алиасы целиком, все call-sites переписываем на `getModel(taskId)`
   - **Я рекомендую (a)** — совместимость, меньше риска

8. **Mock-модели для тестов.** `providers.ts:20-36` имеет branch `isTestEnvironment`, подменяющий модели на моки. Как действовать:
   - (a) новый `registry` тоже имеет test-branch с моками
   - (b) `getModel()` перехватывает test-environment и возвращает моки
   - **Я рекомендую (b)** — registry остаётся чистым, моки концентрируются в `getModel`

9. **ENV-переменные PROFESSOR_MODEL / SUMMARIZER_MODEL / SNAPSHOT_CLERK_MODEL.** Подтверди что они **не установлены** в Vercel production (я не вижу их в `.env.example`, но это не гарантия). Если установлены — удаление сломает текущую конфигурацию проф-пайплайна.

10. **TokenLens — удалить совсем?** Я нашёл что он уже обойдён (формула не совместима с Anthropic cache billing). Предложение — полностью выкинуть пакет `tokenlens` и файл `tokenlens-catalog.ts`, заменив на shim над `model-catalog.ts`. Или оставить «на всякий случай»?

11. **taskId convention.** Плоский (`briefing-filter`, `memory-extract`) или иерархический (`briefing:filter`, `memory:extract`)? Рекомендую иерархический с `:` — совпадает с форматом `chatMode` в `ai_usage_log` (там уже `memory:extract`, `briefing:filter` и т.д.).

12. **Overrides (пик в ТЗ-2).** Где будут храниться overrides — DB (user-level), localStorage (client-level), in-memory (process-level)? Это нужно только чтобы правильно спроектировать сигнатуру `getModel(taskId, context?)` — чтобы в ТЗ-2 не пришлось её переписывать.

---

## Потенциальные риски

| Риск | Вероятность | Митигация |
|------|:---:|-----------|
| **Миграция 20+ call-sites ломает поведение** (особенно `chat/route.ts`) | Высокая | Поэтапно по группам: (1) catalog+registry без замен; (2) chat routes; (3) briefing pipeline; (4) memory; (5) остальное. Между этапами — мануальный тест. |
| **Удаление env-переменных ломает прод** | Средняя | Пункт 9 в вопросах — подтвердить перед началом |
| **Test mocks ломаются** при переходе с `customProvider` на `createProviderRegistry` | Средняя | Концентрация моков в `getModel()` (пункт 8) |
| **DevPanel показывает `???` для новых моделей** (Grok, OpenRouter) | Низкая | `MODEL_DISPLAY` в DevPanel → брать `displayName` из `model-catalog.ts` |
| **`calculateCostRub` ломает client-side импорты** при переносе в catalog | Средняя | Оставить публичный API без изменений — рефакторить внутренности (замечание №4) |
| **Grok/OpenRouter в каталоге, но ключей нет** → crash on boot | Низкая | `getModel()` должен graceful-fallback при отсутствии API key → возврат default модели с warning в лог |
| **`aiUsageLog.provider` backfill на больших таблицах** | Низкая | Таблица не огромная (ТЗ-OPT1, v3.46.0). SQL CASE backfill в той же миграции. |

---

## Зависимости

**До начала:**
- Ответы на 12 вопросов выше
- Решение: удалить ли TokenLens совсем (вопрос 10)
- Подтверждение отсутствия env-переменных в проде (вопрос 9)

**Затронутые компоненты (по грубой оценке):**
- **Core:** `lib/ai/providers.ts` (рефакторинг), `lib/ai/registry.ts` (новый), `lib/ai/model-catalog.ts` (новый), `lib/ai/task-assignments.ts` (новый)
- **Схема/миграция:** `lib/db/schema.ts` + новая Drizzle миграция `0053_ai_usage_log_provider.sql`
- **Usage logging:** `lib/ai/usage-utils.ts`, `lib/ai/tokenlens-catalog.ts`
- **Chat routes:** `app/(chat)/api/chat/route.ts`, `app/(chat)/api/chat/[id]/generate-title/route.ts`, `app/(chat)/actions.ts`
- **Service chat:** `app/(chat)/api/service-chat/route.ts`, `app/(chat)/api/assistant/ben/route.ts`
- **Projects:** `app/(chat)/api/projects/[id]/plan/route.ts`, `analyze-file/route.ts`, `generate-summary/route.ts`, `tasks/[taskId]/chat/route.ts`
- **Pipelines:** `lib/briefing/briefing-{filter,author,section-author}.ts`, `lib/podcast/script-generator.ts`, `lib/meeting/meeting-pipeline.ts`, `lib/ai/professor-pipeline.ts`
- **Memory:** `lib/ai/memory/extract.ts`, `consolidate.ts`, `profile.ts`
- **Clerks:** `lib/ai/clerks/task-summarizer.ts`, `snapshot-creator.ts`
- **Professors:** `lib/ai/professors/task-reviewer.ts`
- **Tools/vision:** `lib/ai/tools/request-suggestions.ts`, `lib/ai/vision-ocr.ts`
- **Обёртки:** `lib/ai/chat-mode-config.ts`, `lib/ai/model-tiers.ts` (thin wrappers after migration)
- **ENV:** `.env.example` (+ XAI_API_KEY)
- **package.json:** +`@ai-sdk/xai`, возможно +`@ai-sdk/google`, возможно –`tokenlens`

**Не трогаем:**
- Prompts (`lib/prompts/`) — остаются где есть
- UI `/dev/models` — ТЗ-2
- Non-LLM провайдеры (Voyage, Deepgram, Perplexity, Gemini TTS) — остаются raw fetch

---

## Оценка сложности

- [ ] Простое (1-2 сессии)
- [x] **Среднее (3 сессии)**
- [ ] Сложное (5+ сессий)

**Раскладка:**
- Сессия 1: `registry.ts` + `model-catalog.ts` + `task-assignments.ts` + миграция БД + рефакторинг `providers.ts` (legacy wrappers) → tsc/build → **мануальный тест базового чата**
- Сессия 2: миграция горячих точек — chat routes, service chat, professors, clerks → тест по каждой области
- Сессия 3: миграция pipelines (briefing, podcast, memory, meeting) + vision-ocr + tools → финальный тест + очистка env-переменных

---

## Чек-лист до старта (для пользователя)

- [ ] Ответить на 12 вопросов
- [ ] Подтвердить наличие `XAI_API_KEY` и `OPENROUTER_API_KEY` (или добавить)
- [ ] Подтвердить что `PROFESSOR_MODEL` / `SUMMARIZER_MODEL` / `SNAPSHOT_CLERK_MODEL` **не установлены** в Vercel prod
- [ ] Решить судьбу TokenLens (удалить / оставить)
- [ ] Определиться со списком моделей в каталоге (минимум для MVP)
