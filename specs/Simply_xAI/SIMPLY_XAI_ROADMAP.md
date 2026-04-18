# Simply — Дорожная карта миграции на xAI

**Создано:** 2026-04-14  
**Обновлено:** 2026-04-16 (**серия закрыта** в v3.92.1 через финализацию ТЗ-XAI-6)  
**Статус:** ✅ **Завершена**  
**Серия:** ТЗ-XAI-1 → ТЗ-XAI-6 (+ ТЗ-ATTACH-1). Будущие расширения (ТЗ-XAI-MA-1, ТЗ-XAI-COL-1, ТЗ-XAI-VOICE-1) — отдельные ветки

> Живой документ. Обновляется после завершения каждого ТЗ.

## Архитектурные стандарты (обязательное чтение)

- **[SIMPLY_ATTACHMENT_ARCHITECTURE.md](SIMPLY_ATTACHMENT_ARCHITECTURE.md)** — Архитектура обработки вложений. Утверждено 2026-04-15. SSOT для всех решений по file attachment routing, upload processing, history adaptation. Все принятые решения не пересматриваются до завершения миграции.
- **[MIND_ARCHITECTURE.md](MIND_ARCHITECTURE.md)** — Архитектура MIND pipeline (extract, consolidate, profile, retrieve).

---

## Стратегия

**Откуда:** MiniMax M2.7 + Anthropic Sonnet/Haiku + OpenRouter (зоопарк провайдеров, костыли, падения)

**Куда:** xAI Grok + Anthropic Haiku/Opus (два серьёзных провайдера, чёткие роли)

**Принцип:** Chat Completions API — индустриальный стандарт. Смена провайдера за минуты. Responses API — только для будущего multi-agent (отдельная ветка).

---

## Целевая архитектура провайдеров

| Роль | Модель | Провайдер | API |
|---|---|---|---|
| KITT (дворецкий, основной чат) | Grok 4.1 Fast (non-reasoning) | xAI | Chat Completions |
| MIND pipeline (extract, consolidate, profile) | Grok 4.1 Fast (non-reasoning) | xAI | Chat Completions |
| Думать (кнопка) | Grok 4.20 | xAI | Chat Completions |
| Создать | Grok 4.20 | xAI | Chat Completions |
| Экспертиза | Grok 4.20 | xAI | Chat Completions |
| Vision/OCR (вложения в чате) | Claude Haiku 4.5 | Anthropic | Messages API |
| Профессор (проекты, premium) | Claude Opus | Anthropic | Messages API |
| Briefing pipeline | Grok 4.1 Fast / 4.20 | xAI | Chat Completions |
| Meeting/Podcast | Grok 4.1 Fast | xAI | Chat Completions |
| Utility (title, suggestions, summaries) | Grok 4.1 Fast | xAI | Chat Completions |
| Embeddings | Voyage AI | Voyage | Без изменений |

---

## Дорожная карта

### ТЗ-XAI-1 — Фундамент
**Статус:** ✅ Завершён 2026-04-14 (v3.88.0, commit `ba9e928`)
**Зависимости:** нет
**Риск:** минимальный (фактически нулевой)

**Суть:** Актуализировать каталог xAI моделей, зафиксировать архитектурные решения для следующих ТЗ серии. Ноль изменений поведения — все taskId остаются на текущих моделях.

**Что сделано:**
- Удалена deprecated `grok-4` запись (SQL-аудит: 0 исторических записей в ai_usage_log)
- Добавлены `notes` на `grok-4.20-multi-agent-0309` — зафиксировано что multi-agent не работает через Chat Completions
- Header xAI секции каталога обновлён с архитектурным обоснованием (contextWindow под рабочий бюджет качества, не под провайдерский потолок)
- Обновлены `docs/ai-providers.md`, `docs/model-catalog-ops.md`
- Закрыт backlog `TZ_GrokContextWindowAudit` → `specs/_backlog/_archive/`
- Зафиксированы для следующих ТЗ серии: R-5 (XAI-5 expertise переключить на non-reasoning), R-6 (XAI-3 убрать `isSimplyNonAnthropicModel`)

**Что НЕ сделано (и почему):**
- contextWindow у xAI записей не изменялся — привязка архитектуры к размеру провайдерского окна признана антипаттерном (вечный чат + Lost in the Middle)
- Эмпирический тест контекстного окна отменён — отвечал на неправильный вопрос

