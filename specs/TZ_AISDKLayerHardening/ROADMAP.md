# Roadmap ТЗ-AISDKLayerHardening — укрепление слоя AI SDK invocations

**Создан:** 2026-04-17
**Версия проекта:** 3.92.2 → 3.93.0
**Статус:** Готов к Фазе 3 (ожидает апрува владельца)

---

## Обзор

| Метрика | Значение |
|---|---|
| Этапов | 4 (3 содержательных + финализация) |
| Текущий этап | 1 (Этап 1 — DevOverrides cleanup) |
| Сессий (оценка) | 3-4 |
| Базовый коммит | `43ed3d0` (master) |

---

## Принципы выполнения (подтверждено владельцем)

1. **Gate-keeping строго.** После каждого этапа: `tsc --noEmit` → `npm run build` → git commit → мануальный тест владельцем → OK → следующий этап. Ни одна отметка `[x]` без реальной проверки.
2. **Официальная документация ДО работы** (Правило 1 WORKFLOW). Уже проверены: Next.js instrumentation.ts, AI SDK v6 streamText, Anthropic streaming threshold, @ai-sdk/anthropic 3.0.66 default. Зафиксировано в [ANALYSIS.md § «Изученная документация»](ANALYSIS.md).
3. **Никаких костылей.** Архитектурно правильные решения, даже если дороже по времени.
4. **Находки вне scope → FINDINGS.md СРАЗУ** (Правило 8). Не «заодно чиним», не «потом вспомним».
5. **`npm run build` в Simply = `tsx lib/db/migrate && next build`** (Правило из MEMORY). Запускаем только когда dev сервер остановлен + предупреждаем владельца.

---

## Этап 1: DevOverrides cleanup

**Статус:** ⬜ Не начат
**Оценка:** 0.5 сессии

**Контекст:** `instrumentation.ts` уже реализует Вариант C (коммит `c4b2b63`). 7 routes продолжают нести redundant side-effect import, ADR 048 описывает устаревшее состояние, README в backlog имеет сломанную ссылку. Этап — гигиена + фиксация SSOT.

**Цель:** Единственным местом регистрации reader-а остаётся `instrumentation.ts`. ADR 048 отражает новое состояние. Backlog README чист.

**Задачи:**

- [ ] 1.1. Добавить в `instrumentation.ts` комментарий-маяк: «Единственное место регистрации `model-overrides-node`. Не дублировать в routes — см. ADR 048 раздел Overrides Reader Registration». (условие владельца)
- [ ] 1.2. Удалить redundant side-effect импорт `import "@/lib/ai/model-overrides-node";` из 7 routes:
  - `app/(chat)/api/chat/route.ts:31`
  - `app/(chat)/api/projects/[id]/plan/route.ts:35` (заодно удалить многословный комментарий про hot-fix)
  - `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts:21`
  - `app/(chat)/api/briefing/generate/route.ts:15`
  - `app/(chat)/api/briefing/refresh-section/route.ts:27`
  - `app/api/cron/briefing/route.ts:24`
  - `app/(chat)/api/service-chat/route.ts:69`
- [ ] 1.3. Обновить ADR 048:
  - Удалить раздел «Постскриптум (2026-04-14, сессия 3)» — он отрицает проблему которая позже подтвердилась и закрыта через instrumentation.ts
  - Заменить L94-102 актуальным описанием: «Reader регистрируется через `instrumentation.ts` (boot-time hook Next.js 15). Единая точка регистрации гарантирует покрытие всех routes и Server Actions без per-route импорта»
  - Добавить ссылку на коммит `c4b2b63`
- [ ] 1.4. Удалить сломанную ссылку на `TZ_DevOverridesSideEffectImportAudit.md` из `specs/_backlog/README.md` (строка 40). Файл в `_backlog/_archive/`.
- [ ] 1.5. Обновить `specs/_backlog/README.md` — удалить записи `TZ_MaxOutputTokensAudit` и `TZ_ProfessorPlanStreaming` (вошли в umbrella ТЗ).

