# Передача сессии ТЗ-AISDKLayerHardening

**Дата:** 2026-04-18 (конец сессии 3)
**Сессия:** 3 — Этапы 2 и 3 закрыты. Следующая сессия: **Этап 4 (финализация)**.

---

## Статус этапов

- [x] Фаза 1 — Анализ + Код-ревью (SPEC + ANALYSIS, 4 вопроса отвечены владельцем)
- [x] Фаза 2 — Планирование (ROADMAP с cap table на 37 taskIds)
- [x] **Этап 1:** DevOverrides cleanup — коммит `a20ad29` (сессия 2)
- [x] **Этап 2:** MaxOutputTokens SSOT + safety-net + 36 call sites — коммит `3bb23b3`
- [x] **Этап 3:** streamText для cap > 21333 на Anthropic + thinking config fix — коммит `da01884`
- [ ] **Этап 4:** Финализация + ADR «AI SDK invocation contract» ← **СЛЕДУЮЩИЙ**

---

## Коммиты всех сессий ТЗ

| SHA | Сессия | Описание |
|---|---|---|
| `a20ad29` | 2 | fix(tz-aisdk-stage1): HMR-proof overrides reader + centralize registration + make DevPanel show auto-naming |
| `9339162` | 2 | chore(tz-aisdk): close Этап 1 in roadmap + session handoff |
| `3bb23b3` | 3 | feat(tz-aisdk-stage2): explicit maxOutputTokens SSOT + 36 call sites + capability safety-net |
| `b4a5ad6` | 3 | chore(tz-aisdk): close Этап 2 in roadmap + session 3 handoff |
| `da01884` | 3 | feat(tz-aisdk-stage3): plan/route.ts → streamText + Anthropic thinking config fix |
| `b770da4` | 3 | chore(tz-aisdk): close Этап 3 in roadmap + Finding #2 + session handoff |

---

## Этап 4 — что делать в следующей сессии (самодостаточный план)

