# HANDOFF — Серия Simply_xAI миграции

**Последнее обновление:** 2026-04-16 (**correction URL hallucination** — была metric bug, не архитектура. Commits `58d9d2e` + `eeba086` + финал этого HANDOFF)
**Текущая версия проекта:** **3.92.0**
**Git state:** локальный `claude/angry-nobel` (worktree), **32 коммита ahead of origin**, не отпушено
**Последние коммиты локального master (сверху вниз):**
- `<этот HANDOFF commit>` docs(xai-migration): HANDOFF update после metric bug correction + memory rule + root CHANGELOG
- `eeba086` docs(xai-migration): correction URL hallucination diagnosis + archive superseded backlog
- `58d9d2e` **fix(pipeline-trace)**: URL normalization в verifyArticleUrls — metric bug, не архитектурная галлюцинация
- `2c9bcb3` docs(xai-migration): fix HANDOFF self-references
- `05c7cb5` docs(xai-migration): финальный HANDOFF после v3.92.0 + ТЗ-XAI-4 финализация
- `fdfd03f` chore(xai-migration): archive TZ_xai_4_UtilityPipelines after v3.92.0
- `583ef03` **release(v3.92.0)**: ТЗ-XAI-4 — 11 taskId на Grok + 2 hot-fixes + 3 новых backlog хвоста
- `00b7f33` Merge branch 'claude/stoic-wu' (README.md + SIMPLY_PRODUCT_VISION.md rewrite)
- `6649d2f` docs: переписать SIMPLY_PRODUCT_VISION.md и README.md
- `5b1a141` docs(xai-migration): HANDOFF update after follow-up 2fbc50b
- `2fbc50b` docs(xai-migration): expertise-multi-agent reservation + dead briefing constants + DevPanel Grok labels
- `2ca1ac5` docs(xai-migration): HANDOFF после ТЗ-XAI-4 Этапов 2+3 + scope expansion
- `676d50d` feat(xai-migration): TZ_XAI_4 Этапы 2+3 + scope expansion
- `d1e2c12` docs(backlog): 2 новых хвоста (DevPanelFooter + TaskExpertInput)
- `d9d3488` fix(professor): plan route hot-fix
- `ceadd17` feat(xai-migration): TZ_XAI_4 Этап 2

Этот документ — **мост между сессиями**, не замена ROADMAP. За детальными задачами — карточка архивированного ТЗ в [_archive/TZ_xai_4_UtilityPipelines/HANDOFF.md](../../_archive/TZ_xai_4_UtilityPipelines/HANDOFF.md) или записи в [SIMPLY_XAI_CHANGELOG.md](SIMPLY_XAI_CHANGELOG.md) (v3.92.0) и [SIMPLY_XAI_NOTES.md](SIMPLY_XAI_NOTES.md) (две записи 2026-04-16).

---

## ⛔ Правило №0 перед любой работой: «Семь раз отмерь — один раз отрежь»

**Это закон, не рекомендация.**

**Перед любой реализацией:**

1. **Изучить официальную документацию** внешних технологий — WebSearch + WebFetch актуальной документации SDK/API/библиотек. Knowledge cutoff = май 2025, всё новое **обязательно** читать заново
2. **Изучить лучшие практики** — WebSearch на «best practices for X», GitHub issues, Stack Overflow для современных решений 2026
3. **ANALYSIS против реального кода** — прочитать все файлы зоны работы, свериться с SSOT документами (SIMPLY_ATTACHMENT_ARCHITECTURE.md, MIND_ARCHITECTURE.md, model-catalog.ts, task-assignments.ts, CLAUDE.md)
4. **Только потом** — план, код, тесты

**Правило из сессии 2026-04-16:** **Empirical test перед model-blame + validate the metric itself.** Не диагностировать AI-output проблему как «model-specific weakness» без empirical теста на 2+ моделях, **и** без проверки кода самой метрики. Memory: [`feedback_empirical_test_before_model_blame.md`](~/.claude/projects/-Users-mactm-Projects-NegotiateAI-Chatbot/memory/feedback_empirical_test_before_model_blame.md).

**Мета-инцидент 2026-04-16** (3 раунда неверной диагностики до дна):
- Раунд 1 (моя ошибка): «MiniMax weakness на URL attribution» (82-91% fabricated)
- Раунд 2 (Владимир): «Sonnet в onboarding выдумывает источники» — опровергнуто curl-проверкой всех 5 источников (HTTP 200)
- Раунд 3 (реальный): метрика `fabricated` использует наивное `Set.has(url)` без нормализации — любая форматная разница (UTM, anchor, trailing slash) → ложный positive

