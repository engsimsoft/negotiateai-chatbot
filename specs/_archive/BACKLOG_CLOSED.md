# Backlog — журнал закрытых долгов

> Исторический реестр закрытых backlog-долгов. SSOT для вопросов «а был ли долг X и чем закончился».
>
> **Правило:** при закрытии долга (см. [`specs/_backlog/README.md`](../_backlog/README.md)) запись добавляется СЮДА, а не в README. README держит только открытые.
>
> Файл создан: 2026-04-21 (восстановлен ретроспективно по содержимому [`specs/_backlog/_archive/`](../_backlog/_archive/) + git log). До этой даты долги закрывались без журнала.

---

## Закрытые долги

| ТЗ | Дата закрытия | Версия / commit | Как закрыт | Файл архива |
|---|---|---|---|---|
| TZ_GrokContextWindowAudit | 2026-04-14 | v3.88.0 / `ba9e928` | Решено в ТЗ-XAI-1: contextWindow привязка к провайдерскому окну признана антипаттерном (вечный чат + Lost in the Middle) | [_backlog/_archive/TZ_GrokContextWindowAudit.md](../_backlog/_archive/TZ_GrokContextWindowAudit.md) |
| TZ_BriefingAuthorUrlHallucination | 2026-04-16 | `eeba086` | Superseded: фикс `normalizeUrlForComparison` показал что это metric bug, не галлюцинация моделей | [_backlog/_archive/TZ_BriefingAuthorUrlHallucination.md](../_backlog/_archive/TZ_BriefingAuthorUrlHallucination.md) |
| TZ_ServiceChatNotOverridable | 2026-04-16 | `5c0a22e` | Closed в scope ТЗ-XAI-6 correction (briefing хвосты) | [_backlog/_archive/TZ_ServiceChatNotOverridable.md](../_backlog/_archive/TZ_ServiceChatNotOverridable.md) |
| TZ_TaskExpertChatInputMissingOnFirstOpen | 2026-04-17 | `a7d1a3f` | Fix: `multimodal-input` теперь рендерится при первом открытии task expert chat (project-creation prompt guard). Файл удалён без переноса в `_backlog/_archive/` | (нет файла, см. commit `a7d1a3f`) |
| TZ_DevPanelFooterHidesSubCalls | 2026-04-17 | `6b3b61d` | Fix: footer aggregates all nested AI sub-calls (artifacts, tools, clerks) | [_backlog/_archive/TZ_DevPanelFooterHidesSubCalls.md](../_backlog/_archive/TZ_DevPanelFooterHidesSubCalls.md) |
| TZ_ErrorRecoveryUI | 2026-04-17 | `e703e6c` | Stage 1 — выполнен в v3.90.0+. Stage 2 — closed as cannot-reproduce | [_backlog/_archive/TZ_ErrorRecoveryUI.md](../_backlog/_archive/TZ_ErrorRecoveryUI.md) |
| TZ_UrlVerificationMetricNormalization | 2026-04-17 | `bd97b73` | Follow-up hardening: extract `normalizeUrlForComparison` + expand tracking params | [_backlog/_archive/TZ_UrlVerificationMetricNormalization.md](../_backlog/_archive/TZ_UrlVerificationMetricNormalization.md) |
| TZ_PromptsDeadCodeCleanup | 2026-04-17 | `3c64f9c` | Удалён мёртвый код из `lib/ai/prompts.ts`, файл переименован в `artifact-prompts.ts` | [_backlog/_archive/TZ_PromptsDeadCodeCleanup.md](../_backlog/_archive/TZ_PromptsDeadCodeCleanup.md) |
| TZ_SimplyContextUsageWidget | 2026-04-17 | `01f154f` | Superseded: поглощён архитектурой Simply Compaction (ТЗ-COMPACTION-1) | [_backlog/_archive/TZ_SimplyContextUsageWidget.md](../_backlog/_archive/TZ_SimplyContextUsageWidget.md) |
| TZ_SimplyChatRaceCondition | 2026-04-17 | `84c5fb5` | Fix: partial unique index на `(userId, chatMode='simply')` | [_backlog/_archive/TZ_SimplyChatRaceCondition.md](../_backlog/_archive/TZ_SimplyChatRaceCondition.md) |
| TZ_DevOverridesSideEffectImportAudit | 2026-04-17 | `c4b2b63` | Fix: централизованный overrides reader через `instrumentation.ts` (ТЗ-AISDKLayerHardening) | [_backlog/_archive/TZ_DevOverridesSideEffectImportAudit.md](../_backlog/_archive/TZ_DevOverridesSideEffectImportAudit.md) |
| TZ_MaxOutputTokensAudit | 2026-04-18 | v3.93.0 / `a2b0a3d` | Closed в ТЗ-AISDKLayerHardening: SSOT `DEFAULT_MAX_OUTPUT_TOKENS` + safety-net getter на 37 taskId | [_backlog/_archive/TZ_MaxOutputTokensAudit.md](../_backlog/_archive/TZ_MaxOutputTokensAudit.md) |
| TZ_ProfessorPlanStreaming | 2026-04-18 | v3.93.0 / `a2b0a3d` | Closed в ТЗ-AISDKLayerHardening: архитектурный инвариант «cap > 21333 на Anthropic ⇒ streamText» (ADR 053) | [_backlog/_archive/TZ_ProfessorPlanStreaming.md](../_backlog/_archive/TZ_ProfessorPlanStreaming.md) |
| TZ_UtilTitleCapReasoningMargin | 2026-04-18 | v3.94.0 / `f221aee` | Closed в финализации ТЗ-COMPACTION-1, файл удалён без переноса в `_backlog/_archive/` | (нет файла, см. commit `f221aee`) |
| TZ_UnifyContextThresholdBase | 2026-04-21 | v3.95.0 / `969b0b4` | Closed в финализации ТЗ-COMPACTION-UNIFY | [_backlog/_archive/TZ_UnifyContextThresholdBase.md](../_backlog/_archive/TZ_UnifyContextThresholdBase.md) |
| TZ_MindConsolidationTriggers | 2026-04-21 | v3.96.0 (ТЗ-MindOnVisit) / v3.97.0 (ТЗ-MindDeepConsolidation) | Triggers пересмотрены: on-visit обработка хвостов + ночная reasoning-консолидация. Архивирован без отдельного коммита | [_backlog/_archive/TZ_MindConsolidationTriggers.md](../_backlog/_archive/TZ_MindConsolidationTriggers.md) |
| TZ_BriefingStuckRecovery | 2026-04-26 | v3.99.1 | Watchdog (markStuckBriefingsAsFailed, 4 точки подключения) + UPSERT pipeline (один row на прогон) + UI-баннер lastAttemptFailed на /briefing | [_archive/TZ_BriefingStuckRecovery/](../TZ_BriefingStuckRecovery/) |
| TZ_SimplyChatMemoryRegression | 2026-04-27 | v3.100.0 / `b17b932` + hotfix v3.100.1 / `3b1fcff` | Closed в ТЗ-FixSimplyMemory: убран фильтр `excludeExtracted=true` для Simply, дедупликация в pre-compact extract через `CompactionContext.alreadyExtractedIds`. Hotfix v3.100.1 добил вторую дыру (LIMIT 200 ломал prefix → xAI cache) и добавил `x-grok-conv-id`. См. ADR 057. | [_backlog/_archive/TZ_SimplyChatMemoryRegression.md](../_backlog/_archive/TZ_SimplyChatMemoryRegression.md) |

---

## Правила ведения

1. Записи **только добавляются** (append-only). Не редактировать прошлые строки кроме явных ошибок.
2. Дата — день фактического закрытия (не создания файла), берётся из git log архивирующего коммита.
3. Версия — semver-релиз в `CHANGELOG.md`, если применимо (некоторые долги закрываются между релизами — тогда только commit hash).
4. «Как закрыт» — одно предложение: fix / superseded / cannot-reproduce / closed in scope of ТЗ-X.
5. Если файл архива отсутствует (исторические случаи удаления без переноса) — отметить «(нет файла)» + commit, чтобы можно было поднять контекст из git history.
