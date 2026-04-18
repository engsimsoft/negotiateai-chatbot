# Roadmap ТЗ-AISDKLayerHardening — укрепление слоя AI SDK invocations

**Создан:** 2026-04-17
**Версия проекта:** 3.92.2 → 3.93.0
**Статус:** Этап 1 закрыт (коммит `a20ad29`). Следующий — Этап 2.

---

## Обзор

| Метрика | Значение |
|---|---|
| Этапов | 4 (3 содержательных + финализация) |
| Текущий этап | 2 (Этап 1 закрыт) |
| Сессий (оценка) | 3-4 |
| Базовый коммит | `43ed3d0` (master) |

---

## Принципы выполнения (подтверждено владельцем)

1. **Официальная документация ДО внедрения.** Перед ЛЮБОЙ правкой, затрагивающей внешнюю технологию (SDK, API, фреймворк), сначала читать первоисточник — WebSearch + WebFetch + исходники в `node_modules`. Работа по памяти = провал. В этом ТЗ уже проверены: Next.js instrumentation.ts, AI SDK v6 createUIMessageStream lifecycle, @ai-sdk/anthropic 3.0.66 streaming threshold. Все находки — в [ANALYSIS.md](ANALYSIS.md).
2. **Никаких костылей и заплаток.** Только архитектурно правильные решения. Если нашёл band-aid в существующем коде — устраняем, а не обходим. Быстрые фиксы запрещены даже под давлением дедлайна.
3. **Gate-keeping строго.** После каждого этапа: `tsc --noEmit` → `npm run build` → git commit → **обязательный мануальный тест владельцем** → OK → следующий этап. Мануальный тест обязателен на КАЖДОМ этапе (не только в финализации). Ни одна отметка `[x]` без реальной проверки владельцем.
4. **Находки вне scope → FINDINGS.md СРАЗУ** (Правило 8 WORKFLOW). Не «заодно чиним», не «потом вспомним».
5. **`npm run build` в Simply = `tsx lib/db/migrate && next build`** (Правило из MEMORY). Запускаем только когда dev сервер остановлен + предупреждаем владельца.

---

## Этап 1: DevOverrides cleanup ✅ ЗАКРЫТ (коммит `a20ad29`)

**Статус:** ✅ Закрыт 2026-04-17. End-to-end валидация подтвердила работу overrides.
**Фактически ушло:** 1 сессия + бонус-находка (HMR-баг + DevPanel auto-naming).

**Цель была:** Единственным местом регистрации reader-а остаётся `instrumentation.ts`. ADR 048 отражает новое состояние. Backlog README чист.

**Задачи:**

- [x] 1.1. Добавить в `instrumentation.ts` комментарий-маяк о единственной точке регистрации reader-а.
- [x] 1.2. Удалить redundant side-effect импорт `import "@/lib/ai/model-overrides-node";` из 7 routes (chat, plan, tasks/chat, briefing generate, briefing refresh-section, cron/briefing, service-chat).
- [x] 1.3. Обновить ADR 048 — удалён устаревший постскриптум, актуализировано описание SSOT-регистрации через instrumentation.ts.
- [x] 1.4. Удалить сломанную ссылку на `TZ_DevOverridesSideEffectImportAudit.md` из `specs/_backlog/README.md` (файл уже в `_archive/`).
- [x] 1.5. Удалить записи `TZ_MaxOutputTokensAudit` и `TZ_ProfessorPlanStreaming` из `specs/_backlog/README.md` (вошли в umbrella ТЗ).

**Бонус-находки (закрыты в том же коммите, архитектурные):**

- [x] **HMR regression fix** — после удаления 7 side-effect импортов в dev сломались overrides: Next.js HMR пересоздавал `lib/ai/model-overrides.ts` на каждом hot-reload, module-level `activeOverridesReader` сбрасывался в no-op. Раньше 7 side-effect импортов маскировали проблему (перезапускали регистрацию при hot-reload route). Фикс — вынесение reader в `globalThis.__simplyOverridesReader` (HMR-immune). Production (без HMR) не затронут.
- [x] **Diagnostic endpoint** `/api/dev/resolve-model?taskId=<id>` — возвращает runtime `{ effectiveModelId, defaultModelId, overrideActive }` без AI-вызова. Помог эмпирически обнаружить HMR-баг и валидировать фикс.
- [x] **DevPanel auto-naming visibility** — sub-call `util:auto-naming` не отображался в Timeline. Причина (из исходников AI SDK `handle-ui-message-stream-finish.ts`): `createUIMessageStream.onFinish` вызывается в `flush()` TransformStream уже после `controller.close()`, поздние writes молча глотаются `safeEnqueue`. Фикс: перенос `autoNameChat` в `streamText.onFinish` (writer ещё открыт через активный merged stream). `autoNameChat` принимает текст ассистента напрямую чтобы сохранить прежний min-count gate.

