# ТЗ-XAI-4 — ANALYSIS

**Создан:** 2026-04-16
**Последнее обновление:** 2026-04-16 — v2: scope сокращён с 12 до 7 точек, артефакты выведены (решение владельца), Q-A…Q-D зафиксированы
**Статус:** Ждёт ОК владельца на итоговый scope + ROADMAP
**Серия:** Simply_xAI
**Зависимости:** ТЗ-XAI-1, ТЗ-XAI-2, ТЗ-XAI-3, ТЗ-ATTACH-1 (все завершены, v3.91.0)
**Связанные документы:**
- [SIMPLY_XAI_ROADMAP.md](../SIMPLY_XAI_ROADMAP.md) — секция ТЗ-XAI-4
- [HANDOFF.md](../HANDOFF.md) — план старта
- [SIMPLY_ATTACHMENT_ARCHITECTURE.md](../SIMPLY_ATTACHMENT_ARCHITECTURE.md) — SSOT серии

---

## 1. Цель

Перевести utility / pipeline call sites Simply на Grok 4.1 Fast / Grok 4.20 (или оставить на MiniMax/Sonnet где экономически или качественно оправдано). Минимальные изменения поведения, максимум — переключение `taskId → model` через `lib/ai/task-assignments.ts` (SSOT резолва моделей).

**Вне scope этого ТЗ:**
- `artifact:*` (5 точек) — остаются на Sonnet. **Решение владельца (2026-04-16):** артефакты — это витрина продукта, пользователь видит результат, качество приоритет. Artifact handlers используют Node.js-библиотеки (docx-js, SheetJS, PptxGenJS), которые заточены под output-стиль Claude. A/B-сравнение Grok vs Sonnet на артефактах — отдельная задача через DevPanel, не в scope быстрой миграции.
- `professor:*` (5 точек) — остаются на Opus (премиум, не экономим)
- `service-chat:*` (4 точки) — отдельное ТЗ для PE-команды
- `simply-chat*`, `expertise`, `create`, `memory:*`, `vision:ocr`, `project:expert:*`
- `clerk:snapshot` — мёртвый код per ADR 052, удалится в XAI-6

---

## 2. Залоченный scope — 7 taskId изменений

**Scope сокращён с 12 до 7 после ответов Q-A…Q-D:** 5 artifact handlers выведены из ТЗ-XAI-4 и остаются на Sonnet.

| # | taskId | Сейчас | Станет | Зона | AI SDK метод |
|---|---|---|---|---|---|
| 1 | `briefing:filter` | MiniMax-M2.7-long | grok-4-1-fast-non-reasoning | Подсобка | streamText + JSON.parse + Zod |
| 2 | `meeting:summary` | claude-sonnet-4-6 | grok-4.20-0309-non-reasoning | Зал | generateText (plain) |
| 3 | `clerk:task-summary` | claude-haiku-4-5-20251001 | grok-4-1-fast-non-reasoning | Подсобка | generateText + JSON.parse + Zod |
| 4 | `clerk:file-analyzer` | claude-haiku-4-5-20251001 | grok-4-1-fast-non-reasoning | Подсобка | generateText + JSON.parse + Zod |
| 5 | `util:title` | claude-haiku-4-5-20251001 | grok-4-1-fast-non-reasoning | Подсобка | generateText (plain) |
| 6 | `util:project-summary` | claude-haiku-4-5-20251001 | grok-4-1-fast-non-reasoning | Подсобка | generateText (plain) |
| 7 | `util:artifact-suggestions` | claude-sonnet-4-6 | grok-4-1-fast-non-reasoning (fallback: grok-4.20-0309-non-reasoning если streamObject нестабилен) | Подсобка | **streamObject (array mode)** ⚠️ |

**Остаётся на MiniMax** (работает, проверено, в 5× дешевле Grok 4.20):
- `briefing:author` → MiniMax-M2.7-long
- `briefing:section` → MiniMax-M2.7-long
- `briefing:podcast-script` → MiniMax-M2.7

**Остаются на Sonnet** (витрина продукта):
- `artifact:text`, `artifact:markdown`, `artifact:excel`, `artifact:pptx`, `artifact:reveal`

