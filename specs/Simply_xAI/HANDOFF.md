# HANDOFF — Серия Simply_xAI миграции

**Последнее обновление:** 2026-04-16 (конец плотной сессии — ТЗ-XAI-4 Этапы 2+3 + scope expansion + 4 hot-fixes + 4 новых backlog хвоста)
**Текущая версия проекта:** 3.91.0 (Этап 4 — version bump до 3.92.0 в следующей сессии)
**Git state:** локальный master, **18 коммитов ahead of origin**, не отпушено
**Последние коммиты локального master (сверху вниз):**
- `676d50d` feat(xai-migration): TZ_XAI_4 Этапы 2+3 + scope expansion — 5 доп taskId на Grok 4.20 reasoning + briefing hot-fix + 4 backlog хвоста
- `d1e2c12` docs(backlog): 2 новых хвоста — DevPanelFooterHidesSubCalls + TaskExpertChatInputMissingOnFirstOpen
- `d9d3488` fix(professor): plan route maxOutputTokens cap + dev overrides import
- `ceadd17` feat(xai-migration): TZ_XAI_4 Этап 2 — подсобка на Grok 4.1 Fast (6 taskId)
- `1fc3603` docs(xai-migration): HANDOFF после v3.91.0 + hygiene + новый хвост
- `f6dbedd` docs(backlog): add TZ_SimplyContextUsageWidget
- `dbe6bdf` release(v3.91.0): TZ_ATTACH_1 — PDF text extraction

Этот документ — **мост между сессиями**, не замена ROADMAP. За детальными задачами всегда иди в карточку ТЗ или `SIMPLY_XAI_CHANGELOG.md`. Полная история решений сессии — в [SIMPLY_XAI_NOTES.md](SIMPLY_XAI_NOTES.md) запись 2026-04-16 «ТЗ-XAI-4 Этапы 2+3 + scope expansion + 4 hot-fixes».

---

## ⛔ Правило №0 перед любой работой: «Семь раз отмерь — один раз отрежь»

**Это закон, не рекомендация.** Нарушение стоит $1 лишнего ТЗ и +1 смены контекста (доказано на трёх последних сессиях).

**Перед любой реализацией:**

1. **Изучить официальную документацию** внешних технологий — WebSearch + WebFetch актуальной документации SDK/API/библиотек. Knowledge cutoff = май 2025, всё новое **обязательно** читать заново
2. **Изучить лучшие практики** — WebSearch на «best practices for X», GitHub issues, Stack Overflow для современных решений 2026
3. **ANALYSIS против реального кода** — прочитать все файлы зоны работы, свериться с SSOT документами (SIMPLY_ATTACHMENT_ARCHITECTURE.md, MIND_ARCHITECTURE.md, model-catalog.ts, task-assignments.ts, CLAUDE.md)
4. **Только потом** — план, код, тесты

**Новое правило из сессии 2026-04-16 (ТЗ-XAI-4 Этап 2):**

**Empirical test перед model-blame.** Не диагностировать AI-output проблему как «model-specific weakness» без empirical теста на 2+ моделях. Зафиксировано в memory [`feedback_empirical_test_before_model_blame.md`](~/.claude/projects/-Users-mactm-Projects-NegotiateAI-Chatbot/memory/feedback_empirical_test_before_model_blame.md). Инцидент: приписал briefing author URL hallucination «слабости MiniMax», empirical тест показал 82% fabricated на Grok 4.20 (vs 91% MiniMax) — это architectural/prompt issue, а не model issue. Sonnet и Gemini исторически тоже галлюцинировали — метрика `fabricated` создана как universal детектор.

---

## Прогресс серии Simply_xAI

- [x] **ТЗ-XAI-1** — Фундамент (v3.88.0)
- [x] **ТЗ-XAI-2** — MIND pipeline → Grok (v3.89.0)
- [x] **ТЗ-XAI-3** — KITT + Think → Grok (v3.90.0 + v3.90.2 correction)
- [x] **ТЗ-SimplyChatModeInjection** (v3.90.1)
- [x] **ТЗ-SimplyReadDocumentTool + R-6 correction** (v3.90.2)
- [x] **ТЗ-ATTACH-1** — PDF text extraction при upload (v3.91.0)
- 🔄 **ТЗ-XAI-4** — Utility/Pipeline batch миграция + **scope expansion**:
  - Этап 1 ✅ streamObject smoke test PASSED (Grok 4.1 Fast)
  - Этап 2 ✅ подсобка (6 taskId на Grok 4.1 Fast) — commit `ceadd17`
  - Этап 3 ✅ meeting:summary на Grok 4.20 reasoning — commit `676d50d`
  - **Scope expansion** ✅ 4 дополнительных taskId variant changes (IDE-правки Владимира по empirical данным) — commit `676d50d`
  - Этап 4 ⏳ **Финализация** (CHANGELOG / SIMPLY_STATUS / v3.92.0 bump / HANDOFF финал / archive TZ folder / 3 backlog хвоста) — **следующая сессия**