Правило усилено: перед выводами о модели/промпте/архитектуре на основе observability метрики — **прочитать код метрики**, понять что она считает, на каких edge cases даст ложный результат. Rule №0 «семь раз отмерь» не охватывал проверку измерительного инструмента — теперь охватывает. См. [SIMPLY_XAI_NOTES.md](SIMPLY_XAI_NOTES.md) 2026-04-16 «Correction: URL hallucination была не галлюцинацией».

---

## Прогресс серии Simply_xAI

- [x] **ТЗ-XAI-1** — Фундамент (v3.88.0)
- [x] **ТЗ-XAI-2** — MIND pipeline → Grok (v3.89.0)
- [x] **ТЗ-XAI-3** — KITT + Think → Grok (v3.90.0 + v3.90.2 correction)
- [x] **ТЗ-SimplyChatModeInjection** (v3.90.1)
- [x] **ТЗ-SimplyReadDocumentTool + R-6 correction** (v3.90.2)
- [x] **ТЗ-ATTACH-1** — PDF text extraction при upload (v3.91.0)
- [x] **ТЗ-XAI-4** — Utility/Pipeline batch миграция + scope expansion (**v3.92.0 завершён 2026-04-16**)
- [x] **ТЗ-XAI-5** — ✅ закрыт через scope expansion ТЗ-XAI-4 (create + expertise + R-5)
- [x] **ТЗ-XAI-6** — Финализация серии (**v3.92.1**, commit `<release>`) — dead code cleanup. MiniMax и OpenRouter остаются by design. Серия Simply_xAI **закрыта**
- [ ] ТЗ-XAI-COL-1 — Collections API для Библиотеки
- [ ] ТЗ-XAI-MA-1 — Premium «Команда агентов» (Responses API + MCP), `expertise-multi-agent` taskId уже зарезервирован

---

## ⏭ Что дальше — варианты для следующей сессии

**ТЗ-XAI-4 закрыта** (включая scope expansion, покрывший XAI-5). **Блокер ТЗ-XAI-6 снят** после correction 2026-04-16 (commits `58d9d2e` + `eeba086`): «URL hallucination» оказалась metric bug (naive `Set.has()` без нормализации), а не architectural issue моделей. briefing:author на MiniMax работает корректно — миграция на Grok теперь вопрос cleanup, не качества.

### Вариант A — ~~ТЗ-XAI-6~~ ✅ закрыт в v3.92.1

Серия Simply_xAI закрыта. Следующие варианты на выбор:

### Вариант B (теперь основной) — TZ_DevOverridesSideEffectImportAudit 🟥 (0.5-1 сессия)

6+ backend routes без `import "@/lib/ai/model-overrides-node"` → dev panel overrides молча игнорируются. Блокирует все будущие A/B тесты — а Вариант A требует empirical smoke test. **Стоит сделать Вариант B перед A** если планируется тест на нескольких моделях briefing:author.

Рекомендованное решение: `instrumentation.ts` register-on-boot + ADR 048 update. Одна архитектурная точка вместо 11 side-effect импортов.

### Вариант C — Medium-impact хвосты

7 Medium хвостов в [specs/_backlog/README.md](../_backlog/README.md): ServiceChatNotOverridable, DevPanelFooterHidesSubCalls, TaskExpertChatInputMissingOnFirstOpen, ProfessorPlanStreaming, MaxOutputTokensAudit, UrlVerificationMetricNormalization, SimplyContextUsageWidget, PromptsDeadCodeCleanup, SimplyChatRaceCondition.

### Вариант D — Пауза на серии, переключение на другое направление

Серия Simply_xAI закрывает ~95% миграционных целей. Если есть продуктовые приоритеты вне неё — можно отвлечься на них.

### Рекомендация порядка

**B → A → C** если хочется максимальную чистоту:
1. B разблокирует A/B тесты (одна сессия)
2. A финализирует серию и убирает MiniMax (1-2 сессии)
3. Потом Medium хвосты по приоритету владельца

**A → B** если хочется быстрее закрыть MiniMax cleanup:
- А не требует A/B теста если смотреть DevPanel urlVerification напрямую (теперь метрика работает корректно)
- B можно отложить — остальные dev-overrides касаются service-chat и некритичных утилит

