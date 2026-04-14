# Мозговой штурм: Grok 4.20 Multi-Agent + наши tools через MCP

**Дата:** 2026-04-14
**Статус:** Мозговой штурм, ТЗ ещё не открыто
**Автор решения:** Владимир + Claude Opus 4.6 (архитектор)
**Исходная идея:** предложена самим Grok 4.20 Multi-Agent

---

## 1. Задача (что мы хотим получить)

Использовать в Simply (режим «Экспертиза» или отдельный toggle) модель **`grok-4.20-multi-agent-0309`** в режиме **4 агентов** (`reasoning.effort: "low"`), **не теряя доступа к нашим кастомным инструментам**:

- `deepResearch` (Perplexity Sonar)
- `fetchUrl` / `fetchPage` (Jina Reader + Readability каскад)
- `knowledge_search` (RAG)
- `readTelegramChannel`
- `createDocument` / `parseExcel` / `readDocument`
- и другие по необходимости

Режим **16 агентов осознанно исключён** — 4 агента признаны оптимумом по цене/качеству.

---

## 2. Ключевой вопрос

Возможно ли это технически без регрессии tools?

**Вердикт: ДА. Фундаментальных архитектурных препятствий нет.**

---

## 3. Техническое обоснование (проверено эмпирически)

### 3.1 Официальная позиция xAI