- [ ] ТЗ-XAI-5 — **сокращён** благодаря scope expansion (create + expertise уже мигрированы). Остаётся: R-5 резолв (фактически сделан), возможные оставшиеся артефакты миграции
- [ ] ТЗ-XAI-6 — Очистка MiniMax/OpenRouter
- [ ] ТЗ-XAI-COL-1 — Collections API для Библиотеки

---

## 🎯 Что сделано в текущей сессии (2026-04-16)

### Коммиты сессии (4 штуки)

1. **`ceadd17`** — ТЗ-XAI-4 Этап 2 (6 taskId подсобки → Grok 4.1 Fast)
2. **`d9d3488`** — Hot-fix plan/route.ts (2 pre-existing бага: отсутствующий dev-overrides import + maxOutputTokens cap)
3. **`d1e2c12`** — 2 новых backlog хвоста (DevPanelFooterHidesSubCalls + TaskExpertChatInputMissingOnFirstOpen)
4. **`676d50d`** — session-closing batch: Этап 3 + scope expansion + briefing hot-fix + 2 новых backlog хвоста (BriefingAuthorUrlHallucination + ServiceChatNotOverridable) + SIMPLY_XAI_NOTES запись

### Scope ТЗ-XAI-4 финально (текущее состояние task-assignments.ts)

**Scope Этапа 2 (6 точек «подсобки» на Grok 4.1 Fast):**
- `briefing:filter`, `clerk:task-summary`, `clerk:file-analyzer`, `util:title`, `util:project-summary`, `util:artifact-suggestions`

**Scope Этапа 3 + expansion (5 точек на Grok 4.20 reasoning):**
- `meeting:summary` (Этап 3)
- `simply-chat-think` (variant switch non-reasoning → reasoning, пересмотр Q1 ТЗ-XAI-3)
- `expertise` (R-5 резолв — было в scope XAI-5)
- `create` (scope XAI-5 выполнен)
- `memory:extract` (variant switch non-reasoning → reasoning)

**Итого изменённых taskIds: 11** (6 подсобка + 5 зал)

**Не тронуто:**
- `simply-chat` (был в XAI-3, Grok 4.1 Fast)
- `simply-chat-vision` (Haiku 4.5)
- `memory:extract-batch/consolidate/profile/dedup-verify` (XAI-2, Grok 4.1 Fast)
- `briefing:author/section/podcast-script` (MiniMax — Q3 решение, empirical test показал что смена модели не решает URL hallucination — см. хвост)
- `professor:*` (Q1 — премиум, Opus)
- `project:expert:*` (tier system)
- `clerk:snapshot` (dead code per ADR 052, XAI-6)
- `service-chat:*` (Q4 — отдельное ТЗ)
- `artifact:*` (Q2 — витрина, Sonnet)
- `vision:ocr` (Haiku)

### 2 hot-fix pre-existing багов применены

**Hot-fix 1: plan/route.ts (commit `d9d3488`) — 2 бага в одном месте**

- **Баг A**: `model-overrides-node` не импортирован → dev-panel override `professor:planning` игнорировался → professor:planning всегда шёл на Opus игнорируя UI override
- **Баг B**: `maxOutputTokens` не указан явно → @ai-sdk/anthropic подставляет model max = 128_000 → Anthropic требует streaming для `max_tokens > 21333` → `generateText` non-streaming упирается в 60s fetch timeout → 3× retry = 180s fail с `UND_ERR_SOCKET: other side closed`

**Фикс:** 1 import line + `maxOutputTokens: 16000`. После этого планирование прошло за 26.6s / $0.028 на Grok 4.20 non-reasoning (через dev override).

**Hot-fix 2: briefing routes (commit `676d50d`)**

Та же дыра с import reader в 3 briefing backend routes (generate/refresh-section/cron). Это блокировало empirical test briefing:author на альтернативной модели. После hot-fix override сработал, получены реальные данные для хвоста TZ_BriefingAuthorUrlHallucination.

