# Передача сессии ТЗ-AISDKLayerHardening

**Дата:** 2026-04-18 (конец сессии 3)
**Сессия:** 3 (Этап 2 закрыт)

---

## Статус этапов

- [x] Фаза 1 — Анализ + Код-ревью (SPEC + ANALYSIS, 4 вопроса отвечены владельцем)
- [x] Фаза 2 — Планирование (ROADMAP с cap table на 37 taskIds)
- [x] **Этап 1: DevOverrides cleanup — закрыт коммитом `a20ad29`**
- [x] **Этап 2: MaxOutputTokens SSOT + safety-net + 36 call sites — закрыт коммитом `3bb23b3`**
- [ ] Этап 3: cap > 21333 на Anthropic → streamText/streamObject (архитектурный принцип) ← **СЛЕДУЮЩИЙ**
- [ ] Этап 4: Финализация + ADR «AI SDK invocation contract»

---

## Что сделано в Этапе 1 (коммит `a20ad29`)

**По плану:**
1. Маяк в `instrumentation.ts` про единственную точку регистрации reader-а
2. Удалены 7 redundant side-effect импортов `model-overrides-node` (chat, plan, tasks/chat, briefing generate, briefing refresh-section, cron/briefing, service-chat)
3. ADR 048 актуализирован (убран устаревший постскриптум, описана SSOT-регистрация через instrumentation.ts)
4. `specs/_backlog/README.md` вычищен (сломанная ссылка на архивный TZ + umbrella записи)

**Бонус-находки во время валидации (закрыты в том же коммите):**

5. **HMR regression в overrides (критичный)** — после удаления side-effect импортов dev в Next.js терял reader на каждом hot-reload (module-level переменная `activeOverridesReader` сбрасывалась в no-op). Раньше это маскировалось 7 импортами: каждый hot-reload route'а заново регистрировал reader через side-effect. После чистки — страховки не осталось. Фикс: вынесение reader в `globalThis.__simplyOverridesReader` (HMR-immune). Файл [lib/ai/model-overrides.ts](../../lib/ai/model-overrides.ts). Production не затронут (нет HMR).

6. **Diagnostic endpoint** `/api/dev/resolve-model?taskId=<id>` — runtime-резолв `{ effectiveModelId, defaultModelId, overrideActive }` без AI-вызова. Использовался для эмпирической проверки HMR-фикса; остаётся как reusable dev-tool. Файл [app/api/dev/resolve-model/route.ts](../../app/api/dev/resolve-model/route.ts).

