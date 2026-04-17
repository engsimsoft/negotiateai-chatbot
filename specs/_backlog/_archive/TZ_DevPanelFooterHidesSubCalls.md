# ТЗ-DevPanelFooterHidesSubCalls — DevPanel футер скрывает nested AI-вызовы (артефакты, tools, clerks)

**Статус:** Хвост, Medium impact
**Создано:** 2026-04-16 (сессия ТЗ-XAI-4 Этап 2, мануальное тестирование)
**Источник:** Владимир, обнаружено при создании markdown-артефакта в /expertise
**Связано с:** [components/dev-panel/](../../components/dev-panel/), [lib/ai/debug-events.ts](../../lib/ai/debug-events.ts), `emitArtifactDebugStep`, ADR 048, ТЗ-CachePipelineMetrics (backend часть уже решена)

---

## Симптом

В DevPanel footer (встроенный под каждым сообщением разработчика для прозрачности стоимости и выбора модели) показывается **только модель и стоимость parent chat вызова**. Nested sub-calls — артефакт-handler'ы, tool-calls с внутренней AI-логикой, clerk'и внутри pipelines — **не суммируются в футер**.

**Конкретное наблюдение (Владимир, 2026-04-16):**

1. В `/expertise` (override → `grok-4-1-fast-non-reasoning`) попросил создать markdown-артефакт
2. DevPanel footer показал: «Grok 4.1 Fast — 3.43 руб»
3. Сумма **не соответствует** Grok 4.1 Fast:
   - Grok 4.1 Fast pricing: $0.20 input / $0.50 output per 1M
   - Чтобы получить $0.04 нужно ~200K input или ~80K output — явно не для одного ответа
4. **SQL-проверка показала два разных вызова за то же пользовательское действие:**

| # | chatMode | modelId | input | output | costUsd |
|---|---|---|---|---|---|
| 1 | `artifact:markdown` | `claude-sonnet-4-6` | 333 | 2049 | **$0.0317** |
| 2 | `expertise` | `grok-4-1-fast-non-reasoning` | 19479 | 150 | $0.0026 |

**Реальность:** 92% стоимости ушло на Sonnet sub-call, футер показывает только Grok parent. Пользователь видит «Grok 4.1 Fast — 3.43 руб» и делает вывод что Grok неожиданно дорогой, хотя реально деньги жжёт Sonnet внутри артефакт-handler'а.

---

## Почему это важно

DevPanel — **инструмент прозрачности разработчика для product-owner'а**. Владимир использует его чтобы:
1. Видеть какая модель работает в каждом режиме (после миграции моделей серии Simply_xAI это критично)
2. Контролировать стоимость вызовов в реальном времени (в процессе разработки и A/B тестов)
3. Ловить регрессии миграции (если что-то неожиданно вызывается на дорогой модели)

**Текущий баг ломает все три цели:**
1. ❌ Модель показывается **неполная** — видно только верхний слой (parent chat), скрыты все nested AI-слои (artifacts, tools с AI внутри, clerks в pipelines, service-chats в onboarding flows)
2. ❌ Стоимость показывается **либо неверная, либо вводящая в заблуждение** — parent стоимость + часть sub-call'ов или только parent, нельзя доверять
3. ❌ Регрессии миграции **не ловятся** — если после миграции `artifact:markdown` уйдёт на Grok, но `artifact:suggestions` останется на Haiku — видно только одно из них, другое «прячется»

---

## Архитектура — где именно проблема

**Backend (уже решено в ТЗ-CachePipelineMetrics):**
- Все AI-вызовы (включая nested) логируются в `ai_usage_log` с правильными `chatMode`, `modelId`, `provider`, токенами, costUsd
- `/admin/cost-audit` и SQL-запросы показывают полную картину
- ✅ Backend observability работает