**Файлы:**
- `instrumentation.ts` — маяк-комментарий
- 7 routes — удаление импорта
- `docs/decisions/048-dev-switchboard-ui.md` — актуализация
- `specs/_backlog/README.md` — cleanup

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен (предупредить владельца, запускать после остановки dev)
- [ ] Smoke test (Claude): временно закомментировать в `instrumentation.ts` регистрацию → `npm run dev` → через `/dev/models` установить override для `professor:planning` на Haiku → позвать plan endpoint → SQL `ai_usage_log` проверка что модель == default Opus (override игнорируется без registration) → раскомментировать → повторить → модель == Haiku (override применяется)
- [ ] 🧪 Мануальный тест владельцем:
  1. Открой `/dev/models`
  2. Установи override для `util:title` на Haiku
  3. Создай новый чат, отправь сообщение
  4. Через минуту проверь что заголовок чата сгенерировался (факт работы route)
  5. Проверь `SELECT modelId FROM ai_usage_log WHERE chatMode='util:title' ORDER BY createdAt DESC LIMIT 1;` — должен быть Haiku
  6. Сбрось override через UI

**Git (после валидации):**
```bash
git add instrumentation.ts docs/decisions/048-dev-switchboard-ui.md specs/_backlog/README.md app/(chat)/api/chat/route.ts app/(chat)/api/projects/[id]/plan/route.ts app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts app/(chat)/api/briefing/generate/route.ts app/(chat)/api/briefing/refresh-section/route.ts app/api/cron/briefing/route.ts app/(chat)/api/service-chat/route.ts
git commit -m "chore(tz-aisdk): centralize overrides reader registration in instrumentation.ts"
```

**Критерий готовности:** `grep -rn 'import "@/lib/ai/model-overrides-node"' app/ lib/` возвращает 0 строк. Smoke test + мануальный тест подтверждают, что overrides работают только через instrumentation.ts.

---

## Этап 2: MaxOutputTokens SSOT + getter + 36 call sites

**Статус:** ⬜ Не начат
**Оценка:** 1.5-2 сессии

⛔ **НЕ НАЧИНАТЬ без подтверждения Этапа 1**

**Цель:** Каждый AI call site в проекте декларирует `maxOutputTokens` явно через SSOT getter. Неявных defaults не остаётся.

### 2.1 Cap table (для ревью владельцем перед работой)

| TaskId | Cap (tokens) | Обоснование |
|---|---|---|
| **Simply Chat** |  |  |
| `simply-chat` | `8192` | Основной продуктовый чат, Grok 4.1 Fast. Типичные ответы 1-4K, 8K даёт запас без runaway. |
| `simply-chat-think` | `16384` | Кнопка «Думать» — Grok 4.20 reasoning. Глубокий анализ часто длиннее чем быстрый ответ. |
| `simply-chat-vision` | `4096` | Haiku vision. Ответы по изображениям обычно короткие (OCR + summary). |
| **Expertise / Create / Multi-agent** |  |  |
| `expertise` | `16384` | Grok 4.20 reasoning, экспертные ответы развёрнутые. |
| `expertise-multi-agent` | `16384` | RESERVED placeholder. Реальное значение будет установлено в ТЗ-XAI-MA-1 когда появится call site. |
| `create` | `16384` | Grok 4.20 reasoning, генерация длинных материалов. |
| **Project expert chat (tier)** |  |  |
| `project:expert:haiku` | `8192` | Haiku tier — лёгкие вопросы по задаче. |
| `project:expert:sonnet` | `16384` | Sonnet tier — средняя глубина. |
| `project:expert:opus` | `32000` | Opus tier — пользователь платит за максимальное качество. Разумный ceiling без риска таймаута (streaming, не попадает под 21333 threshold). |
| **Professor pipeline** |  |  |
| `professor:planning` | `32000` | Opus 4.6 adaptive thinking + план на 10+ задач + plan_json. Выбрано больше tactical 16000 (который ограничивал) но конечно. Используется в Этапе 3 после перехода на streamText. |
| `professor:review` | `8192` | Analysis text по задаче. |
| `professor:pipeline-analyze` | `4096` | Список subtasks, короткий JSON. |
| `professor:pipeline-execute` | `8192` | Работа над одной subtask. |
| `professor:pipeline-synthesize` | `16000` | Финальный synthesis из результатов subtasks. |
| **Clerks** |  |  |
| `clerk:task-summary` | `2048` | Короткий multiline summary завершённой задачи. |
| `clerk:file-analyzer` | `4096` | JSON-анализ загруженного файла. |
| **Memory (MIND / RAG)** |  |  |
| `memory:extract` | `4096` | `generateObject` JSON facts list per-message. |
| `memory:extract-batch` | `8192` | Batch extraction при compression — больше объём входа, больше facts. |
| `memory:consolidate` | `4096` | JSON консолидация. |
| `memory:profile` | `4096` | Narrative profile JSON. |
| `memory:dedup-verify` | `512` | Haiku верификация дедупликации — ответ крошечный (решение + причина). |
| **Briefing / Podcast** |  |  |
| `briefing:filter` | `1024` | JSON список IDs, ничего больше. |
| `briefing:author` | `8192` | **Особый случай:** в call site остаётся dynamic `MAX_TOKENS_BY_VOLUME[volume]` (бизнес-логика объёма). SSOT значение 8192 = fallback + документация намерения. Dynamic вычисление сохраняется. |
| `briefing:section` | `8192` | Уже явный. |
| `briefing:podcast-script` | `4096` | Уже явный. |
| **Meeting** |  |  |
| `meeting:summary` | `8192` | Уже явный. |
| **Service chats** |  |  |
| `service-chat:ben` | `4096` | Conversational. Бен под deprecation, но пока живой. |
| `service-chat:project-creation` | `8192` | Onboarding с развёрнутыми ответами. |
| `service-chat:project-manager` | `4096` | Короткие менеджерские реплики. |
| `service-chat:briefing-onboarding` | `8192` | Onboarding brief. |
| **Утилиты** |  |  |
| `util:title` | `64` | Название чата 1-3 слов ≤ 32 chars. Tight cap защищает от runaway. |
| **Artifacts (document handlers)** |  |  |
| `artifact:text` | `16384` | Текстовые документы. |
| `artifact:markdown` | `16384` | Markdown статьи могут быть длинные. |
| `artifact:excel` | `8192` | CSV-подобный формат, компактнее. |
| `artifact:pptx` | `16384` | Презентации с расширенным контентом. |
| `artifact:reveal` | `16384` | Reveal презентации. |
| **Vision** |  |  |
| `vision:ocr` | `4096` | Полный текст PDF может быть длинным. Haiku + non-streaming — cap критичен (иначе 64K capability = timeout-bomb риск). |