---

## 📦 Открытые хвосты (backlog) после ТЗ-XAI-4

### 🟥 High impact (2)

1. **[TZ_DevOverridesSideEffectImportAudit](../_backlog/TZ_DevOverridesSideEffectImportAudit.md)** — 6+ routes без reader import
2. **[TZ_ErrorRecoveryUI Stage 2](../_backlog/TZ_ErrorRecoveryUI.md)** — useChat state recovery, Stage 1 ✅ в v3.90.0+

### 🟧 Medium impact (8)

1. [TZ_ServiceChatNotOverridable](../_backlog/TZ_ServiceChatNotOverridable.md) — 3 дыры (UI + backend + docs)
2. [TZ_DevPanelFooterHidesSubCalls](../_backlog/TZ_DevPanelFooterHidesSubCalls.md) — nested subcalls invisible
3. [TZ_TaskExpertChatInputMissingOnFirstOpen](../_backlog/TZ_TaskExpertChatInputMissingOnFirstOpen.md) — useChat state bug
4. [TZ_ProfessorPlanStreaming](../_backlog/TZ_ProfessorPlanStreaming.md) — long-term fix max_tokens timeout
5. [TZ_MaxOutputTokensAudit](../_backlog/TZ_MaxOutputTokensAudit.md) — явный maxOutputTokens везде
6. [TZ_UrlVerificationMetricNormalization](../_backlog/TZ_UrlVerificationMetricNormalization.md) — follow-up hardening после commit `58d9d2e` (основной фикс уже в production)
7. [TZ_SimplyContextUsageWidget](../_backlog/TZ_SimplyContextUsageWidget.md) — виджет контекста не ту шкалу
8. [TZ_PromptsDeadCodeCleanup](../_backlog/TZ_PromptsDeadCodeCleanup.md) — 90% prompts.ts dead
9. [TZ_SimplyChatRaceCondition](../_backlog/TZ_SimplyChatRaceCondition.md) — partial unique index

### Закрытые в этой сессии

- ❌ **TZ_BriefingAuthorUrlHallucination** (архивирован как SUPERSEDED) — 82-91% fabricated URLs оказались metric bug, не issue моделей. Реальный фикс в commit `58d9d2e` (1 функция `normalizeUrlForComparison`). 3 раунда неверной диагностики — подробности в [SIMPLY_XAI_NOTES.md](SIMPLY_XAI_NOTES.md)

---

## 🔑 Критичное состояние для следующей сессии

### Dev server

Не запущен между сессиями. На старте: `npm run dev` в background + `curl -sI http://localhost:3000 | head -1` → HTTP 307.

### Dev overrides

Файл `.simply-dev-overrides.json` **отсутствует** (был очищен между сессиями). Если следующая сессия не A/B тестирует — не создавать. Если тестирует — создать чистый.

**⚠️ Готовность к A/B тестам неполная:** по [TZ_DevOverridesSideEffectImportAudit](../_backlog/TZ_DevOverridesSideEffectImportAudit.md) 6+ routes молча игнорируют overrides. Перед тестом конкретного taskId — grep на `import "@/lib/ai/model-overrides-node"` в его route. Если нет — hot-fix +1 import line как в `d9d3488` / `676d50d`.

### Voyage AI 403

Per memory `project_voyage_vpn.md`: Voyage блокирует финский VPN, US Buffalo лечит. MIND storage может быть сломан — это **не блокер** серии, но обращать внимание при MIND-related тестах.

### Git state

**29 коммитов ahead of origin.** Все локальные на ветке `claude/angry-nobel`. Push — отдельная команда Владимира (не делать самому).

