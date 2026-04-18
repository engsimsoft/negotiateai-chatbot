# Changelog ТЗ-AISDKLayerHardening

> Локальный лог изменений в рамках этого ТЗ. После финализации содержание переносится в главный CHANGELOG.md.

---

## Сессия 1 — 2026-04-17 (Фаза 1 + Фаза 2)

### Added
- `specs/TZ_AISDKLayerHardening/SPEC.md` — umbrella ТЗ объединяющий три долга из `_backlog/`
- `specs/TZ_AISDKLayerHardening/ANALYSIS.md` — аудит кода, изучение официальной документации, 4 вопроса владельцу
- `specs/TZ_AISDKLayerHardening/ROADMAP.md` — план с 3 содержательными этапами + финализация, полная cap table для 37 taskIds

### Findings during analysis
- Этап 1 (DevOverrides) в основном уже сделан через `instrumentation.ts` (коммит `c4b2b63`). Scope сократился до cleanup.
- Scope Этапа 2 — 36 call sites (не 20 как в заготовке): 5 с явным cap, 31 implicit.
- ADR 048 L94-108 стал stale после instrumentation.ts фикса. Будет обновлён в Этапе 1.
- `specs/_backlog/README.md:40` содержит сломанную ссылку на `TZ_DevOverridesSideEffectImportAudit.md` (файл в `_backlog/_archive/`). Будет исправлено в Этапе 1.

### Changed
(пока ничего)

### Fixed
(пока ничего)

### Files
- `specs/TZ_AISDKLayerHardening/SPEC.md` — new
- `specs/TZ_AISDKLayerHardening/ANALYSIS.md` — new
- `specs/TZ_AISDKLayerHardening/ROADMAP.md` — new
- `specs/TZ_AISDKLayerHardening/CHANGELOG.md` — new
- `specs/TZ_AISDKLayerHardening/HANDOFF.md` — new

---

## Сессия 2 — 2026-04-17 (Этап 1 закрыт)

### Commits
- `a20ad29` fix(tz-aisdk-stage1): HMR-proof overrides reader + centralize registration + make DevPanel show auto-naming
- `9339162` chore(tz-aisdk): close Этап 1 in roadmap + session handoff

### Changed
- Удалены 7 redundant side-effect импортов `model-overrides-node` из routes (chat, plan, tasks/chat, briefing generate/refresh-section, cron/briefing, service-chat) — регистрация reader'а централизована в `instrumentation.ts`.
- `docs/decisions/048-dev-switchboard-ui.md` — актуализирован (убран устаревший постскриптум, описана SSOT-регистрация через instrumentation.ts).
- `specs/_backlog/README.md` — очищены сломанная ссылка + umbrella-записи.

### Fixed (бонус-находки, закрыты в том же коммите)
- **HMR regression (критичный):** после удаления side-effect импортов в dev Next.js HMR терял reader при каждом hot-reload. Фикс: вынесение reader в `globalThis.__simplyOverridesReader` (HMR-immune). Production не затронут.
- **DevPanel auto-naming visibility:** sub-call `util:auto-naming` не отображался в Timeline из-за `createUIMessageStream.onFinish` вызывающегося в `flush()` TransformStream после `controller.close()`. Фикс: перенос `autoNameChat` в `streamText.onFinish` (merged stream ещё открыт).

### Added
- `app/api/dev/resolve-model/route.ts` — diagnostic endpoint `{ effectiveModelId, defaultModelId, overrideActive }` для runtime-проверок.

---

## Сессия 3 — 2026-04-18 (Этапы 2 и 3 закрыты)

### Commits
- `3bb23b3` feat(tz-aisdk-stage2): explicit maxOutputTokens SSOT + 36 call sites + capability safety-net
- `b4a5ad6` chore(tz-aisdk): close Этап 2 in roadmap + session 3 handoff
- `da01884` feat(tz-aisdk-stage3): plan/route.ts → streamText + Anthropic thinking config fix
- (следующий) chore(tz-aisdk): close Этап 3 + Finding #2

