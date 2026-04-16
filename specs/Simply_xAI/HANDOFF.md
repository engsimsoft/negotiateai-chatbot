# HANDOFF — Серия Simply_xAI миграции

**Последнее обновление:** 2026-04-16 (финализация ТЗ-XAI-4 + v3.92.0 release + archive)
**Текущая версия проекта:** **3.92.0** (bumped с 3.91.0 коммитом `583ef03`)
**Git state:** локальный `claude/angry-nobel` (worktree), **28 коммитов ahead of origin**, не отпушено
**Последние коммиты локального master (сверху вниз):**
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

**Правило из сессии 2026-04-16:** **Empirical test перед model-blame.** Не диагностировать AI-output проблему как «model-specific weakness» без empirical теста на 2+ моделях. Memory: [`feedback_empirical_test_before_model_blame.md`](~/.claude/projects/-Users-mactm-Projects-NegotiateAI-Chatbot/memory/feedback_empirical_test_before_model_blame.md). Инцидент: приписал briefing author URL hallucination «слабости MiniMax», empirical тест показал 82% fabricated на Grok 4.20 (vs 91% MiniMax) — это architectural/prompt issue, не model issue.

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
- [ ] **ТЗ-XAI-6** — Очистка MiniMax/OpenRouter (**следующий в серии**, ожидает закрытия [TZ_BriefingAuthorUrlHallucination](../_backlog/TZ_BriefingAuthorUrlHallucination.md))
- [ ] ТЗ-XAI-COL-1 — Collections API для Библиотеки
- [ ] ТЗ-XAI-MA-1 — Premium «Команда агентов» (Responses API + MCP), `expertise-multi-agent` taskId уже зарезервирован

---

## ⏭ Что дальше — варианты для следующей сессии

Серия ТЗ-XAI-4 полностью закрыта (включая scope expansion, покрывший XAI-5). Следующий шаг в серии — **ТЗ-XAI-6 cleanup**, но он **заблокирован** на [TZ_BriefingAuthorUrlHallucination](../_backlog/TZ_BriefingAuthorUrlHallucination.md): пока briefing author/section/podcast-script остаются на MiniMax, namespace `minimax` и каталог нужны.

### Вариант A — закрыть High-impact блокер (рекомендуется)

**[TZ_BriefingAuthorUrlHallucination](../_backlog/TZ_BriefingAuthorUrlHallucination.md)** 🟥 (1-2 сессии)

Empirical confirmed: 82-91% fabricated URLs на 4 разных моделях. Architectural issue, не model issue. Решение — structured output через `generateObject` + `z.enum([...allowedUrlsFromFilter])` — модель физически не сможет генерировать URL вне списка из filter stage.

**Почему первым:**
1. Критично перед production релизом briefing (качество продукта)
2. Разблокирует ТЗ-XAI-6 (можно будет убрать MiniMax)
3. Empirical данные уже собраны, scope ясен, риск низкий
4. Паттерн `generateObject` + `z.enum` применим и к другим pipeline стадиям (bonus migration)

### Вариант B — закрыть второй High-impact блокер

**[TZ_DevOverridesSideEffectImportAudit](../_backlog/TZ_DevOverridesSideEffectImportAudit.md)** 🟥 (0.5-1 сессия)

6+ backend routes без `import "@/lib/ai/model-overrides-node"` → dev panel overrides молча игнорируются. Блокирует все будущие A/B тесты. Рекомендованное решение — `instrumentation.ts` register-on-boot + ADR 048 update.

**Почему можно вторым:**
1. Быстрое закрытие (одна сессия)
2. Инфраструктурный фикс — разблокирует future debugging
3. Не влияет напрямую на продукт, но экономит сессии в будущем

### Вариант C — ТЗ-XAI-6 cleanup **после** закрытия TZ_BriefingAuthorUrlHallucination

Очистка зоопарка:
- Удалить из `registry.ts` namespace `minimax`, `minimaxLong`, `openrouter`
- Удалить из `model-catalog.ts` все MiniMax и OpenRouter записи (кроме RESERVED `grok-4.20-multi-agent-0309` — она Grok, не MiniMax)
- Удалить из `task-assignments.ts` все ссылки
- Удалить файлы/функции: `stripMiniMaxToolParts`, `stripLegacyOpenAICompatToolParts`, `isSimplyNonAnthropicModel`
- Удалить `vercel-minimax-ai-provider` из `package.json`
- Удалить env `MINIMAX_API_KEY` из Vercel