7. **DevPanel auto-naming sub-call visibility** — `util:auto-naming` не отображался в Timeline/Cost Breakdown. Причина из исходников AI SDK ([node_modules/ai/src/ui-message-stream/handle-ui-message-stream-finish.ts:165-167](../../node_modules/ai/src/ui-message-stream/handle-ui-message-stream-finish.ts#L165-L167)): `createUIMessageStream.onFinish` вызывается в `flush()` TransformStream уже после `controller.close()` — поздние writes молча глотаются через `safeEnqueue`. Фикс: перенос `autoNameChat` в `streamText.onFinish` (там merged stream ещё открыт). Сигнатура `autoNameChat` расширена — принимает `generatedAssistantText` напрямую чтобы не зависеть от saveMessages.

---

## End-to-end валидация Этапа 1 (владелец подтвердил)

1. `curl /api/dev/resolve-model?taskId=util:title` → `{ overrideActive: true, effectiveModelId: grok-4-1-fast-reasoning }` ✅
2. Мануальный тест: свежая ветка /expertise, 4 сообщения → DevPanel Timeline показал `tool:util:auto-naming Grok 4.1F·R 1624 tok` (·R = override reasoning, не default non-reasoning) ✅
3. БД: `SELECT modelId FROM ai_usage_log WHERE chatMode='util:auto-naming' ORDER BY createdAt DESC LIMIT 1` → `grok-4-1-fast-reasoning` ✅

Три источника (endpoint, UI, БД) согласованы.

---

## Следующая сессия: начни с

1. Подтверждение владельца на cap table (ROADMAP § 2.1) — ключевое архитектурное решение Этапа 2
2. При OK → стартуем Этап 2 (MaxOutputTokens SSOT, 1.5-2 сессии)
3. Gate-keeping строго: после каждой задачи `tsc`, после этапа `build` + мануальный тест владельцем + git commit + OK → следующий

---

## Критические правила этого ТЗ (напоминание)

- ⛔ **Документация first.** Перед внедрением любой внешней технологии — WebSearch + WebFetch + исходники в node_modules. Работа по памяти = провал. В Этапе 1 это правило спасло: чтение исходников AI SDK `handle-ui-message-stream-finish.ts` показало что `createUIMessageStream.onFinish` уже после close — от моих догадок толку не было.
- ⛔ **Никаких костылей.** Только архитектурные решения. Если нашёл band-aid в существующем коде — устраняем, а не обходим. Быстрые фиксы запрещены даже под давлением дедлайна. В Этапе 1 был момент когда я предлагал править `parseBatches` под late-finish — отклонено владельцем как костыль.
- ⛔ **Мануальный тест обязателен на КАЖДОМ этапе** владельцем, не только финализация. Claude-валидация через curl/SQL — сильное косвенное доказательство но не замена UI-проверки.
- ⛔ **Находки вне scope → FINDINGS.md** (Правило 8 WORKFLOW). В этой сессии три бонус-находки (HMR-баг, diagnostic endpoint, DevPanel) оказались архитектурно связаны с Этапом 1 и закрылись в том же коммите. В будущих этапах — строже разделять.
- ⛔ `npm run build` в Simply = `tsx lib/db/migrate && next build` → запускать только после остановки `next dev` и с предупреждением владельца.
- ⛔ Не отмечать `[x]` без реальной валидации.

---

## Уроки этой сессии (для будущей)

1. **Удаление «избыточного» кода может скрывать страховочную логику.** 7 side-effect импортов выглядели как дубликаты но компенсировали HMR-регрессию. Перед массовой чисткой — проверять что ни один из дубликатов не играет роль страховки.
2. **`createUIMessageStream.onFinish` ≠ «стрим ещё открыт».** Это вызов через `flush()` TransformStream — после `controller.close()`. Для отправки событий в клиент использовать `streamText.onFinish` (merged stream активен).
3. **Dev-gate endpoints экономят часы.** Вместо повторных мануальных тестов при диагностике — один `/api/dev/resolve-model` сразу разрешил «override или не override?». Стоит инвестировать в такие tools.

---

## Важные файлы для следующей сессии

- [SPEC.md](SPEC.md) — umbrella ТЗ
- [ANALYSIS.md](ANALYSIS.md) — аудит + изученная документация
- [ROADMAP.md](ROADMAP.md) — чеклист с cap table (ключевое для Этапа 2)
- [CHANGELOG.md](CHANGELOG.md) — что поменялось в каждом коммите
- [specs/WORKFLOW.md](../WORKFLOW.md) — процесс
- [MEMORY.md](../../../../.claude/projects/-Users-mactm-Projects-NegotiateAI-Chatbot/memory/MEMORY.md) — оптимизированная память (42 → 15 файлов в этой сессии)

---

## Коммиты сессии 3 (2026-04-18)

| SHA | Описание |
|---|---|
| `3bb23b3` | feat(tz-aisdk-stage2): explicit maxOutputTokens SSOT + 36 call sites + capability safety-net |
| (следующий) | chore(tz-aisdk): close Этап 2 in roadmap + session handoff |

## Коммиты предыдущих сессий

| SHA | Сессия | Описание |
|---|---|---|
| `9339162` | 2 | chore(tz-aisdk): close Этап 1 in roadmap + session handoff |
| `a20ad29` | 2 | fix(tz-aisdk-stage1): HMR-proof overrides reader + centralize registration + make DevPanel show auto-naming |

---

## Что сделано в Этапе 2 (коммит `3bb23b3`)

**SSOT:**
- `DEFAULT_MAX_OUTPUT_TOKENS: Record<TaskId, number>` в [lib/ai/task-assignments.ts:202](../../lib/ai/task-assignments.ts#L202) — 37 taskId, compile-time check через TS Record.

**Getter с двухслойной safety-net** ([lib/ai/getModel.ts:264](../../lib/ai/getModel.ts#L264)):
- `Math.min(requested, capability)` — runtime защита от рассинхрона при смене default-модели.
- `warnOnce` для Anthropic > 21333 — предупреждает dev про обязательное streaming.

**Cap table — 6 правок Grok 16384 → 16000** (capability Grok = 16_000):
`simply-chat-think`, `expertise`, `expertise-multi-agent`, `create`, `professor:pipeline-synthesize`, `memory:extract-batch`.

**Критичное:** `memory:extract-batch` поднят с 8192 до 16000 — MAX_BATCH_FACTS=30 × ~500 tok/fact = ~15K, предыдущий cap был timeout-bomb для MIND compression.

**36 production call sites** переведены на `getMaxOutputTokensForTask()`.

**Бонус:** уже-явные `briefing:section` (8192), `briefing:podcast-script` (4096), `meeting:summary` (8192) тоже переведены на getter для консистентности SSOT (хотя и не были в scope 2.3).

**`plan/route.ts`** оставлен с `maxOutputTokens: 16000` как tactical fix — переписывается на streamText в Этапе 3.

---

## End-to-end валидация Этапа 2 (владелец подтвердил 2026-04-18)

| Тест | Результат |
|---|---|
| `npx tsc --noEmit` | 0 ошибок |
| `npm run build` | migrations 3360ms + compile 10.1s + 62/62 static pages |
| Grep coverage | 25 production файлов, count AI calls == count maxOutputTokens |
| Dev-логи (546 строк) | 0 warning safety-net, 0 UND_ERR, 0 TypeError |
| Simply chat | outputTokens 111 (cap 8192, запас огромный) |
| Expertise (override Grok 4.1 Fast Reasoning) | outputTokens 202/789 (cap 16000) |
| Artifact markdown (Sonnet default) | outputTokens 1979/2056 |
| Artifact markdown (Grok 4.20 non-reasoning override) | outputTokens 698/1683/2319 (safety-net автоматически 16384 → 16000) ✅ **подтверждение Math.min в деле** |
| util:auto-naming (default non-reasoning) | outputTokens 61 (cap 64, margin 3) |
| util:auto-naming (override reasoning variant) | outputTokens 570 = 506 thinking + **64 final == cap**. Safety-net сработал ровно по границе. |

---

## Finding #1 (см. [FINDINGS.md](FINDINGS.md))

`util:title` cap=64 тесен для dev override на reasoning-variant. Не блокер: default non-reasoning работает штатно (61 tok, margin 3). В backlog: повысить до 256 + документировать в ADR контракта. Низкий приоритет.

---

## Следующая сессия: начни с

1. **Этап 3** — call sites с cap > 21333 на Anthropic → streamText/streamObject. Это архитектурный инвариант, не разовый фикс.
2. Кандидаты (из cap table с default Anthropic + cap > 21333):
   - `professor:planning` (Opus 4.6, cap 32000) — сейчас на `generateText`, **переписать на streamText с adaptive thinking** (ROADMAP задача 3.1).
   - `project:expert:opus` (Opus 4.6, cap 32000) — проверить через grep (ROADMAP задача 3.0) что call site уже использует streamText. Если да — только smoke-тест после Этапа 2.
3. Gate-keeping строго: после каждой задачи `tsc`, после этапа `build` + мануальный тест владельцем + git commit + OK → Этап 4.

---

## Перед стартом Этапа 3 — проверь

- `git log --oneline -5` — виден `3bb23b3` как последний коммит Этапа 2.
- `curl /api/dev/resolve-model?taskId=professor:planning` — возвращает `claude-opus-4-6` (проверить что override не активен для этой задачи, иначе smoke-тест будет не на той модели).
- `ps aux | grep "next dev"` — пусто (dev сервер остановлен в конце сессии 3).
- `npx tsc --noEmit` — 0 ошибок (baseline сверка перед правками).

---

## Lessons этой сессии (для будущей)

1. **Двухслойная safety-net — не overengineering, а архитектурная необходимость.** Во время мануального теста владелец сделал override `artifact:markdown` на Grok 4.20 non-reasoning (capability 16000 < наш cap 16384). Без `Math.min` — ошибка от API. С `Math.min` — молча понизили до 16000 и всё работает. Это показывает что safety-net нужен не только для гипотетического «вдруг кто-то поменяет дефолт», а для реального workflow dev-тестирования.

2. **Reasoning vs non-reasoning cap — разные вещи.** Один и тот же cap (64 для util:title) ведёт себя по-разному: non-reasoning укладывается с запасом, reasoning съедает его в thinking. cap table по умолчанию оптимизирована под default модели; при switch на variant может потребоваться ручное повышение. Важный учебный момент для ADR контракта (Этап 4).

3. **Всё-в-одном коммит лучше для umbrella ТЗ.** Я изначально собирался разделить SSOT + getter от 36 call sites. Но 36 call sites без SSOT/getter не компилируются, а SSOT/getter без call sites — orphan. Разделение бессмысленно. Чистый feat-коммит на 346 insertions — читаемый, attributable, reverte-ный.
