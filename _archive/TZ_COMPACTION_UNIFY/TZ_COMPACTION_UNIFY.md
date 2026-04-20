# ТЗ-COMPACTION-UNIFY — унификация памяти Simply

**Тип:** Системный ТЗ, следующий после закрытого ТЗ-COMPACTION-1
**Приоритет:** Высокий (архитектурное упрощение + провайдер-агностичность + экономия затрат)
**Ожидаемая версия:** 3.95.0

---

## О чём это ТЗ

После закрытия ТЗ-COMPACTION-1 в системе управления памятью Simply обнаружены четыре архитектурные проблемы. Они логически связаны — все про то **когда и как извлекать факты и сжимать историю**. Решаем их одним проходом, приводим систему к провайдер-агностичной архитектуре.

## Четыре проблемы

### Проблема 1 — Предупреждение «Новое задание с итогом» пугает пользователя

**Симптом:** при достижении 85% от SIMPLY_CONTEXT_LIMIT (170K токенов) пользователю показывается всплывающее предупреждение «Рекомендуем начать новое задание» с кнопкой.

**Почему плохо:** противоречит философии Simply (Apple-подход, «одна операция — решённая проблема»). Пользователь видит техническую проблему управления памятью. Индустриальный консенсус 2026 (Claude Code, Cursor, ChatGPT) — сжимают молча.

**Решение:** удалить Фазу 3 compaction полностью. На 85% запускается ещё один цикл сжатия молча. Кнопка «Новый чат с итогом» остаётся как опция в меню чата для ручного использования, но не всплывает автоматически.

### Проблема 2 — Per-turn extract в expertise/create тратит деньги впустую

**Симптом:** после каждого ответа AI в режимах expertise и create запускается extract фактов на дорогой модели. Тестовые данные: 4 turn expertise = $0.0072, 4 extract = $0.0862 (extract в 12 раз дороже самого чата).

**Почему плохо:** extract нужен только перед тем как сообщения **уходят из окна модели**. Свежие сообщения модель и так видит в контексте напрямую — извлекать из них факты избыточно. Best practice 2026 (Mem0, LangMem): «memory formation before summarization» — извлекаем только когда собираемся сжать.

**Решение:** удалить per-turn extract. Extract запускается **вместе с compaction** на том же пороге — последовательность extract → compact на той же группе сообщений.

### Проблема 3 — Две разные базы расчёта процентов

**Симптом:** MIND extract считает проценты от CONTEXT_BUDGET = 140K, Compaction от SIMPLY_CONTEXT_LIMIT = 200K. Архитектурный долг `TZ_UnifyContextThresholdBase` (Medium impact) в backlog.

**Почему плохо:** разработчик читает `EXTRACT_THRESHOLD_SOFT = 0.6` и думает «60% от бюджета». Фактически — 42% от SIMPLY_CONTEXT_LIMIT. Источник ошибок при дебаге.

**Решение:** унифицировать всё на SIMPLY_CONTEXT_LIMIT = 200K. Одна база, один порог 50% = 100K для события extract + compact.

### Проблема 4 — Зависимость от провайдерского Compaction API

**Симптом:** текущая архитектура различает модели по capability `supportsCompaction`. Claude Opus/Sonnet используют Anthropic Compaction API через `providerOptions.anthropic.contextManagement`, остальные — нашу Simply Compaction. Две логики управления памятью работают параллельно.

**Почему плохо:**
- **Провайдер-зависимость.** Завтра меняем провайдера — переписываем архитектуру памяти.
- **Непрозрачность.** Anthropic Compaction API — чёрный ящик. Мы не видим что сжалось, когда, какой размер summary.
- **Разный UX.** Пользователь не получает единообразного опыта: в одном режиме индикатор сжатия есть, в другом нет.
- **Дублирование.** У нас уже написана своя логика extract+compact — Anthropic Compaction API стал избыточным.
- **Legacy направление.** Режим «Проект» в следующих ТЗ переводится на xAI/Grok. Anthropic как провайдер уходит.

**Решение:** удалить зависимость от Anthropic Compaction API. Наша логика extract+compact работает для **всех** моделей всех провайдеров одинаково.

---

## Архитектурное решение

**Одна логика для всех моделей всех провайдеров. Никаких веток по chatMode, никаких веток по provider, никаких веток по capability.**

### Как работает

**При достижении 50% от SIMPLY_CONTEXT_LIMIT (100K токенов) в любом чате:**
1. MIND batch extract на сообщениях которые уйдут в summary
2. Compaction: генерация summary из тех же сообщений
3. Замена сообщений на summary в контексте чата

**Гарантия:** ни одно сообщение не покидает историю чата без попытки извлечь факты.

**При достижении 85% (170K):** ещё один цикл сжатия молча, без предупреждений.

### Одна модель для всех extract-вызовов

Один taskId вместо двух: **`memory:extract-batch`** на Grok 4.1 Fast non-reasoning. Существующий `memory:extract` удаляется.

Обоснование:
- Batch extract на 20-50 сообщений — механическая задача структурного извлечения фактов
- `memory:extract-batch` уже работает на Grok 4.1 Fast с хорошим качеством (доказано в Simply Chat)
- Индустриальный консенсус 2026 (Mem0 default `gpt-5-mini`, Mem0g `gpt-4o-mini`, Google ADK `gemini-2.5-flash`) — extraction на small/fast модели
- Экономия ~12× по сравнению с Grok 4.20 Reasoning
- Per-turn extract больше нет, второй taskId не нужен

### Провайдер-агностичная архитектура

