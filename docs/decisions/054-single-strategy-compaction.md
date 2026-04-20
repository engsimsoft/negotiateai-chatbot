# ADR 054 — Single-strategy provider-agnostic compaction

**Дата:** 2026-04-20
**Статус:** Accepted
**ТЗ:** [TZ-COMPACTION-UNIFY](../../specs/Simply_xAI/TZ_compaction_unify/TZ_COMPACTION_UNIFY.md) (v3.95.0)
**Supersedes:** [ADR 042](042-compaction-dual-strategy.md) · [ADR 052](052-context-management-strategy-per-provider.md)

---

## Контекст

После закрытия ТЗ-COMPACTION-1 в Simply сосуществовали **две независимые логики управления памятью чата**:

1. **Anthropic Compaction API** (`providerOptions.anthropic.contextManagement` с `compact_20260112`) — для моделей с `supportsCompaction: true` (Sonnet 4.6, Opus 4.6). Провайдерский чёрный ящик: Anthropic сам решает когда и что сжимать.
2. **Simply Compaction middleware** (`prepareMessagesWithCompaction`) — для всех остальных моделей (Grok, Haiku, MiniMax, OpenRouter). Наш summary buffer + verbatim window.

Плюс к этому — **per-turn `extractAndStoreFacts`** в expertise/create/project handler'ах на каждом ответе AI (Grok 4.20 reasoning, mission-critical modelId `memory:extract`).

Анализ production использования и архитектурный аудит выявили **четыре проблемы**, логически связанные между собой:

1. **Предупреждение «Новое задание с итогом» на 85%** — всплывающее UI-сообщение с кнопкой, противоречащее Apple-философии Simply. Индустриальный консенсус 2026 (Claude Code, Cursor, ChatGPT) — сжимают молча.
2. **Per-turn extract в expertise/create тратит деньги впустую.** Тестовые данные: 4 turn expertise = $0.0072, 4 extract = $0.0862 (extract **в 12 раз дороже** самого чата). Факты извлекаются из сообщений, которые модель и так видит в контексте.
3. **Две разные базы расчёта %.** MIND extract считал от `CONTEXT_BUDGET=140K`, Compaction от `SIMPLY_CONTEXT_LIMIT=200K`, UI виджет — от `contextWindow` модели (128K–1M). Источник ошибок при дебаге и дезинформации пользователя.
4. **Зависимость от провайдерского API.** `supportsCompaction` capability, ветка `providerOptions.anthropic.contextManagement`, непрозрачность сжатия (не видим что сжалось, когда, какой размер), разный UX для разных моделей, дублирование с нашей логикой.

**Дополнительный контекст:** Режим «Проект» в последующих ТЗ переводится на xAI/Grok. Anthropic как провайдер уходит — оставлять на нём критическую инфраструктуру памяти архитектурно неверно.

---

## Решение

**Одна логика управления памятью чата для всех моделей всех провайдеров.**

Simply Compaction middleware (`prepareMessagesWithCompaction`) применяется **безусловно** ко всем пользовательским chat modes (simply / expertise / create / project). Anthropic `contextManagement` удалён. Capability `supportsCompaction` удалена.

### Как работает

**При достижении 50% от `SIMPLY_CONTEXT_LIMIT` (100 000 токенов) в любом чате:**

1. Middleware вычисляет `split = buildVerbatimWindow(messages)` — какие сообщения уйдут в summary, какие останутся дословно.
2. **MIND batch extract** на `split.toCompact` — извлекаем факты **перед** сжатием (Mem0 best practice 2026: «memory formation before summarization»). `await` блокирует compaction до завершения extract.
3. **Compaction**: генерация summary из тех же сообщений через `compaction:summarize` (Grok 4.1 Fast non-reasoning).
4. Замена `toCompact` на synthetic assistant-message с summary в контексте чата. `verbatim` остаётся дословно.

**Гарантия:** ни одно сообщение не покидает историю чата без попытки извлечь факты.

**При достижении 85% (170K):** middleware повторяет тот же алгоритм. Порог Hard — observability-only (различение `action=compact` vs `action=truncate` в структурированных логах), пользовательское предупреждение убрано.