```
05c7cb5 docs(xai-migration): финальный HANDOFF после v3.92.0
fdfd03f chore(xai-migration): archive TZ_xai_4_UtilityPipelines after v3.92.0
583ef03 release(v3.92.0): ТЗ-XAI-4 — 11 taskId на Grok + 2 hot-fixes + 3 новых backlog хвоста
00b7f33 Merge branch 'claude/stoic-wu'
6649d2f docs: переписать SIMPLY_PRODUCT_VISION.md и README.md
5b1a141 docs(xai-migration): HANDOFF update after follow-up 2fbc50b
2fbc50b docs(xai-migration): expertise-multi-agent reservation + dead briefing constants
2ca1ac5 docs(xai-migration): HANDOFF после ТЗ-XAI-4 Этапов 2+3
676d50d feat(xai-migration): TZ_XAI_4 Этапы 2+3 + scope expansion
d1e2c12 docs(backlog): 2 новых хвоста
d9d3488 fix(professor): plan route hot-fix
ceadd17 feat(xai-migration): TZ_XAI_4 Этап 2
1fc3603 docs(xai-migration): HANDOFF после v3.91.0
f6dbedd docs(backlog): add TZ_SimplyContextUsageWidget
6e6867b chore(backlog): archive TZ_ATTACH_1
dbe6bdf release(v3.91.0): TZ_ATTACH_1
b46c5d1 docs(xai-migration): HANDOFF после v3.90.2
59eb33a release(v3.90.2): TZ_SimplyReadDocumentTool + R-6
516d600 release(v3.90.1): TZ_SimplyChatModeInjection
86de8ad docs(xai-migration): HANDOFF после ТЗ-XAI-3
fc8a995 fix(error-recovery): TZ_ErrorRecoveryUI Stage 1
8dfac7f release(v3.90.0): ТЗ-XAI-3
... (ниже ТЗ-XAI-2 / 1 / AnthropicAliasCleanup / ModelCatalogDocumentFlags / ...)
```

### IDE контекст

Предыдущий Владимир работал в реальном проекте `cd3267a3-1c35-48e8-8e6a-b77eb71996ef` (тестовый для ТЗ-XAI-4). Можно использовать для следующей сессии или создать новый.

---

## 🎓 Архитектурные константы серии (версия v3.92.0)

