# Simply Compaction — Архитектура управления контекстом

**Версия:** 2.0 (единая провайдер-агностичная стратегия)
**Дата:** 2026-04-20
**Статус:** Утверждена (ADR 054)
**Автор:** Архитектор (Claude Opus)
**Связанные документы:** MIND_ARCHITECTURE.md, SIMPLY_ATTACHMENT_ARCHITECTURE.md, ADR 054 (supersedes 042, 052), ADR 053

**История версий:**
- **v2.0 (2026-04-20)** — **ТЗ-COMPACTION-UNIFY (v3.95.0).** Стратегия становится единой для всех chat-моделей всех провайдеров. Anthropic Compaction API удалён из кода; capability `supportsCompaction` и функция `getCompactionStrategy` удалены; middleware `prepareMessagesWithCompaction` вызывается безусловно. Middleware теперь оркестрирует **extract → compact** на одной группе сообщений (Mem0 best practice 2026 «memory formation before summarization»). Per-turn `extractAndStoreFacts` удалён в expertise/create/project — убран ~12× overhead. Все пороги считаются от `SIMPLY_CONTEXT_LIMIT = 200_000` (унификация с MIND — закрыт backlog `TZ_UnifyContextThresholdBase`). Виджет контекста использует ту же базу (`lib/usage.ts`). User-visible warning на Hard 85% удалён — compaction работает молча; ручной handoff перенесён в COMPACTION-3. `CompactionEvent.kind` удалён. Полное обоснование: [ADR 054](../../docs/decisions/054-single-strategy-compaction.md).
- v1.0 (2026-04-17) — первая утверждённая версия. 4 секции: Проблема, Решение, Архитектура (фазы 0-3), Формат Summary, Модель, Различие с MIND/Anthropic, Виджет, Техническая реализация, Приоритет, Открытые вопросы, Исследование.
- v1.1 (2026-04-18) — добавлена секция «Провайдер-агностичность» перед «Техническая реализация». Обновлена строка Scope в таблице «Различие с MIND и Anthropic Compaction» (было «Все Grok-чаты» → стало «Все chat-режимы где `supportsCompaction: false`»). Провайдер-агностичность формализует capability-driven подход, новый `taskId` compaction:summarize, функцию getCompactionStrategy(modelId), middleware prepareMessagesWithCompaction, связь с ADR 053 (5-й аспект контракта).
- v1.2 (2026-04-18) — **закрыт открытый вопрос Q3 (триггер по usage% vs абсолютному числу).** Зафиксированы пороги: Soft = 50% от `SIMPLY_CONTEXT_LIMIT` (100 000 токенов, Фаза 1), Hard = 85% от `SIMPLY_CONTEXT_LIMIT` (170 000 токенов, Фаза 3). База расчёта — `SIMPLY_CONTEXT_LIMIT` (200K), не `contextWindow` модели. Обновлены триггеры Фаз 1/2/3. Добавлена подсекция «Обоснование порогов» в §Архитектура (4 источника из практик 2026: Anthropic reasoning degradation, Claude Code default 83%, NVIDIA RULER, best practice smaller-frequent). Q3 удалён из §Открытые вопросы.
- v1.3 (2026-04-18) — **закрыт открытый вопрос Q1 (размер дословного окна).** Зафиксировано: **40 000 токенов**, единица измерения — **токены, не сообщения**. Алгоритм сборки — с конца истории к началу, останавливаемся на первом сообщении которое не помещается целиком (edge case: если последнее сообщение > 40K — включить его целиком, не резать вложение посередине). Обновлены Фаза 1 действие 4 и Фаза 2 действие 3 (верстка окна в токенах). Добавлена подсекция «Дословное окно» в §Архитектура после §Фазы работы. Добавлены 4 новых источника в §Исследование (Mem0 guide 2025 20-older/10-recent, LangChain ConversationSummaryBufferMemory, Microsoft Semantic Kernel v1.35, agentwiki conversation history management). Зафиксирована целевая константа `COMPACTION_VERBATIM_WINDOW_TOKENS = 40_000` для `lib/ai/context-limits.ts` (внедрение — в Фазе 3 реализации). Q1 удалён из §Открытые вопросы.
- v1.4 (2026-04-18) — **закрыт открытый вопрос Q2 (размер summary).** Зафиксировано: **target 3 000 токенов** (константа `COMPACTION_SUMMARY_TARGET_TOKENS`, инструкция модели в промпте) + **hard cap 4 096 токенов** (`DEFAULT_MAX_OUTPUT_TOKENS['compaction:summarize']`, safety-net AI SDK per ADR 053). Два значения — model целится в 3K, cap 4K защищает от runaway с margin 1K. Обновлена строка «Максимальный размер» в §Формат Summary → Требования к Summary. Добавлена подсекция «Обоснование размера summary» в §Формат Summary. Добавлены 4 новых источника в §Исследование (Anthropic Compaction API `compact-2026-01-12` beta, Hermes Agent context-compression, Justin3go 2026-04-09 comparative analysis Codex/Claude Code/OpenCode summary sizes, Microsoft SK compaction strategy). Зафиксирована целевая константа `COMPACTION_SUMMARY_TARGET_TOKENS = 3_000` для `lib/ai/context-limits.ts` (внедрение — в Фазе 3 реализации). Q2 удалён из §Открытые вопросы.
- v1.5 (2026-04-18) — **подтверждён выбор модели Grok 4.1 Fast non-reasoning** (`grok-4-1-fast-non-reasoning`) для `compaction:summarize`. Решение v1.0 правильное, лучшие практики 2026 его подтверждают. Добавлены подсекции «Обоснование выбора (v1.5)» (6 аргументов: индустриальный консенсус, доказано в MIND, native `generateObject`, xAI `prompt_cache_key`, экономика ~1.3₽/сжатие, ресторан) и «Альтернативы (рассмотрены, отклонены)» (5 отклонённых: Grok 4.20 reasoning, Haiku 4.5, MiniMax M2.7, Sonnet/Opus, OpenRouter) в §Модель для сжатия. **Бонусом закрыт Q4 (prompt caching)** — автоматически как прямое следствие выбора Grok 4.1 Fast: используем xAI native `prompt_cache_key` (75% скидка на input, критично для rolling update Фазы 2). Добавлен блок «Источники v1.5» в §Исследование (Microsoft Agent Framework, Google ADK, Factory.ai production eval, JetBrains Junie research). Q4 удалён из §Открытые вопросы (осталось 1 открытый — Q5 о Compaction в Simply Chat поверх MIND).
- v1.6 (2026-04-18) — **зафиксирован MVP scope + phased rollout внутри ТЗ-COMPACTION-1.** Решение: один ТЗ с двумя этапами A→B (narrow-first deployment best practice 2026), не два отдельных ТЗ. **Этап A — Инфраструктура + expertise pilot** (taskId, middleware, миграция БД, вызов в expertise route, smoke test). **Этап B — Расширение на create** (копия вызова middleware в create route, smoke test). Simply Chat / project task expert / service chats — **не в MVP**, откладываются в ТЗ-COMPACTION-2+ после выполнения 4 критериев выхода MVP. Обновлена таблица «MVP-активация» в §Провайдер-агностичность → §Scope расширен — новая колонка «Этап в ТЗ-COMPACTION-1». Добавлены подсекции «Phased Rollout внутри ТЗ-COMPACTION-1» (этапы A/B с обоснованием через narrow-first) и «Критерии выхода MVP» (4 критерия: stable smoke 1+ неделю, observability, качество summary на 3-5 сессиях, edge cases). Добавлен блок «Источники v1.6» в §Исследование (Digital Applied «AI Agent Scaling Gap March 2026», Valtorian MVP scope 2026, HSO PoC→Pilot→MVP maturity curve).
- v1.7 (2026-04-18) — **финальная версия перед Фазой 2 ТЗ-COMPACTION-1: закрыт Q5 (Compaction в Simply Chat поверх MIND).** Решение: **ДА, compaction в Simply Chat нужен — но не в MVP.** MIND и Simply Compaction работают на разных уровнях: MIND = долговременная память (атомарные факты в БД → RAG), Simply Compaction = оперативная память сессии (history → summary → in-context). MIND не сохраняет нарратив сессии, только факты о пользователе — gap который закрывает compaction. Simply Chat нуждается в compaction, но откладывается в ТЗ-COMPACTION-2 из-за MVP-принципа narrow-first и технической сложности ordering. Обновлена подсекция «Взаимодействие в Simply Chat» в §Различие с MIND — новая таблица 4 аспектов (атомарные факты / контекст задачи / нарратив / материалы) и явный диагноз что сейчас Simply Chat работает на `CONTEXT_BUDGET = 140K` sliding window truncation. Добавлена подсекция «Ordering в Simply Chat (для COMPACTION-2)» с техническим риском: при текущих порогах последовательность 84K MIND soft → 100K Compaction soft → 112K MIND hard → 170K Compaction hard; compaction сработает до MIND hard → потеря фактов. Решение для COMPACTION-2: принудительный pre-compaction MIND batch extract на удаляемой части. Указана связь с долгом `TZ_UnifyContextThresholdBase` — желательная подготовка перед COMPACTION-2. Уточнено описание ТЗ-COMPACTION-2 в §Приоритет реализации. **Открытых вопросов больше нет** — добавлена пометка «документ готов к Фазе 2 ТЗ-COMPACTION-1».
- v1.8 (2026-04-18) — **ревизия под реальный код после Фазы 1 ТЗ-COMPACTION-1 (Claude Code ANALYSIS.md).** 8 правок по итогам кодового ревью и ответов архитектора на Группы 1-2 вопросов (полный лог в [specs/TZ_COMPACTION_1/ARCHITECT_ANSWERS.md](../TZ_COMPACTION_1/ARCHITECT_ANSWERS.md)): **(1)** точка интеграции — **единый `app/(chat)/api/chat/route.ts`** с gate по chatMode, НЕ отдельные route handlers для expertise/create (в проекте их нет); **(2)** источник usage для threshold — формула `estimateMessageTokens`-based из существующего MIND extract ([chat/route.ts:787-793](../../app/(chat)/api/chat/route.ts#L787-L793)), SSOT подсчёта; **(3)** AI SDK integration — **explicit pre-call preprocessing**, не `prepareStep` (доступ к dataStream.write, pure function, линейный lifecycle); **(4)** таблица «Сводка изменений кода» исправлена — `app/(chat)/api/chat/route.ts` вместо несуществующих routes + переписывание `supportsCompaction` Line 952-965 через `getCompactionStrategy(modelId)` с **реальным modelId** (убирает `isProjectChat` заплатку); **(5)** xAI caching — автоматическое, `x-grok-conv-id` HTTP header — только оптимизация routing (не opt-in включатель), в MVP header не включаем; **(6)** edge case дословного окна — hard upper bound 80K токенов с маркером `[...начало сообщения сокращено...]`; **(7)** язык summary — одна инструкция на русском + директива модели «отвечай на языке разговора»; **(8)** виджет контекста — реализация через существующий DataStream protocol + `emitDebugCompaction` helper (зеркалирует паттерн `emitDebugPrompt/Rag/Warning` из [lib/ai/debug-events.ts](../../lib/ai/debug-events.ts)).
- v1.9 (2026-04-19) — **уточнение helper-паттерна для user-visible compaction event по итогам Этапа A4 ТЗ-COMPACTION-1.** Claude Code обнаружил коллизию: в коде уже существует `emitDebugCompaction` + `DebugCompactionData` в `lib/ai/debug-events.ts` (из ТЗ-RAG3, схема `{triggered, iterations[]}`, dev-only gated через `isSimplyDevMode`) — семантически несовместимо с v1.8 user-visible схемой `{kind, chatId, compactionIndex, compactionCount, summaryTokens, squeezedTokens}`. Архитектор утвердил **раздельные event channels**: существующий `data-debug-compaction` (dev-only) остаётся неизменным для Anthropic provider iterations; новый user-visible event `data-compaction` эмитится через **новый helper `emitCompactionEvent` в `lib/ai/compaction/events.ts`** (не в `debug-events.ts` — другая семантика, без `isSimplyDevMode` gate). Обновлена §Виджет контекста → «Реализация через существующий DataStream protocol»: helper живёт в `lib/ai/compaction/events.ts`, event type `data-compaction`, функция `emitCompactionEvent`, тип данных `CompactionEvent` (из `lib/ai/compaction/types.ts`). Содержательно архитектура не меняется — исправлена только формулировка helper-паттерна.
- v1.10 (2026-04-19) — **правка терминологии виджета контекста по замечанию владельца в Этапе A6 ТЗ-COMPACTION-1.** В expertise/create/projects по устойчивому продуктовому решению **не используется слово «чат»** — вместо него: expertise → «запрос», create → «задание», projects → «задача» (см. app-sidebar.tsx:97-103). Мои v1.8 формулировки «Рекомендуем начать новый чат» и «Новый чат с итогом» в таблице §Виджет контекста и в секции «Принцип отображения» были прямым нарушением этой терминологии. Исправлено: таблица event'ов теперь показывает mode-aware тексты («новый запрос» / «новое задание» в зависимости от chatMode), компонент `CompactionIndicator` в `components/elements/context.tsx` получает `chatMode` prop и выбирает корректный label + использует каноническую механику `generateUUID() + getChatUrl(newId, chatMode) + router.push + refresh` из app-sidebar.tsx:79-86 (не самопальную strip-pathname). Поведение одинаковое, формулировки корректные.

---

## Проблема

Simply — multi-provider платформа. Исторически управление памятью чата было разным для разных провайдеров:
- **Anthropic модели (Sonnet/Opus)** использовали провайдерский Compaction API (`compact_20260112`) — чёрный ящик, прозрачность нулевая.
- **Остальные модели (Grok, MiniMax, OpenRouter)** использовали собственный Simply Compaction middleware — с явным логированием и контролем.
- **Simply Chat** вообще не имел compaction — полагался на MIND Extract (факты в долговременную память) + sliding window truncation.
- **Per-turn `extractAndStoreFacts`** после каждого ответа AI в expertise/create/project — извлечение фактов из свежих сообщений, которые модель и так видит. Overhead ~12× по сравнению с расходами на сам чат ($0.0862 extract vs $0.0072 chat на 4 turn).

Четыре симптома после ТЗ-COMPACTION-1 привели к решению унифицировать:
1. **UX:** user-visible warning «Рекомендуем начать новое задание» на 85% контекста противоречил Apple-философии Simply.
2. **Экономика:** per-turn extract платил за факты, извлекаемые из ещё не уходящих сообщений.
3. **SSOT:** MIND extract считал от `CONTEXT_BUDGET=140K`, Compaction от `SIMPLY_CONTEXT_LIMIT=200K`, виджет от `contextWindow` модели — три разные базы для одной сущности.
4. **Провайдер-зависимость:** смена провайдера требовала переписывать ветки compaction.

Полное обоснование решения — **[ADR 054](../../docs/decisions/054-single-strategy-compaction.md)**.

---

## Решение: единая Simply Compaction для всех моделей

Собственный механизм сжатия контекста, **один для всех chat-моделей всех провайдеров**. Принцип: **Summary Buffer с оркестрацией extract→compact** — структурированный итог старой части + последние сообщения дословно + гарантия извлечения фактов в память перед сжатием.

### Философия

- **Пользователь не должен знать механику.** Никаких «токенов», «контекстных окон», «сжатия». Он видит: «AI помнит то, что я ему говорил».
- **Бесшовная работа.** Сжатие происходит автоматически, разговор продолжается без разрыва.
- **Предупреждение — крайняя мера**, когда сжатие исчерпано, не первая реакция.
- **Apple-подход:** одна операция решает проблему, пользователь не принимает технических решений.

---

## Архитектура

### Двухслойная история

Вместо отправки полной истории в LLM отправляем:

```
┌─────────────────────────────────────┐
│  System Prompt                      │
├─────────────────────────────────────┤
│  [CONTEXT SUMMARY]                  │  ← Структурированный итог
│  Сжатие старых сообщений            │     старой части разговора
├─────────────────────────────────────┤
│  MIND facts (только Simply Chat)    │
├─────────────────────────────────────┤
│  Последние N сообщений (дословно)   │  ← Свежий контекст,
│  user → assistant → user → ...      │     полная детализация
└─────────────────────────────────────┘
```

### Фазы работы

#### Фаза 0 — Обычная работа (0–50% контекста)

- Вся история отправляется как есть
- Виджет контекста: нейтральная полоска прогресса (без цифр, без процентов)
- Никаких вмешательств

#### Фаза 1 — Первое сжатие (Soft trigger — 50%)

**Триггер:** usage ≥ **50% от `SIMPLY_CONTEXT_LIMIT`** = **100 000 токенов**. База расчёта — `SIMPLY_CONTEXT_LIMIT` (200K), не `contextWindow` модели (2M у Grok). Обоснование порогов — см. §Архитектура → «Обоснование порогов».

**Действия:**
1. Grok 4.1 Fast генерирует структурированный summary старых сообщений
2. Summary инжектируется как блок `[CONTEXT SUMMARY]` в system prompt
3. Старые сообщения исключаются из отправки в LLM
4. Последние **~40 000 токенов** остаются дословно (алгоритм сборки — с конца истории, см. §Дословное окно)
5. Summary + индекс сжатия сохраняются в БД (поле в таблице чата)

**Для пользователя:**
- В UI все сообщения остаются видимыми — визуально ничего не меняется
- Виджет показывает мягкий индикатор: иконка 📦 + «Разговор сжат»
- Разговор продолжается бесшовно

#### Фаза 2 — Повторное сжатие (циклично, Soft 50%)

**Триггер:** после Фазы 1 usage снова достигает **50% от `SIMPLY_CONTEXT_LIMIT`** (100 000 токенов) — начинается повторный цикл сжатия. Циклично повторяется до достижения Hard-порога (Фаза 3).

**Действия:**
1. Новый summary включает: предыдущий summary + сообщения от прошлого сжатия до текущего окна
2. Обновлённый summary заменяет предыдущий в system prompt
3. Дословное окно сдвигается (снова последние ~40 000 токенов, см. §Дословное окно)

**Может повторяться многократно.** Разрыв Soft (100K) ↔ Hard (170K) = 70K пространства для 2-3 повторных циклов. Каждый цикл «продлевает жизнь» разговора.

#### Hard threshold (85%) — observability-only

**v2.0 (ТЗ-COMPACTION-UNIFY):** бывшая Фаза 3 с user-visible предупреждением удалена. Теперь Hard threshold (usage ≥ 85%) используется только для различения `action=compact` vs `action=truncate` в структурированных логах `[Compaction]`. Поведение middleware идентично Soft — тот же алгоритм extract → compact, никаких предупреждений, никаких кнопок.

Ручной handoff в новый чат с pre-fill summary перенесён в **COMPACTION-3** — отдельная UI-поверхность, не сейчас.

### Дословное окно

> Добавлено в v1.3 (2026-04-18). Закрывает открытый вопрос Q1 из v1.0 (размер: 15 или 20 сообщений, или ~30K токенов).

**Размер:** **40 000 токенов** (константа `COMPACTION_VERBATIM_WINDOW_TOKENS` для [lib/ai/context-limits.ts](../../lib/ai/context-limits.ts), внедряется в Фазе 3 реализации ТЗ-COMPACTION-1).

**Единица измерения:** **токены, не сообщения.** Simply-сообщения **разнородные по размеру** — короткий вопрос ~50 токенов, сообщение с PDF-вложением 20-30K токенов. Фиксированное количество сообщений неработоспособно:
- 15 коротких сообщений = ~750 токенов (окно пустое)
- 15 сообщений с вложениями = ~300K токенов (не помещается даже в `SIMPLY_CONTEXT_LIMIT`)

Token-based — индустриальный стандарт для production: LangChain `ConversationSummaryBufferMemory` использует `max_token_limit`, Microsoft Semantic Kernel v1.35 рекомендует токены для production, Claude Code «hot tail» оперирует в токенах.

**Обоснование размера 40K:**

1. **Пропорция summary:verbatim из индустриальных практик 2026** — Mem0, Langchain, Microsoft SK, agentwiki публикуют 2:1 паттерн («сжимать всё старше 20 сообщений, последние 10 — verbatim»). В наших терминах при Soft trigger 100K токенов: summary ~3K + verbatim 40K = 43K «текущее окно», сжатая часть 60K / verbatim 40K = **1.5:1** — в допустимом диапазоне, ближе к более сохранительной стороне.
2. **Реальные use cases expertise/create.** PDF/XLSX average вложение в MVP сценариях = 10-20K токенов. Typical expertise-диалог = 2-4 полных обмена с анализом вложения. 40K вмещает 2-4 полных обмена **даже с крупными вложениями** — покрывает «последнюю активную мысль», то что пользователь реально держит в голове при продолжении.
3. **Почему не 30K** (исходное предложение v1.0): слишком мало для expertise с вложениями. Одно сообщение с PDF = 20K+ → остаётся 10K на остальной разговор, 1-2 коротких обмена, контекст обсуждения самого вложения теряется. 30K подошло бы для чистого текстового диалога без вложений, но Simply не такой.
4. **Почему не 60K+** (overshoot): растёт риск что до Hard trigger (170K) не хватит пространства на новые сообщения. 43K «уже занято» + 60K verbatim = 103K после компакшена → 67K до Hard. Мало для 2-3 повторных циклов Фазы 2 (заявленная цель разрыва Soft↔Hard из §Обоснование порогов).

**Алгоритм сборки verbatim window:**

```
1. Идём с конца истории назад.
2. Складываем токены сообщений кумулятивно.
3. Останавливаемся на ПЕРВОМ сообщении которое при включении превысит 40K.
4. Это сообщение НЕ включаем — оно уходит в summary.

Edge case A — последнее сообщение само > 40K, но ≤ 80K (крупное вложение):
  → Включаем его целиком, окно временно расширяется до размера этого сообщения.
  → Обоснование: резать середину вложения сломает смысл; лучше позволить окну
    временно превысить 40K, чем отдать модели обрезанный PDF.

Edge case B (v1.8) — последнее сообщение > 80K токенов (~40% SIMPLY_CONTEXT_LIMIT):
  → Обрезать верхнюю часть сообщения с маркером
    `[...начало сообщения сокращено из-за большого размера...]`.
  → Сохранить последние ~80K токенов этого сообщения.
  → Обоснование: защита от polluting бюджета — одно сообщение > 80K токенов
    заняло бы половину SIMPLY_CONTEXT_LIMIT, не оставив места для дальнейшего
    разговора. Hard upper bound предотвращает degradation в redkix edge cases.

MVP не перемешивает user/assistant pairing:
  → Берём последние M целых сообщений (любого роля).
  → Если последнее — assistant message, начинаем с него.
  → Возможен orphaned assistant без предыдущего user — это норма (у модели
    уже есть summary в system prompt для контекста).
```

**Ссылки на источники:** см. §Исследование (LangChain, Mem0, Microsoft SK, agentwiki).

### Обоснование порогов

> Добавлено в v1.2 (2026-04-18). Закрывает открытый вопрос Q3 из v1.0 (триггер по usage% vs абсолютному числу).

**Зафиксированные значения:**

| Порог | Значение | Фаза |
|---|---|---|
| Soft trigger | **50% от `SIMPLY_CONTEXT_LIMIT` = 100 000 токенов** | Фаза 1 (первое сжатие), Фаза 2 (повторное, циклично) |
| Hard trigger | **85% от `SIMPLY_CONTEXT_LIMIT` = 170 000 токенов** | Фаза 3 (рекомендация нового чата) |

**База расчёта — `SIMPLY_CONTEXT_LIMIT` (200K), не `contextWindow` модели (2M у Grok).**

#### Почему не от contextWindow модели

- Grok 4.20 заявляет 2M токенов, но **NVIDIA RULER benchmark (2025)** показывает эффективный контекст 50-65% от заявленного → ~1M эффективных. Однако качественная зона — первые **100K токенов** (см. ниже). Поэтому считаем от рабочего бюджета качества (200K), не от провайдерского потолка.
- `SIMPLY_CONTEXT_LIMIT` уже эмпирически подобран как зона где модель ещё думает хорошо — выровнено с архитектурным решением 2026-04-14 (см. [SIMPLY_XAI_NOTES.md](SIMPLY_XAI_NOTES.md)) «размер провайдерского окна архитектурно иррелевантен».

#### Четыре источника обоснования

1. **Anthropic research — reasoning degradation после 100K токенов.** Качество reasoning заметно деградирует после ~100K. Soft = 100K значит сжимаем **до начала деградации**, не после. Источник: LogRocket — «LLM context problem 2026» (обзор Anthropic research на качество на длинном контексте).
2. **Claude Code default auto-compact = 83%.** Наш Hard 85% ≈ соответствует индустриальному стандарту. Headroom 15% (30K токенов) — запас на generation финального summary + output-ответ (summary 2000-4000 tok + output 8000-16000 tok умещаются). Источник: Decode Claude — «Inside Claude Code's Compaction System».
3. **NVIDIA RULER — эффективный контекст 50-65% от заявленного.** 2M у Grok = ~1M эффективных. Работать с заявленным числом = обманывать себя. Источник: Morph AI — «Largest context window 2026» (обзор RULER benchmark).
4. **Best practice — «smaller, more frequent summaries preserve more detail».** Разрыв 50%↔85% = 70K пространства для 2-3 повторных циклов Фазы 2. Каждый цикл работает на меньшем объёме → summary качественнее, детали теряются меньше. Альтернатива (один большой порог 80% без повторных циклов) даёт худшее качество summary. Источник: MindStudio — «How to Use /compact Command».

#### Согласованность с существующими порогами MIND

MIND Extract в коде ([lib/ai/context-limits.ts](../../lib/ai/context-limits.ts)) имеет свои пороги:

- `EXTRACT_THRESHOLD_SOFT = 0.6` (60% от `CONTEXT_BUDGET = 140K` ≈ 84K токенов) — MIND срабатывает **раньше** Simply Compaction (100K).
- `EXTRACT_THRESHOLD_HARD = 0.8` (80% от `CONTEXT_BUDGET = 140K` ≈ 112K токенов).

MIND → Simply Compaction — правильный порядок в Simply Chat (см. §Взаимодействие в Simply Chat). Но **базы расчёта разные** (CONTEXT_BUDGET у MIND vs SIMPLY_CONTEXT_LIMIT у Compaction) — это несоответствие фиксируется как вопрос к архитектору в ANALYSIS.md ТЗ-COMPACTION-1 (нужно ли унифицировать базу или оставить две разные). На реализацию MVP не влияет — MVP активируется только в expertise/create, где MIND не применим.

#### Константы для `lib/ai/context-limits.ts` (ориентир для Фазы 3 реализации)

Добавляются **рядом** с существующими `EXTRACT_THRESHOLD_SOFT/HARD`, не заменяют их:

```typescript
export const COMPACTION_THRESHOLD_SOFT = 0.5;   // 50% от SIMPLY_CONTEXT_LIMIT — Фаза 1/2
export const COMPACTION_THRESHOLD_HARD = 0.85;  // 85% от SIMPLY_CONTEXT_LIMIT — Фаза 3
```

---

## Формат Summary

Урок индустрии: свободный текст теряет детали. Структурированный «handoff» — сохраняет.

### Промпт для генерации Summary (концепция)

> Примечание: финальные формулировки промпта — зона PE-команды. Здесь — архитектурная спецификация структуры.

```markdown
## Контекст задачи
[Что пользователь решает / над чем работает]

## Загруженные материалы
[Какие документы/файлы предоставлены, ключевые данные из каждого]

## Ключевые решения и выводы
[Что решили, какие ограничения установлены, важные факты]

## Текущий фокус
[На чём остановились, что обсуждается прямо сейчас]

## Открытые вопросы
[Что ещё не решено, что пользователь планирует обсудить]
```

### Требования к Summary

- **Target размер:** ~3 000 токенов (константа `COMPACTION_SUMMARY_TARGET_TOKENS` для `lib/ai/context-limits.ts`, инструкция модели в промпте «сделай summary ~3000 токенов»)
- **Hard cap (safety-net):** 4 096 токенов (`DEFAULT_MAX_OUTPUT_TOKENS['compaction:summarize']`, per ADR 053 — защита от runaway в AI SDK call). Модель целится в 3K, cap 4K даёт margin 1K если структура summary требует чуть больше. Оба значения зафиксированы, не эмпирически. Обоснование — см. подсекцию ниже.
- **Язык (v1.8):** реализация через **одну инструкцию в промпте на русском** + директива модели «Итог пиши на том же языке что использует пользователь в разговоре». Grok 4.1 Fast справляется с language adaptation нативно (verified в MIND extract — та же задача). Нет необходимости в language detection + branching промптов.
- **Фокус на фактах**, не на стиле разговора
- **Материалы из вложений:** ключевые данные/выводы, не метаданные файлов
- **Нет дублирования** с system prompt и MIND facts

### Обоснование размера summary

> Добавлено в v1.4 (2026-04-18). Закрывает открытый вопрос Q2 из v1.0 (2000 или 4000 токенов).

**Target 3 000 токенов — обоснование из лучших практик 2026:**

| Источник | Значение | Роль в обосновании |
|---|---|---|
| Anthropic Compaction API default | `max_tokens: 4096` (beta `compact-2026-01-12`) | Production-проверенный Anthropic headroom — наш cap 4096 матчится 1:1 |
| Claude Code 9-section summary | 4-5K токенов | Верхний край диапазона для detailed technical content |
| OpenCode 5-section summary | 2.5-3.5K токенов | Наш 5-секционный формат попадает в этот паттерн |
| Codex CLI concise handoff | 2-3K токенов | Нижний край диапазона |
| Hermes 8-section template | 2.5-3.5K на типичную сессию | Средний диапазон |
| **Консенсус 2026** | **2.5-4K токенов** для structured handoff | Наш target 3K — середина диапазона |

**Математика секций:** наш 5-секционный формат (Goal / Materials / Decisions / Focus / Open Questions) из §Формат Summary × ~600 токенов/секция = ~3000 токенов. Совпадает с индустриальным паттерном.

**Compression ratio:** при Фазе 1 (soft 100K) сжимается ~55K (100K минус system ~5K минус verbatim 40K). 3K summary из 55K input = **~18× compression** — агрессивно, но в пределах нормы (Morph 2026: summarization 10-20×, vs verbatim truncation 50-70%).

**Почему не 2000:**

- 2K × 27× compression = слишком агрессивно для 55K input с вложениями
- 5-секционный формат требует минимум 400-600 токенов/секцию для детализации → минимум 5 × 500 = 2500 токенов
- 2K подходит для простых задач (1-2 секции, короткий handoff) — expertise/create с анализом вложений требуют больше

**Почему не 4000:**

- 4K × 14× compression — менее эффективно, больше input cost на каждом следующем вызове (summary передаётся в каждый request после первого сжатия)
- Claude Code 9-section case использует 4-5K для **detailed technical content** (coding agent) — у нас 5 секций и более бизнесовый контент (Simply — российский бизнес 40-60+, не coding agent)
- Target 3K с margin 1K до cap 4K — достаточный запас если модель разгонится на детализации

**Поведение при повторных сжатиях (Фаза 2):**

При повторном сжатии сжимается меньше контента (~50K), но previous_summary уже занимает ~3K — суммарный input для `compaction:summarize` ~ 53K. Target 3K остаётся адекватным для **rolling update паттерна** (Hermes: «previous summary is passed to the LLM with instructions to update it rather than summarize from scratch»). Мы не удваиваем summary на каждом цикле — мы **обновляем** его до того же target 3K.

**Hermes `_SUMMARY_RATIO = 0.20` — рассмотрено и отклонено:**

Hermes Agent публикует формулу `summary_budget = content_tokens × 0.20`. При нашем input 55K это дало бы summary = 11K токенов, что:
- Слишком велико для system prompt block (11K блокирует prompt caching окно на xAI)
- Делает target переменным от фазы к фазе (hard cap должен был бы тоже плавать)
- Формула оптимальна для небольших сессий (15K → 3K), на 50K+ становится раздутой

Мы выбрали **fixed target** с обоснованием от структурного формата, не от compression ratio. Этот подход лучше масштабируется через повторные Фазы 2.

---

## Модель для сжатия

**Grok 4.1 Fast (non-reasoning)** — роль «подсобка» в архитектуре ресторана. TaskId `compaction:summarize` (зафиксирован в v1.1 в §Провайдер-агностичность).

| Параметр | Значение |
|---|---|
| Catalog id | `grok-4-1-fast-non-reasoning` |
| TaskId | `compaction:summarize` |
| Задача | Механическая: извлечь структуру из разговора |
| Reasoning | Не нужен (non-reasoning) |
| Input cost | $0.20 / 1M tokens |
| Output cost | $0.50 / 1M tokens |
| Prompt caching | xAI автоматическое (opt-out через `cache_prompt: false`). Для Chat Completions API — HTTP header `x-grok-conv-id` опционально для оптимизации routing. В MVP header не включаем. См. §Обоснование выбора, п.4 |

### Обоснование выбора (v1.5)

> Добавлено в v1.5 (2026-04-18). Подтверждение решения v1.0 после изучения индустриальных практик 2026.

**6 аргументов за Grok 4.1 Fast non-reasoning:**

1. **Индустриальный консенсус 2026 — «smaller/faster model для summarization».** Microsoft Agent Framework (март 2026) дословно: «Requires a separate LLM client for summarization — a smaller, faster model is recommended». Google ADK использует `gemini-2.5-flash` для compaction. LangChain `ConversationSummaryBufferMemory` стандартно cheaper auxiliary LLM. Hermes Agent (Nous Research) — отдельный «auxiliary LLM». Survey 8 фреймворков (Claude Code, OpenAI Agents SDK, LangChain, CrewAI, AutoGen, Cursor, Aider, Google ADK) — все используют меньшие модели для summarization. Grok 4.1 Fast non-reasoning в роли «подсобка» — ровно тот паттерн.
2. **Доказано в нашем коде (MIND миграция, v3.89.0, ТЗ-XAI-2).** Та же семантическая задача — извлечение structured representation из conversation history — уже работает на Grok 4.1 Fast non-reasoning в трёх MIND taskId: `memory:extract-batch`, `memory:consolidate`, `memory:profile`. Все три в production с v3.89.0, качество проверено. Compaction summary — задача того же класса на те же ~50K токенов входа. Нет оснований ожидать деградации.
3. **Native `generateObject` на xAI** (verified 2026-04-14, бонус-рефакторинг ТЗ-XAI-2). Структурированный 5-секционный summary валидируется Zod-схемой на лету, без fallback на `generateText + JSON.parse + Zod` workaround. AI SDK v6 API чистый.
4. **xAI prompt caching** — работает **автоматически** на всех Grok моделях, opt-out через `cache_prompt: false` если нужен. Кэшируется prefix сообщений (match «from the start of your messages array»). Для Chat Completions API (наш case) — HTTP header **`x-grok-conv-id`** используется **не как opt-in включатель** (caching работает и без него), а как **оптимизация routing** запросов на один сервер для максимизации cache hit rate. Критично для rolling update Фазы 2 (повторные сжатия) — summary в system prompt становится стабильным префиксом, сообщения добавляются append-only → идеальный cache hit pattern. **В MVP header `x-grok-conv-id` не добавляем** — caching работает автоматически, header включим в follow-up ТЗ если метрики cache hit rate покажут пользу от server routing. ⚠️ **Важное ограничение xAI:** *«Never modify earlier messages — Only append new ones. Any edit, removal, or reorder breaks the cache»* — соблюдается нашей архитектурой (summary в system prompt, не в messages array; old messages при compaction исключаются из отправки, но не «редактируются» в смысле edit-in-place). Источник: [docs.x.ai prompt caching](https://docs.x.ai/developers/advanced-api-usage/prompt-caching).
5. **Экономика ~1.3₽ за одно сжатие** (55K input + 3K output при $0.20/$0.50 за 1M). 10 циклов за разговор = ~13₽. Все альтернативы 5-50× дороже без measurable gain:

| Модель | Input $/1M | Output $/1M | Стоимость 1 сжатия (55K + 3K) |
|---|---|---|---|
| **Grok 4.1 Fast non-reasoning** | **$0.20** | **$0.50** | **~$0.013 ≈ 1.3₽** |
| Grok 4.20 reasoning | $1.50 | $7.50 | ~$0.105 ≈ 10.5₽ (~8×) |
| Claude Haiku 4.5 | $1.00 | $5.00 | ~$0.070 ≈ 7₽ (~5×) |
| Claude Sonnet 4.6 | $3.00 | $15.00 | ~$0.210 ≈ 21₽ (~16×) |

6. **Согласованность с архитектурой «Ресторан».** Compaction — механическая задача, роль «Подсобка» (Grok 4.1 Fast) по философии «4 роли» из ТЗ-XAI-4 (2026-04-16). «Зал» (Grok 4.20) — для realtime пользовательского взаимодействия, не для фонового сжатия. «Автор» (Claude Opus/Sonnet) — для артефактов и Professor, overkill. Переключение на Haiku = добавление Anthropic в путь где xAI справляется — противоречит принципу «ресторан, не зоопарк».

### Альтернативы (рассмотрены, отклонены)

> Добавлено в v1.5 (2026-04-18). Фиксация чтобы при ретроспективе через 6 месяцев было понятно что каждую альтернативу рассмотрели, не просто «выбрали первую попавшуюся».

| Альтернатива | Почему отклонена |
|---|---|
| **Grok 4.20 reasoning** (`grok-4.20-0309-reasoning`) | Overkill. Reasoning overhead не нужен для механической задачи извлечения структуры. +thinking tokens = +latency + стоимость. 8× дороже без measurable gain качества на structured output |
| **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) | Технически справится, но добавляет Anthropic в путь где xAI достаточен. Противоречит архитектуре «ресторан». 5× дороже. Prompt caching через Anthropic — ephemeral TTL 5 минут, хуже чем xAI native `prompt_cache_key` для rolling pattern |
| **MiniMax M2.7** (`MiniMax-M2.7` / `MiniMax-M2.7-long`) | Отлично работает как «кухня» (briefing pipeline), но на MIND-задачах уже мигрировали с неё на Grok 4.1 Fast в v3.89.0 из-за `generateObject` workaround (MiniMax не поддерживает native structured output). Возвращаться без причины не нужно |
| **Claude Sonnet/Opus** (`claude-sonnet-4-6` / `claude-opus-4-6`) | Экстремальный overkill. 16-50× дороже. Используется для артефактов (витрина) и Professor Planning (автор), не для подсобки |
| **OpenRouter experimental** (Qwen, GLM, DeepSeek) | Dev-инструмент по архитектуре (`/dev/models` override), не production-провайдер. Уже отклонено в ТЗ-XAI-1 из-за галлюцинаций на vision. Для compaction не тестировалось, риск не оправдан |

### Экономика одного сжатия

| Сценарий | Input (сообщения) | Output (summary) | Стоимость USD | Стоимость RUB |
|---|---|---|---|---|
| Короткий разговор (20K токенов) | $0.004 | ~$0.001 | ~$0.005 | ~0.50₽ |
| Средний разговор (50K токенов) | $0.010 | ~$0.002 | ~$0.012 | ~1.20₽ |
| Длинный + вложения (100K токенов) | $0.020 | ~$0.002 | ~$0.022 | ~2.20₽ |

**Вывод:** стоимость сжатия пренебрежимо мала. Даже 10 циклов сжатия за разговор — менее 25₽. С учётом `prompt_cache_key` 75% скидки на повторные вызовы Фазы 2 — реальная стоимость ещё ниже.

---

## Различие с MIND и Anthropic Compaction

| Характеристика | MIND Extract | Simply Compaction | Anthropic Compaction |
|---|---|---|---|
| **Цель** | Долговременная память | Оперативная память сессии | Прозрачное сжатие провайдера |
| **Scope** | Только Simply Chat | Все chat-режимы где `supportsCompaction: false` (capability-driven, см. секцию «Провайдер-агностичность») | Все Anthropic-чаты |
| **Хранение** | БД (MemoryEntry, навсегда) | Поле в чате (время жизни чата) | Провайдер (непрозрачно) |
| **Что сохраняет** | Факты о пользователе | Контекст текущей задачи | Всё (решает провайдер) |
| **Модель** | Grok 4.20 (extract) + 4.1 Fast (batch) | Grok 4.1 Fast | Claude (внутренний) |
| **Триггер** | 60%/80% контекста + пауза | 50%/70% контекста | Автоматический (провайдер) |
| **В Simply Chat** | ✅ Работают вместе | ✅ (опционально, для сверхдлинных) | ❌ Не применимо |

### Взаимодействие в Simply Chat

> Обновлено в v1.7 (2026-04-18) — закрытие Q5. Ранее эта подсекция описывала MIND+Compaction как простой pipeline «MIND → Compaction». Фактически они решают разные задачи на разных уровнях.

**В Simply Chat MIND и Compaction — НЕ конкуренты, а два слоя разного назначения:**

| Что сохраняется | MIND | Simply Compaction |
|---|---|---|
| Атомарные факты о пользователе («предпочитает espresso», «работает в IT») | ✅ | ❌ |
| Контекст текущей задачи («мы обсуждаем проект X, выбрали технологию Y») | ⚠️ частично | ✅ |
| Нарратив сессии (что мы делали, где остановились, на чём сфокусированы) | ❌ | ✅ |
| Материалы из вложений (ключевые данные загруженных файлов) | ⚠️ частично | ✅ |

- **MIND — долговременная память.** Facts → БД (`memory_entry` + Voyage embeddings + pgvector) → RAG retrieval в system prompt. **Не изменяет history чата** — только извлекает и возвращает в следующих сообщениях.
- **Simply Compaction — оперативная память сессии.** History → summary → in-context (summary блок в system prompt, старые сообщения исключены из отправки в LLM). **Сжимает видимую историю** чтобы она поместилась в рабочий бюджет.

**Текущий симптом в Simply Chat (до COMPACTION-2):**

Сейчас в Simply Chat при заполнении контекста работает **sliding window truncation** (`CONTEXT_BUDGET = 140K` в [lib/ai/context-limits.ts](../../lib/ai/context-limits.ts)) — молчаливая обрезка старых сообщений без handoff summary. Это **тот же симптом** что в expertise/create **до нашего MVP**. Simply Chat нуждается в compaction, но откладывается в ТЗ-COMPACTION-2:

1. **MVP принцип narrow-first** (см. §Phased Rollout в §Провайдер-агностичность) — основной клиентский путь не первая цель pilot, риск UX-регрессии слишком высок.
2. **Техническая сложность ordering** — MIND и compaction могут срабатывать близко по времени, требуется осторожный design (см. подсекцию «Ordering в Simply Chat» ниже). Живые данные MVP дадут больше информации для принятия решений.

### Ordering в Simply Chat (для COMPACTION-2)

> Добавлено в v1.7 (2026-04-18). **Это не scope текущего ТЗ-COMPACTION-1** — прямой материал для ANALYSIS.md будущего ТЗ-COMPACTION-2.

**Последовательность срабатываний по текущим порогам** (зафиксировано сейчас для prep-работы COMPACTION-2):

| Usage | Событие |
|---|---|
| **84K** (60% от `CONTEXT_BUDGET` 140K) | MIND extract **soft** trigger |
| **100K** (50% от `SIMPLY_CONTEXT_LIMIT` 200K) | Compaction **soft** trigger — ⚠️ **между MIND soft и MIND hard** |
| **112K** (80% от `CONTEXT_BUDGET` 140K) | MIND extract **hard** trigger |
| **170K** (85% от `SIMPLY_CONTEXT_LIMIT` 200K) | Compaction **hard** trigger → рекомендация нового чата |

**Технический риск:** compaction soft (100K) сработает **до** MIND hard (112K). Если compaction удалит сообщения из history чата до того как MIND hard extract их обработает — **факты будут потеряны** (MIND не успеет их извлечь в долговременную память, а из history они уже исключены compaction-ом).

**Решение для COMPACTION-2:**

При срабатывании compaction в Simply Chat — **принудительно запускать MIND batch extract на удаляемой части до compaction**. Compaction ждёт завершения MIND extract на тех же сообщениях прежде чем исключить их из LLM-history. Гарантия: ни одно сообщение не покидает history без попытки извлечь из него факты.

Это усложняет pipeline (pre-compaction blocking call на MIND `memory:extract-batch`), но без этого возникает потеря данных — недопустимо для Simply Chat как основного клиентского пути.

**Связь с долгом `TZ_UnifyContextThresholdBase`:**

Странная последовательность (84K → 100K → 112K → 170K) — симптом **двух разных баз расчёта**: MIND считается от `CONTEXT_BUDGET = 140K`, Compaction от `SIMPLY_CONTEXT_LIMIT = 200K`. После закрытия долга [TZ_UnifyContextThresholdBase](../_backlog/TZ_UnifyContextThresholdBase.md) (унификация на `SIMPLY_CONTEXT_LIMIT`) абсолютные значения сохранятся, но последовательность станет очевидной из процентов:

| Usage | Событие (после унификации) |
|---|---|
| 84K (**42%** от `SIMPLY_CONTEXT_LIMIT`) | MIND extract soft |
| 100K (**50%** от `SIMPLY_CONTEXT_LIMIT`) | Compaction soft |
| 112K (**56%** от `SIMPLY_CONTEXT_LIMIT`) | MIND extract hard |
| 170K (**85%** от `SIMPLY_CONTEXT_LIMIT`) | Compaction hard |

Новый разработчик читает код и сразу видит ordering без пересчётов. Закрытие долга — **желательная подготовка** перед ТЗ-COMPACTION-2 (не blocker, но крайне рекомендовано для диагностики и дебага).

---

## Виджет контекста (v2.0 — упрощён)

**ТЗ-COMPACTION-UNIFY:** виджет показывает одно событие — факт сжатия. Никаких warning, никаких mode-aware кнопок, никаких action. Ручной handoff с pre-fill summary перенесён в COMPACTION-3.

| Тип события | Визуал | Текст | Действие пользователю |
|---|---|---|---|
| `compaction` (единственный) | 📦 Нейтральный muted-серый | «Разговор сжат, X → ~Y токенов» | Ничего не нужно |

Компонент [components/elements/context.tsx](../../components/elements/context.tsx) подписан на `data-compaction` DataStream события. `CompactionEvent.kind` удалён в v2.0 — событие одного типа, дискриминатор избыточен.

### Принцип отображения

- **Виджет показывает `used / SIMPLY_CONTEXT_LIMIT`** — единая база расчёта с compaction middleware. Смена константы меняет и пороги, и UI одновременно.
- **После compaction:** появляется иконка muted-gray + блок «📦 Разговор сжат» с размерами
- **Никогда:** красные зоны, жёлтые предупреждения, мигание, кнопки действия, слово «опасность», слово «чат» в контекстах expertise/create/projects

### Реализация через существующий DataStream protocol (v1.9)

> Добавлено в v1.8 (2026-04-18) после Фазы 1 ANALYSIS. **Уточнено в v1.9 (2026-04-19)** по итогам Этапа A4 ТЗ-COMPACTION-1: обнаружена коллизия с существующим `emitDebugCompaction` в `lib/ai/debug-events.ts` (ТЗ-RAG3, dev-only для Anthropic iterations, несовместимая схема). Утверждено: **раздельные event channels** для dev-метрик и user notification — у них разная семантика, разная видимость, разные клиенты.

События для виджета отправляются через **существующий DataStream protocol** в `app/(chat)/api/chat/route.ts`. Нулевая новая транспортная инфраструктура — зеркалирует паттерн `dataStream.write({type, data})` из существующих data-events.

**Важно: два независимых event type:**

| Event type | Источник | Gating | Клиент |
|---|---|---|---|
| `data-debug-compaction` | `emitDebugCompaction` из `lib/ai/debug-events.ts` (ТЗ-RAG3) | `isSimplyDevMode` (dev-only) | `DevPanelProvider` (Anthropic provider iterations metadata) |
| `data-compaction` | `emitCompactionEvent` из `lib/ai/compaction/events.ts` (ТЗ-COMPACTION-1) | Без gating — всегда | `components/elements/context.tsx` (user-visible widget) |

**Server side — emit helper в [lib/ai/compaction/events.ts](../../lib/ai/compaction/events.ts):**

```typescript
import type { CompactionEvent } from "./types";

export function emitCompactionEvent(
  dataStream: DataStreamWriter,
  data: CompactionEvent,
): void {
  dataStream.write({ type: "data-compaction", data });
}
```

Тип данных `CompactionEvent` определён в [lib/ai/compaction/types.ts](../../lib/ai/compaction/types.ts):

```typescript
export interface CompactionEvent {
  kind: "compaction" | "truncation_warning";
  chatId: string;
  compactionIndex: number;      // сколько сообщений ушло в summary на этом turn'е
  compactionCount: number;       // счётчик завершённых compaction-циклов
  summaryTokens: number;         // размер сгенерированного summary
  squeezedTokens: number;        // сколько исходных токенов сжали
}
```

**Server side — вызов в chat/route.ts:**

```typescript
if (compactionEvent) {
  emitCompactionEvent(dataStream, compactionEvent);
}
```

**Client side — обработка в `components/elements/context.tsx`:** слушает через `useChat` onData callback тип `"data-compaction"`, обновляет виджет. Та же схема что для существующих `data-research-depth` событий.

**Почему НЕ переиспользуем существующий `emitDebugCompaction`:**
- Семантика разная: существующий читает `providerMetadata.anthropic.iterations` (метрика от провайдера), новый — состояние после нашего сжатия (state change).
- Видимость разная: существующий dev-only (DevPanel), новый — production-widget для всех пользователей. `isSimplyDevMode` gate блокирует user-visible функционал.
- Файл `lib/ai/debug-events.ts` семантически про dev-панель (header файла: «Transient data-stream events emitted ONLY when SIMPLY_DEV_MODE=true»). Класть туда не-dev helper — нарушать SRP.
- Event type namespace достаточен для изоляции: DevPanel слушает `data-debug-compaction`, widget — `data-compaction`, каждый игнорирует чужой тип по имени.

**Принцип отправки события:** **после завершения сжатия** (не до начала), одним событием на turn — когда все БД-записи и подготовка messages завершены. Это гарантирует консистентность: пользователь видит «Разговор сжат» только если compaction действительно сработал.

---

## Провайдер-агностичность

> **Версия:** добавлена в v1.1 (2026-04-18) в Фазе 1 ТЗ-COMPACTION-1.
> **Статус:** архитектурное решение, утверждено владельцем.
> **Зачем эта секция:** зафиксировать что выбор механизма compaction — это свойство **модели**, не режима чата и не провайдера. Без capability-driven подхода код будет разветвлён через `if (chatMode === 'expertise')` или `if (provider === 'xai')` — через 3 месяца это превратится в болото с дубликатами. Secция делает SSOT-привязку к `ModelCapabilities.supportsCompaction` и встраивает compaction в контракт ADR 053.

### Принцип: capability-driven, not provider-driven

Выбор стратегии compaction определяется **capability резолвленной модели** — флагом `supportsCompaction: boolean` в [lib/ai/model-catalog.ts](../../lib/ai/model-catalog.ts#L63-L81), — а не `chatMode`, не именем провайдера и не taskId.

**Почему не chatMode:**

- `chatMode=expertise` сегодня резолвится в Grok 4.20 → `supportsCompaction: false` → нужен Simply Compaction. Завтра через `/dev/models` тот же expertise может резолвиться в Sonnet 4.6 → `supportsCompaction: true` → провайдерский Anthropic Compaction API. Логика ветвления должна следовать за моделью, не за режимом.
- `chatMode=simply-chat` сегодня на Grok 4.1 Fast, но Vision-запросы уходят на Haiku (`simply-chat-vision` taskId) — **одна сессия может содержать вызовы к моделям с разными capability**.

**Почему не provider:**

- `provider=anthropic` не гарантирует `supportsCompaction: true` — Haiku 4.5 в Anthropic, но не поддерживает Compaction API (см. [model-catalog.ts:237-241](../../lib/ai/model-catalog.ts#L237-L241): override `supportsCompaction: false` для Haiku).
- Завтра появится новый провайдер с compaction (Google, OpenAI) — провайдер-attribute ветвление потребует правок во всех chat handlers.

**Следствие:** чистый switch по одному флагу в одной функции `getCompactionStrategy(modelId)`. Добавление нового провайдера или новой модели с compaction = обновление одной строки в catalog entry.

### Новый taskId `compaction:summarize`

Модель для генерации summary фиксируется через SSOT [task-assignments.ts](../../lib/ai/task-assignments.ts), как любая другая AI-точка в приложении (contract ADR 053).

**Записи:**

- В `TaskId` union:
  ```typescript
  | "compaction:summarize"   // Simply Compaction MVP (ТЗ-COMPACTION-1): генерация summary старых сообщений для chat-режимов где supportsCompaction=false
  ```
- В `DEFAULT_TASK_MODELS`:
  ```typescript
  "compaction:summarize":    "grok-4-1-fast-non-reasoning",  // подсобка — механическая структура handoff
  ```
- В `DEFAULT_MAX_OUTPUT_TOKENS` (обязательно per ADR 053):
  ```typescript
  "compaction:summarize":    4096,  // summary 2000-4000 токенов (см. §Формат Summary, эмпирически подобрать)
  ```

**Следствия:**

- Переключение default-модели для summary — одна правка в SSOT, без правок кода.
- Через `/dev/models` override можно в dev экспериментировать с Grok 4.20 reasoning / Haiku / Sonnet для отладки качества summary — без кода.
- Cost tracking (`ai_usage_log`) автоматически различает compaction-вызовы от основного чата через taskId.
- Наблюдаемость compaction (DevPanel, observability) — бесплатно через стандартные layer'ы (ADR 053 аспекты 1-4 обеспечивают это).

### Функция `getCompactionStrategy(modelId)`

**Местоположение:** [lib/ai/model-catalog.ts](../../lib/ai/model-catalog.ts) (рядом с `ModelCapabilities` interface и `getCatalogEntry`).

**Почему не новый файл `lib/ai/capabilities.ts`:** SSOT capabilities уже живёт в model-catalog.ts (`ModelCapabilities`, `supportsCompaction`, `DocumentSupport`). Новый файл ради одной функции — искусственное разделение. При росте capability-helpers выше 3-4 функций можно выделить в отдельный файл ретроспективно.

**Сигнатура:**

```typescript
export type CompactionStrategy =
  | { kind: "provider" }   // Anthropic Compaction API (supportsCompaction: true)
  | { kind: "simply" }     // Simply Compaction — наш Summary Buffer (supportsCompaction: false, модель для чата)
  | { kind: "none" };      // capability не для chat (embeddings, transcription, TTS)

export function getCompactionStrategy(modelId: string): CompactionStrategy;
```

**Логика:**

1. Резолвит `modelId` в `ModelEntry` через существующий `getCatalogEntry`.
2. Если `capabilities.embeddings === true` или provider ∈ {voyage, deepgram} → `kind: "none"` (модель не для chat).
3. Иначе если `capabilities.supportsCompaction === true` → `kind: "provider"`.
4. Иначе → `kind: "simply"`.

**Варианты `kind: "none"` важны для defensive типизации** — middleware prepareMessagesWithCompaction получая `none` должен no-op (или throw, если его вызвали на неправильном taskId; решается на этапе реализации).

### Единая middleware `prepareMessagesWithCompaction`

**Местоположение (предложение):** `lib/ai/compaction/prepare-messages.ts` (новая папка `lib/ai/compaction/` — compaction вырастет до 3-4 файлов: prepare-messages, summarize, db-queries, types).

**Почему имя `prepareMessagesWithCompaction`, а не `applyContextStrategy`:**

- Явно описывает действие (готовит messages перед отправкой в LLM).
- Не конфликтует с паттерном «Strategy» (GoF) — это не объектная стратегия, а helper-функция.
- В name grep-ится легче при дебаге (`prepare`-префикс у подобных helper'ов в AI SDK коде).

**Сигнатура:**

```typescript
export interface CompactionContext {
  chatId: UUID;
  modelId: string;                    // для резолва capability через getCompactionStrategy
  systemPromptTokens: number;         // для подсчёта total usage
  mindFactsTokens?: number;           // опционально — если chat использует MIND facts
  threshold?: { soft: number; hard: number };  // override дефолтов (50%/70%), для тестов
}

export interface PrepareMessagesResult {
  messages: UIMessage[];              // готовые messages для streamText
  compactionEvent?: {                 // если сработал compaction — для UI индикатора
    kind: "compaction" | "truncation_warning";
    summary: string;
    compactionIndex: number;
  };
}

export async function prepareMessagesWithCompaction(
  taskId: TaskId,
  messages: UIMessage[],
  context: CompactionContext,
): Promise<PrepareMessagesResult>;
```

**Почему типизированный `context`, не `any`:**

- Compile-time проверка что вызывающий передал все нужные поля (TS falls на забытом field).
- Документирует зависимости: middleware нужен `modelId` для capability-резолва, `chatId` для чтения/записи compaction state в БД, `systemPromptTokens` для подсчёта budget.
- Совместимо с ADR 053 философией compile-time SSOT.

**Вызов из chat handler (ревизия v1.8 после кодового ревью):**

> **ВАЖНО v1.8:** в проекте **один** chat route handler — `app/(chat)/api/chat/route.ts`. Отдельных routes для expertise / create / simply **не существует** — они различаются через `chatMode` параметр в request body. Интеграция compaction — **gate по chatMode** в едином handler'е.

```typescript
// app/(chat)/api/chat/route.ts — ЕДИНСТВЕННАЯ точка вызова
// Этап A MVP: gate на expertise
// Этап B MVP: gate расширяется на expertise + create
// Simply Chat / project:expert:* / service-chat:* — НЕ активируются в MVP

if (chatMode === "expertise" /* || chatMode === "create" в Этапе B */) {
  const { messages: preparedMessages, compactionEvent } =
    await prepareMessagesWithCompaction(taskId, rawMessages, {
      chatId, modelId, systemPromptTokens, mindFactsTokens,
    });

const stream = streamText({
    model: getModel(taskId),
    maxOutputTokens: getMaxOutputTokensForTask(taskId),
    messages: preparedMessages,
    // ... остальные параметры
  });

  if (compactionEvent) {
    dataStream.write({ type: "data-compaction", data: compactionEvent });
  }
} else {
  // chatMode ∈ {simply, task, service-chat:*} — middleware не вызывается в MVP
  // existing compactionOptions (providerOptions.anthropic.contextManagement)
  // применяется для моделей с supportsCompaction:true (Sonnet/Opus) через
  // переписанную логику getCompactionStrategy(modelId) — см. Сводку изменений кода
}
```

**Handler знает про chatMode только для gating активации в MVP.** Внутри гейта он не делает `if (provider === 'xai')` и не различает expertise vs create — middleware сама через `getCompactionStrategy(modelId)` выбирает:

- `kind: "provider"` → no-op на нашем уровне, положиться на провайдерский Compaction (добавить `providerOptions.anthropic.contextManagement` в вызов — это делает уже chat handler, не middleware).
- `kind: "simply"` → выполнить наш Summary Buffer алгоритм (фазы 1-3 из §Архитектура).
- `kind: "none"` → throw или no-op (решится на этапе реализации — зависит от того, может ли этот taskId вообще попасть в chat handler).

### Scope расширен — декларативно vs MVP-активация

**Декларативно (capability-driven подход):** middleware `prepareMessagesWithCompaction` применима ко **всем chat-режимам** где модель обрабатывает message history:

- Simply Chat (`simply-chat`, `simply-chat-think`, `simply-chat-vision`)
- Expertise (`expertise`)
- Create (`create`)
- Project task expert (`project:expert:haiku/sonnet/opus`)
- Сервисные чаты (`service-chat:ben`, `service-chat:project-creation`, `service-chat:project-manager`, `service-chat:briefing-onboarding`)

Для каждого — стратегия определяется capability резолвленной модели через `getCompactionStrategy(modelId)`, никакого знания о режиме в middleware нет.

**MVP-активация (ТЗ-COMPACTION-1):** middleware **реально вызывается** только из handlers **expertise** и **create**. Остальные handlers не трогаются на этапе MVP. Активация внутри ТЗ — **phased rollout A→B** (v1.6), не одновременная (обоснование — см. подсекцию «Phased Rollout» ниже):

| Режим | MVP активация | Этап в ТЗ-COMPACTION-1 | Причина откладывания |
|---|---|---|---|
| **expertise** | ✅ Pilot MVP | **Этап A** | — |
| **create** | ✅ MVP | **Этап B** | Phased rollout — включается после стабилизации expertise (narrow-first best practice 2026) |
| Simply Chat | ❌ COMPACTION-2 | — | MIND extract (60%/80%) уже работает как основной механизм защиты. Вплетение compaction поверх MIND — отдельное продуктовое решение, нужны живые данные реальных сессий. Плюс: основной клиентский путь, риск регрессии на пользовательском experience высок |
| Project task expert | ❌ COMPACTION-2+ | — | Anthropic tier (Opus/Sonnet/Haiku) — `supportsCompaction: true` для Opus/Sonnet, провайдерский compaction уже работает. Для tier Haiku (`supportsCompaction: false`) нужна Simply Compaction — но это less common путь, откладываем |
| Сервисные чаты | ❌ COMPACTION-2+ | — | Короткие контролируемые контексты (onboarding, project-creation) — compaction едва ли триггерится. Низкий приоритет |

**Правило для Claude Code на Фазе 3 реализации:** активация middleware **только в двух route handlers** — expertise и create. Никаких изменений в `app/(chat)/api/chat/route.ts`, project task handlers, service-chat handlers. Декларативная доступность (функция `prepareMessagesWithCompaction` импортабельна откуда угодно) — не означает что её нужно внедрить везде сейчас.

#### Phased Rollout внутри ТЗ-COMPACTION-1

> Добавлено в v1.6 (2026-04-18).

Решение о phased подходе внутри одного ТЗ (а не двух отдельных ТЗ и не одновременного rollout):

**Этап A — Инфраструктура + expertise pilot.** Все базовые компоненты реализуются один раз:
- Новый taskId `compaction:summarize` в SSOT ([task-assignments.ts](../../lib/ai/task-assignments.ts))
- Функция `getCompactionStrategy(modelId)` в [model-catalog.ts](../../lib/ai/model-catalog.ts)
- Middleware `prepareMessagesWithCompaction` в новой папке `lib/ai/compaction/`
- Миграция БД: поля `compactionSummary`, `compactionIndex`, `compactionCount` в Chat таблице ([lib/db/schema.ts](../../lib/db/schema.ts))
- Интеграция вызова `prepareMessagesWithCompaction` **только в expertise** route handler
- UI-события `compaction` / `truncation_warning` в виджете контекста
- Smoke test на 20+ сообщений с вложениями в expertise

**Этап B — Расширение на create.**
- Копия вызова `prepareMessagesWithCompaction` в create route handler (нулевая новая инфраструктура — всё уже есть)
- Smoke test на create

**Технически expertise и create идентичны** (оба на `grok-4.20-0309-reasoning`, `supportsCompaction: false`, одинаковый lifecycle streamText + onFinish, одинаковый capability-резолв). Разделение на 2 отдельных ТЗ = overengineering workflow. Один ТЗ с phased A→B — корректный баланс.

**Обоснование phased подхода (best practice 2026):**

- **Digital Applied «AI Agent Scaling Gap March 2026»** (выборка 650 enterprise leaders): «Narrow single-function agents scale more reliably than broad multi-function ones. Successful deployments started with agents scoped to a single, well-defined task. Scope expansion happened only after the narrow version proved stable.» Статистика: **64% организаций пытались расширять scope, 72% из них stalled >6 месяцев** при одновременном rollout. Локальный dev/pilot — не 6 месяцев, но принцип тот же: один route → тест → второй.
- **Valtorian MVP scope 2026:** «single, end-to-end workflow» как паттерн MVP. У нас один workflow (compaction middleware) + два route attachment pointers (expertise, create).
- **HSO PoC→Pilot→MVP maturity curve:** pilot доводится до стабильности прежде чем reproducible pattern разворачивается на соседние точки.

**Разница между Этапом A и Этапом B по объёму работы:**

| Работа | Этап A | Этап B |
|---|---|---|
| TaskId + DEFAULT_TASK_MODELS + DEFAULT_MAX_OUTPUT_TOKENS | ✅ | — |
| `getCompactionStrategy(modelId)` | ✅ | — |
| `prepareMessagesWithCompaction` middleware | ✅ | — |
| Миграция БД (3 новых поля) | ✅ | — |
| UI-события в виджете | ✅ | — |
| Вызов в route handler | ✅ expertise | ✅ create (копия) |
| Smoke test | ✅ expertise | ✅ create |

Этап B — существенно меньше Этапа A по объёму. Это естественное следствие того что инфраструктура делается один раз.

#### Критерии выхода MVP

> Добавлено в v1.6 (2026-04-18). Применимо **после закрытия ТЗ-COMPACTION-1** перед запуском ТЗ-COMPACTION-2 (расширение на Simply Chat).

Перед расширением Simply Compaction на Simply Chat (что = ТЗ-COMPACTION-2) — **четыре критерия должны быть выполнены на MVP-режимах** (expertise + create):

1. **Stable smoke test 1+ неделю реального использования** — expertise + create работают без регрессий. Пользователь не жалуется что «чат забыл начало», модель корректно продолжает разговор после срабатывания compaction.
2. **Observability проверена.** В [ai_usage_log](../../lib/db/schema.ts) видны `compaction:summarize` вызовы с корректными данными (input/output tokens, стоимость, chat id). События `compaction` / `truncation_warning` корректно отображаются в UI виджете контекста. DevPanel показывает compaction-вызовы (попутно — требует закрытия `TZ_DevPanelFooterHidesSubCalls` backlog-долга).
3. **Качество summary валидировано** на **3-5 реальных длинных сессиях.** Владелец подтвердил что:
   - Summary покрывает ключевые решения (не только последний фокус)
   - Модель корректно отвечает на вопросы о раннем содержимом сессии после compaction
   - Структура 5-секционного формата соблюдена
   - Язык summary = язык сессии
4. **Edge cases выявлены и задокументированы:**
   - Массивные вложения (PDF > 40K токенов) — verbatim window расширяется корректно
   - Быстрые последовательные сообщения без пауз — не создают дублирующие compaction events
   - Повторные сжатия (Фаза 2) — rolling update работает, prompt cache используется
   - Ошибка LLM при генерации summary — graceful fallback (какой именно — определить эмпирически в этапе А)

**Если все 4 критерия выполнены** → поднимается ТЗ-COMPACTION-2 из `specs/_backlog/` в полноценный ТЗ с Simply Chat + решение Q5 (Compaction поверх MIND).

**Если критерии не выполнены** → остаёмся на MVP-режимах, копим данные, не расширяем scope.

### 5-й аспект ADR 053 — context strategy (контекстно-зависим)

[ADR 053 — AI SDK invocation contract](../../docs/decisions/053-aisdk-invocation-contract.md) зафиксировал 4-аспектный контракт для **каждого** call site: `taskId`, `model`, `cap`, `call mode`. Все 4 применимы без исключений: даже `util:title` (короткий механический вызов) имеет taskId, модель, cap и call mode.

**Предлагаемый 5-й аспект — `context strategy`** — контекстно-зависим: применим только к taskId **категории chat-handler**, работающим с message history.

| TaskId категория | 5-й аспект применим? | Почему |
|---|---|---|
| chat-handler (simply-chat, simply-chat-think, expertise, create, project:expert:*, service-chat:*) | ✅ Да — через `getCompactionStrategy(modelId)` | Отправляют multi-turn history в LLM, контекст растёт с сессией |
| artifact:* (text/markdown/excel/pptx/reveal) | ❌ N/A | Одиночный вызов от create-document/update-document tool, без history continuity |
| util:title, memory:*, clerk:*, briefing:*, meeting:*, vision:ocr | ❌ N/A | Одноразовые вызовы с фиксированным input, нет накапливающейся history |
| compaction:summarize | ❌ N/A (сам aspect 5 — summarization) | Вызывается **из** middleware, не использует middleware рекурсивно |

**Формулировка для расширения ADR 053 (рекомендация для будущего ТЗ-COMPACTION-1 Фазы 4):**

> ### 5. `context strategy` — управление message history (только для chat-handler taskId)
>
> **Что:** стратегия обработки history перед отправкой в LLM — провайдерский Compaction, Simply Compaction (наш Summary Buffer), или no-op.
>
> **Применимо к:** taskId категории chat-handler (см. список выше). Для utility taskId (util:*, memory:*, clerk:*, vision:ocr и т.д.) — N/A.
>
> **SSOT:** `getCompactionStrategy(modelId)` в `lib/ai/model-catalog.ts`. Резолвит стратегию из `ModelCapabilities.supportsCompaction` резолвленной модели.
>
> **Middleware:** `prepareMessagesWithCompaction(taskId, messages, context)` в `lib/ai/compaction/prepare-messages.ts`. Вызывается всеми chat-handler route handlers одинаково.
>
> **Инвариант:** chat-handler handler НЕ делает условных веток по `chatMode` или `provider`. Вся логика стратегии — в middleware через capability резолв.

Расширение ADR 053 до 5-го аспекта — часть Фазы 4 ТЗ-COMPACTION-1 (финализация и документация). В Фазе 1 (анализ) и Фазе 3 (реализация) достаточно этой секции архитектурного документа как рабочего контракта.

### Сводка изменений кода (для будущего ROADMAP)

> **Ревизия v1.8 (2026-04-18):** таблица исправлена по результатам Фазы 1 ТЗ-COMPACTION-1. Отдельных routes для expertise/create **не существует** — единый [app/(chat)/api/chat/route.ts](../../app/(chat)/api/chat/route.ts) с chatMode routing. Этап A и Этап B phased rollout отличаются только условием gate, не разными файлами.

Не для Фазы 1 — ориентир для Фазы 2 (планирование ROADMAP):

| Файл | Изменение | Этап |
|---|---|---|
| [lib/ai/task-assignments.ts](../../lib/ai/task-assignments.ts) | +3 записи: `"compaction:summarize"` в TaskId union, DEFAULT_TASK_MODELS, DEFAULT_MAX_OUTPUT_TOKENS | A |
| [lib/ai/model-catalog.ts](../../lib/ai/model-catalog.ts) | +функция `getCompactionStrategy(modelId)`, +тип `CompactionStrategy` | A |
| [lib/ai/context-limits.ts](../../lib/ai/context-limits.ts) | +3 константы: `COMPACTION_THRESHOLD_SOFT`, `COMPACTION_THRESHOLD_HARD`, `COMPACTION_VERBATIM_WINDOW_TOKENS`, `COMPACTION_SUMMARY_TARGET_TOKENS` | A |
| `lib/ai/compaction/` (новая папка) | `types.ts`, `prompt.ts`, `summarize.ts` (вызов LLM через generateObject), `db-queries.ts` (read/write compactionSummary/Index/Count), `prepare-messages.ts` (middleware) | A |
| [lib/db/schema.ts](../../lib/db/schema.ts) | +3 поля в Chat таблице: `compactionSummary` (text, null), `compactionIndex` (integer, null), `compactionCount` (integer, default 0) | A |
| [lib/db/migrations/](../../lib/db/migrations/) | +миграция `NNNN_add-compaction-columns.sql` (3 колонки, SQL-формат проекта). ⛔ `npm run build` автоматически накатит | A |
| [app/(chat)/api/chat/route.ts](../../app/(chat)/api/chat/route.ts) | **ЕДИНАЯ точка интеграции:** (1) переписать существующий блок `supportsCompaction` / `compactionOptions` (Line 952-965) через `getCompactionStrategy(modelId)` с **реальным modelId** (убирает `isProjectChat` заплатку). (2) Добавить pre-stream вызов `prepareMessagesWithCompaction` с gate `chatMode === "expertise"` в Этапе A, gate расширяется на `chatMode === "expertise" \|\| chatMode === "create"` в Этапе B. (3) Отправка `data-compaction` событий через существующий `dataStream.write` | A (gate expertise) + B (gate расширяется) |
| [lib/ai/debug-events.ts](../../lib/ai/debug-events.ts) | +тип `DebugCompactionData` + helper `emitDebugCompaction(dataStream, data)` — зеркалирует существующий паттерн `emitDebugPrompt/Rag/Warning` | A |
| [components/elements/context.tsx](../../components/elements/context.tsx) | +обработка UI событий `data-compaction` / `data-truncation_warning` (поглощает TZ_SimplyContextUsageWidget) | A |

**Этап B — одна строка расширения gate** (следствие единого chat route): `chatMode === "expertise"` → `chatMode === "expertise" || chatMode === "create"`. Минимальный этап по объёму работы.

Все изменения — аддитивные. Переписывание `supportsCompaction` Line 952-965 — functional-equivalent refactor (сохраняет current behavior для Anthropic моделей), но требует smoke test на Simply Chat vision + project:expert:* чтобы провайдерский compaction всё ещё работал.

---

## Техническая реализация (высокий уровень)

### Где хранить Summary

Новое поле в таблице чата (или связанная запись):

```
compaction_summary: text | null     — текущий summary
compaction_index: integer | null    — индекс последнего сжатого сообщения
compaction_count: integer default 0 — количество сжатий в этом чате
```

### Точка интеграции

В `chat/route.ts` (или аналогичный обработчик) — перед формированием messages для LLM:

```
1. Подсчитать текущий usage (system prompt + history + MIND)
2. Если usage > threshold И compaction ещё не было для этого диапазона:
   a. Вызвать Grok 4.1 Fast для генерации summary
   b. Сохранить summary и compaction_index в БД
   c. При формировании messages: summary в system → последние N сообщений
3. Если уже есть compaction — проверить не нужно ли повторное
```

### Реализация через AI SDK

> **Ревизия v1.8 (2026-04-18):** финальное решение после Фазы 1 ANALYSIS.

**Финал: explicit pre-call preprocessing** — `prepareMessagesWithCompaction(...)` вызывается **до** `streamText` в `app/(chat)/api/chat/route.ts`, результат передаётся как `messages` параметр в streamText. AI SDK `prepareStep` **отклонён** как альтернатива.

**Обоснование выбора explicit pre-call vs `prepareStep`:**

| Критерий | Explicit pre-call (принято) | `prepareStep` (отклонён) |
|---|---|---|
| Доступ к `dataStream.write` для UI событий compaction | ✅ Прямой — writer в том же scope | ❌ Косвенный через closure, overkill |
| Testability (pure function) | ✅ Легко изолируется | ⚠️ Связан с streamText API |
| Линейный lifecycle (prepare → stream → persist) | ✅ Понятен при отладке | ⚠️ Spread across streamText config |
| Use case AI SDK v6 | — (не нужен) | Multi-step tool loop reconfiguration per step |

`prepareStep` технически работает (вызывается перед каждым model step включая первый per [ai-sdk.dev docs](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)), но создан для динамической переконфигурации в multi-step agent loops — у нас single-step чат без tool loops compaction-блокирующей природы.

### Подсчёт токенов

> **Ревизия v1.8 (2026-04-18):** конкретизация после обнаружения in-house `estimateMessageTokens` в `lib/utils.ts`.

**SSOT подсчёта — существующая функция `estimateMessageTokens` из [lib/utils.ts](../../lib/utils.ts).** Тот же подход что MIND extract triggers в [app/(chat)/api/chat/route.ts:787-793](../../app/(chat)/api/chat/route.ts#L787-L793):

```typescript
// Формула из existing MIND extract logic — переиспользуется для Compaction threshold check
const systemPromptTokens = estimateMessageTokens([{ type: "text", text: systemPromptText }]);
const totalHistoryTokens = messagesFromDb.reduce(
  (sum, msg) => sum + (msg.tokenCount ?? estimateMessageTokens(msg.parts)),
  0
);
const newMessageTokens = estimateMessageTokens(message.parts);
const mindTokens = mindDynamicBlock ? estimateMessageTokens([{ type: "text", text: mindDynamicBlock }]) : 0;

const totalContext = systemPromptTokens + totalHistoryTokens + newMessageTokens + mindTokens;

if (totalContext >= COMPACTION_THRESHOLD_SOFT * SIMPLY_CONTEXT_LIMIT) {
  // trigger Phase 1 compaction
}
```

**Почему это SSOT:**

- `estimateMessageTokens` — единственная in-house функция подсчёта в проекте, уже используется в ≥3 местах (MIND extract trigger, sliding window loader, widget контекста).
- Consistent с тем что видит пользователь в виджете контекста (тот же подсчёт).
- Нет нужды добавлять npm tokenizer-библиотеку (`tiktoken`/`gpt-tokenizer`) — approximation достаточна для threshold decisions (точный count не нужен для Soft 100K порога; ±5K разница неважна).

**`mindTokens` в формуле:** для expertise/create в MVP `mindDynamicBlock` всегда `undefined` (MIND dynamic block инжектируется только в Simply Chat), поэтому `mindTokens = 0`. Формула универсальная — когда COMPACTION-2 расширит на Simply Chat, `mindTokens` станет ненулевым автоматически.

---

## Приоритет реализации

### Сейчас (в рамках текущего бага виджета)

- Заложить **три типа событий** в компонент виджета (`extract`, `compaction`, `truncation_warning`, `provider_compaction`)
- Виджет различает типы и отображает соответственно
- Simply Compaction пока не реализован — `compaction` событие зарезервировано

> **Поглощение хвоста TZ_SimplyContextUsageWidget (2026-04-17):**
> Существующий виджет (`components/elements/context.tsx`) показывает обманную шкалу
> (% от провайдерского `contextWindow` 128K вместо нашего `SIMPLY_CONTEXT_LIMIT`)
> и дублирует cost-данные из DevPanel. При реализации этой фичи попутно:
> - Удалить блок «Расход за сессию» из виджета (cost живёт в DevPanel)
> - Заменить знаменатель на корректную базу (определяется по режиму/событию)
> - Убрать упоминание «окна модели» из label
> Хвост `TZ_SimplyContextUsageWidget.md` перемещён в `_backlog/_archive/`
> как superseded by этим документом.

### После завершения серии XAI-4…6

- **ТЗ-COMPACTION-1:** MVP Simply Compaction для expertise/create — **phased rollout Этап A (expertise) → Этап B (create)** (см. §Провайдер-агностичность → Phased Rollout).
- **ТЗ-COMPACTION-2:** Расширение на Simply Chat (страховочная сетка поверх MIND). **Требует:** (1) 4 критерия выхода MVP выполнены (см. §Критерии выхода MVP), (2) желательно — закрыт долг [TZ_UnifyContextThresholdBase](../_backlog/TZ_UnifyContextThresholdBase.md) для унификации баз расчёта. **Содержит:** ordering логика MIND extract → compaction (см. §Ordering в Simply Chat), принудительный pre-compaction MIND batch extract на удаляемой части (гарантия что факты не потеряются до compaction).
- **ТЗ-COMPACTION-3:** «Новый чат с итогом» — UX для Фазы 3 (кнопка → новый чат с инжектом финального summary).

### Зависимости

- Виджет контекста должен корректно показывать usage (текущий баг)
- Подсчёт токенов должен быть надёжным
- PE-контракт на промпт генерации summary

---

## Открытые вопросы

✅ **Все открытые вопросы закрыты в v1.2-v1.7 (2026-04-18). Документ готов к Фазе 2 ТЗ-COMPACTION-1.**

> **Закрытые вопросы (история):**
> - ~~**Q1 v1.0 — Размер дословного окна: 15 или 20 сообщений, или ~30K токенов?**~~ Закрыт в v1.3 (2026-04-18). **40 000 токенов, единица измерения — токены, не сообщения.** Алгоритм сборки — с конца истории назад, останавливаемся на первом сообщении которое не помещается целиком; edge case — если последнее сообщение само > 40K, включаем его целиком (не режем вложение). Обоснование — см. §Архитектура → «Дословное окно» (источники 2026: Mem0 20-older/10-recent, LangChain ConversationSummaryBufferMemory, Microsoft SK v1.35, agentwiki).
> - ~~**Q2 v1.0 — Максимальный размер summary: 2000 или 4000 токенов?**~~ Закрыт в v1.4 (2026-04-18). **Target 3 000 токенов** (инструкция модели) **+ hard cap 4 096 токенов** (safety-net AI SDK per ADR 053). Обоснование — см. §Формат Summary → «Обоснование размера summary» (источники 2026: Anthropic Compaction API default, Claude Code 9-section, OpenCode 5-section, Codex CLI, Hermes 8-section; математика 5 секций × ~600 токенов = ~3000; compression ratio 18× в пределах нормы).
> - ~~**Q3 v1.0 — Триггер по usage% vs абсолютному числу токенов.**~~ Закрыт в v1.2 (2026-04-18). Пороги: Soft = 50% от `SIMPLY_CONTEXT_LIMIT` (100K), Hard = 85% от `SIMPLY_CONTEXT_LIMIT` (170K). Обоснование — см. §Архитектура → «Обоснование порогов» (4 источника: Anthropic research, Claude Code default 83%, NVIDIA RULER, best practice smaller-frequent).
> - ~~**Q4 v1.0 — Prompt caching: использовать ли xAI `prompt_cache_key`?**~~ Закрыт в v1.5 (2026-04-18) **автоматически как прямое следствие выбора модели Grok 4.1 Fast non-reasoning** (см. §Модель для сжатия → «Обоснование выбора», п.4). **ДА, используем xAI native `prompt_cache_key` с 75% скидкой на input tokens** — критично для rolling update Фазы 2 (повторные сжатия на стабильном summary prefix). Anthropic ephemeral caching (TTL 5 минут) слабее для этого паттерна. Детали реализации cache key (`chatId + compactionCount`) — в Фазе 3 coding.
> - ~~**Q5 v1.0 — Compaction в Simply Chat поверх MIND: нужен ли?**~~ Закрыт в v1.7 (2026-04-18). **ДА, нужен — но не в MVP.** MIND и Simply Compaction решают разные задачи: MIND = атомарные факты о пользователе в долговременную память (RAG), Simply Compaction = нарратив сессии + материалы в оперативную память (in-context summary). MIND не сохраняет нарратив сессии — gap закрывает compaction. Откладывается в ТЗ-COMPACTION-2 из-за MVP-принципа narrow-first (Simply Chat = основной клиентский путь, риск UX-регрессии высок) и технической сложности ordering с MIND (pre-compaction blocking MIND batch extract для гарантии что факты не потеряются). Подробнее — см. §Различие с MIND → «Взаимодействие в Simply Chat» и «Ordering в Simply Chat (для COMPACTION-2)». Желательная подготовка перед COMPACTION-2 — закрытие долга [TZ_UnifyContextThresholdBase](../_backlog/TZ_UnifyContextThresholdBase.md) для унификации баз расчёта.

---

## Исследование (источники решения)

Решение основано на анализе индустриальных практик (апрель 2026):

- **Codex CLI (OpenAI):** handoff summary — передача контекста как «смена для другого LLM». Локальный (LLM-суммаризация) и серверный (API compact) пути.
- **Claude Code (Anthropic):** трёхуровневый механизм — обрезка tool output → cache-friendly стратегии → 9-секционный структурированный summary.
- **OpenCode:** «ступенчатое управление» — скрытие старых сообщений по timestamp + 5-секционный summary.
- **JetBrains Research (NeurIPS 2025):** observation masking сравнима с LLM-суммаризацией по качеству, но дешевле. Суммаризация не серебряная пуля.
- **Mem0:** Memory Formation > Summarization. Извлечение фактов вместо сжатия всего. Сокращение расхода токенов на 80-90%.
- **Консенсус:** Summary Buffer (summary + last N messages) — наиболее практичный компромисс для продакшен-приложений.

**Источники для §Дословное окно (добавлены в v1.3, 2026-04-18):**

- **Mem0 guide 2025** — опубликованный паттерн «20-older / 10-recent» (сжимать всё старше 20 сообщений, последние 10 держать verbatim) = пропорция 2:1 summary:verbatim. Наш 60K:40K = 1.5:1 — в том же диапазоне, ближе к более сохранительной стороне.
- **LangChain `ConversationSummaryBufferMemory`** — best practice использование `max_token_limit` (а не `max_messages`) для verbatim-буфера. Стандарт production-проектов при разнородном размере сообщений.
- **Microsoft Semantic Kernel v1.35** — chat history reducers поддерживают оба режима (сообщения и токены), но официальная рекомендация для production — token-based reducer.
- **agentwiki «Conversation History Management» (2026)** — сводная статья с 2026 best practices: единица = токены, пропорция summary:verbatim 1.5:1 до 2:1, edge case для сообщений больше верхнего лимита — включать целиком.

**Источники для §Обоснование размера summary (добавлены в v1.4, 2026-04-18):**

- **Anthropic Compaction API** (`compact-2026-01-12` beta) — официальная документация + cookbook `tool-use-automatic-context-compaction` использует `max_tokens: 4096` как стандартный cap для summary. Наш hard cap 4096 матчится 1:1 с production-принятым Anthropic headroom.
- **Hermes Agent (Nous Research)** — context-compression-and-caching docs. Формула `summary_budget = content_tokens × 0.20` (константа `_SUMMARY_RATIO`). Рассмотрена и отклонена для нашего случая (на 50K+ input становится раздутой, 11K summary слишком много для system block и ломает prompt caching). Плюс: паттерн «rolling update» (previous summary передаётся с инструкцией обновить, а не суммаризовать заново) — принят для наших Фаз 2+.
- **Justin3go «Shedding Heavy Memories»** (2026-04-09) — comparative analysis структурированных summary в Codex CLI, Claude Code и OpenCode: 2-3K / 4-5K / 2.5-3.5K токенов соответственно. Консенсус 2.5-4K для structured handoff, наш target 3K — в середине диапазона.
- **Microsoft Semantic Kernel — compaction strategy docs** — fixed target budget с margin до hard cap как предпочтительный паттерн (production scalability) vs ratio-based (хорош для экспериментов, плох для стабильных production systems).

**Источники для §Модель для сжатия (добавлены в v1.5, 2026-04-18):**

- **Microsoft Agent Framework — compaction docs** (март 2026) — официальная формулировка: «Requires a separate LLM client for summarization — **a smaller, faster model is recommended**». Прямое подтверждение паттерна «Подсобка» для compaction.
- **Google ADK — compaction config** (DEV Community survey «Context Compaction in Agent Frameworks», 2026-03-15) — использует `gemini-2.5-flash` (smaller/faster model) для автоматической compaction в ADK agents. Паттерн voiced индустрией.
- **Factory.ai production evaluation** (36,611 сообщений) — accuracy tradeoffs при выборе summarization модели. Ключевой findings: cheaper/faster модели дают accuracy в пределах 2-5% от flagship для structured handoff задач (т.е. качество не зависит от размера модели при чётко сформулированном промпте).
- **JetBrains Junie research** (observation masking vs summarization 2026) — независимое подтверждение «auxiliary LLM» паттерна. Summarization — задача для cheaper model, не для flagship reasoning model.

**Источники для §MVP scope + Phased Rollout (добавлены в v1.6, 2026-04-18):**

- **Digital Applied «AI Agent Scaling Gap March 2026»** (выборка 650 enterprise leaders) — ключевой findings: «Narrow single-function agents scale more reliably than broad multi-function ones. Successful deployments started with agents scoped to a single, well-defined task. Scope expansion happened only after the narrow version proved stable.» Статистика: 64% организаций пытались расширять scope, 72% stalled >6 месяцев при одновременном rollout. Обоснование narrow-first для phased A→B внутри ТЗ-COMPACTION-1.
- **Valtorian «MVP Scope Best Practices 2026»** — single, end-to-end workflow как pattern MVP. Не «все места сразу», а один workflow + последующее горизонтальное расширение. Прямое подтверждение нашего expertise → create подхода.
- **HSO «PoC → Pilot → MVP maturity curve»** — pilot доводится до стабильности прежде чем reproducible pattern разворачивается на соседние точки. Критерии выхода MVP (4 критерия перед COMPACTION-2) — реализация этого паттерна для Simply.

---

**Обновлено:** 2026-04-18 (v1.8 — ревизия под реальный код после Фазы 1 ТЗ-COMPACTION-1, 8 правок по ответам архитектора в [ARCHITECT_ANSWERS.md](../TZ_COMPACTION_1/ARCHITECT_ANSWERS.md))
