# Находки ТЗ-LegacyChatCleanup

> Список нерешённых проблем, обнаруженных во время работы над ТЗ.
> После закрытия ТЗ — оформить как follow-up задачу (одну или несколько).
> Создан: 2026-04-13

---

## 🚩 Finding #1: Grok 4.20 context window — расхождение с docs.x.ai

**Где:** [lib/ai/model-catalog.ts:283-285, 315](lib/ai/model-catalog.ts)
**Что:** Каталог моделей фиксирует `contextWindow: 256_000` для всех `grok-4.20-*` моделей. Комментарий в файле признаёт: «docs.x.ai сообщает 2M для всех моделей, но это может быть actual API testing. Re-check at next audit». То есть предыдущий агент **намеренно занизил** значение из «осторожности», оставив TODO без следа.
**Почему проблема:** (1) Прямое расхождение с официальной документацией xAI — наш SSOT говорит одно, вендор другое; (2) Тип «осторожный костыль» — agent сделал догадку вместо проверки и пометил TODO, который никто не подберёт; (3) Возможная потеря функциональности: если кто-то из Grok-задач реально может работать с большим контекстом — мы это блокируем
**Предлагаемое решение:** Эмпирическая проверка через мини-скрипт: послать в Grok 4.20 несколько запросов с разной длиной (256K, 512K, 1M, 2M токенов синтетического контекста) и зафиксировать реальный лимит API. Затем обновить каталог реальным значением + комментарий с датой проверки.
**Влияние:** low — текущие задачи укладываются в 256K, но это вопрос гигиены SSOT
**Обнаружено:** Этап 1, фаза изучения официальной документации (xAI WebFetch)

---

## 🚩 Finding #2: Неполное покрытие `ai_usage_log`

**Где:** все вызовы `getModel(taskId)` вне `app/(chat)/api/chat/route.ts`
**Что:** Сравнение цифр с Anthropic Console показало, что наш `ai_usage_log` фиксирует **только** основные пользовательские диалоги через chat API. Все вспомогательные вызовы Haiku — автонейминг (`util:title`), OCR (`vision:ocr`), клерки (`clerk:*`), сервисные чаты (Бен, project-creation), meeting-summary, briefing-pipelines — расходуют деньги в Anthropic API, но в `ai_usage_log` не попадают. Расхождение в тестовой сессии: ~12K input + 461 output токенов «утекло» из учёта (примерно 10% от общего расхода Haiku).
**Почему проблема:** (1) Дашборд `/admin/cost-audit` врёт — показывает меньше реального расхода; (2) При росте нагрузки разница станет ощутимой; (3) Невозможно точно атрибутировать перерасход к конкретной задаче
**Предлагаемое решение:** Вместо разбросанных `getModel()` вызовов — единый wrapper типа `wrappedGetModel(taskId, { chatId, userId, chatMode })`, который автоматически логирует usage в `ai_usage_log` через `streamText`/`generateObject` callbacks. ИЛИ единый middleware-логгер на уровне Vercel AI SDK провайдеров.
**Влияние:** medium — критично для финансовой прозрачности при росте, сейчас в dev можно жить
**Обнаружено:** Этап 1, ручная сверка cost calculation с Anthropic Console (запрос пользователя)

---

## 🚩 Finding #3: Поле `inputTokens` неоднозначно названо

**Где:** [lib/db/schema.ts](lib/db/schema.ts) — таблица `ai_usage_log`, колонка `inputTokens`
**Что:** Поле `inputTokens` в `ai_usage_log` хранит **gross input** (всю сумму, включая cache_read_tokens и cache_write_tokens), а соседние `cacheReadTokens` / `cacheWriteTokens` — это **разбивка того же значения**, не отдельные категории. Из имени поля невозможно догадаться — кажется будто это «input minus cache».
**Почему проблема:** (1) Я сам ошибся в SQL-агрегации, попытавшись посчитать `total = inputTokens + cacheReadTokens + cacheWriteTokens` — получил double count; (2) Любой будущий разработчик/агент сделает ту же ошибку при первой попытке посчитать суммарный input; (3) Документация (комментарий в schema.ts) этого не объясняет
**Предлагаемое решение:** Один из двух путей:
- (а) Переименовать `inputTokens` → `inputTokensTotal` через миграцию (более чистое, но затрагивает много call-sites)
- (б) Добавить чёткий jsdoc-комментарий к колонке в `lib/db/schema.ts`: «WARNING: inputTokens — это GROSS input, включая cacheRead/cacheWrite. НЕ складывать с cacheReadTokens/cacheWriteTokens». Это минимальная правка с максимальным эффектом
**Влияние:** low — это вопрос документации/именования, runtime не страдает
**Обнаружено:** Этап 1, ручная сверка cost calculation

---

## 🚩 Finding #4: `lib/ai/models.ts` — мёртвый файл с 5+ импортёрами

