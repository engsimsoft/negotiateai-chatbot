# Передача сессии ТЗ-AISDKLayerHardening

**Дата:** 2026-04-17 (конец сессии 2)
**Сессия:** 2 (Фазы 1-2 + Этап 1 закрыты)

---

## Статус этапов

- [x] Фаза 1 — Анализ + Код-ревью (SPEC + ANALYSIS, 4 вопроса отвечены владельцем)
- [x] Фаза 2 — Планирование (ROADMAP с cap table на 37 taskIds)
- [x] **Этап 1: DevOverrides cleanup — закрыт коммитом `a20ad29`**
- [ ] Этап 2: MaxOutputTokens SSOT + getter + 36 call sites ← **СЛЕДУЮЩИЙ**
- [ ] Этап 3: plan/route.ts → streamText
- [ ] Этап 4: Финализация

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

## Коммиты этой сессии

| SHA | Описание |
|---|---|
| `a20ad29` | fix(tz-aisdk-stage1): HMR-proof overrides reader + centralize registration + make DevPanel show auto-naming |

(ROADMAP/HANDOFF обновления пока без коммита — ждут решения владельца о том, одним коммитом или отдельным)