**Frontend — DevPanel footer:**
- `emitArtifactDebugStep()` в [lib/ai/debug-events.ts](../../lib/ai/debug-events.ts) **существует** и эмитит side-stream events в `dataStream.write({ type: "data-debug-step", ... })` — это отдельный канал для DevPanel
- Но **агрегация этих событий в footer не реализована** — footer показывает только модель/цену из `data-model-info` parent chat вызова
- Nested sub-calls попадают в DevPanel как **отдельные debug-step блоки в UI** (если они там есть), но **не складываются в сумму в footer**

**Тонкость с агрегацией:**
- `expertise` parent chat → 1 событие model-info
- tool createDocument → 1 событие artifact-debug-step (чеке sub-call Sonnet)
- Footer должен: (a) показать обе модели («Grok 4.1 Fast + Sonnet»), (b) сложить стоимости, (c) показать кто доминирует

---

## Воспроизведение

1. Открыть `/dev/models` → поставить override `expertise` → `grok-4-1-fast-non-reasoning` (или оставить default)
2. Открыть `/expertise` → новый запрос типа «Создай markdown документ с планом миграции AI»
3. Grok отвечает, вызывает `createDocument(kind="markdown")` → Sonnet генерирует артефакт
4. Посмотреть DevPanel footer под финальным сообщением
5. Сравнить показанную стоимость с SQL:
   ```sql
   SELECT "chatMode", "modelId", "costUsd" FROM ai_usage_log
   WHERE "createdAt" > NOW() - INTERVAL '2 minutes' ORDER BY "createdAt" DESC;
   ```
6. **Разница:** footer ~ parent only; SQL ~ parent + ВСЕ nested

---

## Какие ещё места сломаны (вероятно)

Везде где parent chat вызывает tool с внутренней AI-логикой:
- **Все артефакт-handler'ы** (text, markdown, excel, pptx, reveal) — `artifact:*` taskIds
- **Request-suggestions** — `util:artifact-suggestions` (streamObject)
- **deepResearch tool** — Perplexity API calls (не AI SDK, но cost должен быть виден)
- **Briefing generation** — parent service chat + sub-calls к `briefing:*`
- **Professor pipeline** — parent pipeline + `clerk:task-summary` вызов на финализации
- **Meeting pipeline** — transcription (Deepgram, отдельный billing) + `meeting:summary`

---

## Acceptance criteria

- [ ] DevPanel footer под сообщением показывает **все участвующие модели** (минимум 2 при создании артефакта: parent chat + artifact handler)
- [ ] Стоимость **суммируется** по всем nested вызовам за одно пользовательское действие
- [ ] Если одна из моделей доминирует по стоимости — помечается визуально (выделение, звёздочка, или «основной расход»)
- [ ] Для tool-calls с AI внутри (artifact handlers, suggestions, clerks) footer собирает events через тот же `dataStream.write({ type: "data-..." })` mechanism
- [ ] Работает для всех 5 типов артефактов и для всех известных nested AI-точек
- [ ] Существующий UI не перегружается: если sub-call == 0 (чистый text reply без tools) — футер показывает только parent model как сейчас

---

## Связанные уже закрытые ТЗ / backlog

- **TZ-CachePipelineMetrics (архив)** — закрыл backend observability. Все вызовы пишутся в `ai_usage_log` корректно. Этот ТЗ — **frontend продолжение** того же направления.
- **ADR 048 DevPanel switchboard UI** — архитектурные основы панели. Расширение footer под nested events должно быть консистентно с ADR.
- **TZ_CachePipelineMetrics ANALYSIS.md §nested sub-calls** — там уже обсуждалась проблема видимости nested, но frontend часть была out of scope.

---

## НЕ в scope ТЗ-XAI-4

Важно: этот баг **НЕ связан с миграцией моделей**. Он существовал до ТЗ-XAI-4, просто стал заметнее потому что:
1. После миграции `simply-chat` → Grok 4.1 Fast (в ТЗ-XAI-3) разница в ценах с Sonnet стала очень большой → любой Sonnet sub-call виден
2. Во время ТЗ-XAI-4 тестирования мы активно проверяем что цены соответствуют ожиданиям → обнаруживается расхождение

Решать — отдельным ТЗ. Оценка 0.5-1 сессия (backend data уже есть, нужно только frontend aggregation).