**Итого 37 taskId.** Для передвижки любого cap в будущем — одна правка в `DEFAULT_MAX_OUTPUT_TOKENS`.

### 2.2 Задачи этапа

- [ ] 2.1. Создать `DEFAULT_MAX_OUTPUT_TOKENS: Record<TaskId, number>` в [lib/ai/task-assignments.ts](../../lib/ai/task-assignments.ts) со значениями из cap table выше. TypeScript `Record<TaskId, number>` гарантирует compile-time check — при добавлении нового TaskId build упадёт без записи. (условие владельца)
- [ ] 2.2. Экспортировать getter `getMaxOutputTokensForTask(taskId: TaskId): number` из [lib/ai/getModel.ts](../../lib/ai/getModel.ts). Простая реализация: return `DEFAULT_MAX_OUTPUT_TOKENS[taskId]`.
- [ ] 2.3. Обновить все 36 call sites чтобы использовали getter (кроме `briefing:author` который остаётся с dynamic вычислением):
  - [ ] 2.3.1. **Artifacts (5 файлов, 10 call sites):** text/markdown/excel/presentation-reveal/presentation-pptx
  - [ ] 2.3.2. **Professor pipeline (3 вызова):** analyze/execute/synthesize
  - [ ] 2.3.3. **Professors/Clerks (2 вызова):** task-reviewer, task-summarizer
  - [ ] 2.3.4. **Memory (5 вызовов):** extract.ts × 3, consolidate.ts, profile.ts
  - [ ] 2.3.5. **Vision (2 вызова):** vision-ocr.ts
  - [ ] 2.3.6. **Briefing filter (1 вызов):** briefing-filter.ts (briefing-author НЕ трогаем — оставляем dynamic)
  - [ ] 2.3.7. **Backend routes (8 вызовов):** chat/route.ts × 2, service-chat/route.ts, assistant/ben, tasks/chat/route.ts, analyze-file/route.ts, generate-title/route.ts, actions.ts