**Где:**
- [lib/ai/models.ts](lib/ai/models.ts) — сам файл
- [lib/ai/entitlements.ts](lib/ai/entitlements.ts) — импортирует тип `ChatModel`
- [components/compact-model-selector.tsx](components/compact-model-selector.tsx) — legacy селектор моделей (не рендерится в UI)
- [components/input/input-model-selector.tsx](components/input/input-model-selector.tsx) — legacy селектор (экспортирован из `components/input/index.tsx`, но не используется в активных компонентах)
- [components/model-selector.tsx](components/model-selector.tsx) — старый легаси-селектор
- [components/multimodal-input.tsx:700-742](components/multimodal-input.tsx) — целый dropdown с массивом `chatModels`, рендерится по условию которое после ТЗ-LegacyChatCleanup всегда false (т.к. `chat-model-reasoning` модели больше нет)

**Что:** Файл `lib/ai/models.ts` — артефакт старой системы UI-селектора моделей до CoreRegistry (ТЗ-1). Содержит `DEFAULT_CHAT_MODEL`, тип `ChatModel`, массив `chatModels` с хардкоженными ценами в виде строк (`"$3"`, `"$15"`). Эти данные не синхронизированы с настоящим SSOT (`lib/ai/model-catalog.ts`) и не подключены к резолву моделей. В рамках ТЗ-LegacyChatCleanup файл оставлен как тонкая `@deprecated` заглушка (пустой `chatModels[]`, тип сохранён, `DEFAULT_CHAT_MODEL = "auto"`), потому что физическое удаление требует параллельного удаления 5+ компонентов и переписывания `entitlements.ts`.

**Почему проблема:** (1) Любой новый разработчик/агент откроет файл и решит что это конфигурация моделей, попытается там что-то менять — ничего не произойдёт (мёртвый код); (2) Старые цены `"$3"`/`"$15"` могут быть скопированы куда-то из доверия к этому файлу — будет неточно; (3) 5 неиспользуемых компонентов раздувают bundle и затрудняют навигацию по проекту

**Предлагаемое решение:** Отдельный мини-ТЗ «TZ_DeadModelSelectors» на 1-2 сессии:
1. Прочитать каждый из 5 импортёров целиком, убедиться что не рендерится в UI (grep по компонентам)
2. Удалить файлы трёх legacy селекторов целиком
3. Удалить dead-dropdown секцию из `multimodal-input.tsx` (строки 700-742)
4. Переписать `lib/ai/entitlements.ts` без зависимости от `ChatModel` тип (либо `string[]`, либо инлайн)
5. Удалить `lib/ai/models.ts` физически
6. Финальная валидация tsc + build + smoke test всех 4 режимов

**Влияние:** medium — мёртвый код, пять неиспользуемых компонентов, плюс «соблазнительная» неактуальная конфигурация
**Обнаружено:** Этап 2.4, попытка физического удаления `lib/ai/models.ts` сразу выявила 5 импортёров, dev-server упал на компиляции

---

## 🚩 Finding #5: Молчаливый stream-level `onError` в chat route

**Где:** [app/(chat)/api/chat/route.ts](app/(chat)/api/chat/route.ts) — секция `onError` в createUIMessageStream (строки около 1551 после удалений Этапа 1)
**Что:**
```ts
onError: () => {
  return "Oops, an error occurred!";
},
```
Stream-level error handler возвращает строку клиенту без `console.error`, без `emitDebugError`, без передачи stack trace. Любая ошибка в стриме (LLM упал, провайдер вернул 500, network glitch) тихо превращается в маленькую строку «Oops» — пользователь видит, разработчик не видит ничего.
**Почему проблема:** (1) Прямое нарушение правила «no silent degradation» из памяти проекта; (2) DevPanel получает данные через `emitDebugError`, но здесь его нет — Errors & Warnings секция остаётся пустой при реальной ошибке стрима; (3) Невозможно отлаживать редкие сбои — в логах ничего, в DevPanel ничего, у пользователя странное поведение
**Предлагаемое решение:** Принимать `error` параметр, логировать `console.error("[Chat Stream Error]", error)` + если возможно `emitDebugError(dataStream, { source: "server:chat-stream-onError", message, stack })`. Возвращать пользователю осмысленную строку «Произошла ошибка: <тип>».
**Влияние:** medium — observability gap, но не блокирует функциональность
**Обнаружено:** Этап 1.5, чтение `route.ts` целиком в поисках веток `chatMode === "chat"`

---

## 🚩 Finding #6: `currentModelIdRef` — мёртвый useRef в chat.tsx

