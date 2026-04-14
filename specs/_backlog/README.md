# Backlog ТЗ — открытые долги и находки

> Список нерешённых задач, найденных при работе над предыдущими ТЗ.
>
> **Перед стартом нового большого ТЗ** Claude обязан пройтись по этому списку и
> предложить пользователю: «В backlog N открытых долгов: …. Хочешь сначала закрыть
> какой-то из них, или они не блокируют новый ТЗ?» Решение принимает пользователь.
>
> Этот файл и папку создаёт правило 8 WORKFLOW.md (FINDINGS → backlog).
>
> Создан: 2026-04-13

---

## Как пользоваться

- Каждый файл в этой папке — заготовка ТЗ (формат как у обычного `SPEC.md`)
- Когда поднимаем работу над долгом — файл становится исходником полноценного ТЗ:
  ```
  mkdir specs/TZ_<name>
  mv specs/_backlog/TZ_<name>.md specs/TZ_<name>/SPEC.md
  ```
  Дальше — обычный WORKFLOW (ANALYSIS → ROADMAP → код → финализация → архив)
- Если долг закрыт — файл удаляется из `_backlog/`, а закрывшее его ТЗ уходит в `_archive/` со ссылкой в своём CHANGELOG: «закрывает backlog/TZ_X»

---

## Открытые долги

### 🟧 Medium impact

| ТЗ | Описание | Оценка | Источник |
|---|---|---|---|
| [TZ_PromptsDeadCodeCleanup](TZ_PromptsDeadCodeCleanup.md) | Удалить мёртвые экспорты из `lib/ai/prompts.ts` (`artifactsPrompt`, `regularPrompt`, `systemPrompt` deprecated, `buildUserContext` deprecated). 90% файла dead, только `updateDocumentPrompt` живой. Рассмотреть переименование в `lib/ai/artifact-prompts.ts`. | 0.5 сессии | TZ_DeadModelSelectors |

### 🟩 Low impact

| ТЗ | Описание | Оценка | Источник |
|---|---|---|---|
| [TZ_GrokContextWindowAudit](TZ_GrokContextWindowAudit.md) | Эмпирическая проверка реального context window для Grok 4.20 (каталог: 256K, docs.x.ai: 2M). Бинарный поиск через xAI API, обновить `model-catalog.ts` (Finding #1) | 0.5 сессии | TZ_LegacyChatCleanup |

---

## Происхождение по ТЗ

| ТЗ-источник | Дата | Долгов внесено | Закрытые |
|---|---|---|---|
| TZ_LegacyChatCleanup | 2026-04-13 | 5 (4 medium + 1 low) | — |
| TZ_UnfreezePipelines (session find) | 2026-04-13 | 1 medium (OpenRouterCostTracking) | — |
| TZ_DeadModelSelectors | 2026-04-14 | 1 medium (`PromptsDeadCodeCleanup`). Finding #2 (`OverridesReaderCentralization`) был ошибочно заведён в backlog — панель `/dev/models` это dev-only инструмент, в production она намеренно выключена (`isSimplyDevMode=false`), а в dev single-process один side-effect import в `chat/route.ts` покрывает все 26 call-sites через shared module instance. Долга нет. | — |

## Закрытые долги

| ТЗ | Закрыто в | Как |
|---|---|---|
| TZ_UsageLoggingCoverage | 2026-04-13 (TZ_UnfreezePipelines v3.86.1) | Слит в `TZ_CachePipelineMetrics` — обе задачи трогают одни и те же pipeline-файлы, раздельное выполнение было бы двойной работой |
| TZ_OpenRouterCostTracking | 2026-04-13 (v3.87.1) | Root cause оказался не namespace prefix (первая гипотеза) а version suffix от OpenRouter. Walk-back loop в `getModelEntry` делает lookup tolerant к versioned IDs. См. ADR not needed — patch fix |
| TZ_StreamObservability | 2026-04-14 (v3.87.2) | Server-side `onError` в обоих chat routes: console.error + emitDebugError через closure-captured writer + локализованная user-facing строка. Stage 2b расширил скоуп на recovery UX: prop-drill `clearError` из useChat → MultimodalInput, submit guard сужен до streaming/submitted, пользователь больше не зависает после ошибки без reload страницы |
| TZ_CreateSnapshotAudit | 2026-04-14 (v3.87.3) | SQL audit: 2 all-time calls, 0 через project task expert (ожидавшийся контекст), 1 failed из 2. Fully deleted — 4 файла, 4 queries, 2 schema columns (migration 0054), все UI ветки. ADR 052 «Context Management Strategy per Provider» документирует 4-уровневую стратегию защиты контекста (L1 Extract-on-compression, L2 Anthropic Compaction, L3 Sliding window, L4 planned server-side middleware) |
| TZ_DeadModelSelectors | 2026-04-14 (`9ddf814`, `a1923b1`, `5b2571c`) | **Закрыто частично** (~30% scope). Удалены 3 legacy selector-файла + упрощён `entitlements.ts`. Попутно закрыт pre-existing bug override в проектных task-чатах (`9ddf814` — side-effect import + 4 поля в emitDebugPrompt). **Остальные ~70%** (удаление `lib/ai/models.ts`, цепочка `initialChatModel`, dead Claude ветка в `multimodal-input.tsx`, упрощение InputContext) **намеренно оставлены** по решению владельца — `ModelSelectorCompact` в проектах сохраняется. Первая попытка (Этап 1, коммит `772e886`) была откачена `git reset --hard` после HMR incident. Внесено 2 новых находки в FINDINGS: `lib/ai/prompts.ts` 90% dead (Finding #1), scattered side-effect imports для overrides reader (Finding #2, high impact architectural) |
| TZ_OverridesReaderCentralization | 2026-04-14 (сессия 3, 0 коммитов в код) | **Закрыто как «ошибочно заведено»**. Finding #2 из TZ_DeadModelSelectors был сформулирован как production-concern для dev-only фичи (`/dev/models`). Попытка перенести side-effect import в `instrumentation.ts` провалилась при мануальном тесте и была полностью откачена. Настоящая причина ошибки мануального теста — в `.simply-dev-overrides.json` не было ключа `simply-chat` (не баг, а состояние UI). Постскриптум добавлен в ADR 048. Правило на будущее: **перед заведением находки сверять с ADR — если ADR явно декларирует ограничение, «отсутствие покрытия за пределами ограничения» это реализация дизайна, не долг**. См. `_archive/TZ_OverridesReaderCentralization/HANDOFF.md` |
