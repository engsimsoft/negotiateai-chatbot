# Roadmap ТЗ-XAI-2: MIND pipeline → Grok

**Создан:** 2026-04-14
**Завершён:** 2026-04-15
**Версия проекта:** 3.88.0 → 3.89.0
**Статус:** ✅ Завершён

**Связанные:**
[ANALYSIS](ANALYSIS.md) · [SIMPLY_XAI_CHANGELOG](../SIMPLY_XAI_CHANGELOG.md) · [SIMPLY_XAI_NOTES](../SIMPLY_XAI_NOTES.md) · [MIND_ARCHITECTURE](../MIND_ARCHITECTURE.md)

---

## Суть

Переключить 5 MIND memory-задач с Sonnet/MiniMax/Haiku на xAI Grok со split-стратегией: mission-critical `memory:extract` на сильной Grok 4.20, механические задачи на быстрой Grok 4.1 Fast. Плюс бонус-рефакторинг: убрать legacy `JSON.parse + Zod` workaround, перейти на native `generateObject`.

---

## Этапы

### Этап 1: Smoke test native generateObject на xAI ✅

**Статус:** ✅ Завершён

**Цель:** Подтвердить что `@ai-sdk/xai` поддерживает `generateObject` с Zod включая `.nullable()` поля — это разблокирует бонус-рефакторинг.

**Задачи:**
- [x] Создан `scripts/test-grok-generate-object.ts` — 2 кейса: базовая schema + nullable
- [x] Запущен на `grok-4-1-fast-non-reasoning`, оба кейса прошли успешно
- [x] Скрипт удалён (одноразовый аудит)

**Результат:** Native structured outputs работают на xAI через AI SDK v6. Nullable поля корректно возвращают как значение, так и null. Рефакторинг включён в план.

---

### Этап 2: Переключение task-assignments + рефакторинг ✅

**Статус:** ✅ Завершён

**Задачи:**
- [x] [task-assignments.ts](../../../lib/ai/task-assignments.ts): 5 memory-tasks → Grok
  - `memory:extract` → `grok-4.20-0309-non-reasoning`
  - `memory:extract-batch` → `grok-4-1-fast-non-reasoning`
  - `memory:dedup-verify` → `grok-4-1-fast-non-reasoning`
  - `memory:consolidate` → `grok-4-1-fast-non-reasoning`
  - `memory:profile` → `grok-4-1-fast-non-reasoning`
- [x] [extract.ts](../../../lib/ai/memory/extract.ts): `batchExtractFacts` переписан с `generateText + JSON.parse + Zod.parse()` на native `generateObject` (−14 строк)
- [x] [consolidate.ts](../../../lib/ai/memory/consolidate.ts): `runConsolidation` переписан аналогично (−11 строк)
- [x] [extract.ts](../../../lib/ai/memory/extract.ts): удалён dead import `calcCostUsd`
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — EXIT 0

---

### Этап 3: MIND_ARCHITECTURE.md — инфраструктура серии ✅

**Статус:** ✅ Завершён

**Цель:** Создать living reference для всей серии Simply_xAI и последующих работ с MIND — чтобы не перерыть код каждый раз.

**Задачи:**
- [x] [MIND_ARCHITECTURE.md](../MIND_ARCHITECTURE.md) — 11 секций: overview, chatMode триггеры, task→model маппинг, адреса всех промптов, параметры с рекомендациями, тест-сценарии, чеклист восстановления, лог-маркеры, схема БД, журнал изменений, правило обновления
- [x] Документирован one-message lag как known behavior (подтверждён Владимиром 2026-04-15)

---

### Этап 4: Live smoke test MIND через Simply Chat ✅

**Статус:** ✅ Завершён

**Цель:** Проверить end-to-end что batch extract + dedup + retrieval работают на Grok с реальными русскими фактами.

**Подготовка — временные изменения (НЕ коммитятся):**
- `EXTRACT_THRESHOLD_SOFT = 0.001` (было 0.6)
- `EXTRACT_PAUSE_MS = 0` (было 10 * 60 * 1000)

**Тест:**
- Владимир отправил 5 сообщений в Simply Chat (c05ad215)
- Наблюдалось в логах: 5 успешных batch extract циклов, 13 фактов извлечено, 3 dedup+supersede успешно

**Результат:**
- ✅ `memory:extract-batch` (Grok 4.1 Fast): 5 циклов, 13 фактов с правильной категоризацией
- ✅ `memory:dedup-verify` (Grok 4.1 Fast): LLM семантически верно находит дубликаты на русском
- ✅ Embeddings + pgvector + supersession flow работают без ошибок
- ✅ Качественная categorization: `fact`, `decision`, `preference`, `task`
- Confidence scores разумные: 0.8-1.0

**Восстановление production defaults:**
- [x] `EXTRACT_THRESHOLD_SOFT = 0.6`
- [x] `EXTRACT_PAUSE_MS = 10 * 60 * 1000`
- [x] `grep TEMP FOR TESTING` — 0 совпадений
- [x] `npx tsc --noEmit` повторно — чисто

---

### Этап 5: Финализация ✅

**Статус:** ✅ Завершён

**Задачи:**
- [x] Version bump 3.88.0 → 3.89.0 (`package.json`, `CLAUDE.md`, `SIMPLY_STATUS.md`)
- [x] `SIMPLY_XAI_CHANGELOG.md` — запись про ТЗ-XAI-2 (сверху)
- [x] `SIMPLY_XAI_NOTES.md` — append запись про результаты теста + split strategy обоснование
- [x] `SIMPLY_XAI_ROADMAP.md` — прогресс таблица + карточка XAI-2
- [x] `CLAUDE.md` «Завершены» — добавлено ТЗ-XAI-2
- [x] Глобальный `CHANGELOG.md` — `[3.89.0]` entry
- [x] Git commit `release(v3.89.0): ТЗ-XAI-2 — MIND pipeline миграция на Grok`

---

## Найденные side-effects (вне scope XAI-2, зафиксированы в backlog)

1. **`getOrCreateSimplyChat` race condition** → [TZ_SimplyChatRaceCondition](../../_backlog/TZ_SimplyChatRaceCondition.md). Проявляется при одновременных запросах к пустой БД. В steady state не виден. Фикс: unique partial index на `(userId, chatMode='simply')`. Чиним после завершения серии

## Риски которые проверились в тесте и НЕ материализовались

- ❌ R-1 (generateObject не работает нативно на xAI) — **не подтвердился**, работает. Бонус-рефакторинг включён в ТЗ
- ❌ R-2 (`.nullable()` ломается на xAI) — **не подтвердился**, работает через `anyOf`
- 🟡 R-3 (качество Grok 4.1 Fast vs Sonnet для извлечения) — **обходится split-стратегией:** mission-critical extract на Grok 4.20, остальные на Fast. Мониторится через `/context` dashboard