- Удаляется capability `supportsCompaction` из `lib/ai/model-catalog.ts`
- Удаляется функция `getCompactionStrategy(modelId)` из `lib/ai/model-catalog.ts`
- Удаляется ветка `providerOptions.anthropic.contextManagement` из `app/(chat)/api/chat/route.ts`
- Middleware `prepareMessagesWithCompaction` теряет проверку strategy — вызывается для всех модель безусловно

**Результат:** смена провайдера = 0 строк правок в архитектуре памяти.

### Что удаляется из кода

- Per-turn вызов extract в `app/(chat)/api/chat/route.ts` для expertise/create
- Константы `CONTEXT_BUDGET`, `EXTRACT_THRESHOLD_SOFT`, `EXTRACT_THRESHOLD_HARD`, `EXTRACT_PAUSE_MS`
- Событие `truncation_warning` в compaction middleware
- UI-блок «Рекомендуем начать новое задание» в `context.tsx`
- TaskId `memory:extract` и его промпт `lib/prompts/memory/extract.md`
- Capability `supportsCompaction` из всех model-catalog записей
- Функция `getCompactionStrategy(modelId)`
- Блок `compactionOptions` и `providerOptions.anthropic.contextManagement` в chat/route.ts

### Что остаётся

- `SIMPLY_CONTEXT_LIMIT = 200K` — единая база
- `COMPACTION_THRESHOLD_SOFT = 0.5` — единый триггер extract + compact
- `COMPACTION_THRESHOLD_HARD = 0.85` — повторный compact молча
- Индикатор «📦 Разговор сжат» на 2-3 секунды при срабатывании (единственное UI-событие)
- TaskId `memory:extract-batch` на Grok 4.1 Fast non-reasoning (единственный extract-вызов)
- TaskId `compaction:summarize` на Grok 4.1 Fast non-reasoning (без изменений)

---

## Scope

**В этом ТЗ:**
- Удаление Фазы 3 и события `truncation_warning`
- Удаление per-turn extract во всех режимах
- Унификация базы на SIMPLY_CONTEXT_LIMIT, удаление старых констант MIND
- Объединение триггеров extract + compact на одном пороге 50%
- Последовательность extract → compact на одной группе сообщений
- Удаление taskId `memory:extract` и его промпта, оставить только `memory:extract-batch`
- Удаление capability `supportsCompaction` и функции `getCompactionStrategy`
- Удаление зависимости от Anthropic Compaction API
- Закрытие backlog-долга `TZ_UnifyContextThresholdBase`
- Обновление архитектурных документов: `SIMPLY_COMPACTION_ARCHITECTURE.md`, `MIND_ARCHITECTURE.md`
- Обновление ADR 053 (5-й аспект «context strategy» — упрощение формулировки)

**НЕ в этом ТЗ:**
- Перевод режима «Проект» с Anthropic на xAI/Grok (отдельный ТЗ, Legacy Code cleanup)
- Калибровка формулы estimateMessageTokens (отдельный долг `TZ_CompactionActualCalibration`)

---

## Workflow

Стандартный по `specs/WORKFLOW.md`:
1. **Фаза 1 (Claude Code):** ANALYSIS — прочитать весь релевантный код, зафиксировать findings, задать вопросы архитектору
2. **Архитектор отвечает** на findings через чат
3. **Фаза 2 (Claude Code):** SPEC + ROADMAP по этапам
4. **Фаза 3 (Claude Code):** реализация
5. **Фаза 4:** финализация — CHANGELOG, версия 3.95.0, обновление SIMPLY_STATUS.md, ADR, архивация папки ТЗ

---

## Критерии приёмки

1. Предупреждение «Новое задание с итогом» не показывается ни при каких условиях автоматически
2. Per-turn extract удалён во всех режимах, код чистый
3. Все пороги считаются от SIMPLY_CONTEXT_LIMIT = 200K, старые MIND-константы удалены
4. При достижении 100K в любом chatMode: сначала extract, потом compact, на одной группе сообщений
5. Единственный extract-taskId — `memory:extract-batch` на `grok-4-1-fast-non-reasoning`, старый `memory:extract` удалён
6. Capability `supportsCompaction` удалена из model-catalog, `getCompactionStrategy` функции не существует
7. `providerOptions.anthropic.contextManagement` не используется нигде в коде
8. Smoke test Simply Chat >100K: extract + compact срабатывают вместе, факты в memory_entry, история сжата
9. Smoke test expertise >100K: то же поведение
10. Smoke test expertise >170K: второй compact молча, без UI-предупреждений
11. Smoke test project chat на Claude Opus: наша логика работает вместо Anthropic Compaction, факты извлекаются, история сжимается нашим middleware
12. TypeScript компилируется, все тесты проходят
13. `TZ_UnifyContextThresholdBase.md` перемещён в `_backlog/_archive/`, запись в `BACKLOG_CLOSED.md`

---

## Референсы

- `_archive/TZ_COMPACTION_1/` — архитектурный документ compaction v1.8 (основа для расширения)
- `specs/Simply_xAI/MIND_ARCHITECTURE.md` — pipeline памяти
- `specs/_backlog/TZ_UnifyContextThresholdBase.md` — детализация проблемы 3
- Best practices 2026: Mem0 (ADD-only single-pass April 2026, провайдер-агностичный memory layer), LangMem (Subconscious memory formation, работает с любым провайдером), LangChain Memory overview, Microsoft Agent Framework «smaller/faster model for summarization», Google ADK

---

## Запуск

По команде владельца: «Старт ТЗ-COMPACTION-UNIFY, Фаза 1 по WORKFLOW».