- [ ] 2.4. Сохранить tactical `maxOutputTokens: 16000` в plan/route.ts как есть — он убирается в Этапе 3 при переходе на streamText. Альтернативно можно в этапе 2 перевести на `getMaxOutputTokensForTask("professor:planning")` = 32000 (Этап 3 всё равно пересмотрит эту строку). Выбираю **оставить как 16000** чтобы не сломать текущий работающий hot-fix до Этапа 3.
- [ ] 2.5. Верификация покрытия: `grep -rn '(generateText|streamText|generateObject|streamObject)\s*\(' lib/ app/ artifacts/ --include="*.ts"` → для каждой строки проверить что maxOutputTokens проставлен. Результат в CHANGELOG.
- [ ] 2.6. Обновить [specs/Simply_xAI/SIMPLY_PROMPTS_AND_MODEL_CONFIG.md § 4.2](../Simply_xAI/SIMPLY_PROMPTS_AND_MODEL_CONFIG.md) с финальной cap table.

**Файлы:**
- `lib/ai/task-assignments.ts` — SSOT
- `lib/ai/getModel.ts` — getter
- 24 файла с call sites (см. ANALYSIS.md инвентаризацию)
- `specs/Simply_xAI/SIMPLY_PROMPTS_AND_MODEL_CONFIG.md` — документация

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок (включая compile-time check `Record<TaskId, number>`)
- [ ] `npm run build` — успешен (после остановки dev)
- [ ] Grep-test: `grep -rn '(generateText|streamText|generateObject|streamObject)' lib/ app/ artifacts/ | grep -v '\.d\.ts'` → каждый результат имеет `maxOutputTokens:` в пределах 10 строк
- [ ] 🧪 Мануальный тест владельцем:
  1. Отправь сообщение в Simply (обычный чат) → ответ приходит, заголовок чата генерируется → ok
  2. Открой экспертизу → задай вопрос → ответ приходит → ok
  3. Создай документ (artifact: markdown) → генерируется → ok
  4. Попробуй briefing (если есть активная тема) → генерируется → ok
  5. `SELECT modelId, outputTokens FROM ai_usage_log ORDER BY createdAt DESC LIMIT 10;` — проверить что outputTokens не зашкаливает (нет 100K+ ответов)

**Git (после валидации):**
```bash
git add lib/ai/task-assignments.ts lib/ai/getModel.ts lib/ lib/ai/memory/ lib/ai/professors/ lib/ai/clerks/ artifacts/ app/ specs/Simply_xAI/SIMPLY_PROMPTS_AND_MODEL_CONFIG.md
git commit -m "feat(tz-aisdk): explicit maxOutputTokens SSOT + 36 call sites"
```

**Критерий готовности:** grep не находит ни одного AI call site без явного `maxOutputTokens`. Cap table задокументирована в SIMPLY_PROMPTS_AND_MODEL_CONFIG.md.

---

## Этап 3: plan/route.ts → streamText

**Статус:** ⬜ Не начат
**Оценка:** 1-1.5 сессии

⛔ **НЕ НАЧИНАТЬ без подтверждения Этапа 2** (использует getter из 2.2)

**Цель:** `plan/route.ts` работает через `streamText` с adaptive thinking. Tactical cap 16000 заменён на `getMaxOutputTokensForTask("professor:planning") = 32000`.

**Задачи:**