**Файлы:**
- `instrumentation.ts` — маяк-комментарий
- 7 routes — удаление импорта
- `docs/decisions/048-dev-switchboard-ui.md` — актуализация
- `specs/_backlog/README.md` — cleanup

**Валидация этапа (факт):**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] Empirical curl на `/api/dev/resolve-model?taskId=util:title` → `overrideActive: true`, `effectiveModelId: grok-4-1-fast-reasoning`
- [x] 🧪 Мануальный тест владельцем (новый expertise/create чат, 4+ сообщений):
  - В DevPanel Timeline появилась строка `tool:util:auto-naming Grok 4.1F·R 1624 tok stop` (·R = override reasoning variant, не default non-reasoning)
  - SQL: `SELECT modelId FROM ai_usage_log WHERE chatMode='util:auto-naming' ORDER BY createdAt DESC LIMIT 1;` → `grok-4-1-fast-reasoning` ✅

**Git:** коммит `a20ad29` — `fix(tz-aisdk-stage1): HMR-proof overrides reader + centralize registration + make DevPanel show auto-naming`

**Критерий готовности (выполнен):** `grep -rn 'import "@/lib/ai/model-overrides-node"' app/ lib/` → 0 строк. Empirical endpoint + мануальный тест владельцем подтверждают end-to-end работу overrides включая `util:title`.

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
| `simply-chat-think` | `16000` | Кнопка «Думать» — Grok 4.20 reasoning. Потолок capability Grok. |
| `simply-chat-vision` | `4096` | Haiku vision. Ответы по изображениям обычно короткие (OCR + summary). |
| **Expertise / Create / Multi-agent** |  |  |
| `expertise` | `16000` | Grok 4.20 reasoning, экспертные ответы развёрнутые. Потолок capability Grok. |
| `expertise-multi-agent` | `16000` | RESERVED placeholder. Потолок capability Grok multi-agent (капа уточняется в ТЗ-XAI-MA-1 когда появится call site). |
| `create` | `16000` | Grok 4.20 reasoning, генерация длинных материалов. Потолок capability Grok. |
| **Project expert chat (tier)** |  |  |
| `project:expert:haiku` | `8192` | Haiku tier — лёгкие вопросы по задаче. |
| `project:expert:sonnet` | `16384` | Sonnet tier — средняя глубина. |
| `project:expert:opus` | `32000` | Opus tier — пользователь платит за максимальное качество. Разумный ceiling без риска таймаута (streaming, не попадает под 21333 threshold). |
| **Professor pipeline** |  |  |
| `professor:planning` | `32000` | Opus 4.6 adaptive thinking + план на 10+ задач + plan_json. Выбрано больше tactical 16000 (который ограничивал) но конечно. Используется в Этапе 3 после перехода на streamText. |
| `professor:review` | `8192` | Analysis text по задаче. |
| `professor:pipeline-analyze` | `4096` | Список subtasks, короткий JSON. |
| `professor:pipeline-execute` | `8192` | Работа над одной subtask. |
| `professor:pipeline-synthesize` | `16000` | Финальный synthesis из результатов subtasks. Потолок capability Grok. |
| **Clerks** |  |  |
| `clerk:task-summary` | `2048` | Короткий multiline summary завершённой задачи. |
| `clerk:file-analyzer` | `4096` | JSON-анализ загруженного файла. |
| **Memory (MIND / RAG)** |  |  |
| `memory:extract` | `4096` | `generateObject` JSON facts list per-message. |
| `memory:extract-batch` | `16000` | Batch extraction при compression: `MAX_BATCH_FACTS=30` × ~500 токенов/факт = ~15K. Cap 8192 = timeout-bomb (JSON обрезается в середине), 4096 хватает только на 10 фактов. 16000 = потолок capability Grok 4.1 Fast, дают 30 фактам развернуться. |
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

**Согласование с capability моделей (проверено против [lib/ai/model-catalog.ts](../../lib/ai/model-catalog.ts) 2026-04-18):** каждое значение в таблице ≤ `maxOutput` своей default-модели. 6 taskId на Grok упёрты в потолок 16000 (Grok 4.20 reasoning / Grok 4.1 Fast / Grok 4.20 multi-agent все имеют `maxOutput: 16_000`). Safety-net в getter (см. задачу 2.2) защитит runtime при переключении default-модели через `/dev/models` или смене `DEFAULT_TASK_MODELS` — но cap table в SSOT должна отражать реалистичный потолок, а не «хотелку».

