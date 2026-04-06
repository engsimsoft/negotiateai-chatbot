# ТЗ-PIPELINE1: Reliable Pipeline Observability

**Версия проекта:** 3.68.0 → 3.69.0
**Приоритет:** Критический
**Предшественники:** ТЗ-BILLING2 (закрыт — недостаточный scope)

---

## Проблема

Pipeline генерации брифинга теряет **78% расхода Anthropic** (тест 2026-04-06: БД $0.074 vs Console $0.33). Причины:

1. **AI SDK default `maxRetries: 2`** — до 3 скрытых попыток на каждый `generateObject()`, usage возвращается только за последнюю успешную
2. **Manual fallback поверх SDK retry** — `briefing-author.ts` делает primary (3 попытки) → catch → fallback (3 попытки) = до 6 вызовов, логируется 1
3. **logUsage только при success** — если все retry fail, usage = 0
4. **Pipeline crash** — "Controller is already closed" убивает section-author
5. **Perplexity не логируется** — research-engine не вызывает logUsage
6. **Legacy fallback** — Sonnet 4.5 как fallback (та же цена, нет смысла)
7. **Нет видимости** — DevPanel не показывает что происходит внутри pipeline

## Принцип решения

**Сначала видимость, потом починка.** Но для видимости нужны данные → retry-инфраструктура идёт первой.

---

## Этапы

### Этап 0: Fix multi-step usage logging (все routes)

**Цель:** `onFinish` во всех routes записывает usage последнего step-а, а не total. Это корневая причина потерь не только в pipeline, но и во всех чатах.

**Проблема (доказано 2026-04-06):**
- Anthropic Console: 159K input tokens (Sonnet 4.6, briefing-onboarding)
- Наша БД: 42K input tokens (1 запись из 6 steps)
- Потеря: 74% tokens не залогированы

**Затронутые routes:**
- `app/(chat)/api/service-chat/route.ts` — `onFinish: ({ usage })` → usage последнего step-а
- `app/(chat)/api/chat/route.ts` — аналогично

**Решение:** В `onStepFinish` аккумулировать usage, в `onFinish` логировать total.

**Дополнительная находка — Artifacts (100% потеря):**
- `artifacts/text/server.ts`, `artifacts/markdown/server.ts`, `artifacts/excel/server.ts`, `artifacts/presentation-reveal/server.ts`, `artifacts/presentation-pptx/server.ts`
- Все используют `streamText` с Sonnet 4.6 и **НИ ОДИН не вызывает logUsage**
- Каждое создание/редактирование документа — полная потеря usage

### Этап 1: Retry-инфраструктура + базовые фиксы

**Цель:** Каждый API-вызов логируется (включая failed attempts).

1. Создать `lib/ai/retry-with-logging.ts` — retry-обёртка:
   - Принимает `fn()` (generateObject/generateText), `maxAttempts`, `userId`, `modelId`, `chatMode`
   - Каждая попытка: вызов → если success: logUsage → если fail: logUsage с тем что есть (input tokens из prompt size estimation) + лог ошибки
   - Аккумулирует usage по всем попыткам
   - Возвращает `{ result, totalUsage, attempts: Array<{ usage, error?, durationMs }> }`

2. Все pipeline `generateObject()` / `generateText()`:
   - Добавить `maxRetries: 0` (отключить скрытые SDK retry)
   - Обернуть в retry-обёртку
   - **Файлы:** `briefing-author.ts`, `briefing-section-author.ts`, `briefing-filter.ts`, `script-generator.ts`

3. Убрать `AUTHOR_MODEL_FALLBACK` (Sonnet 4.5):
   - Удалить из `briefing-config.ts`
   - В `briefing-author.ts` и `briefing-section-author.ts` — убрать try/catch с fallback
   - Retry с основной моделью через обёртку

4. Perplexity logUsage:
   - В `research-engine.ts` — пробросить `userId`, вызвать `logUsage()` после `callPerplexity()`

5. Fix "Controller is already closed":
   - В `app/(chat)/api/briefing/generate/route.ts` — защита от double-close