Полный чеклист — в [ROADMAP.md § «Этап 4: Финализация»](ROADMAP.md#этап-4-финализация). Ниже — выжимка последовательно исполняемых шагов.

### Шаг 0 — baseline проверки перед стартом

```bash
# 1. Виден b770da4 как последний коммит
git log --oneline -6

# 2. Tree чист (ничего не забыли)
git status

# 3. Нет активного dev
ps aux | grep -E "next dev|next-server" | grep -v grep

# 4. tsc чист (baseline)
npx tsc --noEmit

# 5. CLAUDE.md в лимите 220 строк (правило из самого CLAUDE.md)
wc -l CLAUDE.md
```

### Шаг 1 — прочитать [DOCUMENTATION_GUIDE.md](../../DOCUMENTATION_GUIDE.md) ⛔ обязательно

Это закон финализации. Пройти чеклист — какие файлы нужно обновить при определённых триггерах в diff.

### Шаг 2 — SQL-проверки БД через `mcp__postgres__query`

**Runaway detection:**
```sql
SELECT chatMode, modelId, outputTokens, createdAt
FROM ai_usage_log
WHERE outputTokens > 32000 AND createdAt > NOW() - INTERVAL '24 hours'
ORDER BY outputTokens DESC;
-- ожидаем: 0 строк (ни одного превышения даже самого большого cap)
```

**Cost sanity (аномалии):**
```sql
SELECT chatMode, SUM(costUsd::numeric) AS total_cost, COUNT(*) AS calls
FROM ai_usage_log
WHERE createdAt > NOW() - INTERVAL '1 hour'
GROUP BY chatMode
ORDER BY total_cost DESC;
-- ожидаем: нет аномально дорогих chatMode (professor:planner дороже всего, ~$0.25-0.30)
```

**Затронутые taskId (последние записи):**
```sql
SELECT chatMode, modelId, outputTokens, thinkingTokens, costUsd, createdAt
FROM ai_usage_log
WHERE chatMode IN ('professor:planner', 'util:title', 'util:auto-naming',
                   'artifact:markdown', 'simply', 'expertise')
ORDER BY createdAt DESC
LIMIT 15;
```

### Шаг 3 — мануальные тесты golden path (владелец)

Три теста + cost sanity. Инструкции дать владельцу. Запустить `npm run dev` в фоне + Monitor на ошибки.

1. **Simply chat** — отправить сообщение в существующий Simply → ответ приходит (cap 8192, simply-chat на Grok 4.1 Fast Non-Reasoning).
2. **Professor planning** — открыть существующий проект с планом / создать мини-проект → «Создать план». Опционально (стоит ~$0.30 на Opus). Подтверждает архитектурный инвариант Этапа 3.
3. **Briefing** — если есть активная тема → дождаться generation cycle. Опционально.

**Рекомендация:** минимум Simply + Professor planning. Briefing — только если тема активна и не жалко дождаться.

### Шаг 4 — оформить Finding #1 в backlog (Finding #2 НЕ создавать)

Владелец решил 2026-04-18: Finding #2 (Anthropic thinking tokens) **не оформлять** в backlog — неразрешимое ограничение SDK, через 1-2 месяца может стать неактуальным если перейдём на Grok Multi-Agent.

**Finding #1** — `util:title` cap=64 тесен при reasoning override. Создать файл:
```
specs/_backlog/TZ_UtilTitleCapReasoningMargin.md
```
Содержание — см. [FINDINGS.md § Finding #1](FINDINGS.md).

Обновить [specs/_backlog/README.md](../../specs/_backlog/README.md) — добавить ссылку в индекс по impact (раздел «низкий приоритет / косметика»).

### Шаг 5 — документация (главная)

**Главный [CHANGELOG.md](../../CHANGELOG.md)** — добавить запись:
```markdown
### [3.93.0] - 2026-04-XX — ТЗ-AISDKLayerHardening

- chore(aisdk): centralized overrides reader registration in instrumentation.ts (removed 7 redundant side-effect imports); HMR-proof reader via globalThis (dev workflow fix).
- feat(aisdk): explicit maxOutputTokens SSOT (`DEFAULT_MAX_OUTPUT_TOKENS`) in lib/ai/task-assignments.ts + getter `getMaxOutputTokensForTask()` with capability safety-net (Math.min + warnOnce for Anthropic >21333) + 36 call sites migrated.
- feat(aisdk): architectural invariant "cap > 21333 on Anthropic ⇒ streamText/streamObject" — plan/route.ts migrated from generateText to streamText with enabled thinking (budgetTokens: 16000); fixed temperature+thinking incompatibility across 3 call sites.
- docs(aisdk): ADR "AI SDK invocation contract" codifies 4-aspect contract (taskId / model / cap / call mode) + checklist for future changes.
- note: for Anthropic models, `thinkingTokens` in ai_usage_log is architecturally always 0 (Messages API doesn't separate thinking from completion in usage). Cost is still calculated correctly via outputTokens × output_price.
```

**[SIMPLY_STATUS.md](../../SIMPLY_STATUS.md)** — обновить snapshot (таблица состояния компонентов). ТЗ-AISDKLayerHardening переводим из «в работе» в «завершено», номер версии поднимается.

**[package.json](../../package.json)** — bump version: `3.92.2` → **`3.93.0`**.

**⛔ [CLAUDE.md](../../CLAUDE.md) — НЕ редактировать** (правило из самого файла: «lim 220 строк, при достижении STOP и в CHANGELOG»). Финальная проверка: `wc -l CLAUDE.md`.

### Шаг 6 — документация (docs/ по правилу 6 DOCUMENTATION_GUIDE)

Триггеры в diff этого ТЗ:
- `lib/ai/task-assignments.ts` (SSOT + DEFAULT_MAX_OUTPUT_TOKENS) → обновить [docs/ai-chats-map.md](../../docs/ai-chats-map.md) (добавить упоминание `DEFAULT_MAX_OUTPUT_TOKENS`) + [docs/architecture.md](../../docs/architecture.md) (упоминание getter API).
- `lib/ai/getModel.ts` (новый getter + safety-net) → [docs/architecture.md](../../docs/architecture.md) (описать API).
- `instrumentation.ts` + `lib/ai/model-overrides.ts` — уже обновлён ADR 048 в Этапе 1, повторно не трогать.

### Шаг 7 — ADR «AI SDK invocation contract» (новый, обязательный по решению владельца)

Создать `docs/decisions/NNN-aisdk-invocation-contract.md` (NNN = следующий номер после 054 или какой там текущий — проверить `ls docs/decisions/` перед стартом).

**Структура ADR** (из [ROADMAP.md Этап 4.4](ROADMAP.md#42-мануальные-тесты-владелец)):

**Фиксирует 4 аспекта контракта:**
1. **taskId** — стабильная точка конфигурации в `DEFAULT_TASK_MODELS` (не меняется)
2. **model** — SSOT `task-assignments.ts`, меняется (А/Б тесты, смена провайдера)
3. **cap** — SSOT `DEFAULT_MAX_OUTPUT_TOKENS`, capped к capability через `getMaxOutputTokensForTask()` runtime
4. **call mode** — `streamText`/`streamObject` обязательно при cap > 21333 на Anthropic (иначе UND_ERR_SOCKET)

**Также фиксирует:**
- Регистрация overrides reader через `instrumentation.ts` (см. ADR 048).
- `globalThis.__simplyOverridesReader` — HMR-immune (сессия 2).
- **Finding #2 (важно упомянуть в ADR):** Anthropic API не разделяет thinking от completion в usage — `thinkingTokens` для Anthropic-моделей всегда 0, это ограничение SDK+API, не баг.
- **Finding #1 (упомянуть в checklist):** при override reasoning-variant для cap=64 (util:title) — reasoning съедает budget, нужно повышать cap вручную.

**Checklist для будущих изменений (обязательный раздел в ADR):**
- [ ] Добавляешь новый taskId: (a) запись в `DEFAULT_TASK_MODELS`, (b) запись в `DEFAULT_MAX_OUTPUT_TOKENS` (иначе TS падает), (c) cap ≤ capability назначенной модели, (d) если cap > 21333 и модель Anthropic — call site использует `streamText`/`streamObject`.
- [ ] Меняешь default-модель в `DEFAULT_TASK_MODELS`: (a) cap ≤ capability новой модели; (b) если новая модель Anthropic и cap > 21333 — все call sites этого taskId на streaming.
- [ ] Увеличиваешь cap в `DEFAULT_MAX_OUTPUT_TOKENS`: (a) новое ≤ capability default-модели, (b) если > 21333 и модель Anthropic — call mode проверить.

### Шаг 8 — архивирование ТЗ

```bash
# Переместить всю папку ТЗ в _archive
git mv specs/TZ_AISDKLayerHardening _archive/

# Добавить запись в BACKLOG_CLOSED (3 долга закрыты одним umbrella)
# см. _archive/BACKLOG_CLOSED.md — формат существующих записей
```

Убедиться что `specs/_backlog/README.md` не содержит ссылок на закрытые файлы.

### Шаг 9 — финальная валидация + коммит

```bash
# 1. Dev остановлен
ps aux | grep next

# 2. Build success (включает migrate) — ПРЕДУПРЕДИТЬ ВЛАДЕЛЬЦА перед запуском
npm run build

# 3. CLAUDE.md в лимите
wc -l CLAUDE.md  # ≤ 220

# 4. Grep-инварианты
grep -rn 'import "@/lib/ai/model-overrides-node"' app/ lib/  # ожидаем: 0 результатов
grep -rn 'thinking.*type:\s*"adaptive"' app/ lib/            # ожидаем: 0 (все должны быть "enabled" после Этапа 3)
grep -rn 'effort:\s*"high"' app/ lib/                        # ожидаем: 0 (невалидный Anthropic параметр)
```

**Финальный коммит:**
```bash
git add CHANGELOG.md SIMPLY_STATUS.md package.json docs/ specs/_backlog/ _archive/
git commit -m "docs(tz-aisdk): finalize AI SDK layer hardening — 3.93.0"
```

После этого — deploy в Vercel если владелец решит, мониторинг production логов.

---

## Что именно сделано в Этапе 3 (коммит `da01884`)

**По плану:**
1. Grep-инвентаризация Anthropic call sites с cap > 21333. Найдено 2: `professor:planning` (Opus, generateText — переписан) и `project:expert:opus` (Opus, уже streamText в [tasks/[taskId]/chat/route.ts:388](../../app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts#L388) — ничего не менял).
2. [plan/route.ts:181](../../app/(chat)/api/projects/[id]/plan/route.ts#L181) — `generateText` → `streamText`, cap через getter (32000), удалён многословный hot-fix комментарий, `extractTag` работает без изменений (accumulated text).

**Бонус (вне исходного scope, обнаружен в мануальном тесте):** фикс несовместимости `temperature` + `thinking` в 3 файлах:
- [plan/route.ts](../../app/(chat)/api/projects/[id]/plan/route.ts) — `professor:planning`
- [lib/ai/professors/task-reviewer.ts](../../lib/ai/professors/task-reviewer.ts) — `professor:review`
- [app/(chat)/api/service-chat/route.ts](../../app/(chat)/api/service-chat/route.ts) — `service-chat:briefing-onboarding`

Во всех трёх заменён `thinking: { type: "adaptive" }` + невалидный `effort: "high"` на `thinking: { type: "enabled", budgetTokens: N }` (16000 для plan, 4096 для review/briefing); `temperature` вынесен в else-ветку (передаётся только при `supportsThinking=false`). После фикса SDK warning `"temperature is not supported when thinking is enabled"` исчез из логов.

---

## Валидация Этапа 3 (владелец подтвердил 2026-04-18)

| Прогон | modelId | Выполнено | thinking config | outputTokens | SDK warnings |
|---|---|---|---|---|---|
| 1-й (до фикса) | claude-opus-4-6 | план создан | `type: "adaptive"` + temp 0.2 | 9333 | ❌ temp warning |
| 2-й (фикс, HMR не подхватил) | claude-opus-4-6 | план создан | `type: "enabled"` на диске, но runtime старый | 10250 | ❌ temp warning (старый код) |
| 3-й (чистый перезапуск .next/cache) | claude-opus-4-6 | **план создан без warning** | `type: "enabled"`, budget 16000 | 8462 | ✅ 0 warnings |

Третий прогон = архитектурный инвариант Этапа 3 выполнен: streamText на Opus cap 32000 без UND_ERR_SOCKET, план парсится (planReport=5992 chars + planJson=13679 chars с tasks/risks/caveats/recommendations), время POST=146s, SDK warnings=0.

---

## Finding #2 — архитектурное ограничение Anthropic (КРИТИЧНО прочесть перед Этапом 4)

**Файл:** [FINDINGS.md § Finding #2](FINDINGS.md).

**Суть:** @ai-sdk/anthropic@3.0.66 возвращает `outputTokens.reasoning: void 0` ВСЕГДА ([исходники index.js:1646-1659](../../node_modules/@ai-sdk/anthropic/dist/index.js#L1646)). Причина: Anthropic Messages API response содержит единое поле `usage.output_tokens` без разделения thinking vs completion. OpenAI и xAI разделяют (`completion_tokens_details.reasoning_tokens`), Anthropic — нет.

**Следствие для нас:**
- `thinkingTokens` в `ai_usage_log` для Opus/Sonnet/Haiku **архитектурно всегда 0**, независимо от работы extended thinking.
- Pricing корректен (Anthropic биллит `output_tokens` суммарно — цена уже учитывает thinking + completion).
- Теряется только аналитика «сколько модель думала».

**Что это означает для ADR (Этап 4.4):** критерий валидации «thinkingTokens > 0» из исходного ROADMAP переформулирован в «POST 200 без UND_ERR + план создаётся + время ≥ 60с (косвенный признак работы thinking)». ADR должен явно упомянуть это как known limitation.

**Решение владельца:** в backlog НЕ оформляем. Workaround через `usage.raw` хрупкий и ломается при апдейте SDK, а стратегически обсуждается переход Professor Planning на Grok Multi-Agent (ТЗ-XAI-MA-1) где эта проблема не стоит.

---

## Finding #1 (более лёгкий)

`util:title` cap=64 тесен при dev override на reasoning-variant. Default non-reasoning работает штатно (61 tok, margin 3). В backlog оформить как `specs/_backlog/TZ_UtilTitleCapReasoningMargin.md` (низкий приоритет, косметика). Это сделать в Шаге 4 Этапа 4.

---

## Критические правила этого ТЗ (напоминание следующей сессии)

- ⛔ **Документация first.** Перед внедрением любой внешней технологии — WebSearch + WebFetch + исходники в `node_modules`. Работа по памяти = провал. В Этапе 3 это правило спасло дважды: чтение исходников `@ai-sdk/anthropic` показало (а) `outputTokens.reasoning: void 0` — это SDK-ограничение, не баг кода; (б) `"adaptive"` поддерживается в 3.0.66 несмотря на первичное впечатление.
- ⛔ **Никаких костылей.** Только архитектурные решения. Workaround для извлечения thinking из `usage.raw` — отклонено владельцем как хрупкое.
- ⛔ **Мануальный тест обязателен на КАЖДОМ этапе** владельцем, не только финализация.
- ⛔ **Находки вне scope → FINDINGS.md** (Правило 8 WORKFLOW). Finding #2 спас ТЗ от ложного блокера — без него бы «зависли» пытаясь получить thinkingTokens > 0.
- ⛔ `npm run build` в Simply = `tsx lib/db/migrate && next build` → останавливать dev + предупреждать владельца. В этой сессии владелец прямо просил «убей все процессы которые в фоне» — для того чтобы иметь доступ к логам.
- ⛔ **CLAUDE.md не редактировать** (lim 220 строк, все новое → CHANGELOG + docs/).
- ⛔ Не отмечать `[x]` без реальной валидации.

---

## Уроки сессии 3 (для следующей)

1. **HMR в dev может НЕ перезапустить route handler** даже после Edit файла. Во втором прогоне теста Этапа 3 temperature warning всё ещё был, потому что Next.js держал скомпилированный старый код. Решение: `rm -rf .next/cache && npm run dev` — гарантированно свежий код. Это более надёжно чем полагаться на HMR при правке глубоких server-side файлов.

2. **AI SDK warning — реальный функциональный сигнал, не просто шум.** Warning «temperature is not supported when thinking is enabled» означал что thinking молча отключался. Игнорировать AI SDK warnings в dev — нельзя.

3. **Разные провайдеры по-разному отчитываются об usage.** OpenAI/xAI разделяют reasoning vs completion, Anthropic — нет. Building cost/analytics-слой над AI SDK должен учитывать что некоторые поля `LanguageModelUsage.outputTokenDetails.*` провайдер-специфичны.

4. **Два коммита на этап (feat + chore) — хороший паттерн.** feat — собственно изменения кода с полным описанием, chore — финализация документации с привязкой к SHA предыдущего коммита. Позволяет в git history увидеть и код и закрытие этапа.

5. **Владелец принимает сложные архитектурные решения быстро при правильной подаче.** Когда я прислал выжимку для архитектора с цитатами кода и table тестов — решение пришло мгновенно. Формат «контекст → находка с доказательствами → вариант решения → прямой вопрос» работает.

---

## Ключевые файлы для ознакомления новой сессии

**Обязательно прочесть перед стартом Этапа 4:**
- [ROADMAP.md § Этап 4](ROADMAP.md) — полный чеклист финализации
- [FINDINGS.md](FINDINGS.md) — 2 находки, Finding #2 влияет на ADR
- [CHANGELOG.md](CHANGELOG.md) — полный журнал изменений всех сессий ТЗ
- [../../DOCUMENTATION_GUIDE.md](../../DOCUMENTATION_GUIDE.md) — правила финализации (Шаг 1 Этапа 4)
- [../WORKFLOW.md](../WORKFLOW.md) — процессные правила

**Проверочные файлы (читать при сомнениях):**
- [SPEC.md](SPEC.md), [ANALYSIS.md](ANALYSIS.md) — контекст umbrella ТЗ
- [../../CLAUDE.md](../../CLAUDE.md) — закон проекта, 220 строк лимит
- [MEMORY.md](../../../../.claude/projects/-Users-mactm-Projects-NegotiateAI-Chatbot/memory/MEMORY.md) — user-level persistent memory (в этой сессии добавится запись про Anthropic usage limitation)

---

## Финальный совет следующей сессии

Этап 4 — это много мелких шагов, каждый важен, но ни один не требует heavy thinking. Главные риски:
1. **Забыть DOCUMENTATION_GUIDE чеклист** — Шаг 1 делать первым, не откладывать.
2. **Заредактировать CLAUDE.md** — 220 строк лимит, прямой запрет, всё новое → CHANGELOG/docs.
3. **ADR написать без упоминания Finding #2** — критично, иначе будущие разработчики снова будут гоняться за thinkingTokens.
4. **Пропустить version bump** в package.json — 3.92.2 → 3.93.0.
5. **Забыть про архивирование** — папка ТЗ должна переехать в `_archive/` и ссылки в `_backlog/README.md` не должны остаться сломанными.

Удачи.
