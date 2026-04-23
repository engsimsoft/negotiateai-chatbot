# ТЗ-ExpertiseReasoningRestore — вернуть reasoning в режим Экспертиза

**Статус:** Хвост, **Medium impact** (качество Экспертизы снижено на non-reasoning Grok, пока корень не починен)
**Создано:** 2026-04-23 — после инцидента с `reasoning part {id} not found` на `grok-4.20-0309-reasoning` при параллельных tool calls.
**Воркэраунд на момент создания:** переключение `expertise` на `grok-4.20-0309-non-reasoning` в [lib/ai/task-assignments.ts](../../lib/ai/task-assignments.ts) (владелец сделал вручную).
**Связано с:**
- [lib/ai/getModel.ts](../../lib/ai/getModel.ts) — `wrapLanguageModel` обёртка для xAI reasoning
- [lib/ai/middleware/reasoning-reconciliation.ts](../../lib/ai/middleware/reasoning-reconciliation.ts) — существующий неактивный middleware
- [lib/ai/task-assignments.ts](../../lib/ai/task-assignments.ts) — маппинг `expertise` → модель
- [app/(chat)/api/chat/route.ts](../../app/(chat)/api/chat/route.ts) — streamText, stopWhen
- [specs/Simply_xAI/SIMPLY_XAI_NOTES.md](../Simply_xAI/SIMPLY_XAI_NOTES.md) — запись 2026-04-23 с диагностикой

---

## Контекст

Грок 4.20 reasoning (`grok-4.20-0309-reasoning`) при параллельных tool calls (typical для Экспертизы: `webSearch` + `librarySearch` одновременно) ломает reasoning-поток на стороне `@ai-sdk/xai@3.0.83`. SDK присылает `reasoning-delta`/`reasoning-end` с id, для которого не был эмитнут `reasoning-start`. `streamText` в `ai@6.0.168` ловит это в валидации, выбрасывает `reasoning part {id} not found` в `onError` × N раз, HTTP-ответ закрывается `200 OK` с пустым content → клиент висит, в БД `Saving 0 assistant message(s)`.

Баг плавающий — иногда запрос проходит (1 message saved), иногда падает. Видимо зависит от timing'а tool calls и внутренней кадровки reasoning-блоков xAI.

## Симптомы в логе

```
[Chat API] Model selection: chatMode=expertise, task=expertise, model=grok-4.20-0309-reasoning
[Chat Stream onError] [Error: reasoning part reasoning-{uuid} not found]  × 3-7
POST /api/chat 200 in Nms
[Token Aware] Chat {id}: Saving 0 assistant message(s) with ~0 tokens
```

В UI: `client:useChat reasoning part reasoning-{uuid} not found`, бесконечный спиннер либо пустое сообщение.

## Что уже пробовали (чтобы не повторять)