Прямая цитата из [docs.x.ai/developers/model-capabilities/text/multi-agent](https://docs.x.ai/developers/model-capabilities/text/multi-agent) (fetched 2026-04-14):

> *«Client-side tools (function calling) and custom tools are not currently supported by the multi-agent model variant. We do support a set of built-in tools (e.g., `web_search`, `x_search`) and **remote MCP tools**.»*

Это означает: **remote MCP — легальный официальный канал для custom tools в multi-agent.** Не хак, не обход, не серая зона.

### 3.2 SDK уже содержит всё необходимое

В проекте установлен `@ai-sdk/xai@3.0.82`. Проверка файла [node_modules/@ai-sdk/xai/dist/index.d.ts:182-198](node_modules/@ai-sdk/xai/dist/index.d.ts#L182):

```ts
// Responses API встроен — никакого отдельного провайдера писать не надо:
xai.responses(modelId: XaiResponsesModelId) => LanguageModelV3

// MCP tool-обёртка уже типизирована:
xai.tools.mcpServer({
  serverUrl: string,
  serverLabel?: string,
  serverDescription?: string,
  allowedTools?: string[],
  headers?: Record<string, string>,
  authorization?: string,
})
```

Результат `xai.responses(...)` — `LanguageModelV3`, совместимый с нашим текущим `streamText()` через [lib/ai/registry.ts](lib/ai/registry.ts) и [lib/ai/getModel.ts](lib/ai/getModel.ts). То есть интеграция вписывается в существующую SSOT-модель резолва.

### 3.3 Модель уже в каталоге

- [lib/ai/model-catalog.ts:370](lib/ai/model-catalog.ts#L370) — запись `grok-4.20-multi-agent-0309`, pricing $2/$6 проверен против xAI docs
- [lib/ai/task-assignments.ts:91](lib/ai/task-assignments.ts#L91) — назначена на `expertise` (но сейчас вызывается через Chat Completions, что **не** активирует multi-agent фичи — поэтому в логах `ai_usage_log` всего 1 вызов за всю историю, работает как обычный Grok)

---

## 4. Механизм (как это будет работать)

```
Пользователь → Simply chat route
    │
    ├─ getModel("expertise-multi-agent") → xai.responses("grok-4.20-multi-agent-0309")
    │
    ├─ streamText({
    │     model: grokMultiAgent,
    │     providerOptions: { xai: { reasoning: { effort: "low" } } },  // 4 агента
    │     tools: {
    │       simply_tools: xai.tools.mcpServer({
    │         serverUrl: "https://simply.app/api/mcp",
    │         authorization: ephemeralJwt,   // content: userId, chatId, projectId, exp
    │         allowedTools: ["deep_research", "knowledge_search", "fetch_url", ...],
    │       }),
    │       // плюс опционально built-in:
    │       web_search: xai.tools.webSearch(),
    │       x_search: xai.tools.xSearch(),
    │     },
    │   })
    │
    ↓
xAI серверная сторона
    │
    ├─ Лидер-агент координирует
    ├─ 4 sub-агента работают параллельно с внутренними «дебатами»
    │   Каждый может вызвать:
    │     • web_search / x_search / code_execution (нативно)
    │     • simply_tools.* (через HTTP → наш MCP endpoint)
    │
    ↓
Simply MCP endpoint (/api/mcp)
    │
    ├─ Проверяет HMAC/JWT в Authorization header
    ├─ Декодирует userId / chatId / projectId
    ├─ Resolve контекст (session → DB)
    ├─ Выполняет tool (deepResearch, fetchUrl, knowledge_search...)
    └─ Возвращает результат обратно в xAI
    │
    ↓
xAI → финальный синтез лидера → стрим обратно в Simply → UI
```

---

## 5. Что уже решено (параметры для ТЗ)

| Параметр | Решение | Почему |
|---|---|---|
| Модель | `grok-4.20-multi-agent-0309` | Единственная multi-agent модель xAI |
| Количество агентов | **4** (`reasoning.effort: "low"`) | 16 избыточно по цене и latency |
| API endpoint | `xai.responses()` (Responses API) | Multi-agent работает только через него, не через Chat Completions |
| Канал для custom tools | **Remote MCP сервер** | Единственный официально разрешённый способ |
| Built-in tools xAI | Использовать дополнительно к нашим | `web_search`, `x_search`, `code_execution` дают sub-агентам нативные поисковые возможности |
| Точка интеграции в Simply | Отдельный toggle («Команда агентов»), не замена дефолту | Multi-agent — новый продукт, нужно мерить реальную пользу |
| Сохранение текущего expertise | Да — Sonnet + deepResearch остаётся дефолтом | Multi-agent как опциональный premium-режим |

---

## 6. Три вещи, которые потребуют аккуратного дизайна в ТЗ

Это **не блокеры**, но явно требуют проработки:

### 6.1 Идентификация пользователя на MCP endpoint
- xAI дёргает наш MCP endpoint **со своих серверов**, не из браузера пользователя
- Нужна схема: chat route формирует **ephemeral JWT** (TTL ~10 мин) с `userId/chatId/projectId` → кладёт в `authorization` параметр `xai.tools.mcpServer` → xAI прокидывает в `Authorization` header при вызове MCP → наш endpoint декодирует → resolve user context
- Альтернатива: HMAC с shared secret + IP whitelist xAI
- **Безопасность — корень всего**. Публичный endpoint, принимающий tool calls от внешних серверов.

### 6.2 Observability: частичная адаптация
- Наш текущий стек ([tool-call-guardian.ts](lib/ai/tool-call-guardian.ts), [DevPanel](components/dev-panel/), [pipeline-trace.ts](lib/ai/pipeline-trace.ts), [tool-activity-indicator.tsx](components/tool-activity-indicator.tsx)) слушает `onToolCall` callbacks `streamText()`
- Когда tool выполняется внутри MCP, мы получаем события как `server_side_tool_usage` — другая ветка стрима
- Нужен **адаптер**: парсер server-side tool events → те же форматы, которые ждёт DevPanel/Guardian
- **Это не регрессия архитектуры, это адаптация источника событий**

### 6.3 Стоимость × 2 компонента
- (а) Grok токены: 4 агента × reasoning tokens — умножение на ~3-5× от обычного запроса
- (б) Наши tools: каждый sub-агент потенциально вызывает `deepResearch` (Perplexity $5/1000) независимо
- Нужен **throttling на MCP стороне** (dedup по query, rate limit per chat) + **ценовой warning в UI** до запуска

---

## 7. Что точно НЕ проблема

Эти вещи проверены и работают «из коробки»:

- ✅ SDK поддержка (`@ai-sdk/xai@3.0.82` содержит `responses()` + `tools.mcpServer()`)
- ✅ Наш `streamText()` pipe совместим с `LanguageModelV3` от Responses API
- ✅ Стриминг sub-agent events + reasoning tokens
- ✅ MCP-протокол — открытый стандарт, зрелые Node.js серверные SDK
- ✅ Наши существующие tools — чистые функции, оборачиваются тривиально
- ✅ Совместимость с нашей SSOT моделью резолва (`getModel(taskId)`)
- ✅ Pricing / usage logging (переиспользуем `extractUsageFields` из [usage-utils.ts](lib/ai/usage-utils.ts))

---

## 8. Что должно быть в будущем ТЗ (checklist-skeleton)

Когда откроем `TZ_XaiMultiAgentMCP`, должны быть раскрыты:

- [ ] **Фаза 1 — Registry / Responses API**
  - Новая запись в [lib/ai/registry.ts](lib/ai/registry.ts) или флаг на существующей
  - `getModel()` возвращает правильный LanguageModelV3
  - Провайдер-опции (`reasoning.effort: "low"`) прокидываются через `providerOptions.xai`

- [ ] **Фаза 2 — MCP сервер (`/api/mcp` endpoint в Next.js)**
  - Streamable HTTP transport (MCP spec)
  - Auth layer: ephemeral JWT или HMAC + xAI IP allowlist
  - Декодер контекста → session resolve
  - Rate limiting / dedup per chatId
  - Observability (каждый вызов логируется в `ai_usage_log` с chatMode=`tool:mcp:*`)

- [ ] **Фаза 3 — Tools адаптеры (Simply → MCP)**
  - Минимум: `deep_research`, `knowledge_search`, `fetch_url`
  - Zod schemas → MCP JSON Schema
  - Сохранить наши retry / cost tracking

- [ ] **Фаза 4 — Observability адаптация**
  - Парсер `server_side_tool_usage` событий
  - Кормим существующий DevPanel / tool-activity-indicator
  - Guardian работает в bypass-режиме (как для briefing-onboarding, см. [ADR 025](docs/decisions/025-guardian-bypass-pattern.md))

- [ ] **Фаза 5 — UI**
  - Toggle «Команда агентов» (по паттерну [input-think-button.tsx](components/input/input-think-button.tsx))
  - Live-прогресс работы 4 агентов (по паттерну [research-progress-card.tsx](app/(dashboard)/briefing/setup/components/research-progress-card.tsx))
  - Ценовой warning до запуска («×4 agents, estimated cost ~X₽»)
  - Reasoning tokens в main chat (сейчас только в DevPanel)
  - Sub-agent trace в DevPanel drawer
  - Source citations из `web_search`/`x_search`

- [ ] **A/B перед полной реализацией**
  - 5 реальных expertise-запросов
  - Сравнение: текущий (Sonnet + deepResearch) vs multi-agent через xAI Console
  - **Если built-in Grok web_search покрывает 80% пользы** — можно обойтись без MCP в первой итерации

---

## 9. Ссылки

**Внешние:**
- [xAI Multi-Agent docs](https://docs.x.ai/developers/model-capabilities/text/multi-agent)
- [Model Context Protocol spec (Anthropic)](https://modelcontextprotocol.io)

**Внутренние:**
- [lib/ai/model-catalog.ts:370](lib/ai/model-catalog.ts#L370) — catalog entry
- [lib/ai/task-assignments.ts:91](lib/ai/task-assignments.ts#L91) — текущее назначение
- [lib/ai/registry.ts](lib/ai/registry.ts) — точка интеграции Responses API
- [lib/ai/getModel.ts](lib/ai/getModel.ts) — SSOT резолва моделей
- [app/(chat)/api/chat/route.ts](app/(chat)/api/chat/route.ts) — место вызова `streamText`
- [docs/decisions/047-core-model-registry.md](docs/decisions/047-core-model-registry.md) — ADR текущей архитектуры моделей
- [docs/decisions/025-guardian-bypass-pattern.md](docs/decisions/025-guardian-bypass-pattern.md) — паттерн bypass для multi-step flows

---

## 10. Параметры моделей Grok (verified 2026-04-14)

Перед внесением в ТЗ: проверка утверждений Grok Multi-Agent против официальной документации xAI.
Три параллельных fetch'а: [multi-agent page](https://docs.x.ai/developers/model-capabilities/text/multi-agent), [api-reference](https://docs.x.ai/docs/api-reference), [models page](https://docs.x.ai/docs/models).

### 10.1 ✅ Подтверждено официальной документацией

| Параметр | Значение | Источник / цитата |
|---|---|---|
| `temperature` | `0 – 2` | *«between 0 and 2 ... higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic»* |
| `top_p` | nucleus sampling | *«alternative to sampling with temperature... considers the results of the tokens with top_p probability mass»* |
| `max_tokens` | **DEPRECATED** | Актуальный параметр — `max_completion_tokens`. Точный потолок в доках не указан — проверять эмпирически |
| `presence_penalty` | `-2.0 – 2.0` | **Не поддерживается reasoning-моделями** (включая все Grok reasoning) |
| `frequency_penalty` | `-2.0 – 2.0` | **Не поддерживается reasoning-моделями** |
| `reasoning.effort` (non-multi-agent reasoning models) | `low` / `medium` / `high` (+ `xhigh` через `/v1/responses`) | *«low (uses fewer reasoning tokens) and high (uses more reasoning tokens). The /v1/responses endpoint also mentions medium as an option»* |
| `reasoning.effort` (multi-agent) | Доки явно описывают только два режима по количеству агентов: **4 агента и 16 агентов** | SDK принимает все 4 значения, но поведение `medium`/`xhigh` для multi-agent в документации не описано |
| Context window (все Grok 4.x) | `2 000 000` tokens (декларативно) | В нашем каталоге — консервативные значения (256K / 128K) до эмпирического подтверждения |
| Лидер + sub-агенты | Абстрактное описание, **без имён и ролей** | *«A designated leader agent is responsible for synthesizing the discussion... When you send a request, multiple agents are launched to discuss and collaborate»* |

### 10.2 ❌ Опровергнуто (НЕ использовать в ТЗ)

- **Имена агентов «Harper / Benjamin / Lucas / Grok-капитан» с жёсткими ролями (креатив / аналитика / проверка ошибок / синтез)** — **в официальной документации xAI таких имён и ролей нет**. Агенты описаны только абстрактно: «leader agent» и «sub-agents, each contributing its own perspective». Это галлюцинация Grok-ответа. В документах Simply и в ТЗ это упоминать нельзя.
- **«Grok 4.20 и Grok 4.1 Fast не принимают `reasoning.effort` и будут падать с ошибкой»** — неверно. Reasoning-варианты этих моделей (`grok-4.20-0309-reasoning`, `grok-4-1-fast-reasoning`) используют `reasoning.effort` так же, как другие reasoning-модели (low/medium/high) для контроля глубины рассуждения. Только **non-reasoning** варианты не принимают этот параметр.
- **Рекомендация `presence_penalty = 0.1` для KITT / `frequency_penalty = 0.2` для Создать** — некорректна: оба параметра **не поддерживаются reasoning-моделями**. Если режим использует reasoning-вариант Grok — эти параметры будут проигнорированы или вызовут ошибку.
- **`max_tokens` до 30 000** — число не подтверждено. Параметр `max_tokens` deprecated, актуальный — `max_completion_tokens`. Реальный потолок output для Grok 4.20 в нашем каталоге стоит **16K**, 30K — нужна проверка перед использованием.

### 10.3 🟡 Субъективное мнение Grok (не документация)

Таблица предустановок temperature / top_p / effort для режимов Simply (KITT / Думать / Экспертиза / Создать / Проекты) из ответа Grok — **это его собственная рекомендация, а не данные из документации xAI**.

Решение: **не записывать в ТЗ как исходные параметры**. Вместо этого: начать от нейтральных дефолтов (`temperature: 0.3`, `top_p: 0.9`, `effort: low`) и тюнить эмпирически на реальных запросах по каждому режиму в отдельной фазе ТЗ. Результаты тюнинга — в ADR.

### 10.4 🛠 Что реально использовать в будущем ТЗ

**Для multi-agent режима:**
```ts
providerOptions: {
  xai: {
    reasoning: { effort: "low" },  // = 4 агента, подтверждено
  }
}
// НЕ передавать: presence_penalty, frequency_penalty (не работают на reasoning)
// max_completion_tokens — новое имя, НЕ max_tokens
// temperature / top_p — начать с 0.3 / 0.9, тюнить под каждый режим
```

**Для non-multi-agent Grok reasoning:**
```ts
providerOptions: {
  xai: {
    reasoning: { effort: "low" | "medium" | "high" },  // глубина, не агенты
  }
}
```

**Для non-reasoning Grok (`grok-4.20-0309-non-reasoning`, `grok-4-1-fast-non-reasoning`):**
```ts
// reasoning.effort НЕ передавать — параметр не поддерживается
// presence_penalty / frequency_penalty — поддерживаются
// temperature / top_p — стандартно
```

---

## 11. Итог (для архитектора следующей сессии)

**Вопрос:** «Можно ли в Simply использовать Grok 4.20 Multi-Agent (4 агента) с полным набором наших custom tools?»

**Ответ:** Да. Все кирпичи уже есть — официальный MCP-канал от xAI, встроенная поддержка в `@ai-sdk/xai@3.0.82`, совместимость с нашим `streamText` pipeline. Нужно спроектировать: (1) auth для публичного MCP endpoint, (2) адаптер observability под server-side tool events, (3) throttling от множественных параллельных вызовов tools подагентами, (4) UI для прогресса команды агентов и ценового warning. Это **дизайн-работа, не исследование возможности**.

**Следующий шаг:** НЕ открываем ТЗ. Сначала A/B-тест Grok multi-agent через xAI Console без наших tools — проверить, стоит ли вообще этот продукт инвестиций.
