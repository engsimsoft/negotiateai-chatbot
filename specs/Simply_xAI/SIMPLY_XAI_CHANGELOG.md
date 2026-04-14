# Simply — XAI Migration CHANGELOG

> **Append-only серийный факт-лист.** Одна запись на каждый завершённый ТЗ серии. Новые записи сверху, старые не редактируются (кроме опечаток).

---

## Назначение

Этот файл — **что было реально реализовано** в серии миграции на xAI. Три документа серии работают в связке и не дублируют друг друга:

| Документ | Отвечает на | Когда читать |
|---|---|---|
| [SIMPLY_XAI_ROADMAP.md](SIMPLY_XAI_ROADMAP.md) | **Что** мы планируем сделать? | Перед планированием следующего ТЗ |
| **SIMPLY_XAI_CHANGELOG.md** (этот файл) | **Что** уже сделано? Какими коммитами? | При передаче смены, при аудите, при старте новой сессии |
| [SIMPLY_XAI_NOTES.md](SIMPLY_XAI_NOTES.md) | **Почему** приняли такое решение? Что узнали? | Когда нужно понять мотивацию архитектурного выбора |

## Правила использования

1. **Одна запись на каждый завершённый ТЗ серии** — не на каждый коммит, не на каждый этап внутри ТЗ
2. **Запись создаётся после git commit** финализирующего ТЗ, не до — иначе факты могут разойтись с кодом
3. **Формат записи фиксированный** (см. ниже): дата, версия, коммиты, что сделано, что НЕ сделано, следующий шаг
4. **Локальных CHANGELOG внутри `TZ_xai_N/`** папок **не создаём** — дублирование ухудшает читаемость серии
5. **Глобальный `CHANGELOG.md`** в корне проекта продолжает заполняться как обычно (он для всего проекта, не только серии)

### Шаблон записи

```markdown
## [ТЗ-XAI-N] YYYY-MM-DD — Название — vX.Y.Z

**Коммиты:** `хэш1` (release), `хэш2` (doc sync)
**Продолжительность:** X сессий (или «одна сессия»)

**Что сделано:**
- Пункт 1 с файлом:строкой если применимо
- Пункт 2

**Что НЕ сделано (и почему):**
- Пункт 1 — обоснование

**Связанные документы:**
- [TZ_xai_N/ROADMAP.md](TZ_xai_N/ROADMAP.md)
- [SIMPLY_XAI_NOTES.md](SIMPLY_XAI_NOTES.md) запись YYYY-MM-DD «Название»

**Следующий шаг:** ТЗ-XAI-(N+1) — краткое описание

---
```

---

## [ТЗ-XAI-3] 2026-04-15 — KITT (Simply Chat) + Think → Grok + R-6 cleanup — v3.90.0

**Коммиты:** TBD (single release commit планируется)

**Продолжительность:** одна сессия (2026-04-15)

**Что сделано:**
- Переключение KITT и Think в [lib/ai/task-assignments.ts](../../lib/ai/task-assignments.ts):
  - `simply-chat`: `MiniMax-M2.7` → **`grok-4-1-fast-non-reasoning`**
  - `simply-chat-think`: `claude-sonnet-4-6` → **`grok-4.20-0309-non-reasoning`** (расширение scope из XAI-5 в XAI-3 — нет смысла держать Sonnet на переходный период)
  - `simply-chat-vision` без изменений (Haiku 4.5)
- **R-6 cleanup в [app/(chat)/api/chat/route.ts](../../app/(chat)/api/chat/route.ts):** удалены 80 строк хрупкой логики
  - `stripMediaPartsForTextModel` (28 строк)
  - `stripLegacyOpenAICompatToolParts` (40 строк, SQL-аудит показал 0 legacy `call_function_*` parts в БД Simply чатов)
  - Флаг `isSimplyNonAnthropicModel` (2+4 строки)
  - `preparedHistory` упрощён с тройного тернарника до одного условия
  - Temperature: `chatMode === "simply" ? 0.7 : 1.0` (0.7 — продуктовое решение про стабильность дворецкого, не провайдер-компромисс)
- **Pre-существовавший баг найден и починен:** `saveMessages` сохраняла `message.parts` (оригинал с file part), а не `processedMessage.parts` (после конверсии). Привело к рекурсивной регрессии на шаге 5 smoke-теста. Фикс: использовать `processedMessage.parts` везде в saveMessages + `await convertTextFilesInAllMessages(cleanedHistory)` вместо дубликатной `inlineTextFileParts` в preparedHistory
- Создан backlog [TZ_ErrorRecoveryUI.md](../../_backlog/TZ_ErrorRecoveryUI.md) после 9-кратного повторения проблемы «error state блокирует инпут» — зафиксированы stages 1/2 и минимальный фикс от Владимира
- Создан backlog [TZ_SimplyReadDocumentTool.md](../../_backlog/TZ_SimplyReadDocumentTool.md) — tool-selection quality issue Grok на attached файлах