1. **Апдейт `ai@6.0.116 → 6.0.168` + `@ai-sdk/xai@3.0.82 → 3.0.83`.** Коммит `97af934` (2026-04-23). Помогло на одном тесте, баг вернулся — не полный фикс. Уменьшило, но не устранило. Оставлять обновлённые версии нужно.
2. **`providerOptions.xai.reasoningEffort: 'high'`.** **Не поддерживается** `grok-4.20-reasoning` по [docs.x.ai](https://docs.x.ai/developers/model-capabilities/text/reasoning) — «модель рассуждает автоматически без конфигурации», передача вернёт API error. Этот рычаг для Grok 4.20 закрыт на стороне провайдера.
3. **Custom `LanguageModelMiddleware` (`reasoningReconciliationMiddleware`).** По паттерну [vercel/ai PR #12055](https://github.com/vercel/ai/pull/12055) — ловит orphan `reasoning-delta/end`, синтезирует недостающий `reasoning-start`. Подключён в [lib/ai/getModel.ts](../../lib/ai/getModel.ts) через `wrapLanguageModel` для xAI+`thinking:true`. **Не сработал** — баг воспроизвёлся после обёртки. Вероятные причины: (а) ошибка возникает внутри `streamText` ДО middleware по протоколу stream parts; (б) xAI эмитит chunks с другими `type` полями чем ожидает middleware; (в) порядок chunk'ов от параллельных tool calls взаимодействует с reasoning iteratively, не адресуется простым reconciliation'ом. Middleware с diagnostic log оставлен в коде — даст данные при следующей попытке.
4. **Temperature 0.3** (было 1.0) для Экспертизы — не влияет на этот баг, оставлено по рекомендации PE для следования инструкциям промпта.

## Варианты решения (в порядке предпочтения)

### 1. Sequential tool calls для reasoning-режима (High)

Отключить параллельность tool calls на уровне Экспертизы. В `streamText` параллельность управляется моделью через `parallel_tool_calls` (OpenAI) / `parallel_function_calling` (xAI). Для xAI:

```ts
providerOptions: {
  xai: { parallel_function_calling: false }
}
```

Проверить: (а) поддерживается ли флаг на `grok-4.20-reasoning` (docs.x.ai не указывает явно), (б) действительно ли устраняет баг при последовательных tool calls. Минус — Экспертиза с несколькими поисковыми запросами станет в 1.5-2× медленнее (они пойдут последовательно, а не параллельно). Для режима «глубокий ответ» это приемлемый trade-off.

### 2. Дождаться фикса xAI / Vercel (Medium)

Мониторить [vercel/ai issue #12054](https://github.com/vercel/ai/issues/12054) и #7311. Если Vercel введёт общий reconciliation middleware — наш `reasoningReconciliationMiddleware` заменяется upstream-версией. Если xAI починит reasoning stream для параллельных tool calls на стороне `@ai-sdk/xai` — средство решения упростится до апдейта пакета. Параллельно: отправить баг-репорт xAI с минимальным репро (expertise-style prompt + 2-3 параллельных tool calls).

### 3. Доработать middleware (Low, если 1 и 2 не зайдут)

Разобраться почему текущий `reasoningReconciliationMiddleware` не сработал (есть diagnostic log в коде). Варианты: поменять хук с `wrapStream` на `transformParams`, ловить chunks до `toUIMessageStream`, добавить re-ordering reasoning vs tool-call events, вручную пересобирать поток с atomic reasoning-блоками. Сложная доработка, лезет глубоко в SDK internals — делать только если 1 и 2 не дали результата.

### 4. Переход на Responses API (Long-term)

xAI продвигает Responses API для agentic workflows — другой формат messages, другое поведение tool calls. Требует полной миграции chat pipeline, пересечение с планируемой серией ТЗ-XAI-MA-1 (Multi-Agent Экспертиза). Рассматривать в контексте MA-1, не отдельно.

## Acceptance criteria

- [ ] Экспертиза переключена обратно на `grok-4.20-0309-reasoning` в [task-assignments.ts](../../lib/ai/task-assignments.ts) (владелец вручную подтвердит)
- [ ] 10 последовательных тестовых запросов с параллельными tool calls (типа «Honda K20 + регламент РАФ 2026») — ни одной ошибки `reasoning part not found` в `/tmp/simply-dev.log`
- [ ] В БД после каждого запроса — `Saving ≥1 assistant message(s)`, UI получает полный ответ
- [ ] `npx tsc --noEmit` зелёный
- [ ] Запись в [SIMPLY_XAI_NOTES.md](../Simply_xAI/SIMPLY_XAI_NOTES.md) — «фикс в проде», удалить diagnostic console.log из middleware (или сам middleware, если решено вариантом 1/4)
- [ ] Обновить [docs/ai-chats-map.md](../../docs/ai-chats-map.md) при изменении task-assignments ([feedback_ai_chats_map_sync](../../../.claude/projects/-Users-mactm-Projects-NegotiateAI-Chatbot/memory/feedback_ai_chats_map_sync.md))

## НЕ в scope

- Переписывание streamText buffering логики в [route.ts:1352-1467](../../app/(chat)/api/chat/route.ts#L1352-L1467) — он работает после SDK и не является корнем
- Отказ от tool calls в Экспертизе (webSearch/librarySearch критичны для качества)
- Изменение промпта Экспертизы — новый v2.0 от PE не связан с этим багом
- Миграция на другой reasoning-провайдер (Anthropic Opus с thinking) — отдельное ТЗ, другие риски

## Релевантный контекст из памяти

- **[feedback_sdk_regression_check](../../../.claude/projects/-Users-mactm-Projects-NegotiateAI-Chatbot/memory/feedback_sdk_regression_check.md)** — при «загадочных» багах AI SDK stream ПЕРВЫМ проверять installed patch-версию vs latest. Первый тест этой сессии это подтвердил: `^6.0.116` подтянуло `6.0.146` с регрессией.
- **[project_anthropic_temperature_thinking_conflict](../../../.claude/projects/-Users-mactm-Projects-NegotiateAI-Chatbot/memory/project_anthropic_temperature_thinking_conflict.md)** — прецедент: thinking/reasoning провайдер-специфичны, требуют условной обработки providerOptions. Для Anthropic `temperature` несовместимо с `thinking`. Для xAI — `reasoningEffort` не существует на grok-4.20. Каждый провайдер решает reasoning по-своему, general-purpose фикс маловероятен.
- **[project_anthropic_thinking_tokens_limitation](../../../.claude/projects/-Users-mactm-Projects-NegotiateAI-Chatbot/memory/project_anthropic_thinking_tokens_limitation.md)** — xAI/Grok корректно разделяет reasoning tokens в usage (в отличие от Anthropic). Значит reasoning-поток от xAI технически возвращается структурированно — баг именно в порядке/id событий при параллельных tools, не в данных.
- **[project_voyage_vpn_finland](../../../.claude/projects/-Users-mactm-Projects-NegotiateAI-Chatbot/memory/project_voyage_vpn_finland.md)** — Voyage AI 403 из-за финского VPN проверено и исключено как причина этого бага (US VPN не помог).
- **[project_think_button_semantics](../../../.claude/projects/-Users-mactm-Projects-NegotiateAI-Chatbot/memory/project_think_button_semantics.md)** — «Думать» в Simply Chat = tier upgrade на reasoning-модель. Если Экспертиза временно без reasoning, этот функционал в Simply Chat (`simply-chat-think`) может страдать от того же бага при параллельных tools. Проверить на следующем тестировании Simply Chat с Think + multiple tools.

## Оценка

**0.5-1.5 сессии:**
- Вариант 1 (sequential tools) — 0.3-0.5 (проверка флага в docs.x.ai, тест, обновление notes)
- Вариант 2 (ждать фикса) — 0 работы, мониторинг
- Вариант 3 (доработка middleware) — 1-1.5 (разбор chunks, итерации, тесты)
- Вариант 4 (Responses API) — не оценивается отдельно, часть ТЗ-XAI-MA-1

Рекомендация: начинать с варианта 1, параллельно следить за 2. К варианту 3 прибегать только если 1 не сработает.