**Подробности:** [TZ_xai_1/](TZ_xai_1/) · [SIMPLY_XAI_NOTES.md](SIMPLY_XAI_NOTES.md) запись 2026-04-14

---

### ТЗ-XAI-2 — MIND pipeline → Grok (split strategy)
**Статус:** ✅ Завершён 2026-04-15 (v3.89.0)
**Зависимости:** ТЗ-XAI-1
**Риск:** низкий (подтверждено smoke test'ом)

**Что сделано:**
- `memory:extract` → **`grok-4.20-0309-non-reasoning`** (mission-critical задача — сильная модель, без reasoning overhead)
- `memory:extract-batch` / `dedup-verify` / `consolidate` / `profile` → **`grok-4-1-fast-non-reasoning`** (механические задачи — рабочая лошадка)
- Бонус-рефакторинг: `batchExtractFacts` и `runConsolidation` переписаны с legacy `generateText + JSON.parse + Zod` workaround на native `generateObject` (xAI поддерживает structured outputs — verified 2026-04-14)
- Создан [MIND_ARCHITECTURE.md](MIND_ARCHITECTURE.md) — living doc с pipeline flow, таблицей параметров, адресами промптов, тест-сценариями. Source of truth для MIND на всю серию

**Ключевые находки:**
- Split-стратегия принята: mission-critical звено (первичный extract) на сильной модели, остальные на быстрой → экономия ~15× vs Sonnet при сохранении качества входа в память
- Native `generateObject` работает на xAI через AI SDK v6 (проверено smoke test'ом 2 кейсов: базовая schema + `.nullable()`)
- One-message lag в Simply Chat MIND подтверждён как known behavior (не баг) — зафиксирован в MIND_ARCHITECTURE.md §2

**Подробности:** [TZ_xai_2/](TZ_xai_2/) · [SIMPLY_XAI_CHANGELOG.md](SIMPLY_XAI_CHANGELOG.md) запись 2026-04-15

---

### ТЗ-XAI-3 — KITT + Think (Simply Chat) → Grok
**Статус:** ✅ Завершён 2026-04-15 (v3.90.0)
**Зависимости:** ТЗ-XAI-1, ТЗ-XAI-2
**Риск:** средний (главный route, tools, providerOptions) — реализовалось со sideline-регрессией которая была починена в той же сессии

**Суть:** Переключить основной чат (chatMode=simply, текст без вложений) на Grok 4.1 Fast non-reasoning через Chat Completions.

**Что меняется:**
- model → `grok-4-1-fast-non-reasoning`
- Cache breakpoints (`providerOptions.anthropic.cacheControl`) — уже провайдер-aware через `isAnthropicProtocolModel` в [chat/route.ts:929](../../app/(chat)/api/chat/route.ts#L929), под xAI этот блок уже no-op. Специально ничего убирать не надо
- Compaction API (`providerOptions.anthropic.contextManagement`) — аналогично, уже gracefully no-op для xAI. **Это мёртвый но безвредный код** — оставляем как есть до ТЗ-XAI-6 (финальная чистка)
- **[R-6, критично]** Полностью убрать `isSimplyNonAnthropicModel` + связанные strip-функции (`stripMediaPartsForTextModel`, `stripLegacyOpenAICompatToolParts`). Заменить на явную проверку `capabilities.vision` из `model-catalog.ts` (SSOT). НЕ полагаться на маршрутизацию «vision → Haiku спасёт» — это хрупкая логика. Убирать причину, а не симптом. См. [SIMPLY_XAI_NOTES.md](SIMPLY_XAI_NOTES.md) (2026-04-14)
- Tools остаются как есть — function calling работает в Chat Completions
- **Защита контекста НЕ трогается**: sliding window (`CONTEXT_BUDGET`) + Extract-on-compression остаются как основной механизм обработки вечного чата. `SIMPLY_CONTEXT_LIMIT` НЕ привязываем к провайдерскому окну — она задаёт рабочий бюджет качества, где модель ещё думает хорошо. Размер провайдерского окна (256K, 2M — неважно) архитектурно иррелевантен: вечный чат заполнит любое, модели деградируют на 30-50% заявленного. См. [SIMPLY_XAI_NOTES.md](SIMPLY_XAI_NOTES.md) (2026-04-14, коррекция Владимира)

**Что НЕ меняется:**
- Vision маршрут (вложения) — остаётся на Haiku
- Кнопка "Думать" — отдельно в ТЗ-XAI-5
- Tools — без изменений

---

### ТЗ-ATTACH-1 — PDF text extraction при upload
**Статус:** 📋 Планируется (высокий приоритет)
**Зависимости:** v3.90.2 (TZ_SimplyReadDocumentTool + R-6 correction)
**Риск:** средний (нужен выбор библиотеки, проверка на Vercel serverless, эвристика text vs scan)
**Ссылка:** [SIMPLY_ATTACHMENT_ARCHITECTURE.md — Слой 0](SIMPLY_ATTACHMENT_ARCHITECTURE.md), раздел «Серверное извлечение при загрузке»

**Суть:** Реализовать серверное извлечение текста из PDF при upload (как уже работает для DOCX/XLSX). Текстовые PDF превращаются в `text/plain` на upload → читаются Grok inline без маршрутизации на Haiku. Сканированные PDF (эвристика по символам на страницу) остаются как `application/pdf` → маршрут на Haiku (нативный PDF support).

**Что меняется:**
- [app/(chat)/api/files/upload/route.ts](../../app/(chat)/api/files/upload/route.ts) — добавить PDF branch рядом с существующими DOCX/XLSX (строки 96-140)
- Выбор PDF library: проверить что уже есть в node_modules (`pdfjs-dist`, `pdf-parse`, `unpdf`) — свериться с тем что Simply использует для Claude Vision PDF
- Эвристика scan detection: `<30 chars/page` → оставить как PDF → Haiku; иначе → text/plain → Grok
- Обновить analyze-document SKILL.md — теперь PDF обрабатывается как DOCX/XLSX
- Удалить placeholder-сообщение про PDF из `adaptHistoryToCapabilities` (или оставить — мёртвый но безвредный fallback на edge case)

**Что НЕ меняется:**
- Сканированные PDF — остаются на Haiku как сейчас
- Очень большие PDF (>N страниц) — KITT будет предлагать Экспертизу/Библиотеку (пороги эмпирически, возможно отдельный ТЗ)

**Выгода:** избавляет от Haiku overhead на обычных текстовых PDF. Grok читает inline, дешевле, быстрее, Grok помнит содержимое в persistent chat без sticky routing.

**Definition of Done:**
- Текстовый PDF загружается → в `ai_usage_log` видно один вызов на `simply-chat` (Grok), не `simply-chat-vision` (Haiku)
- Сканированный PDF → один вызов на `simply-chat-vision` (Haiku)
- Follow-up вопрос о текстовом PDF → Grok отвечает из inline-содержимого, не из placeholder

---

### ТЗ-XAI-4 — Utility/Pipeline → Grok (+ scope expansion)
**Статус:** ✅ Завершён 2026-04-16 (v3.92.0)
**Зависимости:** ТЗ-XAI-1
**Риск:** низкий (подтверждён мануальным тестом)

**Суть (исходная):** переключить utility/pipeline точки на Grok по двум тир-группам — «подсобка» (Grok 4.1 Fast) и «зал» (Grok 4.20).

**Что фактически сделано (11 taskId):**

*Этап 2 — «подсобка» на `grok-4-1-fast-non-reasoning` (6 taskId, commit `ceadd17`):*
- `briefing:filter`, `clerk:task-summary`, `clerk:file-analyzer`, `util:title`, `util:project-summary`, `util:artifact-suggestions`

*Этап 3 + scope expansion — «зал» на `grok-4.20-0309-reasoning` (5 taskId, commit `676d50d`):*
- `meeting:summary` (Этап 3 по исходному плану)
- `simply-chat-think` (variant switch non-reasoning → reasoning, пересмотр Q1 ТЗ-XAI-3 по empirical данным)
- `expertise` (**R-5 резолв** — перенесено из scope ТЗ-XAI-5)
- `create` (**перенесено из ТЗ-XAI-5**)
- `memory:extract` (variant switch non-reasoning → reasoning, empirical confidence в Grok 4.20 reasoning на multi-step задачах)

*Этап 4 — финализация (v3.92.0):* v3.92.0 release commit + 3 новых backlog хвоста (DevOverridesSideEffectImportAudit, ProfessorPlanStreaming, MaxOutputTokensAudit)

**2 hot-fix pre-existing багов (side-effect):**
- `plan/route.ts` — добавлен `import "@/lib/ai/model-overrides-node"` (dev override для professor:planning молча игнорировался) + tactical `maxOutputTokens: 16000` (Anthropic streaming threshold 21333). Commit `d9d3488`
- 3 briefing routes (generate + refresh-section + cron) — тот же side-effect import. Commit `676d50d`

**Empirical находка (не решено, отдельный хвост):** briefing:author выдумывает 82-91% URLs — 4 модели одинаково плохо (Sonnet, Gemini, MiniMax, Grok 4.20). Architectural issue, не model issue. → [TZ_BriefingAuthorUrlHallucination](../_backlog/TZ_BriefingAuthorUrlHallucination.md)

**Expertise-multi-agent RESERVED:** запись каталога `grok-4.20-multi-agent-0309` **не удалена**, а зарезервирована через placeholder taskId `expertise-multi-agent` под будущий ТЗ-XAI-MA-1 (commit `2fbc50b`).

**Follow-up (commit `2fbc50b`):** multi-agent RESERVED fix, dead briefing constants cleanup, DevPanel Grok display labels.

**Подробности:** [TZ_xai_4_UtilityPipelines/](TZ_xai_4_UtilityPipelines/) · [SIMPLY_XAI_NOTES.md](SIMPLY_XAI_NOTES.md) записи 2026-04-16 · [SIMPLY_XAI_CHANGELOG.md](SIMPLY_XAI_CHANGELOG.md) v3.92.0

---

### ТЗ-XAI-5 — Create / Expertise → Grok 4.20 (+ R-5)
**Статус:** ✅ **фактически закрыт в ТЗ-XAI-4 scope expansion** (2026-04-16, v3.92.0)
**Зависимости:** ТЗ-XAI-3

**Что произошло:** scope ТЗ-XAI-5 полностью покрыт scope expansion ТЗ-XAI-4:
- ✅ **R-5** — `expertise` → `grok-4.20-0309-reasoning` (через Владимирский IDE edit в scope ТЗ-XAI-4 Этапа 3)
- ✅ `create` → `grok-4.20-0309-reasoning` (через Владимирский IDE edit в scope ТЗ-XAI-4 Этапа 3)

**Остаётся только в теории:** если после production наблюдений появится идея вернуть `expertise` на non-reasoning variant из экономии — это отдельный product decision, не отдельное ТЗ миграции.

**Multi-agent отложен** в ТЗ-XAI-MA-1 (Responses API + MCP), taskId `expertise-multi-agent` зарезервирован в [task-assignments.ts](../../lib/ai/task-assignments.ts). См. [BRAINSTORM_GrokMultiAgent.md](BRAINSTORM_GrokMultiAgent.md).

---

### ТЗ-XAI-6 — Финализация серии
**Статус:** ✅ Завершён 2026-04-16 (v3.92.1)
**Зависимости:** все предыдущие ТЗ завершены и проверены
**Риск:** минимальный (удаление placeholder-записи без call sites)

**Суть (финальная, после двух correction'ов владельца):** Символическое закрытие серии Simply_xAI. Scope сжался от «cleanup провайдеров» до «удаление одного оставшегося placeholder-taskId».

**Что удалено:**
- `clerk:snapshot` placeholder в [lib/ai/task-assignments.ts](../../lib/ai/task-assignments.ts) — 3 строки (TaskId union + DEFAULT_TASK_MODELS + комментарий). `snapshot-creator.ts` был удалён ещё в ADR 052, taskId остался висеть без call sites
- 2 упоминания `clerk:snapshot` в [docs/decisions/038-cost-tracking-architecture.md](../../docs/decisions/038-cost-tracking-architecture.md) + [SIMPLY_PROMPTS_AND_MODEL_CONFIG.md](SIMPLY_PROMPTS_AND_MODEL_CONFIG.md)

**Что НЕ удалено (by design, зафиксировано в [SIMPLY_XAI_NOTES.md](SIMPLY_XAI_NOTES.md) 2026-04-16):**
- **MiniMax** (`minimax`, `minimaxLong` namespaces + M2.7/M2.7-long catalog + `MINIMAX_API_KEY`) — Кухня, production by design. Активно используется в briefing pipeline (`briefing:author`, `briefing:section`, `briefing:podcast-script`)
- **OpenRouter** (`openrouter` namespace + `OPENROUTER_API_KEY`) — dev-инструмент для быстрого тестирования новых моделей (GLM, Qwen, DeepSeek и т.д.) через `/dev/models` override. НЕ production-провайдер, но нужен в процессе разработки

**Почему «финализация», а не «cleanup»:**
Все реальные cleanup-цели из оригинального плана ТЗ-XAI-6 **были сделаны заранее** в предыдущих ТЗ:
- `stripMiniMaxToolParts`, `stripLegacyOpenAICompatToolParts`, `isSimplyNonAnthropicModel` — удалены в ТЗ-XAI-3 (Этап 2, R-6 резолв)
- `snapshot-creator.ts` — удалён в ADR 052 (ТЗ-CreateSnapshotAudit)
- MiniMax миграция — **никогда не планировалась** (это моя ошибка интерпретации)
- OpenRouter cleanup — **тоже не планировался** (это моя вторая ошибка)

Финальный scope свёлся к символическому closure серии.

---

## Будущие расширения (не в текущей серии)

**Порядок выполнения** (утверждён владельцем 2026-04-18, после закрытия ТЗ-AISDKLayerHardening v3.93.0):

```
[серия xAI закрыта v3.92.1]
  ↓
ТЗ-AISDKLayerHardening ✅ v3.93.0 (umbrella, 3 долга + ADR 053)
  ↓
1. ТЗ-COMPACTION-1 ← СЛЕДУЮЩИЙ (фундамент, блокирует COL-1)
  ↓
2. ТЗ-XAI-COL-1 (продуктовая ценность: загрузка документов в RAG)
  ↓
3. ТЗ-XAI-MA-1 (Multi-Agent premium-режим)
  ↓
4. ТЗ-XAI-VOICE-1 (голосовой канал)
```

**Обоснование порядка (владелец 2026-04-18):**
- COMPACTION-1 первым — фундамент: чинит молчаливую потерю контекста в expertise/create/projects-on-Grok (реальная UX-деградация в 3 chat-режимах) + блокирует COL-1 (большие документы переполнят контекст мгновенно) + расширяет ADR 053 до 5-го аспекта (compaction strategy) пока контракт свежий.
- COL-1 вторым, а не MA-1 — ближе к продуктовому видению (пользователь загружает документы), понятнее в реализации (Grok Collections из коробки). MA-1 требует MCP-сервер + auth layer — больше работы, меньше сразу осязаемой ценности.
- MA-1 третьим — бонусно закрывает Finding #2 (thinking tokens на Anthropic естественно переходом Professor Planning на Grok Multi-Agent).
- VOICE-1 последним — отдельный канал, не зависит от остального, продуктовая приоритизация.

| № | ID | Название | Зависимости | Описание |
|---|---|---|---|---|
| 1 | **ТЗ-COMPACTION-1** | Simply Compaction MVP | ADR 053 (v3.93.0 ✅) | Summary Buffer для Grok-чатов (expertise/create как pilot). Capability-driven middleware `applyContextStrategy`, новый taskId `compaction:summarize`, 5-й аспект ADR 053. Архитектура — [SIMPLY_COMPACTION_ARCHITECTURE.md](SIMPLY_COMPACTION_ARCHITECTURE.md) v1.0 → v1.1 в Фазе 1. Поглощает backlog-хвост `TZ_SimplyContextUsageWidget`. |
| 2 | ТЗ-XAI-COL-1 | Collections (Библиотека) | ТЗ-XAI-1 + COMPACTION-1 | Grok Collections API для RAG документов пользователя. Unified `knowledge_search` с MIND. |
| 3 | ТЗ-XAI-MA-1 | Multi-Agent Экспертиза | ТЗ-XAI-5 + A/B тест | Responses API + MCP сервер для custom tools в режиме multi-agent. **TaskId `expertise-multi-agent` зарезервирован в [task-assignments.ts](../../lib/ai/task-assignments.ts) с 2026-04-16** (placeholder, call sites нет). Полное обоснование архитектуры — [BRAINSTORM_GrokMultiAgent.md](BRAINSTORM_GrokMultiAgent.md). Попутно закрывает Finding #2 (Anthropic thinking tokens) естественным переходом Professor Planning на Grok Multi-Agent. |
| 4 | ТЗ-XAI-VOICE-1 | Voice Agent | — | Grok Voice Agent API для голосового режима. |

**Отложены (не независимые серии, вплетаются по мере необходимости):**
- ТЗ-COMPACTION-2 — расширение Simply Compaction на Simply Chat как страховочная сетка поверх MIND (для сверхдлинных сессий). После COMPACTION-1 MVP.
- ТЗ-COMPACTION-3 — «Новый чат с итогом» (UX Фазы 3 из архитектуры). После COMPACTION-1/COMPACTION-2.

---

## Решения принятые в ходе планирования (2026-04-14)

1. **Chat Completions — основа.** Responses API только для multi-agent. Причина: портабельность, наши tools работают без изменений, стандартный формат.

2. **Защита контекста остаётся как есть независимо от провайдера.** Sliding window (140K) + Extract-on-compression — основа обработки вечного чата. Размер провайдерского окна (256K, 2M — неважно) архитектурно иррелевантен: вечный чат заполнит любое, модели деградируют на 30-50% заявленного (Lost in the Middle). Compaction API уже провайдер-aware, под Grok становится мёртвым но безвредным кодом. **Коррекция Владимира 2026-04-14:** изначальная формулировка «2M → Compaction не нужен» была неверной.

3. **Qwen отменён.** Тест показал галлюцинации на изображениях через OpenRouter. Vision остаётся на Haiku 4.5 — проверен, работает.

4. **Haiku 4.5 остаётся для vision.** Anthropic всё равно остаётся в проекте (Opus для Профессора). Один ключ, одна зависимость.

5. **Grok 4.1 Fast non-reasoning для KITT.** Быстрый, дешёвый ($0.20/$0.50), не тратит токены на reasoning. Для дворецкого идеально.

6. **`reasoning_effort` не передавать** для Grok 4.20 и Grok 4.1 Fast — вернёт ошибку. Reasoning автоматический. Этот параметр только для multi-agent.

7. **Маленькие ТЗ.** Каждый шаг изолирован и тестируем. Claude Code не срезает углы если задача конкретная.

---

## Прогресс

| ТЗ | Статус | Дата начала | Дата завершения | Примечания |
|---|---|---|---|---|
| ТЗ-XAI-1 | ✅ Завершён | 2026-04-14 | 2026-04-14 | v3.88.0 — удалён grok-4, notes про multi-agent, зафиксирована архитектура защиты контекста |
| ТЗ-XAI-2 | ✅ Завершён | 2026-04-14 | 2026-04-15 | v3.89.0 — 5 memory tasks → Grok (extract на 4.20, остальные на 4.1 Fast), native generateObject, создан MIND_ARCHITECTURE.md |
| ТЗ-XAI-3 | ✅ Завершён | 2026-04-15 | 2026-04-15 | v3.90.0 — KITT → Grok 4.1 Fast, Think → Grok 4.20 (расширен scope), R-6 cleanup (80 строк strip-функций удалено). **Note:** R-6 сделан неполно — восстановлен правильно в v3.90.2 через adaptHistoryToCapabilities |
| ТЗ-SimplyChatModeInjection | ✅ Завершён | 2026-04-15 | 2026-04-15 | v3.90.1 — плейсхолдеры `<current_mode>`/`<current_model>` через SSOT model-catalog (hotfix из backlog вне серии xAI) |
| ТЗ-SimplyReadDocumentTool + R-6 correction | ✅ Завершён | 2026-04-15 | 2026-04-15 | v3.90.2 — удаление мёртвого readDocument tool + adaptHistoryToCapabilities через SSOT (правильная реализация R-6 из XAI-3 через capabilities каталога) |
| ТЗ-ATTACH-1 | ✅ Завершён | 2026-04-16 | 2026-04-16 | v3.91.0 — PDF text extraction при upload, текстовые PDF → `text/plain` → Grok inline, сканы → Haiku |
| ТЗ-XAI-4 | ✅ Завершён | 2026-04-16 | 2026-04-16 | v3.92.0 — 11 taskId на Grok (6 подсобка Fast + 5 зал 4.20 reasoning, включая Владимирский scope expansion) + 2 hot-fix pre-existing багов (side-effect import + maxOutputTokens) + 3 новых backlog хвоста |
| ТЗ-XAI-5 | ✅ Закрыт через scope expansion ТЗ-XAI-4 | — | 2026-04-16 | create + expertise + R-5 выполнены Владимирскими IDE edits в scope ТЗ-XAI-4 |
| ТЗ-XAI-6 | ✅ Завершён | 2026-04-16 | 2026-04-16 | v3.92.1 — финализация серии, удалён `clerk:snapshot` placeholder (3 строки кода + 2 в docs). MiniMax (кухня) и OpenRouter (dev-инструмент) остаются by design |