### 2.2 Задачи этапа

- [x] 2.1. Создать `DEFAULT_MAX_OUTPUT_TOKENS: Record<TaskId, number>` в [lib/ai/task-assignments.ts](../../lib/ai/task-assignments.ts) со значениями из cap table выше. TypeScript `Record<TaskId, number>` гарантирует compile-time check — при добавлении нового TaskId build упадёт без записи. (условие владельца)
- [x] 2.2. Экспортировать getter `getMaxOutputTokensForTask(taskId: TaskId): number` из [lib/ai/getModel.ts](../../lib/ai/getModel.ts) с **двухслойной safety-net**:
  ```ts
  export function getMaxOutputTokensForTask(taskId: TaskId): number {
    const requested = DEFAULT_MAX_OUTPUT_TOKENS[taskId];
    const modelId = getModelIdForTask(taskId); // учитывает override
    const entry = resolveModelEntry(modelId);
    const capability = entry?.maxOutput ?? requested;
    const effective = Math.min(requested, capability);

    // Anthropic non-streaming threshold — при cap > 21333 call site ОБЯЗАН
    // использовать streamText/streamObject (см. ADR AI SDK invocation contract).
    if (entry?.provider === "anthropic" && effective > 21333) {
      warnOnce(taskId, `[${taskId}] cap ${effective} > 21333 with Anthropic — call site MUST use streamText/streamObject`);
    }
    return effective;
  }
  ```
  - **Math.min к capability** — защищает от смены default-модели через `/dev/models` или правки `DEFAULT_TASK_MODELS`, при которой cap окажется выше capability новой модели (runtime, без краха).
  - **warnOnce через `Set<TaskId>` сеен** — логируется один раз на процесс. Предупреждение для dev (обязывает перейти на streaming); production не крашится.
- [x] 2.3. Обновить все 36 call sites чтобы использовали getter (кроме `briefing:author` который остаётся с dynamic вычислением):
  - [x] 2.3.1. **Artifacts (5 файлов, 10 call sites):** text/markdown/excel/presentation-reveal/presentation-pptx
  - [x] 2.3.2. **Professor pipeline (3 вызова):** analyze/execute/synthesize
  - [x] 2.3.3. **Professors/Clerks (2 вызова):** task-reviewer, task-summarizer
  - [x] 2.3.4. **Memory (5 вызовов):** extract.ts × 3, consolidate.ts, profile.ts
  - [x] 2.3.5. **Vision (2 вызова):** vision-ocr.ts
  - [x] 2.3.6. **Briefing filter (1 вызов):** briefing-filter.ts (briefing-author НЕ трогаем — оставляем dynamic). Заодно переведены уже-явные `briefing:section`, `briefing:podcast-script`, `meeting:summary` с литералов на getter — для консистентности SSOT.
  - [x] 2.3.7. **Backend routes (8 вызовов):** chat/route.ts × 2, service-chat/route.ts, assistant/ben, tasks/chat/route.ts, analyze-file/route.ts, generate-title/route.ts, actions.ts
- [x] 2.4. Сохранить tactical `maxOutputTokens: 16000` в plan/route.ts как есть — он убирается в Этапе 3 при переходе на streamText.
- [x] 2.5. Верификация покрытия: каждый production AI SDK call site имеет `maxOutputTokens` (grep count AI calls == count maxOutputTokens в 25 production файлах, scripts/ исключены). Единственное исключение — `briefing:author` сохраняет dynamic `MAX_TOKENS_BY_VOLUME[volume]` по задизайну.
- [x] 2.6. Обновил [specs/Simply_xAI/SIMPLY_PROMPTS_AND_MODEL_CONFIG.md § 4.2](../Simply_xAI/SIMPLY_PROMPTS_AND_MODEL_CONFIG.md) — раздел переписан под SSOT-архитектуру (`DEFAULT_MAX_OUTPUT_TOKENS` + getter + двухслойная safety-net + полная таблица 37 taskId).

**Файлы:**
- `lib/ai/task-assignments.ts` — SSOT
- `lib/ai/getModel.ts` — getter
- 24 файла с call sites (см. ANALYSIS.md инвентаризацию)
- `specs/Simply_xAI/SIMPLY_PROMPTS_AND_MODEL_CONFIG.md` — документация

