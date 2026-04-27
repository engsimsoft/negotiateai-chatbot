# TZ_MindConsolidationTriggers — упрощение триггеров MIND консолидации

**Тип:** долг (заготовка ТЗ)
**Impact:** Low-Medium
**Сложность:** 0.5-1 сессия
**Зависимости:** независим. Можно взять в работу когда удобно.
**Обновлено:** 2026-04-21 (v2 — после аудита Claude Code и research best practices 2026)

---

## Контекст

После ТЗ-COMPACTION-UNIFY (v3.95.0, коммит 969b0b4) `batchExtractFacts` запускается в двух местах:

1. **Основной путь** — compaction middleware (`lib/ai/compaction/prepare-messages.ts:126`). При достижении 50% контекста извлекает факты из уходящей части истории перед сжатием.
2. **Safety net** — ночной cron (`app/api/cron/memory-profile/route.ts`). Раз в сутки ловит пользователей с simply-сообщениями старше 24ч без `extractedAt`.

Внутри `batchExtractFacts` работает event-chain (`lib/ai/memory/extract.ts:247-282`):
- storedCount ≥ 10 → `consolidateUserMemory` (full)
- totalChanged ≥ 10 → `generateUserProfile`
- иначе инкремент `factsSinceConsolidation`

Аудит Claude Code выявил три проблемы:

1. **Мёртвый код** — `miniConsolidateUserMemory` (`consolidate.ts:311`) экспортирована, нигде не вызывается
2. **Устаревшие комментарии** — шапка `consolidate.ts:1-9` описывает mini event-triggered архитектуру, которой больше нет
3. **Мёртвый счётчик** — `factsSinceConsolidation` инкрементируется (`extract.ts:275`) и сбрасывается (`consolidate.ts:293,327`), но **ни одно место в коде не читает его для принятия решений**. Inc → reset → inc → reset впустую.

**Дыра в логике триггера (Claude Code выявил):** активный пользователь с 5-9 фактов за compaction-сессию никогда не попадает на консолидацию через hot path (`storedCount < 10`). За месяц накапливается 200+ неконсолидированных фактов. Cron подбирает их косвенно (через stale messages), но без гарантий.

---

## Ответы на вопросы Claude Code (с research best practices 2026)

### Q1. Cron как safety net для пассивных пользователей — это норма?

**Ответ:** Да, индустриальная норма. Оставляем.