**Global issue:** `_archive/TZ_DeadModelSelectors/FINDINGS.md:36` говорит что reader был установлен только в 4 местах. После этой сессии закрыты 4 routes (plan + 3 briefing), но `service-chat/route.ts` точно без импорта, остальные routes требуют audit. **Хвост TZ_DevOverridesSideEffectImportAudit запланирован для создания на Этапе 4.**

### Empirical находка: briefing:author URL hallucination — не model issue

DevPanel Pipeline Trace показал **10 из 11 URL fabricated** в briefing author stage (MiniMax). Ранняя диагностика «MiniMax weakness» оказалась неверной — Владелец указал что Sonnet и Gemini раньше в этой роли тоже галлюцинировали.

**Empirical test двух моделей:**
- MiniMax-M2.7: **10/11 (91%) fabricated**, 137.3s, $0.010
- Grok 4.20 non-reasoning: **9/11 (82%) fabricated**, 15.6s, $0.044

**4 разные модели (Sonnet, Gemini, MiniMax, Grok 4.20) одинаково плохо** = architectural issue, не model weakness. Смена модели не решает.

**Рекомендованное решение** (хвост TZ_BriefingAuthorUrlHallucination): **structured output через `generateObject` + Zod schema с URL как `z.enum([...allowedUrlsFromFilter])`** — модель физически не сможет генерировать URL вне списка. 1-2 сессии.

### SQL verification scope

Подтверждено прямыми замерами за сессию:
- `clerk:file-analyzer` → grok-4-1-fast-non-reasoning ✅ (3 calls)
- `util:title` (logged as `util:auto-naming`, pre-existing inconsistency) → grok-4-1-fast-non-reasoning ✅
- `briefing:filter` → grok-4-1-fast-non-reasoning ✅
- `briefing:author` empirical test → grok-4.20-0309-non-reasoning ✅ (через override + hot-fix)
- `professor:planner` → grok-4.20-0309-non-reasoning ✅ (через override + hot-fix plan route)
- `project:expert` → grok-4.20-0309-non-reasoning ✅ (через override)

Не триггерились, но scope принят Владельцем (Gate C Вариант A):
- `clerk:task-summary`, `util:project-summary`, `util:artifact-suggestions`, `meeting:summary`, `simply-chat-think`, `expertise` (default), `create`, `memory:extract`

### Бонусные находки, зафиксированные в NOTES

1. **xAI prompt caching работает автоматически** — без `providerOptions.xai.cacheControl`. Smoke test показал 160/405 tokens cached. Не нужно ничего делать в коде.
2. **Grok 4.20 reasoning = сильная модель для multi-step tool-calling** — подтверждено empirically на professor:planning, project:expert, briefing:author, task expert chat. Это повлияло на IDE-правки `simply-chat-think` → reasoning variant и `memory:extract` → reasoning variant.
3. **Scope expansion в IDE как паттерн** — Владелец как product-owner может расширить scope напрямую в коде когда empirical данные дают уверенности, обходя формальные этапы. Правило: такие изменения фиксируются как решения в SIMPLY_XAI_NOTES append-only log.

### 4 новых backlog хвоста зафиксированы (все pre-existing bugs)

1. 🟥 **[specs/_backlog/TZ_BriefingAuthorUrlHallucination.md](../_backlog/TZ_BriefingAuthorUrlHallucination.md)** — High impact. 82-91% fabricated URLs в briefing author, 4 модели одинаково плохо, architectural issue. Рекомендация: generateObject + z.enum. 1-2 сессии. **Критично перед production релизом briefing.**
2. 🟧 **[specs/_backlog/TZ_ServiceChatNotOverridable.md](../_backlog/TZ_ServiceChatNotOverridable.md)** — Medium. 3 дыры: (1) `/dev/models` UI не показывает service-chat selectors, (2) `service-chat/route.ts` не импортирует model-overrides-node, (3) docs ai-chats-map не разделяет briefing-onboarding и briefing pipeline. 0.5-1 сессия.
3. 🟧 **[specs/_backlog/TZ_DevPanelFooterHidesSubCalls.md](../_backlog/TZ_DevPanelFooterHidesSubCalls.md)** — Medium. DevPanel footer показывает только parent chat cost, nested subcalls (artifact handlers, clerks) скрыты. SQL корректен, только frontend aggregation. Empirical confirmation: в /expertise с Grok создан markdown-артефакт, footer говорит «Grok 3.43 руб», но 92% ушло на hidden Sonnet sub-call. 0.5-1 сессия.
4. 🟧 **[specs/_backlog/TZ_TaskExpertChatInputMissingOnFirstOpen.md](../_backlog/TZ_TaskExpertChatInputMissingOnFirstOpen.md)** — Medium. useChat state bug: при входе в task expert chat из режима планирования не рендерится `multimodal-input`. Hard reload лечит. 0.5-1 сессия. Можно объединить с TZ_ErrorRecoveryUI Stage 2.