- [ ] 3.1. Переписать вызов `generateText(...)` в [app/(chat)/api/projects/[id]/plan/route.ts:191-208](../../app/(chat)/api/projects/[id]/plan/route.ts#L191) на `streamText`:
  - Импорт `import { streamText } from "ai"`
  - Вызов `const stream = streamText({ model, system, prompt, temperature, maxOutputTokens: getMaxOutputTokensForTask("professor:planning"), providerOptions: { anthropic: { thinking: { type: "adaptive" }, effort: "high" } } })`
  - `const text = await stream.text`
  - `const usage = await stream.usage`
- [ ] 3.2. Обновить `extractTag(text, ...)` — сигнатура не меняется, работает с accumulated text.
- [ ] 3.3. Удалить многословный комментарий `ТЗ-XAI-4 hot-fix (2026-04-16)...` (строки 179-190) — заменить короткой ссылкой на ADR 048 и новый ADR (см. финализация).
- [ ] 3.4. `logUsage({ usage, ... })` — остаётся вызов, передаёт `usage` из streamText. Проверить что `reasoningTokens` попадает в лог (поле `thinkingTokens` в ai_usage_log через `extractUsageFields`).
- [ ] 3.5. Смоук-тест: создать проект с 10+ задачами → нажать «Создать план» → убедиться что план генерируется за <60s без socket errors, парсинг `<plan_report>` и `<plan_json>` работает.

**Файлы:**
- `app/(chat)/api/projects/[id]/plan/route.ts` — переписать вызов
- (опционально) `docs/decisions/NNN-streamtext-for-adaptive-thinking.md` — если решаем делать ADR (см. финализация)

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] 🧪 Мануальный тест владельцем:
  1. Открой проект с 10+ задачами (или создай новый с manifest из 5+ файлов)
  2. Нажми «Создать план»
  3. Дождись завершения (ожидание: <60s, без ошибок)
  4. Проверь что план показан в UI и сохранён в БД:
     `SELECT id, planReport IS NOT NULL AS has_report, jsonb_array_length(planJson->'subtasks') AS task_count FROM project WHERE id='...';`
  5. `SELECT modelId, inputTokens, outputTokens, thinkingTokens, costUsd FROM ai_usage_log WHERE chatMode='professor:planner' ORDER BY createdAt DESC LIMIT 1;` — thinkingTokens > 0 (adaptive thinking работает), outputTokens в разумных пределах (<32000)

**Git (после валидации):**
```bash
git add app/(chat)/api/projects/[id]/plan/route.ts
git commit -m "feat(tz-aisdk): plan/route.ts → streamText with adaptive thinking"
```

**Критерий готовности:** plan/route.ts работает через streamText. Smoke test на реальном проекте завершается <60s. `thinkingTokens > 0` в ai_usage_log.

---

## Этап 4: Финализация

**Статус:** ⬜ Не начат
**Оценка:** 0.5 сессии

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../../DOCUMENTATION_GUIDE.md) — пройти чеклист.

### 4.1 Проверка БД (Claude)

```sql
-- Последние записи по затронутым taskIds
SELECT chatMode, modelId, outputTokens, costUsd, createdAt
FROM ai_usage_log
WHERE chatMode IN ('professor:planner', 'util:vision-ocr', 'util:title')
ORDER BY createdAt DESC LIMIT 20;

-- Убедиться что нет записей с outputTokens > 32000 за последние 24h (runaway detection)
SELECT chatMode, modelId, outputTokens, createdAt
FROM ai_usage_log
WHERE outputTokens > 32000 AND createdAt > NOW() - INTERVAL '24 hours'
ORDER BY outputTokens DESC;
```

### 4.2 Мануальные тесты (владелец)

**Golden path (3 самых критичных):**
1. Simply chat — отправить сообщение, получить ответ, проверить автозаголовок
2. Professor planning — создать план на проекте с 10+ задачами, <60s
3. Briefing — если есть активная тема, дождаться generation cycle

**Cost sanity:**
4. `SELECT chatMode, SUM(costUsd) FROM ai_usage_log WHERE createdAt > NOW() - INTERVAL '1 hour' GROUP BY chatMode ORDER BY SUM(costUsd) DESC;` — проверить что нет аномально дорогих chatMode

### 4.3 FINDINGS.md → backlog (Правило 8 + 9)

- [ ] Если FINDINGS.md создавался — каждую значимую находку оформить как `specs/_backlog/TZ_<name>.md`
- [ ] Обновить `specs/_backlog/README.md` (индекс по impact)

Ожидаемые находки:
- Потенциальный дубль `util:title` (actions.ts + generate-title/route.ts)
- Потенциальная ревизия memory:dedup-verify cap (512) после первой недели в проде

### 4.4 Документация

**Обязательная:**
- [ ] ⛔ Прочитать DOCUMENTATION_GUIDE.md — пройти чеклист
- [ ] Обновить главный `CHANGELOG.md`:
  ```
  ### [3.93.0] - 2026-04-XX — ТЗ-AISDKLayerHardening
  - chore(aisdk): centralized overrides reader registration in instrumentation.ts (removed 7 redundant side-effect imports)
  - feat(aisdk): explicit maxOutputTokens SSOT (`DEFAULT_MAX_OUTPUT_TOKENS`) + getter `getMaxOutputTokensForTask()` + 36 call sites migrated
  - feat(aisdk): plan/route.ts migrated from generateText to streamText with adaptive thinking (replaces tactical cap 16000 with SSOT 32000)
  ```