### Added (Этап 2)
- `DEFAULT_MAX_OUTPUT_TOKENS: Record<TaskId, number>` в [lib/ai/task-assignments.ts:202](../../lib/ai/task-assignments.ts#L202) — SSOT для 37 taskId, compile-time check через TypeScript Record.
- `getMaxOutputTokensForTask()` в [lib/ai/getModel.ts:264](../../lib/ai/getModel.ts#L264) с двухслойной safety-net:
  - `Math.min(requested, capability)` — runtime защита от рассинхрона cap table с каталогом при смене default-модели
  - `warnOnce` для Anthropic > 21333 — предупреждает dev про обязательное streaming
- `specs/TZ_AISDKLayerHardening/FINDINGS.md` — Finding #1 (util:title cap=64 тесноту при reasoning override), Finding #2 (Anthropic не разделяет thinking tokens в usage).

### Changed (Этап 2)
- 36 production AI SDK call sites переведены на `getMaxOutputTokensForTask()`: 10 artifacts + 3 professor-pipeline + 2 professors/clerks + 5 memory + 2 vision + 3 briefing + 1 meeting + 8 backend routes + 2 бонусных (уже явные cap заменены на getter для консистентности).
- Cap table приведена в соответствие с capability моделей: 6 Grok-cap'ов 16384 → 16000 (`simply-chat-think`, `expertise`, `expertise-multi-agent`, `create`, `professor:pipeline-synthesize`, `memory:extract-batch`).
- `memory:extract-batch` — cap 8192 → 16000 (MAX_BATCH_FACTS=30 × ~500 tok/fact был timeout-bomb для MIND compression).
- [specs/Simply_xAI/SIMPLY_PROMPTS_AND_MODEL_CONFIG.md § 4.2](../Simply_xAI/SIMPLY_PROMPTS_AND_MODEL_CONFIG.md) полностью переписан под SSOT-архитектуру.

### Changed (Этап 3)
- [app/(chat)/api/projects/[id]/plan/route.ts:181](../../app/(chat)/api/projects/[id]/plan/route.ts#L181) — `generateText` → `streamText` с adaptive thinking. Cap tactical 16000 заменён на SSOT `getMaxOutputTokensForTask("professor:planning")` = 32000. Удалён многословный hot-fix комментарий.
- **Фикс конфликта temperature + thinking** в трёх call sites (бонус вне исходного scope Этапа 3):
  - [plan/route.ts:181](../../app/(chat)/api/projects/[id]/plan/route.ts#L181) — `professor:planning`
  - [lib/ai/professors/task-reviewer.ts:137](../../lib/ai/professors/task-reviewer.ts#L137) — `professor:review`
  - [app/(chat)/api/service-chat/route.ts:782](../../app/(chat)/api/service-chat/route.ts#L782) — `service-chat:briefing-onboarding`
  - Заменён `thinking: { type: "adaptive" }` + невалидный `effort: "high"` на `thinking: { type: "enabled", budgetTokens: N }`; `temperature` вынесен в else-ветку (не передаётся при активном thinking). SDK warning "temperature is not supported when thinking is enabled" исчез из логов.

### Findings (Этап 3)
- **Finding #2 — Anthropic API не разделяет thinking tokens от completion в usage.** Обнаружено исходниками @ai-sdk/anthropic@3.0.66 ([dist/index.js:1646-1659](../../node_modules/@ai-sdk/anthropic/dist/index.js#L1646)): `outputTokens.reasoning` всегда `void 0` — Anthropic Messages API в response возвращает единое поле `output_tokens` без разделения thinking vs completion. Следствие: `thinkingTokens` для Anthropic-моделей в `ai_usage_log` **архитектурно всегда 0**, независимо от работы extended thinking. Не баг кода — ограничение API. **Практический вывод для биллинга:** pricing корректен (thinking tokens уже включены в `outputTokens × output_price`), разделение не требуется для cost calculation; отсутствует только аналитика «сколько модель думала».

### Validation
- `npx tsc --noEmit` — 0 ошибок на каждом шаге.
- `npm run build` — successful (migrations 3360ms + compile 10.1s + 62/62 static pages).
- **Этап 2 мануальный тест (владелец):** 3 golden path (Simply chat, Expertise, artifact:markdown) + повторные прогоны с overrides на 4 разных моделях (Sonnet, Grok 4.1 Fast non-reasoning/reasoning, Grok 4.20 non-reasoning) — safety-net `Math.min(16384, 16000)` сработал на Grok artifact overrides, 0 warning'ов safety-net на дефолтах, 0 UND_ERR.
- **Этап 3 мануальный тест (владелец):** проект «AI для стоматологической диагностики» на Opus 4.6 default, cap 32000, streamText + thinking enabled budget 16000. POST 200 за 146 секунд, план успешно создан (7 задач, 5992 chars report, 13679 chars json), без warning'ов AI SDK, без UND_ERR_SOCKET. Архитектурный инвариант Этапа 3 подтверждён.

### Files (Этап 3)
- `app/(chat)/api/projects/[id]/plan/route.ts` — modified
- `lib/ai/professors/task-reviewer.ts` — modified (thinking config fix)
- `app/(chat)/api/service-chat/route.ts` — modified (thinking config fix)
- `specs/TZ_AISDKLayerHardening/FINDINGS.md` — updated (Finding #2)
- `specs/TZ_AISDKLayerHardening/ROADMAP.md` — updated (Этап 3 закрыт, критерий переформулирован)
- `specs/TZ_AISDKLayerHardening/CHANGELOG.md` — updated (this entry)