**Что НЕ сделано (и почему):**
- Compaction API блок и cache breakpoints НЕ удалены — **остаются живыми для vision-маршрута на Haiku** (который до сих пор использует prompt caching). Удаление возможно только когда vision уедет с Claude полностью — это ТЗ-XAI-6
- `simply-chat-think` variant B (reasoning) не был взят для default — выбран A (non-reasoning) как продуктовый tier upgrade с мгновенной разницей. B остаётся доступным через `/dev/models`
- SQL-аудит prod БД на legacy `call_function_*` — не потребовался. Владимир решил: «база пустая, страховать нечего» → `stripLegacyOpenAICompatToolParts` удалена без проверки prod
- ТЗ-XAI-5 не расширен на Think (наоборот, сузился) — после переноса simply-chat-think в XAI-3, ТЗ-XAI-5 будет трогать только Create + Expertise + R-5

**Smoke test — 6 сценариев end-to-end (2026-04-15):**
1. **Текст-only** ✅ `simply-chat → grok-4-1-fast-non-reasoning`, TTFT 10ms, Total 2.5s
2. **Function calling** ✅ один tool вызвался, ответ получен (quality issue по tool-selection — в backlog, не блокер миграции)
3. **Vision — фото** ✅ `simply-chat-vision → claude-haiku-4-5-20251001`, корректное описание картинки — R-6 сохранил vision-маршрут без регрессии
4. **text/plain файл (повторный тест после фикса регрессии)** ✅ `simply-chat → grok-4-1-fast-non-reasoning`, Grok увидел инлайн-содержимое через `convertTextFilesInAllMessages`, проявил safety-сознание и отказался раскрывать «секретное слово» — корректное поведение с точки зрения продукта, приятный бонус
5. **Think — кнопка** ✅ `simply-chat-think → grok-4.20-0309-non-reasoning`, tier upgrade ощутимо сильнее 4.1 Fast — Владимир подтвердил «разница была невероятно крутая»
6. **MIND retrieve** ✅ 5/5 фактов injected через pgvector в `<memory>` блок, секция RAG в DevPanel работает, **implicit caching от xAI как бонус**: 6520 cached tokens без нашей конфигурации (OpenAI-совместимый `prompt_tokens_details.cached_tokens` эмитится xAI автоматически, ₽0.04 стоимость уже с учётом cached pricing)

**Методологические наблюдения:**
1. **Дубликат функции — cost of speed.** Я создал `inlineTextFileParts` не проверив что в том же файле уже объявлена `convertTextFilesInAllMessages` (был hint `"declared but never read"`, который я проигнорировал как pre-existing noise). Ошибка обернулась регрессией на шаге 5 + 30 минутами debug. **Правило:** при добавлении helper'а в файл — grep на типовые имена + внимательно смотреть diagnostic hints про unused declarations, они часто указывают на готовый dead-but-useful код
2. **Regression exposure вскрыла скрытый баг.** Ошибка на шаге 5 (`AI_UnsupportedFunctionalityError`) раскопала pre-existing баг в `saveMessages` — она всегда сохраняла file parts в БД, а не converted text parts. Под Sonnet (think default до XAI-3) это маскировалось терпимостью провайдера к file parts. Grok нетерпим → баг вылез. Побочная выгода миграции: чистка БД от неправильного формата идёт автоматически для новых сообщений
3. **xAI implicit caching — приятный сюрприз.** Мы не настраиваем xAI кэш (отказались от Anthropic кэша через `isAnthropicProtocolModel` гейт), но xAI эмитит `cached_tokens` в usage автоматически. Наш cost calculator это считает правильно через `extractUsageForPricing`. 6520 cached / 300 fresh на тестовом запросе → реальная экономия без нашего участия
4. **Процессная дисциплина бэклога** — Владимир поднял упрёк за 9-кратное откладывание проблемы «error state блокирует инпут» без записи. Это системный фейл, не забывчивость. Правило зафиксировано: повторяющаяся не-блокер-проблема = немедленно в backlog, даже если фикс откладывается. Backlog `TZ_ErrorRecoveryUI` создан прямо в сессии тестов, до технического фикса регрессии