### Одна модель для всех extract-вызовов

Один taskId: **`memory:extract-batch`** на Grok 4.1 Fast non-reasoning. Предыдущий `memory:extract` удалён.

Обоснование:
- Batch extract на 20–50 сообщений — механическая задача структурного извлечения фактов, не mission-critical reasoning
- Индустриальный консенсус 2026 (Mem0 default `gpt-5-mini`, Mem0g `gpt-4o-mini`, Google ADK `gemini-2.5-flash`) — extraction на small/fast модели
- Экономия ~12× по сравнению с Grok 4.20 reasoning
- Per-turn extract удалён — второй taskId не нужен

### Единая база расчёта — `SIMPLY_CONTEXT_LIMIT`

Все пороги и user-visible отображение считаются от **одной константы**:

| Компонент | База |
|---|---|
| MIND extract threshold | `SIMPLY_CONTEXT_LIMIT` (через compaction middleware) |
| Compaction Soft (50%) / Hard (85%) | `SIMPLY_CONTEXT_LIMIT` |
| UI виджет `used / max` | `SIMPLY_CONTEXT_LIMIT` |
| Sliding window cap в `getMessagesByChatId` | hardcoded ~140K-180K (техническая деталь, не влияет на триггеры) |

Константы `CONTEXT_BUDGET`, `EXTRACT_THRESHOLD_SOFT/HARD`, `EXTRACT_PAUSE_MS` удалены. Закрыт backlog-долг `TZ_UnifyContextThresholdBase`.

### Провайдер-агностичная архитектура

Удалены из кода:
- Capability `supportsCompaction` из `ModelCapabilities` (`lib/ai/model-catalog.ts`)
- Функция `getCompactionStrategy(modelId)` и тип `CompactionStrategy`
- Блок `compactionOptions` + `providerOptions.anthropic.contextManagement` в обоих chat handler'ах
- Поле `kind` в `CompactionEvent` (раньше различало `compaction` / `truncation_warning`)

**Результат:** смена провайдера = 0 строк правок в архитектуре памяти.

---

## Причины

1. **Унификация > вариативность.** Одна логика проще в отладке, документировании, поддержке. Разработчик читает один middleware вместо двух веток по capability.
2. **Прозрачность.** Anthropic Compaction — чёрный ящик (не видим когда/что сжато). Наш middleware логирует `[Compaction] chat=... action=... tokens={...}` и `pre-compact-extract={processed,extracted,stored}`. Дебаг возможен.
3. **Единый UX.** Пользователь видит одинаковый индикатор «📦 Разговор сжат» независимо от модели. Раньше Sonnet чаты не получали user-visible индикации, потому что сжатие было на стороне Anthropic.
4. **Экономика.** Per-turn extract убран → ~92% экономии MIND overhead для expertise/create/project (с $0.0862 до ~$0.007 на 4 turn).
5. **Memory formation before summarization** — зафиксированный консенсус 2026 (Mem0, LangMem). Извлечение фактов ровно в момент их ухода из окна — семантически чище, чем после каждого ответа.
6. **Legacy direction.** Anthropic как провайдер уходит (режим «Проект» мигрирует на Grok). Оставлять inter-modal infrastructure на нём — технический долг на будущее.

---

## Последствия

**Плюсы:**
- Провайдер-агностичная архитектура: новая модель = одна строка в `task-assignments.ts`, compaction работает сразу
- Dead code удалён (`supportsCompaction`, `getCompactionStrategy`, `CompactionStrategy`, `extractFactsFromMessages`, `extractAndStoreFacts`, `EXTRACT_SYSTEM_PROMPT`, `lib/prompts/memory/extract.md`, все константы `EXTRACT_THRESHOLD_*` и `CONTEXT_BUDGET`)
- Виджет контекста показывает реальное состояние системы (одна база)
- Observability: каждый compaction-event логируется структурированно
- MIND batch extract вызывается реже (только в момент сжатия, не на каждом turn) → меньше нагрузки на Voyage embeddings

