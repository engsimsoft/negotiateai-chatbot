# ADR 052 — Context Management Strategy per Provider

> **🗄️ Superseded by [ADR 054](054-single-strategy-compaction.md) (2026-04-20, v3.95.0).**
> Per-provider многоуровневая стратегия (Extract-on-compression + Anthropic Compaction API + Sliding window + planned server-side middleware) заменена на единую Simply Compaction middleware для всех провайдеров. Capability `supportsCompaction` и `providerOptions.anthropic.contextManagement` удалены. Extract запускается только внутри compaction cycle, не per-turn. Документ ниже сохранён как исторический контекст.

**Дата:** 2026-04-14
**Статус:** Superseded by ADR 054
**Источник решения:** TZ_CreateSnapshotAudit (v3.87.3)

---

## Контекст

Simply — multi-provider платформа. Главная модель Simply Chat — **MiniMax M2.7** через Anthropic-compat wrapper. Проектные задачи — Claude Sonnet/Opus/Haiku. Режим «Думать» переключает Simply на Sonnet. В будущем планируются ещё провайдеры (дополнительные OpenRouter модели, возможные новые независимые AI-API).

Каждый провайдер имеет разные характеристики:
- Размер контекстного окна (от 128K у MiniMax до 1M у Claude Opus)
- Поддержку собственных механизмов сжатия контекста (Anthropic Compaction API — только у Anthropic)
- Стоимость за токен (влияет на то, можно ли позволить себе полный контекст без сжатия)

Нам нужна чёткая стратегия: **как Simply защищает каждый чат от переполнения контекста, независимо от того какой провайдер активен**.

---

## Решение

Стратегия — **многоуровневая защита**, где каждый уровень provider-agnostic насколько возможно, и провайдер-специфичные оптимизации добавляются как бонус когда доступны.

### Уровень 1 — Extract-on-compression + MIND memory (provider-agnostic, активен для Simply Chat)

**Что:** при достижении 60% контекста (или при пассивной паузе ≥ 10 мин после 80%) сервер извлекает факты из старых сообщений в MIND memory (pgvector), помечает их `extractedAt` и исключает из последующих загрузок (`extractedAt IS NULL`).

**Где:** `lib/ai/memory/extract.ts` (`batchExtractFacts`), `app/(chat)/api/chat/route.ts` (вызов в финишной части streamа для Simply Chat), `app/api/cron/memory-profile/route.ts` (ночная страховка для >24h stale сообщений).

**Работает для:** MiniMax M2.7, Gemini Flash (vision mode), Sonnet через «Думать» — универсально для любой LLM в Simply Chat.

**Не работает для:** expertise/create/project chats (там другой паттерн — Compaction).

**Ограничения:** извлечение стоит денег (batch Haiku/MiniMax call), задержка 3-8 сек. Триггерится не на каждое сообщение, а по порогу.

### Уровень 2 — Anthropic Compaction API (provider-specific, активен для Anthropic моделей)

**Что:** Anthropic сам сжимает старые сообщения на своей стороне, прозрачно для нас. Модель воспринимает полный контекст, API возвращает сжатые результаты.

**Где:** `providerOptions.anthropic.contextManagement` в `streamText` calls, capability-gated через `modelSupportsCompaction` в `model-catalog.ts`.

**Работает для:** Claude Sonnet (expertise/create/project), Claude Opus (project Professor), Claude Haiku (project Executor).

**Не работает для:** MiniMax (даже через Anthropic-compat wrapper), xAI Grok, OpenRouter модели (Qwen, GLM и др.), Gemini.

**Ограничения:** только Anthropic API. Нельзя «одолжить» другому провайдеру.

### Уровень 3 — Sliding window safety cap (provider-agnostic, жёсткий потолок)

**Что:** последний рубеж — hard cap на количество токенов загружаемого контекста. Для Simply — 180K токенов (v3.76.0). Если после Extract-on-compression и всех остальных защит остаётся больше 180K — старые сообщения просто отрезаются.

**Где:** `lib/ai/context-limits.ts` (константы), `lib/db/queries.ts` (getMessagesByChatId с `maxTokens` параметром и token-aware loading).

**Работает для:** всех провайдеров, всех режимов. Универсальный hard backstop.

**Ограничения:** теряет информацию. Если срабатывает часто — значит уровни 1-2 не справляются и надо искать причину.

### Уровень 4 — (planned, не реализован) Provider-agnostic server-side compression middleware

**Что:** когда контекст > 70% и модель НЕ имеет Compaction API и Extract-on-compression недостаточен — сервер сам (без участия модели) подзывает дешёвый summarizer (Haiku/аналог) и сжимает старые сообщения в краткое резюме, вставляет в system prompt, укорачивает историю в модельном запросе.

**Где:** `lib/ai/context-compression.ts` (planned), вызов из `chat/route.ts` ПЕРЕД `streamText`. Паттерн уже используется в `lib/meeting/meeting-pipeline.ts` для расшифровок встреч — там сервер сам диспатчит summarization через Sonnet.

**Когда активировать:** если в будущем появится провайдер где одновременно (а) нет Compaction, (б) Extract-on-compression неэффективен (маленький контекст + большие сообщения), (в) частые hit'ы sliding window. Сейчас не нужен.