**Связанные документы:**
- [TZ_xai_3/ANALYSIS.md](TZ_xai_3/ANALYSIS.md) — первичный аудит + 5 вопросов Владимиру
- [TZ_xai_3/ROADMAP.md](TZ_xai_3/ROADMAP.md) — план на 5 этапов с чекпоинтами
- [SIMPLY_XAI_NOTES.md](SIMPLY_XAI_NOTES.md) — записи про дубликат функции, Grok 4.20 tier upgrade impressions, процессный урок
- [global CHANGELOG.md](../../CHANGELOG.md) — запись `[3.90.0] — 2026-04-15`
- [specs/_backlog/TZ_ErrorRecoveryUI.md](../../_backlog/TZ_ErrorRecoveryUI.md) — backlog error state UI
- [specs/_backlog/TZ_SimplyReadDocumentTool.md](../../_backlog/TZ_SimplyReadDocumentTool.md) — backlog tool-selection quality

**Следующий шаг:** ТЗ-XAI-4 — Utility/Pipeline batch миграция (~12 «лёгких» вызовов: briefing author/section/filter, meeting summary, podcast script, professor pipeline, clerk, title, suggestions, artifact handlers). Риск низкий — простые вызовы без сложных providerOptions. Подшаги: сначала utility, потом briefing pipeline, потом professor/clerk (адаптация `providerOptions.anthropic.thinking` убрать для Grok). ТЗ-XAI-5 сузился — не трогает Think (он уже на Grok 4.20 после XAI-3), остаются Create + Expertise + R-5.

---

## [ТЗ-XAI-2] 2026-04-15 — MIND pipeline → Grok — v3.89.0

**Коммиты:** TBD (single release commit планируется после финализации)

**Продолжительность:** одна сессия (2026-04-14 → 2026-04-15 по timezone)

**Что сделано:**
- Переключение 5 memory-задач с Sonnet/MiniMax/Haiku на xAI Grok в [lib/ai/task-assignments.ts](../../lib/ai/task-assignments.ts):
  - `memory:extract` → **`grok-4.20-0309-non-reasoning`** (mission-critical, сильная модель)
  - `memory:extract-batch` → `grok-4-1-fast-non-reasoning`
  - `memory:dedup-verify` → `grok-4-1-fast-non-reasoning`
  - `memory:consolidate` → `grok-4-1-fast-non-reasoning`
  - `memory:profile` → `grok-4-1-fast-non-reasoning`