- [ ] Обновить `SIMPLY_STATUS.md` (snapshot — таблица компонентов, не история)
- [ ] ⛔ **CLAUDE.md — НЕ редактировать** (`wc -l CLAUDE.md` ≤ 220, иначе STOP)
- [ ] Обновить `package.json` version: 3.92.2 → 3.93.0

**По Правилу 6 (docs/ по файлам-триггерам):**

Файлы-триггеры в diff:
- `lib/ai/task-assignments.ts` → `docs/ai-chats-map.md`, `docs/architecture.md` (новая SSOT)
- `lib/ai/getModel.ts` → `docs/architecture.md` (getter API)
- `instrumentation.ts` — если впервые полноценный контент, обновить `docs/architecture.md` / ADR 048

- [ ] `docs/ai-chats-map.md` — раздел моделей не меняется (это ТЗ про output cap, не модели). Но в Реестре конфигураций добавить колонку/абзац про `DEFAULT_MAX_OUTPUT_TOKENS`.
- [ ] `docs/architecture.md` — добавить упоминание `DEFAULT_MAX_OUTPUT_TOKENS` + `getMaxOutputTokensForTask()` в разделе AI / Chat core.
- [ ] `docs/decisions/048-dev-switchboard-ui.md` — уже обновлён в Этапе 1.

**ADR (новый, если владелец согласен):**
- [ ] `docs/decisions/NNN-aisdk-layer-hardening.md` — зафиксировать три архитектурных решения этого ТЗ:
  1. Регистрация overrides reader через `instrumentation.ts` (not per-route)
  2. Обязательный explicit `maxOutputTokens` через SSOT
  3. streamText для adaptive thinking (not generateText)

  Обоснование ADR: три решения касаются общего паттерна (AI SDK invocations contract), будут референсом для будущих routes.

### 4.5 Архивирование

- [ ] Переместить `specs/TZ_AISDKLayerHardening/` → `_archive/TZ_AISDKLayerHardening/`
- [ ] Добавить запись в `_archive/BACKLOG_CLOSED.md` (3 долга закрыты одним umbrella)
- [ ] Убедиться что `specs/_backlog/README.md` не содержит ссылок на закрытые файлы

**Валидация финализации:**
- [ ] `npm run build` — успешен
- [ ] Production URL работает (после деплоя)
- [ ] `wc -l CLAUDE.md` ≤ 220
- [ ] `grep -rn 'import "@/lib/ai/model-overrides-node"' app/ lib/` = 0 результатов
- [ ] `grep -rn '(generateText|streamText|generateObject|streamObject)\s*\(' lib/ app/ artifacts/` — каждый результат имеет `maxOutputTokens:`

**Git финализации:**
```bash
# Commits последовательно по этапам (уже сделаны в этапах 1-3)
# Финализация — один коммит с docs + version bump
git add CHANGELOG.md SIMPLY_STATUS.md package.json docs/ specs/_backlog/README.md _archive/
git commit -m "docs(tz-aisdk): finalize AI SDK layer hardening — 3.93.0"
```

---

## Риски (сводка из ANALYSIS)

| # | Риск | Минимизация |
|---|---|---|
| 1 | Регрессия artifacts при cap | Щедрые значения 16384, SSOT меняется одной строкой |
| 2 | Дубль util:title расходится по поведению | Одинаковый cap 64 для обоих, записать в FINDINGS для unification |
| 3 | streamText меняет result semantics в plan/route.ts | Smoke test на реальном проекте, SQL-проверка thinkingTokens |
| 4 | Удаление side-effect imports ломает dev overrides | Smoke test до удаления (коммент-декоммент instrumentation.ts) |

---

## Gate-keeping (копия из WORKFLOW для удобства)

```
⛔ НЕЛЬЗЯ начинать следующий этап пока:
1. ✅ Все задачи текущего этапа отмечены [x]
2. ✅ npm run build проходит успешно
3. ✅ npx tsc --noEmit — 0 ошибок
4. ✅ Git commit сделан (фиксация этапа)
5. ✅ Владелец подтвердил мануальный тест
6. ✅ Обновлён CHANGELOG.md (локальный)
7. ✅ Обновлён HANDOFF.md
```