**Где:** [components/chat.tsx:91, 122-123](components/chat.tsx)
**Что:**
```ts
const [currentModelId, setCurrentModelId] = useState(initialChatModel);
const currentModelIdRef = useRef(currentModelId);
// ...
useEffect(() => {
  currentModelIdRef.current = currentModelId;
}, [currentModelId]);
```
Ref объявлен, синхронизируется через useEffect, но **нигде в файле не читается**. Чисто мёртвый pattern — кто-то когда-то добавил ref «на всякий случай» или при переписывании забыл удалить.
**Почему проблема:** (1) Любой будущий разработчик подумает что ref важен и побоится трогать; (2) useEffect зря триггерится при каждом изменении модели — мини-перфоманс; (3) Рост технического долга
**Предлагаемое решение:** Удалить три строки. Тривиально.
**Влияние:** low — чистая гигиена кода
**Обнаружено:** Этап 2.4, чтение chat.tsx в поисках `initialChatModel` chain

---

## 🚩 Finding #7: `isReasoningModel` — мёртвая проверка на удалённую модель

**Где:** [components/multimodal-input.tsx:602](components/multimodal-input.tsx)
**Что:**
```ts
const isReasoningModel = selectedModelId === "chat-model-reasoning";
```
Проверка на строку `"chat-model-reasoning"` — эта модель не существует в актуальной системе (её ID не в каталоге, не в task-assignments). Это остаток от ещё более старой системы model selector (до ТЗ-1).
**Почему проблема:** Условие всегда false → весь зависимый код (если есть) — мёртвый
**Предлагаемое решение:** Найти все использования `isReasoningModel`, удалить вместе с зависимыми ветками (или переписать на `selectedModelId === "auto"` если логика всё-таки нужна)
**Влияние:** low — мёртвая ветка, не блокирует
**Обнаружено:** Этап 2.4, чтение multimodal-input.tsx

---

---

## 🚩 Finding #8: `createSnapshot` tool — потенциально мёртв для проектов

**Где:**
- [lib/ai/tools/create-snapshot.ts](lib/ai/tools/create-snapshot.ts) — сам tool
- [lib/ai/tools/chat-tools.ts](lib/ai/tools/chat-tools.ts) — включён в `baseTools` и в `isProjectChat` ветку `getActiveToolNames`
- [app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts](app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts) — импортируется в project task expert
- [components/projects/snapshot-card.tsx](components/projects/snapshot-card.tsx) — UI компонент рендеринга
- [components/messages.tsx](components/messages.tsx), [components/message.tsx](components/message.tsx) — рендер tool-createSnapshot части

**Что:** В Этапе 1 этого ТЗ удалён snapshot fallback из chat/route.ts (привязан был к legacy `chatMode="chat"`). Я предполагал что `createSnapshot` tool тоже станет полностью dead, но обнаружил что он всё ещё прокидывается в **project task expert chat** через `getStandardTools` → `experimental_activeTools`. Однако проектные задачи используют Anthropic Compaction (см. `supportsCompaction = isAnthropicModel && (modelSupportsCompaction || isProjectChat)` в chat/route.ts), что должно делать snapshot ненужным. Возможно tool оставлен «на всякий случай» или уже не вызывается моделью в проектах.

**Почему проблема:** Подвешенное состояние — tool либо нужен, либо нет. Если не нужен — это +1 определение в каждом запросе (увеличивает caching prompt без пользы, +tokens на cache write при первом запросе). Если нужен — нет ясного use case в документации (`docs/ai-tools.md`?).

**Предлагаемое решение:** Эмпирическая проверка: пройти SQL в `ai_usage_log`/event traces, посмотреть как часто проектные задачи вызывают createSnapshot за последний месяц. Если 0 вызовов — удалить tool из `getActiveToolNames` для проектов и из проектного route. Если есть вызовы — задокументировать use case в `docs/ai-tools.md`.

**Влияние:** medium — каждый лишний tool в caching prompt стоит токенов на write breakpoint, но не блокирует работу

**Обнаружено:** Этап 2.10, попытка удаления tool раскрыла что он не полностью dead

---

## Оформление в follow-up ТЗ (для Фазы 4)

Предлагаю сгруппировать находки по приоритету:

**TZ_DeadModelSelectors** (medium impact, 1-2 сессии)
- Finding #4 (lib/ai/models.ts + 5 импортёров)
- Finding #6 (currentModelIdRef мёртвый ref)
- Finding #7 (isReasoningModel мёртвая проверка)

**TZ_UsageLoggingCoverage** (medium impact, 1 сессия)
- Finding #2 (неполное покрытие ai_usage_log)
- Finding #3 (переименовать/задокументировать inputTokens)

**TZ_StreamObservability** (medium impact, 0.5 сессии)
- Finding #5 (silent onError в stream)

**TZ_GrokContextWindowAudit** (low impact, 0.5 сессии)
- Finding #1 (Grok 4.20 эмпирическая проверка контекста)

**TZ_CreateSnapshotAudit** (medium impact, 0.5 сессии)
- Finding #8 (createSnapshot tool — мёртв ли в проектах, эмпирическая проверка)