### Memory обновлена

- **`feedback_empirical_test_before_model_blame.md`** (новый файл) — правило empirical теста перед model-blame
- `MEMORY.md` индекс обновлён — строка про empirical rule

---

## ⏭ Что дальше — Этап 4 ТЗ-XAI-4 (следующая сессия)

### Task 4.1 — Создать 3 запланированных хвоста

- [ ] **`TZ_DevOverridesSideEffectImportAudit`** — global audit всех backend routes в `app/(chat)/api/` и `app/api/` на наличие `import "@/lib/ai/model-overrides-node"`. Прошедшие hot-fixes закрыли 4 routes (plan + 3 briefing), но service-chat точно без import, остальные требуют audit. Включить архитектурное решение: middleware / instrumentation.ts auto-register / или требование в ADR 048 что все route handlers **должны** импортировать reader. Hight priority — в Этап 4 создать карточку, решать в отдельной сессии.
- [ ] **`TZ_ProfessorPlanStreaming`** — переход plan/route.ts на `streamText` вместо `generateText` для правильного long-term fix max_tokens timeout. Anthropic thinking + adaptive требует streaming by design. Текущий hot-fix `maxOutputTokens: 16000` tactical, не лечит корень. 1-2 сессии.
- [ ] **`TZ_MaxOutputTokensAudit`** — audit всех `generateText`/`streamText` вызовов в кодовой базе на явный `maxOutputTokens` под realistic task output size. Сейчас большинство берёт default из model capability (128K для Opus, 64K для Sonnet) — это timeout-bomb для non-streaming routes. Плюс — составить recommended cap table (title 50, project-summary 500, task-summary 2000, meeting 8000, planning 16000, etc). 1 сессия.

### Task 4.2 — Финализация документов

- [ ] Обновить `specs/Simply_xAI/SIMPLY_XAI_ROADMAP.md` — отметить ТЗ-XAI-4 ✅, уточнить что XAI-5 сокращён благодаря scope expansion (create + expertise уже мигрированы)
- [ ] Обновить `specs/Simply_xAI/SIMPLY_XAI_CHANGELOG.md` — append запись v3.92.0 со всеми изменениями сессии
- [ ] Обновить `SIMPLY_STATUS.md` — текущее состояние серии
- [ ] Обновить корневой `CHANGELOG.md` — release запись v3.92.0

### Task 4.3 — Version bump + release commit

- [ ] `package.json` — bump version до `3.92.0`
- [ ] Release commit `release(v3.92.0): TZ_XAI_4 — 11 taskId на Grok (6 подсобка Fast + 5 зал 4.20) + 2 hot-fixes + 4 backlog хвоста`

### Task 4.4 — Archive + hygiene

- [ ] Архивировать `specs/Simply_xAI/TZ_xai_4_UtilityPipelines/` → `_archive/TZ_xai_4_UtilityPipelines/` с `HANDOFF.md`
- [ ] Обновить `_archive/BACKLOG_CLOSED.md` — запись о закрытии ТЗ-XAI-4
- [ ] Обновить `specs/Simply_xAI/HANDOFF.md` — этот файл, финальное состояние

### Task 4.5 — Итоговый HANDOFF для следующей сессии

- [ ] Написать HANDOFF для следующей сессии — что дальше в серии (XAI-5 сокращён, XAI-6 cleanup, ТЗ-XAI-MA-1 multi-agent, и 7 открытых хвостов)

---

## 📦 Открытые хвосты (backlog) — приоритеты для отдельных ТЗ после финализации XAI-4

### 🟥 High impact (3)

1. **TZ_BriefingAuthorUrlHallucination** — 82-91% fabricated URLs, architectural, **критично перед production релизом briefing**. Решение: `generateObject` + `z.enum([...allowedUrls])`. 1-2 сессии.
2. **TZ_ErrorRecoveryUI** Stage 2 — useChat state recovery, долг из прошлой серии. 0.5 сессии.
3. **TZ_DevOverridesSideEffectImportAudit** (будет создан Этап 4) — global audit backend routes. Влияет на работоспособность dev panel для любых будущих A/B тестов. 0.5-1 сессия.