**Триггер в коде:**
```ts
if (contextFillRatio > 0.7 && !modelSupportsCompaction && !extractOnCompressionSufficient) {
  await compressOldMessagesServerSide();
}
```

---

## Таблица защит × провайдеров

| Провайдер (основные задачи) | L1 Extract-on-compression | L2 Compaction API | L3 Sliding window | L4 Server-side compression (planned) |
|---|---|---|---|---|
| **MiniMax M2.7** (Simply Chat main) | ✅ активен | ❌ нет | ✅ 180K | ⏸ не нужен сейчас |
| **Gemini Flash** (Simply Chat vision) | ✅ активен | ❌ нет | ✅ 180K | ⏸ не нужен сейчас |
| **Claude Sonnet** (expertise/create/project tasks, Simply Думать) | — (не применяется) | ✅ активен | ✅ | ⏸ не нужен (есть Compaction) |
| **Claude Opus** (Professor planning) | — | ✅ активен | ✅ | ⏸ не нужен |
| **Claude Haiku** (task Executor, clerks) | — | ⚠️ опционально (capability-gated) | ✅ | ⏸ fallback если нет Compaction |
| **xAI Grok** (доступен через OpenRouter) | ❌ не активен | ❌ нет | ✅ | ⏸ потенциально нужен если перейдём на primary |
| **OpenRouter модели (Qwen, GLM и др.)** | ❌ не активен (только через OpenRouter для peripheral задач) | ❌ нет | ✅ | ⏸ потенциально нужен если перейдём на primary |

---

## Почему createSnapshot был удалён (v3.87.3)

`createSnapshot` — model-invoked tool, который когда-то считался универсальным fallback-решением для сжатия контекста. В v3.87.3 удалён по совокупности причин:

1. **Эмпирически неэффективен.** SQL audit `Message_v2` показал **2 вызова за всю историю**, оба — из Simply Chat через Sonnet (режим «Думать»), где и так активна Compaction. **0 вызовов** из project task expert — контекста, для которого SPEC изначально предполагал tool'у «живым».
2. **Зависит от voluntary tool call.** Модель должна *сама* решить вызвать tool. MiniMax M2.7 — главная модель Simply Chat — ни разу этого не сделала за всю историю. Триггер ненадёжен.
3. **Хрупкая JSON schema.** Из 2 вызовов **1 failed** с `JSON parsing error: No number after minus sign at position 328` — модель сгенерировала невалидный nested-array input.
4. **Дублирует L1.** Даже если бы триггер работал, результат (snapshot в Chat.snapshots) дублирует функциональность Extract-on-compression — только хуже (один большой summary вместо извлечённых структурированных фактов).
5. **Дублирует L2.** Для Sonnet-задач Compaction API делает то же самое лучше и прозрачно.
6. **DB overhead.** Колонки `Chat.snapshots` (JSONB array) и `Chat.contextState` (JSONB), 4 db queries, UI компонент `SnapshotCard`, 3 ветки рендера — всё это maintenance cost без пользы. В DB: 1 запись на 11 чатов.

**Правильный паттерн для того что createSnapshot пытался делать** — см. Уровень 4 (server-side compression middleware), НЕ tool. Если понадобится — реализуется как средний pipeline вызов, а не как функция AI-модели.

---

## Последствия

**Что улучшается:**
- Явная стратегия, задокументированная в одном месте (этот ADR)
- Dead code удалён — codebase проще читать
- Меньше хрупкости (удалена одна ненадёжная ветка поведения)

**Что ухудшается:**
- Теряется 1 историческая snapshot-запись на 1 чате (не видна в UI после cleanup'а всё равно)
- При переходе на новую модель без Compaction и без mature Extract-on-compression — придётся реализовать L4. Но это правильная работа, а не восстановление старого tool.

**Чего НЕ ожидается:**
- Никакого влияния на пользовательский опыт (в UI не было видимой фичи — 2 tool calls из Sonnet-«Думать» были побочными)
- Никакого влияния на стоимость (tool stale, не использовался)
- Никакого влияния на производительность Simply Chat (MiniMax продолжает работать ровно как раньше)

---

## Альтернативы рассмотрены

### A. Оставить createSnapshot как есть
**Отвергнуто.** Dead code без защитной функции. Каждое чтение routes/components стоит внимания.

### B. Переписать createSnapshot в server-side middleware прямо сейчас
**Отвергнуто.** YAGNI — текущих 3 уровней защиты достаточно для всех текущих провайдеров. Реализация middleware — 2-3 сессии работы ради предположения что в будущем понадобится. Лучше реализовать **когда** понадобится, а не **на случай если**.

### C. Оставить schema columns, удалить только tool
**Отвергнуто.** Колонки в Chat без кода, который их пишет — технический долг будущей сессии. Full cleanup предпочтительнее.

---

## Ссылки

- **Source ТЗ:** `_archive/TZ_CreateSnapshotAudit/` (после финализации)
- **Release:** v3.87.3
- **ADR 049** — MiniMax Anthropic-compat wrapper (контекст почему Compaction не работает через него)
- **ADR 050** — Three-breakpoint cache strategy (related context management)
- **v3.76.0 TZ_SlidingWindow** — L3 реализация
- **v3.78.0 TZ_ExtractCompression** — L1 реализация
- **v3.73.0 TZ_RAG3** — Compaction API dual strategy (L2 реализация)
