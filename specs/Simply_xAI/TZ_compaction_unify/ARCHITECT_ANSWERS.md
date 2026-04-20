# Ответы архитектора на Фазу 1 ТЗ-COMPACTION-UNIFY

**Дата:** 2026-04-20
**Контекст:** Ответы на 10 вопросов из [ANALYSIS.md §3](ANALYSIS.md) + подтверждение рекомендаций §2
**Статус:** Утверждено. Фаза 2 (ROADMAP) разрешена.

---

## Q1 — Orchestration: middleware или caller?

**Решение:** **(A) Middleware-инкапсуляция.**

`prepareMessagesWithCompaction` оркестрирует последовательность extract → compact. Caller ничего не знает про MIND. Добавить `userId` в `CompactionContext`.

**Обоснование:** memory pipeline — одна ответственность («управление памятью чата»). Best practice Mem0: memory operations инкапсулированы в один API.

---

## Q2 — Полная чистка dead code

**Решение:** Да, полная чистка.

**Удалить:**
- `extractFactsFromMessages` ([lib/ai/memory/extract.ts:120](../../../lib/ai/memory/extract.ts#L120))
- `extractAndStoreFacts` ([lib/ai/memory/extract.ts:179](../../../lib/ai/memory/extract.ts#L179))
- `EXTRACT_SYSTEM_PROMPT` загрузка ([extract.ts:53-60](../../../lib/ai/memory/extract.ts#L53-L60))
- Файл [lib/prompts/memory/extract.md](../../../lib/prompts/memory/extract.md)
- TaskId `memory:extract` из `DEFAULT_TASK_MODELS` и `DEFAULT_MAX_OUTPUT_TOKENS` + из `TaskId` union
- Экспорты из `lib/ai/memory/index.ts`

**Оставить:**
- `batchExtractFacts` (используется compaction-flow)
- `processAndStoreFact` (shared helper)
- TaskId `memory:extract-batch`

**YAGNI.** Если понадобится per-turn в будущем — вернём через git history.

---

## Q3 — Project task-expert route в scope

**Решение:** Да, в scope.

`app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — полный аналог `chat/route.ts` для проектных чатов. Содержит копии тех же проблем:
- Anthropic `contextManagement` (`compact_20260112`) — строки 366-392
- Per-turn `extractAndStoreFacts` — строки 729-754

Без его правок критерий приёмки #11 невыполним.

**ТЗ обновить:** scope включает оба handler'а явно.

---

## Q4 — Порог 85% Hard — что именно триггерит

**Решение:** Soft и Hard = один и тот же алгоритм middleware, разные пороги активации.

- **Soft (50%)** — сжимает, стандартный путь
- **Hard (85%)** — safety net, срабатывает если Soft пропущен (один turn скакнул с 40% до 90% через большой attachment)

На практике Hard редко достижим после Soft-сжатия (usage падает под 50%). Поведение identical.

**Упрощение ТЗ:** удалить отдельное упоминание «Hard триггерит ещё один цикл». Формулировка: «middleware срабатывает при usage ≥ 50%». Константа `COMPACTION_THRESHOLD_HARD` остаётся **только для observability** (различать soft/hard в `console.info`).

---

## Q5 — Порог 50% для Simply Chat — согласен на сдвиг?

**Решение:** Да, согласен. 84K → 100K — осознанный трейд-офф.

Обоснование:
- Унификация важнее сохранения исторической границы
- 100K всё ещё ниже reasoning degradation threshold (Anthropic research 100K)
- Для русскоязычной сессии ~100 сообщений без крупных вложений — адекватно

**Зафиксировать в ROADMAP явно:** «Simply Chat теперь получает полноценный цикл extract + compact + verbatim window (раньше был только batch extract). Это расширение функциональности, не только унификация.»

---

## Q6 — Simply Chat в scope? Ordering MIND retrieve vs compaction

**Решение:** Да, Simply Chat в scope.

MIND retrieve работает на **свежем пользовательском запросе**, не на истории. Simply Compaction работает на **истории**. Independent.

**Последовательность в handler:**
1. MIND retrieve (по user query) → `mindDynamicBlock`
2. `prepareMessagesWithCompaction` (на истории, включает `mindTokens` в подсчёт)
3. `streamText`

**Критерий приёмки добавить:** `mindTokens` в `CompactionContext` должен включать **retrieved facts + profile block** (не только profile).

---

## Q7 — «Меню чата» для ручной кнопки?

**Решение:** Вариант (c) — убрать кнопку из этого ТЗ полностью.

Реализация в COMPACTION-3 как было зарезервировано. Добавление новой UI-поверхности = расширение scope. Задача этого ТЗ — **убрать предупреждение**, не создавать новую кнопку.

**Простое решение сейчас:**
- Compaction работает молча
- Индикатор «📦 Разговор сжат» на 2-3 секунды
- Ручное переначинание чата — через обычную кнопку «Новый чат» в sidebar (уже есть)
- Summary-handoff — отдельный ТЗ COMPACTION-3

---

## Q8 — ADR 042/052/053/050?

**Решение:** Вариант (a) — создать ADR 054.

**Действия:**
- **ADR 054** — «Single-strategy provider-agnostic compaction (v3.95.0)». Явный supersedes 042+052. Обоснование: провайдер-агностичность, упрощение, уход от Anthropic.
- **ADR 042** — добавить header «Superseded by ADR 054»
- **ADR 052** — добавить header «Superseded by ADR 054»
- **ADR 050** — edit, удалить упоминание Compaction API из раздела cache breakpoints
- **ADR 053** — edit, 5-й аспект упрощается до `{kind: "simply" | "none"}`, убрать `provider`

---

## Q9 — Удалять `CompactionEvent.kind` полностью?

**Решение:** Вариант (a) — удалить поле `kind` вовсе.

YAGNI. `compactionEvent !== null` достаточно для UI-флага. Если появятся новые типы событий — добавим дискриминатор тогда, обратимая правка.

---

## Q10 — Миграция БД?

**Решение:** Миграция не нужна. Zero migration risk.

Поля `compactionSummary/Index/Count` уже существуют после ТЗ-COMPACTION-1, применимы ко всем chat modes. Исторические чаты с `null/0` — middleware обрабатывает как Phase 0 (noop).

---

## Подтверждения рекомендаций §2 ANALYSIS.md

Все 9 рекомендаций приняты:

1. ✅ Task-expert route в scope (Q3)
2. ✅ Extract работает на `split.toCompact`, middleware-инкапсуляция (Q1)
3. ✅ Полная чистка dead code (Q2)
4. ✅ Упростить `CompactionStrategy` — или удалить вовсе если `getCompactionStrategy` больше не существует, тип тоже не нужен. **Проверить в реализации.**
5. ✅ `calcUsagePercent` default → `SIMPLY_CONTEXT_LIMIT`
6. ✅ Ручная кнопка — вариант (c), убрать из ТЗ (Q7)
7. ✅ ADR 054 новый + supersede 042/052 (Q8)
8. ✅ Удалить `CompactionEvent.kind` полностью (Q9)
9. ✅ SQL-верификация `ai_usage_log` в критериях приёмки

---

## Комментарии к рискам §4 ANALYSIS.md

- **R1 (regression project chat):** принимаем осознанный риск. Smoke test обязателен перед финализацией.
- **R2 (Simply Chat compaction cost):** принимаем. SQL-мониторинг первую неделю production.
- **R3 (mindTokens):** должен включать **retrieved facts + profile block**. Фиксируй в ROADMAP.
- **R6 (latency):** `await` extract перед compact — **принимаем**. Параллельность `extract || compact` **не делать** — они в реальности зависимы (compact использует те же сообщения). Семантическая целостность важнее +3-8 секунд в момент сжатия (происходит редко, раз на ~50 сообщений). Пользователь увидит лёгкую паузу — индикатор «📦 Разговор сжимается» объяснит.
- **R7 (dev overrides):** ничего не делаем. Ожидаемое поведение.

---

## Open findings §7 ANALYSIS.md

1. Правка ADR 053 в этом ТЗ решит первый finding (пример `{type: "auto"}` vs реальность `compact_20260112`).
2. Трейд-офф 84K → 100K принимаем (подтверждено Q5).
3. `TZ_CompactionActualCalibration` — остаётся в backlog, неделя production-данных нужна.

---

## Резюме scope для Фазы 2 (ROADMAP)

### Scope расширяется (vs исходное ТЗ)

- **Оба handler'а:** `app/(chat)/api/chat/route.ts` **+** `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts`
- **Новый ADR 054** + supersede 042/052 + edit 050/053
- **`calcUsagePercent` default** → `SIMPLY_CONTEXT_LIMIT`
- **SQL-верификация** в критерии приёмки
- **Полная чистка** `extract.md`, `extractFactsFromMessages`, `extractAndStoreFacts`, `EXTRACT_SYSTEM_PROMPT`

### Scope сокращается (vs исходное ТЗ)

- **Ручная кнопка «Новый чат с итогом»** — убирается из этого ТЗ полностью (перенос в COMPACTION-3)
- **`CompactionEvent.kind`** — удаляется полностью (было «упростить до одного kind», теперь просто удалить)

### Оценка ~5 сессий принимается

Разбивка по этапам A/B1/B2/C/D/E — согласована с архитектором.

---

**Документ готов к Фазе 2 ТЗ-COMPACTION-UNIFY.**
