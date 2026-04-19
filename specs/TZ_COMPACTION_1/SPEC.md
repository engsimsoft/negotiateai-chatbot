# ТЗ-COMPACTION-1 — Simply Compaction MVP

**Дата:** 2026-04-18
**Фаза:** 1 (Анализ + Код-ревью) по [WORKFLOW.md](../WORKFLOW.md)
**Архитектурный источник:** [SIMPLY_COMPACTION_ARCHITECTURE.md v1.7](../Simply_xAI/SIMPLY_COMPACTION_ARCHITECTURE.md)
**Владелец серии:** Владимир Анатольевич
**Архитектор:** Claude Opus (отдельные сессии)
**Разработчик:** Claude Code (эта папка)

---

## Scope этого ТЗ (MVP)

**Инфраструктура Simply Compaction:**
- Новый `compaction:summarize` taskId в SSOT ([task-assignments.ts](../../lib/ai/task-assignments.ts)) — 3 записи per ADR 053 checklist
- Функция `getCompactionStrategy(modelId)` + тип `CompactionStrategy` в [model-catalog.ts](../../lib/ai/model-catalog.ts)
- Middleware `prepareMessagesWithCompaction(taskId, messages, context)` в новой папке `lib/ai/compaction/`
- 3 константы в [context-limits.ts](../../lib/ai/context-limits.ts): `COMPACTION_THRESHOLD_SOFT=0.5`, `COMPACTION_THRESHOLD_HARD=0.85`, `COMPACTION_VERBATIM_WINDOW_TOKENS=40_000`, `COMPACTION_SUMMARY_TARGET_TOKENS=3_000`
- Миграция БД: 3 новых поля в `Chat` таблице ([lib/db/schema.ts](../../lib/db/schema.ts)) — `compactionSummary` (text null), `compactionIndex` (integer null), `compactionCount` (integer default 0)
- UI-события `compaction` / `truncation_warning` через существующий dataStream protocol
- Реализация Фазы 0-1 (обычная работа + первое сжатие) и Фазы 3 (рекомендация нового чата); Фаза 2 (повторное сжатие через rolling update) — в MVP, но smoke test критерий только если триггерится

**Phased rollout внутри ТЗ** (narrow-first, см. v1.7 §Phased Rollout):
- **Этап A** — вся инфраструктура + активация в expertise (gate `chatMode === "expertise"`)
- **Этап B** — расширение gate на create (gate `chatMode === "expertise" || chatMode === "create"`)

## НЕ в scope (явно откладывается)

- Simply Chat (`chatMode === "simply"`) — COMPACTION-2 (требует 4 критерия выхода MVP + решение ordering с MIND)
- Project task expert (`chatMode === "task"` на Anthropic tier) — COMPACTION-2+ (Opus/Sonnet имеют `supportsCompaction: true`, провайдерский compaction уже активен)
- Service chats — COMPACTION-2+ (короткие контексты, compaction не триггерится)
- «Новый чат с итогом» UI — COMPACTION-3 (отдельный ТЗ)
- Повторные циклы Фазы 2 в production — активируются автоматически через middleware, но smoke test Фазы 2 не обязателен в MVP (требует очень длинные сессии)

## Архитектурные инварианты (не пересматриваются)

1. **Capability-driven:** выбор стратегии по `ModelCapabilities.supportsCompaction`, не по chatMode/provider. См. v1.7 §Провайдер-агностичность.
2. **SSOT ADR 053:** compaction:summarize taskId имеет все 4 аспекта контракта (taskId, model, cap, call mode).
3. **Пороги:** Soft 50% / Hard 85% от `SIMPLY_CONTEXT_LIMIT=200K` (100K и 170K абсолютно). См. v1.7 §Обоснование порогов.
4. **Дословное окно:** 40K токенов, единица — токены, не сообщения. Edge case: одно массивное сообщение > 40K включается целиком. См. v1.7 §Дословное окно.
5. **Summary:** target 3K + hard cap 4K, 5-секционный структурированный формат (Context/Materials/Decisions/Focus/Open Questions). См. v1.7 §Формат Summary + §Обоснование размера summary.
6. **Модель:** `grok-4-1-fast-non-reasoning`, роль «подсобка». См. v1.7 §Модель для сжатия.

## Далее по WORKFLOW

- **Сейчас (Фаза 1):** [ANALYSIS.md](ANALYSIS.md) создан с Изученной документацией + Код-ревью + Вопросами. **СТОП — ждать архитектора и владельца.**
- **После согласования (Фаза 2):** [ROADMAP.md](ROADMAP.md) по шаблону [ROADMAP_GUIDE.md](../ROADMAP_GUIDE.md) с этапами A→B и валидационными критериями.
- **Разработка (Фаза 3):** Этап A → tsc → build → manual test → Этап B → tsc → build → manual test. Правило 7 — git commit после каждого этапа.
- **Финализация (Фаза 4):** SQL-проверка БД, [DOCUMENTATION_GUIDE.md](../../DOCUMENTATION_GUIDE.md) чеклист, ADR 053 расширение до 5-го аспекта (context strategy), архивирование папки.