### Этап 2: DevPanel для брифинга

**Цель:** На странице брифинга видно всё что происходит в pipeline.

Используя существующую инфраструктуру (`PipelineTraceFooter`, `PipelineTraceDrawer`, `TraceCollector`):

1. **Расширить trace данные:**
   - Добавить в `PipelineStageTrace` поле `attempts` — массив попыток с usage, error, duration
   - Добавить retry info в `AiCallTrace` — per-attempt breakdown

2. **Расширить DevPanel Drawer для pipeline:**
   - Per-stage детализация: модель, токены, стоимость, retry history
   - Per-fetch детализация: URL, метод, время, успех/неудача
   - URL verification: красные маркеры на выдуманных URLs (данные уже есть в `verifyArticleUrls`)
   - Cost breakdown: per-stage стоимость, total

3. **Детекция галлюцинаций:**
   - Визуализация URL verification (уже собирается, нужно сделать заметным)
   - Маркеры: "URL есть в fetch" (зелёный), "URL нет в fetch" (красный — выдумка модели)
   - Счётчик в footer: "URLs: 42 OK, 2 fake"

4. **Section refresh trace:**
   - `sectionTraces` уже собирается но не отображается — добавить inline UI

### Этап 3: Дымовой тест + финализация

1. Реальная генерация брифинга в dev mode
2. Сверка с Anthropic Console: допуск < 5%
3. Проверка DevPanel: все данные отображаются
4. Финализация (docs, CLAUDE.md, CHANGELOG)

---

## Ключевые решения из исследования документации

### AI SDK v6
- `maxRetries` default = 2 (3 попытки). Usage только за последнюю успешную. При полном fail — usage = 0.
- `APICallError` не содержит usage. Нет способа получить partial usage от failed request через SDK.
- Решение: `maxRetries: 0` + свой retry.

### Anthropic Billing
- Server errors (500, 529) — **не списывается**
- Client disconnect/timeout mid-stream — **списывается**
- Каждый retry — отдельный billable request
- Решение: минимизировать retry (2 max), логировать каждый

### Существующая инфраструктура
- `TraceCollector`, `PipelineStageTrace`, `PipelineTraceFooter/Drawer` — всё есть
- `verifyArticleUrls()` — URL verification уже работает
- DevPanel для chat — полный reference implementation
- Нужно: расширить данные + расширить UI для pipeline

---

## Затронутые файлы

**Новые:**
- `lib/ai/retry-with-logging.ts` — retry-обёртка

**Изменяемые (Этап 1):**
- `lib/briefing/briefing-config.ts` — убрать AUTHOR_MODEL_FALLBACK
- `lib/briefing/briefing-author.ts` — maxRetries: 0, retry-обёртка, убрать fallback
- `lib/briefing/briefing-section-author.ts` — аналогично
- `lib/briefing/briefing-filter.ts` — maxRetries: 0, retry-обёртка
- `lib/briefing/research-engine.ts` — добавить userId, logUsage для Perplexity
- `lib/podcast/script-generator.ts` — maxRetries: 0
- `app/(chat)/api/briefing/generate/route.ts` — fix Controller crash

**Изменяемые (Этап 2):**
- `lib/ai/pipeline-trace.ts` — расширить типы (attempts array)
- `components/dev-panel/pipeline-trace-drawer.tsx` — расширить UI
- `components/dev-panel/pipeline-trace-footer.tsx` — URL verification counter
- `components/briefing/briefing-page-client.tsx` — section traces UI
- `components/briefing/briefing-article-view.tsx` — inline trace для section refresh

---

## Критерии успеха

1. **Cost accuracy:** Сумма в БД === Anthropic Console (допуск < 5%)
2. **Visibility:** DevPanel показывает каждый AI-вызов, каждый retry, каждый fetch
3. **Hallucination detection:** Выдуманные URLs видны красным в DevPanel
4. **No regression:** Pipeline работает как раньше, не медленнее
5. **Zero prod overhead:** Всё за `isSimplyDevMode` gate