**Валидация этапа (факт):**
- [x] `npx tsc --noEmit` — 0 ошибок (включая compile-time check `Record<TaskId, number>`)
- [x] `npm run build` — успешен (migrations 3360ms + compile 10.1s + 62/62 static pages)
- [x] Grep-test: 25 production файлов имеют совпадающий count AI calls ↔ `maxOutputTokens`. Scripts/ исключены как тестовые.
- [x] 🧪 Мануальный тест владельцем (2026-04-18):
  1. **Simply chat** — `simply` on Grok 4.1 Fast Non-Reasoning: outputTokens 111 (cap 8192, не обрезан) ✅
  2. **Expertise** (новый чат) — `expertise` on Grok 4.1 Fast Reasoning (override): outputTokens 202/789 (cap 16000) + `util:auto-naming` на reasoning variant (override) outputTokens 570 (64 final + 506 thinking — safety-net сработал ровно по cap) ✅
  3. **Artifact markdown** — `artifact:markdown` on Sonnet (default): outputTokens 1979/2056; на Grok 4.20 non-reasoning (override): outputTokens 698/1683/2319 (capability Grok 16000 < наш 16384 → safety-net автоматически понизил до 16000) ✅
  4. **Повторный `util:auto-naming`** на default non-reasoning: outputTokens 61 (cap 64, idle margin 3 токена) ✅
  5. SQL: все outputTokens в разумных пределах (max 2420 для expertise с tools), никаких 100K+ runaway записей ✅
  6. Dev-логи: 0 warning'ов safety-net, 0 UND_ERR, 0 TypeError из 546 строк вывода ✅

**Git:** коммит Этапа 2 (SHA добавляется после).

**Git (после валидации):**
```bash
git add lib/ai/task-assignments.ts lib/ai/getModel.ts lib/ lib/ai/memory/ lib/ai/professors/ lib/ai/clerks/ artifacts/ app/ specs/Simply_xAI/SIMPLY_PROMPTS_AND_MODEL_CONFIG.md
git commit -m "feat(tz-aisdk): explicit maxOutputTokens SSOT + 36 call sites"
```

**Критерий готовности:** grep не находит ни одного AI call site без явного `maxOutputTokens`. Cap table задокументирована в SIMPLY_PROMPTS_AND_MODEL_CONFIG.md.

---

## Этап 3: call sites с cap > 21333 на Anthropic → streaming (архитектурный принцип)

**Статус:** ⬜ Не начат
**Оценка:** 1-1.5 сессии

⛔ **НЕ НАЧИНАТЬ без подтверждения Этапа 2** (использует getter из 2.2)

**Цель:** Архитектурный инвариант «cap > 21333 на Anthropic ⇒ только `streamText`/`streamObject`» выполнен по всему проекту. Это не разовый фикс plan/route.ts, а правило контракта AI SDK invocation (фиксируется в ADR, Этап 4.4).

**Обоснование расширения scope:** Anthropic threshold 21333 — hard constraint SDK (при `maxOutputTokens > 21333` non-streaming вызов превышает default fetch timeout → `UND_ERR_SOCKET`). Правило касается обоих non-streaming API: `generateText` **и** `generateObject` (та же timeout-bomb при больших JSON-ответах).

**Кандидаты для проверки (из cap table, Anthropic с cap > 21333):**

| TaskId | Cap | Модель | Текущий режим | Действие |
|---|---|---|---|---|
| `professor:planning` | 32000 | claude-opus-4-6 | `generateText` | **переписать на `streamText`** (задача 3.1) |
| `project:expert:opus` | 32000 | claude-opus-4-6 | уже `streamText`? | **проверить и подтвердить** (задача 3.0) |

**Задачи:**