### 🟧 Medium impact (6)

1. **TZ_ServiceChatNotOverridable** — 3 дыры (UI + backend + docs)
2. **TZ_DevPanelFooterHidesSubCalls** — nested subcalls invisible
3. **TZ_TaskExpertChatInputMissingOnFirstOpen** — useChat state bug
4. **TZ_SimplyContextUsageWidget** — UI контекст-виджет показывает не ту шкалу
5. **TZ_PromptsDeadCodeCleanup** — мёртвый код в lib/ai/prompts.ts
6. **TZ_SimplyChatRaceCondition** — partial unique index на getOrCreateSimplyChat
7. **TZ_ProfessorPlanStreaming** (будет создан Этап 4) — long-term fix max_tokens timeout
8. **TZ_MaxOutputTokensAudit** (будет создан Этап 4) — явные maxOutputTokens везде

---

## 🔑 Критичное состояние для следующей сессии

### Dev server

Запущен в фоне task `bno8vt9zu`. Скорее всего остановится между сессиями. На старте следующей сессии: `npm run dev` в background + проверка `http://localhost:3000 → HTTP 307`.

### Dev overrides — активные

`.simply-dev-overrides.json` сейчас содержит (от тестов Владимира в текущей сессии):

```json
{
  "expertise":"grok-4-1-fast-non-reasoning",
  "create":"grok-4-1-fast-reasoning",
  "project:expert:sonnet":"grok-4.20-0309-non-reasoning",
  "project:expert:haiku":"grok-4.20-0309-non-reasoning",
  "project:expert:opus":"grok-4.20-0309-non-reasoning",
  "professor:planning":"claude-haiku-4-5-20251001",
  "professor:pipeline-synthesize":"claude-haiku",
  "professor:review":"claude-haiku-4-5-20251001",
  "professor:pipeline-analyze":"claude-haiku-4-5-20251001"
}
```

**⚠️ Осторожно:** `"professor:pipeline-synthesize":"claude-haiku"` — это **невалидный catalogId** (правильный `claude-haiku-4-5-20251001`). Если pipeline-synthesize триггернётся — `getModel()` бросит error. Рекомендую почистить overrides перед началом Этапа 4.

**Также:** после IDE-правок task-assignments.ts некоторые из этих overrides стали дубликатами default'а (например `expertise` → `grok-4-1-fast-non-reasoning` override когда default уже `grok-4.20-0309-reasoning`). Стоит ревизию сделать перед началом сессии.

### Voyage AI 403

Во время сессии Владимир менял VPN — Voyage API возвращал 403 Forbidden при попытке сохранения MIND facts. По памяти `project_voyage_vpn.md`: Voyage блокирует финский VPN, US Buffalo лечит. MIND extract работает, но storage сломан — это **не блокер** ТЗ-XAI-4, но обращать внимание при MIND-related тестах.

### Git state

**18 коммитов ahead of origin.** Все локальные. Push — отдельная команда Владимира (не делать самому).

```
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
2272e67 docs(xai-migration): HANDOFF после ТЗ-XAI-2
1481141 release(v3.89.0): ТЗ-XAI-2
6fd1fbb docs(xai-migration): CHANGELOG серии + verified Grok params
ba9e928 release(v3.88.0): ТЗ-XAI-1
```

### Активные SIMPLY задачи в проекте на экране

Владимир в текущей сессии работал в реальном проекте:
- Создан проект `cd3267a3-1c35-48e8-8e6a-b77eb71996ef` для тестов ТЗ-XAI-4
- План сгенерирован, утверждён, часть задач прошла через task expert chat (на Grok 4.20 через override)
- 3 файла загружены, проанализированы через Grok 4.1 Fast

### IDE контекст

Владимир открывал `SIMPLY_STATUS.md` в IDE. Возможно ему нужно будет обновить этот файл в Этапе 4 финализации — там информация о текущем состоянии проекта для архитектора.

---

## 🎓 Архитектурные константы серии (обновлено после 2026-04-16)