- **Бонус-рефакторинг в [lib/ai/memory/extract.ts](../../lib/ai/memory/extract.ts) и [lib/ai/memory/consolidate.ts](../../lib/ai/memory/consolidate.ts):** legacy `generateText + JSON.parse + Zod.parse()` workaround заменён на native `generateObject` в `batchExtractFacts` и `runConsolidation`. Workaround существовал потому что MiniMax через Anthropic-compat endpoint не давал чистого `generateObject`. Smoke test 2026-04-14 подтвердил что xAI поддерживает native structured outputs через AI SDK v6, включая `.nullable()` поля. Удалено ~28 строк legacy парсинг-логики.
- **Dead import удалён:** `calcCostUsd` в [extract.ts:25](../../lib/ai/memory/extract.ts#L25) — 0 живых использований.
- **Создан [MIND_ARCHITECTURE.md](MIND_ARCHITECTURE.md)** — живой документ-reference серии: 11 секций, охватывает pipeline, chatMode триггеры, task→model маппинги, адреса промптов, параметры с рекомендациями для тюнинга, тест-сценарии, чеклист восстановления, лог-маркеры, схема БД, журнал изменений. Служит testing harness для MIND и заменяет необходимость копания в коде перед каждым ТЗ серии.

**Что НЕ сделано (и почему):**
- `memory:extract` (Grok 4.20) в боевом тесте не триггерился — в `simply` chatMode этот путь отключён by design (ТЗ-MinimaxCleanup v3.77.0). Триггерится только в `expertise`/`create`/`project` — проверится при нормальной эксплуатации
- `memory:consolidate` и `memory:profile` event chain не дошёл до ≥10 фактов за один batch — тоже проверится при нормальной эксплуатации
- Temperature и другие параметры извлечения не менялись — оставлены 0.1 для extract, 0 для dedup-verify, 0.1 для consolidate, 0.3 для profile

**Smoke test — end-to-end через Simply Chat (5 сообщений с Extract-on-compression):**
- `memory:extract-batch` (Grok 4.1 Fast) — ✅ 5 циклов, извлечено 13 фактов корректно
- `memory:dedup-verify` (Grok 4.1 Fast) — ✅ 3 раза успешно определил семантически близкие дубли, пример: «работает над проектом Simply» ≈ «разработчик приложения Simply» (similarity 0.715)
- Qualitative проверка: категоризация корректная (`fact/decision/preference/task`), confidence 0.8-1.0, content на грамматичном русском
- Временные изменения в [context-limits.ts](../../lib/ai/context-limits.ts) (`EXTRACT_THRESHOLD_SOFT=0.001`, `EXTRACT_PAUSE_MS=0`) — восстановлены к production defaults перед коммитом

**Методологические наблюдения:**
1. **Smoke test за $0.002 спас от неверного решения:** первая гипотеза была что xAI не поддерживает native `generateObject`, поэтому JSON.parse workaround придётся оставить. Двухкейсный тест показал что поддержка есть, включая `.nullable()` → бонус-рефакторинг стал возможным
2. **Важность empirical test против архитектурного допущения:** аналогично как в ТЗ-XAI-1 с эмпирическим тестом `reasoningEffort` — предпочитать быстрый реальный вызов docs/documentation interpretation
3. **Race condition при очистке БД** (`getOrCreateSimplyChat`) — side-effect обнаружен при nuke БД для чистого тестирования. Зафиксирован в [specs/_backlog/TZ_SimplyChatRaceCondition.md](../../specs/_backlog/TZ_SimplyChatRaceCondition.md). Не чинится — строгий фокус на серии
4. **One-message lag в Simply Chat MIND** — подтверждён Владимиром как known behavior (не баг). Зафиксирован в [MIND_ARCHITECTURE.md §2](MIND_ARCHITECTURE.md) — чтобы будущие сессии не искали баг там где его нет

**Связанные документы:**
- [TZ_xai_2/ANALYSIS.md](TZ_xai_2/ANALYSIS.md) — анализ call sites + 5 риск-вопросов
- [MIND_ARCHITECTURE.md](MIND_ARCHITECTURE.md) — **новая инфраструктура**, источник правды для MIND на всю серию
- [SIMPLY_XAI_NOTES.md](SIMPLY_XAI_NOTES.md) — записи про verified `generateObject` на xAI и one-message lag

**Следующий шаг:** ТЗ-XAI-3 — KITT (Simply Chat) → Grok 4.1 Fast non-reasoning. Критичные пункты: R-6 (убрать `isSimplyNonAnthropicModel` + strip-функции, заменить на `capabilities.vision` из каталога SSOT).

---

## [ТЗ-XAI-1] 2026-04-14 — Фундамент миграции — v3.88.0

**Коммиты:**
- `ba9e928` — `release(v3.88.0): ТЗ-XAI-1 — фундамент миграции на xAI` (13 files, +868 −27)
- `0ecc6fa` — `docs(xai-migration): синхронизация статусов после завершения ТЗ-XAI-1` (6 files, +365 −39)

**Продолжительность:** одна сессия (2026-04-14)

**Что сделано:**
- Удалена deprecated запись `grok-4` из [lib/ai/model-catalog.ts](../../lib/ai/model-catalog.ts) — SQL-аудит `ai_usage_log` подтвердил 0 исторических записей, оставлен пояснительный комментарий
- Добавлены `notes` на запись `grok-4.20-multi-agent-0309`: multi-agent variant не поддерживает client-side function calling через Chat Completions (только built-in tools + remote MCP). Текущее назначение `expertise → multi-agent` фактически работает как обычный Grok 4.20 (1 вызов за всю историю)
- Обновлён header xAI секции каталога: убран устаревший TODO про «2M aspirational», заменён на архитектурное обоснование что `contextWindow` задан под рабочий бюджет качества, а не под провайдерский потолок
- Обновлены [docs/ai-providers.md](../../docs/ai-providers.md) и [docs/model-catalog-ops.md](../../docs/model-catalog-ops.md) — удалены ссылки на несуществующий `grok-4`
- Создана структура серии `specs/Simply_xAI/`: `SIMPLY_XAI_ROADMAP.md`, `SIMPLY_XAI_NOTES.md`, `BRAINSTORM_GrokMultiAgent.md` (перемещён из `specs/`), папка `TZ_xai_1/` со SPEC/ANALYSIS/ROADMAP
- Закрыт backlog-ТЗ `TZ_GrokContextWindowAudit` → `specs/_backlog/_archive/` с пометкой о закрытии
- Обновлены `CHANGELOG.md` (global), `SIMPLY_STATUS.md`, `CLAUDE.md` — версия 3.88.0, секция «Активная серия Simply_xAI»
- В памяти Claude Code зафиксированы три новых правила: `no_external_architect`, `simply_xai_migration` (фокус), `keep_spec_docs_simple`
- **Эмпирический тест параметров Grok** (follow-up, без отдельного коммита на момент написания): подтверждено что `reasoningEffort` не принимается ни reasoning, ни non-reasoning вариантами `grok-4-1-fast` (оба возвращают `Bad Request`). Таблица verified параметров Grok сохранена в NOTES. Одноразовый скрипт `scripts/test-grok-reasoning-effort.ts` удалён после тестирования.

**Что НЕ сделано (и почему):**
- **Эмпирический тест максимального контекстного окна Grok** (~$10) — отменён после архитектурной коррекции Владимира. Тест отвечал на неправильный вопрос: вечный чат заполнит любое окно, модели деградируют на 30-50% заявленного размера (Lost in the Middle). Привязка `SIMPLY_CONTEXT_LIMIT` к провайдерскому окну признана антипаттерном
- **Обновление `contextWindow` у xAI записей в каталоге** — не изменён. Текущие 256K/128K заведомо больше рабочего бюджета качества (140K), провайдерский потолок архитектурно иррелевантен
- **Переключение taskId на Grok** — не делалось. ТЗ-XAI-1 это **«ноль изменений поведения»**. Переключение taskId — работа ТЗ-XAI-2 и далее
- **Удаление Compaction API блока** из `app/(chat)/api/chat/route.ts` — не нужно. Блок уже провайдер-aware через `isAnthropicProtocolModel` проверку, под xAI становится мёртвым но безвредным кодом. Оставляем до ТЗ-XAI-6

**Зафиксировано для следующих ТЗ серии:**
- **R-5** → ТЗ-XAI-5: явно переключить `expertise` с `grok-4.20-multi-agent-0309` на `grok-4.20-0309-non-reasoning`. Multi-agent уходит в отдельную будущую ветку ТЗ-XAI-MA-1
- **R-6** → ТЗ-XAI-3: полностью убрать `isSimplyNonAnthropicModel` + связанные strip-функции (`stripMediaPartsForTextModel`, `stripLegacyOpenAICompatToolParts`), заменить на проверку `capabilities.vision` из SSOT каталога. Не полагаться на маршрутизацию «vision → Haiku спасёт»
- **Бонус для ТЗ-XAI-2:** 2 call sites в MIND pipeline (`batchExtractFacts`, `runConsolidation`) сейчас используют legacy `generateText + JSON.parse + Zod` workaround от MiniMax — под Grok можно переписать на native `generateObject`
- **Новая схема работы** (зафиксирована в памяти): без внешнего архитектора, ТЗ как черновик, прямая работа user ↔ Claude Code с обязательным ANALYSIS против реального кода. Grok 4.20 Multi-Agent (веб-подписка Владимира) как факт-чекер для узких xAI вопросов, не архитектурный консультант

**Смоук-тест:**
Владимир проверил через активные dev overrides на `/dev/models`:
- `simply-chat` → `grok-4-1-fast-non-reasoning`: TTFT 15ms, total 2.8s, MIND retrieval 5 фактов ✅
- `simply-chat-think` → `grok-4-1-fast-reasoning`: TTFT 8ms, total 68s (нормально для reasoning), MIND retrieval 5 фактов ✅

**Связанные документы:**
- [TZ_xai_1/TZ-XAI-1.md](TZ_xai_1/TZ-XAI-1.md) · [ANALYSIS.md](TZ_xai_1/ANALYSIS.md) · [ROADMAP.md](TZ_xai_1/ROADMAP.md)
- [SIMPLY_XAI_NOTES.md](SIMPLY_XAI_NOTES.md) — записи «2026-04-14 ТЗ-XAI-1 завершён», «Verified Grok parameter reference», «Коррекция архитектурного допущения», «Новая схема работы»
- [global CHANGELOG.md](../../CHANGELOG.md) — запись `[3.88.0] — 2026-04-14`

**Следующий шаг:** ТЗ-XAI-2 — переключить 5 call sites MIND pipeline (`extract`, `extract-batch`, `dedup-verify`, `consolidate`, `profile`) на Grok 4.1 Fast non-reasoning. Риск низкий: нет tools, нет streaming осложнений, никаких Anthropic-specific providerOptions в этих файлах. Бонус — native `generateObject` вместо `JSON.parse` workaround.

---
