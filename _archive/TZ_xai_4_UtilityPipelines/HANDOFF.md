# HANDOFF — TZ_XAI_4_UtilityPipelines (архивная запись)

**Статус:** ✅ Завершено 2026-04-16 (v3.92.0, commit `583ef03`)
**Архивируется в:** `_archive/TZ_xai_4_UtilityPipelines/`

> Эта папка архивируется вместе с ANALYSIS.md и ROADMAP.md как исторический артефакт серии Simply_xAI. Активные ссылки живут в [../SIMPLY_XAI_CHANGELOG.md](../SIMPLY_XAI_CHANGELOG.md) (запись v3.92.0), [../SIMPLY_XAI_ROADMAP.md](../SIMPLY_XAI_ROADMAP.md) (отметка ✅) и [../SIMPLY_XAI_NOTES.md](../SIMPLY_XAI_NOTES.md) (две записи 2026-04-16).

---

## Что задумывали (исходный scope)

Из ANALYSIS.md — 7 taskId (briefing:filter + 4 clerk/util + meeting:summary + artifact-suggestions). Из ROADMAP.md — 3 этапа (smoke test → подсобка → зал) + финализация.

## Что получилось (фактический scope)

**11 taskId** переключены в одной сессии. Исходный scope расширен Владимирскими IDE edits на 4 точки «зала» (expertise, create, simply-chat-think variant, memory:extract variant) по empirical данным из Этапа 2 (professor:planning + project:expert успешно работали на Grok 4.20 reasoning через dev override).

**Scope expansion как паттерн серии:** Владелец как product-owner расширяет scope ТЗ напрямую в коде когда empirical данные дают уверенности, обходя формальные этапы. Фиксация в append-only log SIMPLY_XAI_NOTES.md.

**Побочный эффект:** ТЗ-XAI-5 (create + expertise + R-5) закрыт без отдельного релиза.

## Ключевые находки (подробности в NOTES)

1. **xAI prompt caching автоматический** — smoke test streamObject показал 160/405 tokens cached без `providerOptions.xai.cacheControl`
2. **Grok 4.20 reasoning сильнее ожиданий на multi-step** — подтверждено empirically на professor:planning, project:expert, briefing:author, task expert chat
3. **briefing:author URL hallucination = architectural, не model issue** — 82-91% fabricated на 4 моделях. Блокирует ТЗ-XAI-6 cleanup MiniMax
4. **Dev overrides global gap** — 6+ backend routes без reader import. Hot-fix закрыл 4 routes (plan + 3 briefing), остальные в [TZ_DevOverridesSideEffectImportAudit](../../_backlog/TZ_DevOverridesSideEffectImportAudit.md)
5. **Non-streaming generateText + большой maxOutputTokens = timeout-bomb** — Anthropic требует streaming для `max_tokens > 21333`. Hot-fix tactical `16000`, long-term — [TZ_ProfessorPlanStreaming](../../_backlog/TZ_ProfessorPlanStreaming.md)
6. **Reserved vs deprecated семантика** — запись `grok-4.20-multi-agent-0309` осталась после снятия expertise с multi-agent variant, но это RESERVED под ТЗ-XAI-MA-1 (placeholder taskId `expertise-multi-agent` + 🔒 маркер)

## Коммиты

- `ceadd17` — ТЗ-XAI-4 Этап 2: 6 taskId подсобки
- `d9d3488` — Hot-fix plan/route.ts
- `d1e2c12` — 2 backlog хвоста (DevPanelFooter + TaskExpertInput)
- `676d50d` — ТЗ-XAI-4 Этапы 2+3 + scope expansion + briefing hot-fix + 2 backlog хвоста
- `2ca1ac5` — HANDOFF v1 + audit metadata fix
- `2fbc50b` — follow-up: multi-agent RESERVED + dead constants + DevPanel labels
- `5b1a141` — HANDOFF v2
- `583ef03` — **release(v3.92.0)** с финализацией

## 7 backlog хвостов зафиксированы (все pre-existing bugs, найдены в сессии)

**Из Этапов 2+3 (4 штуки):**
- 🟥 [TZ_BriefingAuthorUrlHallucination](../../_backlog/TZ_BriefingAuthorUrlHallucination.md) (High)
- 🟧 [TZ_ServiceChatNotOverridable](../../_backlog/TZ_ServiceChatNotOverridable.md) (Medium)
- 🟧 [TZ_DevPanelFooterHidesSubCalls](../../_backlog/TZ_DevPanelFooterHidesSubCalls.md) (Medium)
- 🟧 [TZ_TaskExpertChatInputMissingOnFirstOpen](../../_backlog/TZ_TaskExpertChatInputMissingOnFirstOpen.md) (Medium)

**Из Этапа 4 финализации (3 штуки):**
- 🟥 [TZ_DevOverridesSideEffectImportAudit](../../_backlog/TZ_DevOverridesSideEffectImportAudit.md) (High)
- 🟧 [TZ_ProfessorPlanStreaming](../../_backlog/TZ_ProfessorPlanStreaming.md) (Medium)
- 🟧 [TZ_MaxOutputTokensAudit](../../_backlog/TZ_MaxOutputTokensAudit.md) (Medium)

## Memory rules добавлены

- `feedback_empirical_test_before_model_blame.md` — правило empirical теста на 2+ моделях перед диагностикой «weakness модели X»

## Что НЕ сделано (и почему)

- `briefing:author` / `briefing:section` / `briefing:podcast-script` — остаются на MiniMax M2.7 до закрытия TZ_BriefingAuthorUrlHallucination. Empirical подтверждено что смена модели не решает URL hallucination — это prompt/architectural issue
- `professor:*` — не тронуты, premium tier (Q1 решение)
- `project:expert:*` — не тронуты, tier system
- `service-chat:*` — не в scope (Q4, отдельное ТЗ связано с TZ_ServiceChatNotOverridable)
- `artifact:*` — Q2 витрина, остаются на Sonnet
- `vision:ocr` — Haiku 4.5 capability-критично

## Связанные документы активной серии

- [../SIMPLY_XAI_ROADMAP.md](../SIMPLY_XAI_ROADMAP.md) — отметка ✅ v3.92.0
- [../SIMPLY_XAI_CHANGELOG.md](../SIMPLY_XAI_CHANGELOG.md) — запись v3.92.0
- [../SIMPLY_XAI_NOTES.md](../SIMPLY_XAI_NOTES.md) — 2 append-only записи 2026-04-16
- [../HANDOFF.md](../HANDOFF.md) — живой мост между сессиями серии

---

**Архивировано Claude Code 2026-04-16** при финализации ТЗ-XAI-4 (Этап 4). Исходные ANALYSIS.md и ROADMAP.md в папке сохранены без правок как исторический артефакт (план vs реальность).