### Вариант D — Medium-impact хвосты

7 Medium хвостов в [specs/_backlog/README.md](../_backlog/README.md). Решает Владимир по приоритету.

---

## 📦 Открытые хвосты (backlog) после ТЗ-XAI-4

### 🟥 High impact (3)

1. **[TZ_BriefingAuthorUrlHallucination](../_backlog/TZ_BriefingAuthorUrlHallucination.md)** — **блокирует ТЗ-XAI-6**. Architectural, не model issue
2. **[TZ_DevOverridesSideEffectImportAudit](../_backlog/TZ_DevOverridesSideEffectImportAudit.md)** — 6+ routes без reader import
3. **[TZ_ErrorRecoveryUI Stage 2](../_backlog/TZ_ErrorRecoveryUI.md)** — useChat state recovery, Stage 1 ✅ в v3.90.0+

### 🟧 Medium impact (8)

1. [TZ_ServiceChatNotOverridable](../_backlog/TZ_ServiceChatNotOverridable.md) — 3 дыры (UI + backend + docs)
2. [TZ_DevPanelFooterHidesSubCalls](../_backlog/TZ_DevPanelFooterHidesSubCalls.md) — nested subcalls invisible
3. [TZ_TaskExpertChatInputMissingOnFirstOpen](../_backlog/TZ_TaskExpertChatInputMissingOnFirstOpen.md) — useChat state bug
4. [TZ_ProfessorPlanStreaming](../_backlog/TZ_ProfessorPlanStreaming.md) — long-term fix max_tokens timeout
5. [TZ_MaxOutputTokensAudit](../_backlog/TZ_MaxOutputTokensAudit.md) — явный maxOutputTokens везде
6. [TZ_SimplyContextUsageWidget](../_backlog/TZ_SimplyContextUsageWidget.md) — виджет контекста не ту шкалу
7. [TZ_PromptsDeadCodeCleanup](../_backlog/TZ_PromptsDeadCodeCleanup.md) — 90% prompts.ts dead
8. [TZ_SimplyChatRaceCondition](../_backlog/TZ_SimplyChatRaceCondition.md) — partial unique index

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

**28 коммитов ahead of origin.** Все локальные на ветке `claude/angry-nobel`. Push — отдельная команда Владимира (не делать самому).

```
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

---

## 🚀 Рекомендованный старт следующей сессии

```
1. Прочитать этот HANDOFF (5-10 мин)
2. Прочитать SIMPLY_XAI_NOTES.md две записи 2026-04-16 (10 мин)
3. Прочитать MEMORY.md целиком (2 мин) — особенно empirical-test-before-model-blame
4. git log --oneline -10 — проверить что 28 коммитов ahead of origin, HEAD на fdfd03f
5. cat package.json | grep version — проверить что 3.92.0
6. ls .simply-dev-overrides.json — должно быть «нет такого файла» (чистое состояние)
7. npm run dev в background + curl http://localhost:3000 → HTTP 307
8. Обсудить с Владимиром варианты (A/B/C/D из секции «Что дальше»):
   - A 🟥 TZ_BriefingAuthorUrlHallucination (рекомендуется, 1-2 сессии, разблокирует ТЗ-XAI-6)
   - B 🟥 TZ_DevOverridesSideEffectImportAudit (0.5-1 сессия, инфраструктурный)
   - C 📋 ТЗ-XAI-6 cleanup (ждёт закрытия A)
   - D 🟧 Medium-impact хвосты (7 штук)
9. Запустить выбранный вариант по стандартному WORKFLOW (ANALYSIS → ROADMAP → код → финализация → архив)
```

---

**ТЗ-XAI-4 завершена. v3.92.0 зарелижен локально. 28 коммитов ahead of origin, push — решение Владимира.**

**Семь раз отмерь, один раз отрежь.** Rule №0.

**Empirical test перед model-blame.** Rule из этой серии.

**После любой правки `next.config.ts` — `rm -rf .next && npm run dev`.**

**Dev overrides reader — любой новый backend route с `getModel()` обязан импортировать `@/lib/ai/model-overrides-node`.** Или ждать закрытия [TZ_DevOverridesSideEffectImportAudit](../_backlog/TZ_DevOverridesSideEffectImportAudit.md) с централизованным решением.