1. **Защита контекста не привязана к размеру провайдерского окна.** Sliding window (140K) + Extract-on-compression (SIMPLY_CONTEXT_LIMIT 200K, SOFT 60%, HARD 80%) независимы
2. **Simply Chat «Думать» = tier upgrade.** `simply-chat` = Grok 4.1 Fast, `simply-chat-think` = Grok 4.20 **reasoning** (пересмотрено 2026-04-16 по empirical)
3. **`reasoning_effort` не передавать** в Grok 4.1 Fast / 4.20 — эмпирически падает `Bad Request`. Только multi-agent принимает
4. **`adaptHistoryToCapabilities` через SSOT model-catalog** — единственный механизм адаптации истории. Живёт в [chat/route.ts:252-344](../../app/(chat)/api/chat/route.ts#L252)
5. **Simply Chat = один persistent чат на пользователя** (после MIND/RAG). Тестирование `util:title` только через `/expertise` или `/create`, НЕ в `/simply`
6. **`capabilities.vision` ≠ `documentSupport.supported`.** Grok 4.1 Fast: vision=true, documentSupport.supported=false
7. **`serverExternalPackages` для ESM-first пакетов с worker dependencies.** `lamejs` + `pdf-parse` — оба требуют external declaration в `next.config.ts`
8. **После изменения `next.config.ts` — чистый rebuild обязателен.** `rm -rf .next && npm run dev`
9. **«Хвосты» = `_backlog/`.** Русский slang для backlog items
10. **Dev overrides global gap.** Reader `.simply-dev-overrides.json` регистрируется только при side-effect импорте `@/lib/ai/model-overrides-node` в backend routes. 6+ routes требуют audit. Scope в [TZ_DevOverridesSideEffectImportAudit](../_backlog/TZ_DevOverridesSideEffectImportAudit.md)
11. **Non-streaming `generateText` + большой `maxOutputTokens` = timeout-bomb.** Anthropic требует streaming для `max_tokens > 21333`. Для generateText всегда передавать **явный реалистичный `maxOutputTokens`** под output size задачи. Audit в [TZ_MaxOutputTokensAudit](../_backlog/TZ_MaxOutputTokensAudit.md)
12. **Empirical test перед model-blame.** Memory rule `feedback_empirical_test_before_model_blame.md`. Не диагностировать AI-output проблему как «weakness модели X» без теста на 2+ моделях. Prompt/architectural issues маскируются под model issues
13. **SSOT в коде > документация.** Добавлено в ai-chats-map.md header warning. Если таблицы в документе расходятся с task-assignments.ts — правда в коде
14. **xAI prompt caching автоматический.** Сервер кэширует system prompt без каких-либо `providerOptions.xai.cacheControl`. Ручная настройка не нужна
15. **Reserved vs deprecated семантика модели в каталоге.** Когда taskId снимается с активного использования, но запись каталога остаётся — различать «deprecated (удалить когда чисто)» и «reserved (placeholder под будущую фичу)». Reserved маркируется через placeholder taskId + подробный комментарий + cross-ref в ROADMAP. Пример: `expertise-multi-agent` taskId → `grok-4.20-multi-agent-0309` запись под ТЗ-XAI-MA-1
16. **Audit metadata hardcoded modelId проверка при миграции taskId.** При переключении taskId X в task-assignments — обязательно grep на hardcoded имя старой модели в audit metadata блоках и заменять на `getModelIdForTask("X")`. Иначе в БД пишется лживое значение. Пример: `meeting/regenerate/route.ts:91` имел `"claude-sonnet-4-6"` hardcoded
17. **🆕 Observability метрики канонизируются перед сравнением.** Сравнение URL / path / identifier в observability слое через `Set.has(rawValue)` — антипаттерн. Любая форматная разница (tracking params, anchor, trailing slash, case) даёт ложный positive. Канонизация обязательна: нормализовать оба сравниваемых значения функцией без побочек, потом Set.has. Живой пример — `normalizeUrlForComparison()` в [pipeline-trace.ts](../../lib/ai/pipeline-trace.ts) (2026-04-16, commit `58d9d2e`). Перед выводами о качестве модели на основе метрики — **читать код метрики**
18. **🆕 Целевая архитектура серии: 4 роли, 3 production провайдера + 1 dev-инструмент.** Подсобка = Grok 4.1 Fast, Кухня = MiniMax M2.7/M2.7-long, Зал = Grok 4.20, Автор = Claude Opus/Sonnet/Haiku. **OpenRouter** = dev-инструмент для тестирования новых моделей (GLM, Qwen, DeepSeek и т.д.) через `/dev/models` override — НЕ production-провайдер, но остаётся в каталоге, registry, env как есть. Полная формулировка владельца 2026-04-16 — [SIMPLY_XAI_NOTES.md](SIMPLY_XAI_NOTES.md) записи «Философия серии "4 роли, 3 провайдера"» и «ТЗ-XAI-6 финализация + OpenRouter как dev-инструмент»

---

## 🚀 Рекомендованный старт следующей сессии

```
1. Прочитать этот HANDOFF (5-10 мин)
2. Прочитать SIMPLY_XAI_NOTES.md 3 записи 2026-04-16 (15 мин) — особенно
   «Correction: URL hallucination была не галлюцинацией» (верхняя)
3. Прочитать MEMORY.md целиком (2 мин) — empirical-test-before-model-blame
   усилено: валидируй саму метрику, не только 2 модели
4. git log --oneline -12 — проверить что 32+ коммитов ahead of origin
5. cat package.json | grep version — 3.92.0
6. ls .simply-dev-overrides.json — «нет такого файла» (чистое состояние)
7. npm run dev в background + curl http://localhost:3000 → HTTP 307
8. Обсудить с Владимиром порядок:
   - Рекомендованный: B → A → C (чистый путь)
   - Быстрее: A → B (если хочется закрыть серию Simply_xAI сразу)
   - A 📋 ТЗ-XAI-6 cleanup MiniMax/OpenRouter (1-2 сессии) — блокер снят
   - B 🟥 TZ_DevOverridesSideEffectImportAudit (0.5-1 сессия)
   - C 🟧 Medium-impact хвосты (9 штук, решает Владимир по приоритету)
9. Запустить выбранный вариант по стандартному WORKFLOW (ANALYSIS → ROADMAP → код → финализация → архив)
```

---

**ТЗ-XAI-4 завершена. v3.92.0 зарелижен локально. Блокер ТЗ-XAI-6 снят (URL hallucination оказалась metric bug). 32 коммита ahead of origin, push — решение Владимира.**

**Семь раз отмерь, один раз отрежь + проверь сам метр.** Rule №0 усилено 2026-04-16.

**Empirical test перед model-blame + читать код метрики перед выводами.** Rule из этой серии усилено.

**После любой правки `next.config.ts` — `rm -rf .next && npm run dev`.**

**Dev overrides reader — любой новый backend route с `getModel()` обязан импортировать `@/lib/ai/model-overrides-node`.** Или ждать закрытия [TZ_DevOverridesSideEffectImportAudit](../_backlog/TZ_DevOverridesSideEffectImportAudit.md) с централизованным решением.