1. **Защита контекста не привязана к размеру провайдерского окна.** Sliding window (140K) + Extract-on-compression (SIMPLY_CONTEXT_LIMIT 200K, SOFT 60%, HARD 80%) независимы.
2. **Simply Chat «Думать» = tier upgrade.** `simply-chat` = Grok 4.1 Fast, `simply-chat-think` = Grok 4.20 **reasoning** (пересмотрено 2026-04-16 — ранее non-reasoning после ТЗ-XAI-3, теперь reasoning по empirical результатам).
3. **`reasoning_effort` не передавать** в Grok 4.1 Fast / 4.20 — эмпирически падает `Bad Request`. Только multi-agent принимает.
4. **`adaptHistoryToCapabilities` через SSOT model-catalog** — единственный механизм адаптации истории. Живёт в [chat/route.ts:252-344](../../app/(chat)/api/chat/route.ts#L252).
5. **Simply Chat = один persistent чат на пользователя** (после MIND/RAG). Тестирование `util:title` только через `/expertise` или `/create`, НЕ в `/simply`.
6. **`capabilities.vision` ≠ `documentSupport.supported`.** Grok 4.1 Fast: vision=true, documentSupport.supported=false.
7. **`serverExternalPackages` для ESM-first пакетов с worker dependencies.** `lamejs` + `pdf-parse` — оба требуют external declaration в `next.config.ts`.
8. **После изменения `next.config.ts` — чистый rebuild обязателен.** `rm -rf .next && npm run dev`.
9. **«Хвосты» = `_backlog/`.** Русский slang для backlog items.
10. **🆕 Dev overrides global gap.** Reader `.simply-dev-overrides.json` регистрируется только при side-effect импорте `@/lib/ai/model-overrides-node` в backend routes. 4 места закрыты (plan + 3 briefing), остальные требуют audit. **Любой новый backend route с `getModel()` должен импортировать reader**, иначе dev panel overrides для него не работают.
11. **🆕 Non-streaming `generateText` + большой `maxOutputTokens` = timeout-bomb.** Anthropic требует streaming для `max_tokens > 21333`. Для generateText всегда передавать **явный реалистичный `maxOutputTokens`** под output size задачи. Default из model capability (128K Opus, 64K Sonnet) — недопустим для non-streaming.
12. **🆕 Empirical test перед model-blame.** Memory rule `feedback_empirical_test_before_model_blame.md`. Не диагностировать AI-output проблему как «weakness модели X» без теста на 2+ моделях. Prompt/architectural issues маскируются под model issues.
13. **🆕 SSOT в коде > документация.** Добавлено в ai-chats-map.md header warning. Если таблицы в документе расходятся с task-assignments.ts — правда в коде.
14. **🆕 xAI prompt caching автоматический.** Сервер кэширует system prompt без каких-либо `providerOptions.xai.cacheControl`. Ручная настройка не нужна.

---

## 🚀 Рекомендованный старт следующей сессии

```
1. Прочитать этот HANDOFF (5-10 мин)
2. Прочитать SIMPLY_XAI_NOTES.md запись 2026-04-16 ТЗ-XAI-4 Этапы 2+3 (5 мин)
3. Прочитать MEMORY.md целиком (2 мин) — особенно новое правило empirical-test-before-model-blame
4. git log --oneline -18 — проверить что 18 коммитов в master ahead of origin
5. cat .simply-dev-overrides.json — посмотреть активные overrides, почистить stale записи (особенно "claude-haiku" невалидный id)
6. npm run dev в background + curl http://localhost:3000 → HTTP 307
7. Начать Этап 4 ТЗ-XAI-4:
   a. Task 4.1 — создать 3 backlog хвоста (TZ_DevOverridesSideEffectImportAudit, TZ_ProfessorPlanStreaming, TZ_MaxOutputTokensAudit)
   b. Task 4.2 — обновить SIMPLY_XAI_ROADMAP + CHANGELOG серии + SIMPLY_STATUS + корневой CHANGELOG
   c. Task 4.3 — bump v3.92.0 + release commit
   d. Task 4.4 — archive specs/Simply_xAI/TZ_xai_4_UtilityPipelines/ + BACKLOG_CLOSED
   e. Task 4.5 — новый HANDOFF для пост-XAI-4 состояния
8. (После XAI-4 финализации) — обсудить с Владимиром следующее направление: XAI-6 cleanup, или High-impact хвост TZ_BriefingAuthorUrlHallucination, или другое
```

---

**Сессия завершена. Следующему Claude Code — удачной работы.** 

**Семь раз отмерь, один раз отрежь.** Rule №0.

**Empirical test перед model-blame.** Новое правило этой сессии. Не попадайся на «это слабость модели X» без теста на 2+ моделях.

**После любой правки `next.config.ts` — `rm -rf .next && npm run dev`.**

**Dev overrides reader — любой новый backend route с `getModel()` обязан импортировать `@/lib/ai/model-overrides-node`.** Иначе dev panel переключатели для этого route не работают.