**Принцип распределения (закреплено с владельцем):**
- **Кухня** — фоновое, пользователь не видит процесс (MiniMax M2.7 — дешёвый работяга)
- **Зал** — интерактивное, пользователь видит результат (Grok 4.20 — качество)
- **Подсобка** — механика, короткие задачи (Grok 4.1 Fast — дешевле всех)
- **Витрина** — артефакты + премиум (Sonnet / Opus — проверенное качество, не трогаем)

---

## 3. Верификация по docs.x.ai (2026-04-16)

Подтверждено WebFetch на https://docs.x.ai/docs/models:

| Модель | Pricing | Context | Structured outputs |
|---|---|---|---|
| `grok-4-1-fast-non-reasoning` | $0.20 / $0.50 per 1M | 2M | ✅ "functions, structured" |
| `grok-4.20-0309-non-reasoning` | $2.00 / $6.00 per 1M | 2M | ✅ "functions, structured" |

Оба поддерживают structured outputs (через Chat Completions API). Цены совпадают с CLAUDE.md и памятью. Параметр `reasoning_effort` для этих вариантов не передавать — эмпирически падает `Bad Request` (архитектурная константа №3, CLAUDE.md).

**Важная оговорка:** документация xAI явно заявляет "structured outputs", но не специфицирует поведение `streamObject` AI SDK v6 с array mode. ТЗ-XAI-2 подтвердил `generateObject` на Grok (v3.89.0, MIND pipeline). Для `streamObject` — **нужен smoke test** (см. §6).

---

## 4. Аудит call sites — детальные находки

### 4.1 Briefing pipeline (1 changing)