**Минусы:**
- **Латенси при сжатии:** +3-8 секунд на turn, когда middleware фактически сжимает (await extract → await summary). Раньше с Anthropic Compaction это происходило скрыто внутри ответа провайдера. Компенсация: индикатор «📦 Разговор сжимается» даёт ожидание; сжатие происходит раз на ~50 сообщений, не на каждом turn.
- **Нагрузка на одну модель:** `memory:extract-batch` + `compaction:summarize` оба идут на Grok 4.1 Fast. При scaling может понадобиться разделение taskId на разные модели — но это YAGNI сейчас.
- **Потеря Anthropic cache invalidation на summary-сообщении:** synthetic assistant-message с summary подставляется в начало history, что может инвалидировать Anthropic prompt cache breakpoint 3 (на последнем user message). Средний impact, но cache breakpoint 1 (system) и 2 (tools) остаются валидными.

**Чего НЕ ожидается:**
- Регрессий качества ответов — Grok 4.1 Fast для summary уже проверен в ТЗ-COMPACTION-1 pilot (expertise/create)
- Потери фактов — orchestration `await extract → await compact` гарантирует обработку `toCompact` перед удалением из контекста
- UX разницы в коротких чатах — `action=noop` не делает ничего, поведение identical с прошлым состоянием

---

## Альтернативы (рассмотрены, отклонены)

### A. Сохранить dual strategy, доработать только виджет

Косметическая правка, не решает корневой проблемы — провайдер-зависимость остаётся. Следующая смена провайдера → снова 4 ветки в handler'ах.

### B. Перейти на Anthropic Compaction API для всех (через proxy-wrapper)

Технически невозможно — MiniMax, Grok, OpenRouter модели не поддерживают `compact_20260112`. И это фиксирует зависимость от чужого API в core-инфраструктуре.

### C. Оставить per-turn extract «на всякий случай»

$0.0862 на 4 turn = ~$20/месяц на одного активного пользователя только на extract. Не масштабируется. Best practice 2026 однозначно против.

### D. Отложить унификацию до COMPACTION-3 (когда Anthropic полностью уйдёт)

Анти-паттерн: накапливать долг, «починим потом». Текущий момент — оптимальный (Anthropic ещё работает, можно сделать чистую миграцию с rollback-возможностью через git; в будущем когда Anthropic уйдёт — миграция была бы forced + risky).

---

## Реализация

- **Core layer** (`lib/ai/context-limits.ts`, `model-catalog.ts`, `task-assignments.ts`, `memory/extract.ts`, `compaction/types.ts`, `compaction/prepare-messages.ts`): commit `b2d6ec9` (Этап A)
- **Main chat handler** (`app/(chat)/api/chat/route.ts`): commit `5a6e445` (Этап B1)
- **Project task handler** (`app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts`): commit `b2c35e2` (Этап B2)
- **UI** (`components/elements/context.tsx`): commit `12c74da` (Этап C)
- **Виджет SIMPLY_CONTEXT_LIMIT** (`lib/usage.ts`): commit `de72cce` (hotfix при тесте)

---

## Ссылки

- **ТЗ:** [specs/Simply_xAI/TZ_compaction_unify/](../../specs/Simply_xAI/TZ_compaction_unify/) (после финализации — `_archive/TZ_COMPACTION_UNIFY/`)
- **ADR 042** (superseded) — Dual strategy snapshot + compaction
- **ADR 052** (superseded) — Context management strategy per provider
- **ADR 053** — AI SDK invocation contract (5-й аспект упрощён этим решением)
- **ADR 050** — Cache breakpoints strategy (разделы про Compaction удалены)
- **Архитектурный спек:** [SIMPLY_COMPACTION_ARCHITECTURE.md v2.0](../../specs/Simply_xAI/SIMPLY_COMPACTION_ARCHITECTURE.md)
- **Backlog closure:** `TZ_UnifyContextThresholdBase` закрыт этим ТЗ
- **Best practices 2026:** Mem0 ADD-only single-pass (April 2026), LangMem Subconscious memory formation, Microsoft Agent Framework «smaller/faster model for summarization», Google ADK