- [ ] 3.0. Grep-инвентаризация всех Anthropic call sites с cap > 21333. Для каждого — убедиться что используется `streamText`/`streamObject`, а не `generateText`/`generateObject`. Результат в CHANGELOG. Если найдётся хоть один `generateText`/`generateObject` помимо plan/route.ts — добавить задачу на переписывание в этот этап до коммита.
- [ ] 3.1. Переписать вызов `generateText(...)` в [app/(chat)/api/projects/[id]/plan/route.ts:191-208](../../app/(chat)/api/projects/[id]/plan/route.ts#L191) на `streamText`:
  - Импорт `import { streamText } from "ai"`
  - Вызов `const stream = streamText({ model, system, prompt, temperature, maxOutputTokens: getMaxOutputTokensForTask("professor:planning"), providerOptions: { anthropic: { thinking: { type: "adaptive" }, effort: "high" } } })`
  - `const text = await stream.text`
  - `const usage = await stream.usage`
- [ ] 3.2. Обновить `extractTag(text, ...)` — сигнатура не меняется, работает с accumulated text.
- [ ] 3.3. Удалить многословный комментарий `ТЗ-XAI-4 hot-fix (2026-04-16)...` (строки 179-190) — заменить короткой ссылкой на ADR 048 и новый ADR (см. финализация).
- [ ] 3.4. `logUsage({ usage, ... })` — остаётся вызов, передаёт `usage` из streamText. Проверить что `reasoningTokens` попадает в лог (поле `thinkingTokens` в ai_usage_log через `extractUsageFields`).
- [ ] 3.5. Смоук-тест `professor:planning`: создать проект с 10+ задачами → нажать «Создать план» → убедиться что план генерируется за <60s без socket errors, парсинг `<plan_report>` и `<plan_json>` работает.
- [ ] 3.6. Смоук-тест `project:expert:opus` (если задача 3.0 подтвердила что уже streamText — просто верификация что после изменений Этапа 2 ничего не сломалось): задать вопрос в project expert chat на Opus-tier → ответ стримится → `thinkingTokens > 0` в ai_usage_log при достаточно сложном вопросе.

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
  - feat(aisdk): explicit maxOutputTokens SSOT (`DEFAULT_MAX_OUTPUT_TOKENS`) + getter `getMaxOutputTokensForTask()` with capability safety-net (Math.min + warnOnce for Anthropic >21333) + 36 call sites migrated
  - feat(aisdk): architectural invariant "cap > 21333 on Anthropic ⇒ streamText/streamObject" — plan/route.ts migrated from generateText to streamText with adaptive thinking (replaces tactical cap 16000 with SSOT 32000)
  - docs(aisdk): ADR "AI SDK invocation contract" codifies 4-aspect contract (taskId / model / cap / call mode) + checklist for future changes
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

**ADR (обязательный — условие владельца):**
- [ ] `docs/decisions/NNN-aisdk-invocation-contract.md` — ADR «AI SDK invocation contract». Фиксирует 4 аспекта контракта и их взаимосвязи:
  1. **taskId** — стабильная точка конфигурации в `DEFAULT_TASK_MODELS` (не меняется).
  2. **model** — SSOT `task-assignments.ts`, меняется (А/Б тесты, смена провайдера).
  3. **cap** — SSOT `DEFAULT_MAX_OUTPUT_TOKENS` в `task-assignments.ts`, привязан к taskId, capped к capability модели в runtime через `getMaxOutputTokensForTask()`.
  4. **call mode** — `streamText`/`streamObject` **обязательно** при cap > 21333 на Anthropic (threshold SDK, иначе socket timeout). Независимо от текущей default-модели.

  Также фиксирует результаты этого ТЗ:
  - Регистрация overrides reader через `instrumentation.ts` (not per-route) — см. ADR 048.
  - `globalThis.__simplyOverridesReader` — HMR-immunity reader (Этап 1 бонус).

  **Checklist для будущих изменений (обязательный раздел в ADR):**
  - [ ] Добавляешь новый taskId: (a) запись в `DEFAULT_TASK_MODELS`, (b) запись в `DEFAULT_MAX_OUTPUT_TOKENS` (иначе TS падает), (c) cap ≤ capability назначенной модели, (d) если cap > 21333 и модель Anthropic — call site использует `streamText`/`streamObject`.
  - [ ] Меняешь default-модель taskId в `DEFAULT_TASK_MODELS`: (a) проверить что cap в `DEFAULT_MAX_OUTPUT_TOKENS` не превышает `maxOutput` новой модели — иначе SSOT рассинхронизируется с каталогом (runtime safety-net молча срежет до capability, но в таблице останется неправильное число); (b) если новая модель Anthropic и cap > 21333 — убедиться что все call sites этого taskId используют `streamText`/`streamObject`.
  - [ ] Увеличиваешь cap в `DEFAULT_MAX_OUTPUT_TOKENS`: (a) новое значение ≤ `maxOutput` default-модели, (b) если > 21333 и модель Anthropic — проверить call mode.

  Обоснование ADR: четыре аспекта — общий паттерн AI SDK invocations, будут референсом для будущих routes. Без ADR следующее изменение легко нарушит инвариант (этот же ТЗ родился из того что 3 предыдущих долга накопились).

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