**`briefing:filter`** — [lib/briefing/briefing-filter.ts:119](../../../lib/briefing/briefing-filter.ts#L119)
- Метод: `streamText` + `JSON.parse` + Zod validation
- Комментарий в коде: «migrated from Gemini 2.0 Flash, generateObject → generateText + JSON.parse + Zod» — это legacy workaround времён MiniMax (у MiniMax ломались structured outputs через AI SDK).
- **Риск миграции на Grok 4.1 Fast: Low.** Grok следует JSON-инструкциям сильно лучше MiniMax — существующий workaround будет работать.
- **Optional improvement (вне scope XAI-4):** после миграции можно вернуть к чистому `generateObject` (как сделал ТЗ-XAI-2 для MIND). Экономит ~30 строк workaround кода и даёт type-safe output. **Рекомендую отложить на XAI-6 cleanup** — иначе XAI-4 раздувается.

**Остаются без изменений** (по решению владельца):
- `briefing:author` — [lib/briefing/briefing-author.ts:210](../../../lib/briefing/briefing-author.ts#L210) — streamText + JSON.parse + Zod
- `briefing:section` — [lib/briefing/briefing-section-author.ts:188](../../../lib/briefing/briefing-section-author.ts#L188) — streamText + JSON.parse + Zod
- `briefing:podcast-script` — не проверялся детально (out of scope)

### 4.2 Meeting pipeline (1 changing)

**`meeting:summary`** — [lib/meeting/meeting-pipeline.ts:92](../../../lib/meeting/meeting-pipeline.ts#L92)
- Метод: `generateText` с `temperature: 0.3`, `maxOutputTokens: 8192`
- Output: plain text, парсится через кастомный `parseTitleAndSummary(rawSummary)` (не JSON)
- **Риск миграции на Grok 4.20: Low.** Длинные транскрипты — Grok 4.20 справится, 2M контекст избыточен. `generateText` уже подтверждён для Grok в ТЗ-XAI-3.
- **Внимание:** `temperature: 0.3` — Grok его принимает, проверено. Не менять.

### 4.3 Artifact handlers — OUT OF SCOPE (аудит сохранён как reference для будущего A/B)

**Решение владельца (2026-04-16):** все 5 artifact handlers остаются на Sonnet. Причины:
- Артефакты — витрина продукта, пользователь видит финальный результат
- Handlers используют Node.js-библиотеки (docx-js, SheetJS/ExcelJS, PptxGenJS) которые исторически заточены под output-стиль Claude
- Grok vs Sonnet A/B на артефактах — отдельная задача через DevPanel override, не через коммит в task-assignments
- Скорости и экономии, которые даёт Grok 4.20, здесь не компенсируют риск regression на UX-критичной поверхности

**Аудит сохранён ниже для будущего ТЗ A/B-сравнения.**

Все 5 handlers: [artifacts/text/server.ts](../../../artifacts/text/server.ts), [artifacts/markdown/server.ts](../../../artifacts/markdown/server.ts), [artifacts/excel/server.ts](../../../artifacts/excel/server.ts), [artifacts/presentation-pptx/server.ts](../../../artifacts/presentation-pptx/server.ts), [artifacts/presentation-reveal/server.ts](../../../artifacts/presentation-reveal/server.ts).

**Общее для всех 5:**
- ✅ Используют `getModel(ARTIFACT_TASK)` через SSOT — если в будущем решим мигрировать, это тривиально через DevPanel override или 5 строк в task-assignments
- ✅ Используют `streamText` (не streamObject — как изначально предполагалось в обосновании)
- ⚠️ Некоторые используют `experimental_transform: smoothStream({ chunking: "word" })` — провайдер-агностичный transform AI SDK v6
- 🧹 `artifact:text` и `artifact:markdown` в `onUpdateDocument` имеют мёртвый `providerOptions.openai.prediction` (OpenAI Predicted Outputs). **Cleanup в XAI-6.**
- 🧹 `artifact:excel`, `artifact:pptx`, `artifact:reveal` используют prompt-engineered JSON + regex cleanup + `JSON.parse` с fallback. При будущем A/B на Grok — этот паттерн потребует smoke test JSON adherence.

**Этот раздел — исключительно reference для будущего ТЗ. В scope ТЗ-XAI-4 артефакты не входят.**

### 4.4 Clerks (2 changing, 1 out of scope)

**`clerk:task-summary`** — [lib/ai/clerks/task-summarizer.ts:155](../../../lib/ai/clerks/task-summarizer.ts#L155)
- Метод: `generateText` с `temperature: 0.1` → `stripCodeBlocks` → `JSON.parse` → Zod `taskSummarySchema.parse`
- Fallback: `createFallbackSummary(taskTitle, taskGoal)` при error
- **Риск на Grok 4.1 Fast: Low.** Тот же паттерн что briefing:filter, fallback защищает от edge cases.

**`clerk:file-analyzer`** — [app/(chat)/api/projects/[id]/analyze-file/route.ts:131](../../../app/(chat)/api/projects/[id]/analyze-file/route.ts#L131)
- Метод: `generateText` с `temperature: 0.1` → regex strip markdown → `JSON.parse` → Zod `analysisSchema.parse`
- Fallback: HTTP 500 ошибка при parse fail (хуже, чем у task-summary — пользователь увидит ошибку анализа файла)
- **Риск на Grok 4.1 Fast: Low-Medium.** Grok справится с JSON, но при edge case пользователь увидит ошибку вместо graceful fallback. **Рекомендую smoke test** — загрузить 2-3 разных файла в проект после миграции.

**`clerk:snapshot`** — **не мигрируем.** Dead code per ADR 052, 0 recent вызовов. Удалится в XAI-6.

### 4.5 Utility (3 changing)

**`util:title`** — 3 call sites:
- [app/(chat)/actions.ts:34](../../../app/(chat)/actions.ts#L34)
- [app/(chat)/api/chat/[id]/generate-title/route.ts:88](../../../app/(chat)/api/chat/[id]/generate-title/route.ts#L88)
- [app/(chat)/api/chat/route.ts:133](../../../app/(chat)/api/chat/route.ts#L133)
- Все `generateText`, короткий prompt → одна строка заголовка
- **Риск на Grok 4.1 Fast: Low.** Тривиальная задача.

**`util:project-summary`** — [app/(chat)/api/projects/[id]/generate-summary/route.ts:80](../../../app/(chat)/api/projects/[id]/generate-summary/route.ts#L80)
- `generateText`, короткая сводка проекта
- **Риск на Grok 4.1 Fast: Low.**

**`util:artifact-suggestions`** — [lib/ai/tools/request-suggestions.ts:49-61](../../../lib/ai/tools/request-suggestions.ts#L49)
- **Метод: `streamObject` с `output: "array"` + Zod schema** (3 поля × max 5 элементов)
- **Это ЕДИНСТВЕННЫЙ реальный streamObject в scope ТЗ-XAI-4.**
- Схема простая: `{ originalSentence, suggestedSentence, description }`
- Usage логирование через `waitUntil` + `usage` promise — обычный паттерн AI SDK v6
- **Риск на Grok 4.1 Fast: Medium. Нужен smoke test.** Если `streamObject` array mode не работает стабильно на Grok 4.1 Fast — fallback на `generateObject` с ручным переизданием (не streaming, но работает). Либо оставить на Sonnet.

---

## 5. MiniMax catalog audit (попутно, deliverable для XAI-6)

**Текущее состояние `lib/ai/model-catalog.ts`:**
- `MiniMax-M2.7` (physical, provider: minimax)
- `MiniMax-M2.7-long` (alias → M2.7, provider: minimaxLong — отдельный namespace с 180s fetch timeout)
- **Всего 2 записи.** Согласно памяти `project_minimax_catalog_audit.md`, в docs упоминается 8 моделей, но каталог давно уже минимальный.

**После ТЗ-XAI-4 останутся ссылки на MiniMax из task-assignments:**
- `briefing:author` → MiniMax-M2.7-long (не меняется)
- `briefing:section` → MiniMax-M2.7-long (не меняется)
- `briefing:podcast-script` → MiniMax-M2.7 (не меняется)
- `create` → MiniMax-M2.7 (out of scope XAI-4, уйдёт в XAI-5)

**Для XAI-6 cleanup (когда придёт время):** удалить из registry.ts namespace `minimax` + `minimaxLong`, удалить 2 catalog entries, удалить `vercel-minimax-ai-provider` из package.json. Но сначала `create` должен переехать (XAI-5) + убедиться что briefing переезжает или останется на MiniMax навсегда.

**Проверка docs vs catalog** — не делал глубоко, т.к. catalog уже минимальный. Если в `docs/ai-providers.md` упомянуты 8 моделей MiniMax — это устаревшая информация, её надо сверить при XAI-6.

---

## 6. Risk Matrix & Smoke Test Plan

| taskId | Риск | Smoke test нужен? | Тест-кейс |
|---|---|---|---|
| `briefing:filter` | Low | ❌ | Генерация брифинга после миграции — проверить что секции фильтруются корректно |
| `meeting:summary` | Low | ❌ | Прогнать 1 реальную запись встречи через `/meeting` — summary генерируется |
| `clerk:task-summary` | Low | ❌ | Завершить 1 задачу проекта → clerk-summary в БД, JSON parse success |
| `clerk:file-analyzer` | Low-Medium | ✅ | Загрузить 2-3 разных файла в проект → проверить успешный анализ (нет 500 ошибок) |
| `util:title` | Low | ❌ | Проверить автонейминг 1 нового Simply Chat |
| `util:project-summary` | Low | ❌ | Запросить summary 1 проекта |
| `util:artifact-suggestions` | **Medium** | ✅ **КРИТИЧНО (streamObject)** | Создать текстовый артефакт → вызвать `requestSuggestions` → проверить streaming + elementStream + валидный usage logging |

**streamObject smoke test (Q-A):**
- Цель: проверить что `streamObject` с `output: "array"` работает на `grok-4-1-fast-non-reasoning` через AI SDK v6
- Метод: изолированный тестовый скрипт в `scripts/test-grok-streamObject.ts`, удалить после прохождения (паттерн v3.91.0)
- **Fallback по Q-A (ответ владельца):** Вариант 3 — `grok-4.20-0309-non-reasoning`. Если streamObject на 4.1 Fast нестабилен, переключаем `util:artifact-suggestions` на 4.20 и идём дальше. Не переписываем код, не оставляем на Sonnet.

---

## 7. Ключевые архитектурные соображения

1. **Все 7 call sites в scope используют `getModel(taskId)` через SSOT.** Физическая миграция = 7 строк в `task-assignments.ts`. **Низкий blast radius.**

2. **Нет `providerOptions.anthropic.*` в scope.** Ни один handler не использует `cacheControl`, `thinking`, `contextManagement` напрямую. Adapter на `capabilities` (v3.90.2, adaptHistoryToCapabilities) здесь не задействован — call sites работают с простыми сообщениями без вложений.

3. **Dead code для XAI-6 cleanup** (не трогаем в XAI-4 per Q-B):
   - `providerOptions.openai.prediction` в `artifact:text` и `artifact:markdown` onUpdateDocument
   - Legacy `streamText + JSON.parse + Zod` workaround в briefing:filter + clerk:task-summary + clerk:file-analyzer можно вернуть к чистому `generateObject` в будущем
   - `clerk:snapshot` таск и код
   - Устаревшие docs упоминания 8 MiniMax моделей

4. **Ожидаемая экономия (грубая оценка, 7 точек в scope):**
   - `meeting:summary`: Sonnet ($3/$15) → Grok 4.20 ($2/$6) → **~2.5× экономия**
   - 5× utility/clerks: Haiku ($0.80/$4) → Grok 4.1 Fast ($0.20/$0.50) → **~4× input / 8× output экономия**
   - `util:artifact-suggestions`: Sonnet → Grok 4.1 Fast → **~15× input / 30× output экономия** (если fallback на 4.20 — всё равно ~1.5× экономия)

5. **Артефакты (5 taskId) остаются на Sonnet** — витрина, не экономим. Вопрос будущего A/B ревью через DevPanel override.

6. **Briefing author/section/podcast-script остаются на MiniMax** — сам MiniMax M2.7 в ~5× дешевле Grok 4.20. Рациональный компромисс: рабочие, проверенные, экономные.

---

## 8. Предварительный план ROADMAP

Финальный ROADMAP пишется после аппрува этого ANALYSIS. Черновик (порядок подтверждён Q-C):

**Этап 1 — Smoke test streamObject (до любых изменений task-assignments)**
- [ ] Создать `scripts/test-grok-streamObject.ts` — изолированный тест streamObject array mode на grok-4-1-fast-non-reasoning
- [ ] Прогнать: валидный stream, корректные элементы, usage promise резолвится
- [ ] Если FAIL на 4.1 Fast — повторить на grok-4.20-0309-non-reasoning (Q-A fallback)
- [ ] `npx tsc --noEmit` → 0 ошибок
- [ ] Удалить тестовый скрипт после прохождения (паттерн v3.91.0)
- [ ] Доложить владельцу результат — какую модель использовать для `util:artifact-suggestions`

**Этап 2 — Миграция «Подсобки» (6 taskId на Grok 4.1 Fast, 1 возможно на 4.20)**
- [ ] `briefing:filter` → grok-4-1-fast-non-reasoning
- [ ] `clerk:task-summary` → grok-4-1-fast-non-reasoning
- [ ] `clerk:file-analyzer` → grok-4-1-fast-non-reasoning
- [ ] `util:title` → grok-4-1-fast-non-reasoning
- [ ] `util:project-summary` → grok-4-1-fast-non-reasoning
- [ ] `util:artifact-suggestions` → grok-4-1-fast-non-reasoning (или 4.20 если Этап 1 показал fallback)
- [ ] Обновить `docs/ai-chats-map.md` (правило feedback_ai_chats_map_sync.md) — **обязательно в той же сессии**
- [ ] `npx tsc --noEmit` → 0 ошибок
- [ ] `npm run build` → успешно (⚠️ auto-migrations — предупредить владельца ДО запуска)
- [ ] **Мануальный тест владельца:** 6 сценариев из §6 risk matrix
- [ ] Commit only after OK

**Этап 3 — Миграция «Зала» (1 taskId на Grok 4.20)**
- [ ] `meeting:summary` → grok-4.20-0309-non-reasoning
- [ ] Обновить `docs/ai-chats-map.md`
- [ ] `npx tsc --noEmit` → 0 ошибок
- [ ] `npm run build` → успешно
- [ ] **Мануальный тест владельца:** прогнать 1 реальную запись встречи через `/meeting`
- [ ] Commit only after OK

**Этап 4 — Финализация**
- [ ] MiniMax catalog audit deliverable зафиксирован (список для XAI-6)
- [ ] Обновить `specs/Simply_xAI/SIMPLY_XAI_ROADMAP.md` (отметить ТЗ-XAI-4 ✅)
- [ ] Обновить `specs/Simply_xAI/SIMPLY_XAI_CHANGELOG.md` запись серии
- [ ] Обновить `SIMPLY_STATUS.md`
- [ ] Обновить корневой `CHANGELOG.md`
- [ ] SQL-проверка `ai_usage_log` — новые `modelId` появляются за последний час работы
- [ ] Bump version v3.92.0
- [ ] `specs/Simply_xAI/HANDOFF.md` обновлён с результатом
- [ ] Архивировать папку `specs/Simply_xAI/TZ_xai_4_UtilityPipelines/` → `_archive/` + обновить `_archive/BACKLOG_CLOSED.md`

**Rule №0 checkpoints:**
- Перед Этапом 1 — владелец одобряет эту ANALYSIS.md
- Перед Этапом 2 — Этап 1 (smoke test streamObject) прошёл
- Перед Этапом 3 — Этап 2 прошёл мануальный тест владельца
- Перед Этапом 4 — Этап 3 прошёл мануальный тест владельца

---

## 9. Принятые решения (ответы владельца 2026-04-16)

**Q-A → Вариант 3: Grok 4.20 как fallback для `util:artifact-suggestions`**
Если smoke test `streamObject` array mode нестабилен на `grok-4-1-fast-non-reasoning` — переключаем эту одну точку на `grok-4.20-0309-non-reasoning`. Не переписываем код, не оставляем на Sonnet. Одна копеечная точка — ставим модель помощнее и забываем. Scope stays locked at 7.

**Q-B → Отложить в XAI-6**
Сейчас задача = переключить модели, не рефакторить паттерны. Legacy workaround `generateText + JSON.parse + Zod` в `briefing:filter` / `clerk:task-summary` / `clerk:file-analyzer` работает и на Grok. Возврат к чистому `generateObject` — отдельный cleanup в XAI-6 после того как всё переключено и стабильно.

**Q-C → Да, подсобка первой**
Сначала 6 подсобочных точек (Grok 4.1 Fast, низкий риск, быстрый feedback). Потом 1 зальная (`meeting:summary` → Grok 4.20). Если что-то пойдёт не так — увидим на дешёвых задачах, не на пользовательском meeting summary.

**Q-D → N/A (артефакты выведены из scope)**
Первоначально вопрос был про JSON adherence артефакт-handlers. После решения вывести все 5 артефактов из ТЗ-XAI-4 — этот вопрос снимается. Если в будущем будет A/B через DevPanel — вопрос JSON adherence вернётся как отдельный smoke test.

---

## 10. Definition of Done

- [ ] Все 7 taskId в scope указывают на целевые модели в `lib/ai/task-assignments.ts`
- [ ] `npx tsc --noEmit` → 0 ошибок после каждого этапа
- [ ] `npm run build` → успешно
- [ ] Мануальный тест владельца пройден для каждого этапа
- [ ] `docs/ai-chats-map.md` синхронизирован с новыми моделями (обязательно — правило feedback_ai_chats_map_sync.md)
- [ ] `ai_usage_log` показывает записи с новыми `modelId` за последний час работы
- [ ] SIMPLY_XAI_ROADMAP.md + SIMPLY_XAI_CHANGELOG.md + SIMPLY_STATUS.md + корневой CHANGELOG.md обновлены
- [ ] MiniMax catalog audit deliverable зафиксирован (для XAI-6)
- [ ] HANDOFF.md обновлён с результатом сессии

---

**Ждёт:** ревью владельца + ответы на Q-A, Q-B, Q-C, Q-D.