**Источники:**
- **Mem0 v1.0.4 (апрель 2026)** ввёл **Dream gate** — «Automatic memory consolidation during idle periods for higher-quality long-term recall» ([highlights](https://docs.mem0.ai/changelog/highlights), 2026-04-04)
- **Mem0 lifecycle hooks** — session start, context compaction, task completion, session end. Наш путь (extract на compaction) — один из четырёх канонических хуков
- **Letta — sleep-time compute** ([letta.com/blog/memory-blocks](https://www.letta.com/blog/memory-blocks)): «agents can process information during idle periods and update shared memory blocks… non-blocking operations: memory management asynchronously, improving response times and memory quality»
- **Zep** — background graph processing: «immediate post-ingestion retrieval often failed — correct answers only appeared hours later after background graph processing completed» ([mem0 paper/dev.to сравнение](https://blog.devgenius.io/ai-agent-memory-systems-in-2026-mem0-zep-hindsight-memvid-and-everything-in-between-compared-96e35b818da8))
- **LangMem** — «Background memory manager. Automatically extracts, consolidates, and updates agent knowledge from conversations» ([dev.to](https://dev.to/anajuliabit/mem0-vs-zep-vs-langmem-vs-memoclaw-ai-agent-memory-comparison-2026-1l1k))

**Вывод:** все production memory layers 2026 года используют background/idle-period consolidation. Наш cron — это правильная имплементация этого паттерна. Альтернативы (session-close beacons, per-turn extract) либо ненадёжны, либо экономически неадекватны (отменено предыдущим ТЗ).

### Q2. Нужен ли mini-consolidation как отдельная операция?

**Ответ:** Нет. Удаляем `miniConsolidateUserMemory`.

**Источники:**
- **Mem0 OSS v3 (2026)** ([migration docs](https://docs.mem0.ai/migration/oss-v2-to-v3)): убрали старый двухфазный алгоритм (extract → ADD/UPDATE/DELETE в hot path) в пользу **ADD-only single-pass**. UPDATE/DELETE теперь только в отдельной периодической консолидации.
- **Letta** ([memory-blocks](https://www.letta.com/blog/memory-blocks)): два уровня (core + archival), без промежуточного mini. Refinement — через sleep-time compute (наш cron), не через отдельный синхронный пласт.
- **Zep** ([Memory docs](https://help.getzep.com/v2/memory)): inline ingestion (hot path, ADD) + background deduplication/temporal relationships. Без mini между ними.

**Вывод:** наша текущая двухуровневая архитектура (`batchExtractFacts` = ADD-only hot path, `consolidateUserMemory` = ADD/UPDATE/DELETE/SUPERSEDE отдельно) соответствует Mem0 v3 / Letta / Zep 2026. Mini-consolidation — архаизм. Удаляем.

### Q3. Триггер «batch ≥ 10 фактов» — адекватный?

**Ответ:** Нет. Активный пользователь с 5-9 фактов за compaction-сессию не попадает на консолидацию, пока cron не подберёт его. Нужен **cumulative counter с threshold**.

**Источники:**
- **oneuptime.com (январь 2026)** ([blog](https://oneuptime.com/blog/post/2026-01-30-memory-consolidation/view)) — канонический паттерн:
  - Immediate triggers (SESSION_END, GOAL_ACHIEVED, FEEDBACK_RECEIVED)
  - **Batch triggers (каждые N событий, threshold: 5-10)**
  - Volume-based (max_entries)
- **Mem0** ([paper 2504.19413](https://arxiv.org/html/2504.19413v1)): consolidation периодически сканирует memory store при достижении порога similarity 0.85 (deduplication); отдельно от hot path extraction
- **Letta sleep-time compute**: triggered by idle signals, но в active session — через threshold событий (tokens, tool calls)

**Вывод:** индустрия использует комбинацию event-immediate + counter-threshold + volume-based. У нас сейчас только первый (one-shot при batch ≥ 10). Добавляем второй — накопительный счётчик.

### Q4. Что делать со счётчиком `factsSinceConsolidation`?

**Ответ:** Вариант (B) — реанимировать. Инфраструктура уже есть, добавляем чтение.

**Логика нового триггера:**
```
if (storedCount >= 10)                          // immediate trigger (текущий)
   || (factsSinceConsolidation + storedCount >= 15)  // NEW: threshold trigger
   consolidateUserMemory(userId)
```

**Почему 15, а не 10:**
- При 10 триггер дублирует текущую логику (storedCount ≥ 10 уже триггерит)
- Запас +5 даёт буфер для активного пользователя: если он уже имеет 8 неконсолидированных фактов и batch даёт ещё 7 → триггер, что правильно
- Защищает от слишком частых вызовов LLM консолидации

**Точное значение threshold — на обсуждение с Claude Code в Фазе 1 (ANALYSIS).** Стартовое 15, корректировка по fixtures при необходимости.

**Вариант (A) — удалить** — отклоняю. Дыра в логике (активные пользователи проваливаются между cron запусками) существует, и счётчик — самый дешёвый инструмент её закрыть.

**Вариант (C) — телеметрия** — отклоняю. Нет потребителей.

### Q5. Стоит ли разделять consolidation и profile regeneration?

**Ответ:** Оставить как есть. Не трогаем в этом ТЗ.

**Источники:**
- **Mem0**: profile генерируется ad-hoc из retrieved facts (no stored profile). У нас хранимый профиль — расширение, а не противоречие.
- **Letta**: core memory (аналог нашего profile) — агент сам её редактирует inline. Другая философия (self-editing), не применима без полной переписывания.
- **Zep**: context string — assembled on-the-fly из graph + last 4-6 messages. Близко к Mem0.

**Наша текущая логика** («profile регенерируется только если consolidation дал totalChanged ≥ 10») — разумная экономия. Сливать consolidate + profile в один LLM call можно, но это отдельная оптимизация без явного ROI:
- Экономия: -1 LLM call при каждой активной консолидации (~$0.001)
- Риск: промпт consolidate и промпт profile разного назначения. Смешивание может ухудшить качество обоих.

**Вывод:** зафиксировано в backlog как возможная оптимизация на будущее (`TZ_MergeConsolidateAndProfile`, Low impact, after production validation). Не делаем сейчас.

---

## Scope этого ТЗ

### Что делаем

1. **Удалить мёртвый код**
   - Функция `miniConsolidateUserMemory` в `lib/ai/memory/consolidate.ts:311`
   - Экспорт в `index.ts` если есть
   - Все комментарии-призраки в шапке `consolidate.ts:1-9` (переписать на текущую архитектуру)

2. **Реанимировать счётчик `factsSinceConsolidation`**
   - Добавить `getUserFactsSinceConsolidation(userId)` в `lib/db/queries.ts` (если нет)
   - В `batchExtractFacts` (`extract.ts:247-282`) перед вызовом `consolidateUserMemory` прочитать счётчик и применить объединённый триггер:
     ```
     shouldConsolidate =
        storedCount >= 10
        || (factsSinceConsolidation + storedCount) >= THRESHOLD
     ```
   - Константа `CONSOLIDATION_THRESHOLD_CUMULATIVE = 15` в `lib/ai/context-limits.ts` с комментарием-обоснованием

3. **Обновить документацию**
   - `MIND_ARCHITECTURE.md` — описать новую логику триггера с обоснованием из best practices 2026
   - Убрать упоминания mini-consolidation если они там есть
   - ADR-комментарий со ссылками на Mem0 v3 / Letta / Zep

### Что НЕ делаем

- **Не трогаем cron** — работает как Dream gate / sleep-time compute, индустриальная норма
- **Не трогаем `consolidateUserMemory`** — её алгоритм (ADD/UPDATE/DELETE/SUPERSEDE с cap 200) уже соответствует Mem0 v3 pattern
- **Не сливаем consolidate + profile** — Q5, отдельная оптимизация в будущее
- **Не добавляем session-close beacons / logout triggers** — cron покрывает, осложнение не оправдано
- **Не добавляем volume-based trigger** (`max_entries`) — у нас нет проблем с объёмом памяти на пользователя сейчас

---

## Acceptance Criteria

1. **Чистка dead code**
   - `grep -r "miniConsolidateUserMemory" lib/` → пусто
   - `grep -r "mini event-triggered" lib/` → пусто
   - `tsc --noEmit` проходит
   - Unit tests `consolidate.test.ts` проходят

2. **Реанимация счётчика**
   - В `batchExtractFacts` чтение `factsSinceConsolidation` перед решением о вызове `consolidateUserMemory`
   - При `storedCount < 10` но `factsSinceConsolidation + storedCount >= 15` → вызывается `consolidateUserMemory` (проверка через `console.info` лог или unit test с мокнутым db)
   - После `consolidateUserMemory` счётчик сбрасывается в 0 (текущее поведение сохраняется)

3. **Документация**
   - `MIND_ARCHITECTURE.md` обновлён: новая формула триггера, ссылки на Mem0 v3 / Letta sleep-time / Dream gate
   - Константа `CONSOLIDATION_THRESHOLD_CUMULATIVE` документирована в `context-limits.ts` с обоснованием

4. **Verification в production после deploy (1 неделя мониторинга)**
   - SQL-запрос: количество вызовов `consolidateUserMemory` в день до/после — ожидается рост на ~15-30% (активные пользователи, которые раньше проваливались на cron)
   - SQL-запрос: `factsSinceConsolidation` у пользователей — не должно быть значений ≥ 15 дольше одной compaction-сессии

---

## Оценка

**0.5-1 сессия Claude Code.** Фаза 1 ANALYSIS (быстрый grep + ревью event-chain) + Фаза 2 ROADMAP (3 этапа: cleanup / counter / docs) + Фаза 3 implementation + Фаза 4 verification.

Без миграции БД. Без изменений API. Без изменений UI.

---

## Источники research 2026

Все ответы на Q1-Q5 опираются на документацию и peer-reviewed работы:

1. Mem0 paper: [arxiv.org/abs/2504.19413](https://arxiv.org/abs/2504.19413) (Chhikara et al., 2025)
2. Mem0 OSS v3 migration: [docs.mem0.ai/migration/oss-v2-to-v3](https://docs.mem0.ai/migration/oss-v2-to-v3)
3. Mem0 changelog (Dream gate v1.0.4): [docs.mem0.ai/changelog/highlights](https://docs.mem0.ai/changelog/highlights)
4. Letta memory blocks & sleep-time: [letta.com/blog/memory-blocks](https://www.letta.com/blog/memory-blocks)
5. Anthropic memory tool + compaction pattern: [platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)
6. Zep Memory API: [help.getzep.com/v2/memory](https://help.getzep.com/v2/memory)
7. State of AI Agent Memory 2026: [mem0.ai/blog/state-of-ai-agent-memory-2026](https://mem0.ai/blog/state-of-ai-agent-memory-2026)
8. Event-based consolidation trigger patterns (oneuptime): [oneuptime.com/blog/post/2026-01-30-memory-consolidation](https://oneuptime.com/blog/post/2026-01-30-memory-consolidation/view)
9. Architecture survey — LangMem / Mem0 / Zep comparison: [analyticsvidhya.com/blog/2026/04/memory-systems-in-ai-agents](https://www.analyticsvidhya.com/blog/2026/04/memory-systems-in-ai-agents/)
