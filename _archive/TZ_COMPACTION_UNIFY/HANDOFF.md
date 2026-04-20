# Передача сессии ТЗ-COMPACTION-UNIFY

**Дата:** 2026-04-20
**Сессия:** 1 (Фаза 1 + Фаза 2 — Анализ и Планирование)

---

## Статус этапов

- [x] Фаза 1 (Анализ) завершена — ANALYSIS.md + ARCHITECT_ANSWERS.md
- [x] Фаза 2 (Планирование) завершена — ROADMAP.md создан
- [ ] Этап A — Core Refactor (⬜ Не начат, ждёт одобрения ROADMAP)
- [ ] Этап B1 — Integration `app/(chat)/api/chat/route.ts`
- [ ] Этап B2 — Integration `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts`
- [ ] Этап C — UI Cleanup
- [ ] Этап D — Documentation (ADR 054 + supersede + updates)
- [ ] Этап E — Финализация

---

## Следующая сессия: начни с

1. **ОБЯЗАТЕЛЬНО:** прочитать [ROADMAP.md](ROADMAP.md) Этап A полностью
2. **НЕ начинать** Этап A без явного одобрения владельцем ROADMAP (в этой сессии владелец ещё не одобрил план — только утвердил Фазу 1 ответами архитектора)
3. Если одобрение получено → старт Этапа A задача A.1 (`lib/ai/context-limits.ts` — чистка констант)
4. После каждой задачи: `npx tsc --noEmit` (будут ошибки в handler'ах — это ожидаемо до Этапа B)
5. По окончании Этапа A: git commit, попросить мануальный тест **невозможен** (приложение не собирается до B); переход к B1 без мануального теста, но с git commit

---

## Ключевые архитектурные решения

Зафиксированы в [ARCHITECT_ANSWERS.md](ARCHITECT_ANSWERS.md):

1. **Middleware инкапсулирует extract → compact.** `prepareMessagesWithCompaction` получает `userId` в `CompactionContext`, сам вызывает `batchExtractFacts` на `split.toCompact` перед `generateCompactionSummary`.
2. **Extract работает на `toCompact` подмножестве** (сообщения уходящие в summary), не на всей истории.
3. **Полная чистка dead code** — `extractFactsFromMessages`, `extractAndStoreFacts`, `EXTRACT_SYSTEM_PROMPT` + файл `extract.md`.
4. **Оба handler'а в scope:** `chat/route.ts` и `projects/[id]/tasks/[taskId]/chat/route.ts`.
5. **Simply Chat получает полноценный compaction cycle** (расширение функциональности, не только унификация). Порог 100K vs прежний 84K extract.
6. **Ручная кнопка «Новый чат с итогом» убирается** — реализация в COMPACTION-3.
7. **CompactionEvent.kind удаляется полностью** — `compactionEvent !== null` достаточно для UI.
8. **ADR 054 новый** + супередирует 042+052, edit 050/053.
9. **Await extract, не parallel.** Семантическая целостность > +3-8 секунд латенси.
10. **mindTokens = только retrieved facts.** Profile block уже в systemPromptTokens.

---

## В процессе

Ничего. Все Фаза 1 + Фаза 2 документы созданы и зафиксированы.

---

## Блокеры / Вопросы

**Блокер:** ожидается одобрение владельцем [ROADMAP.md](ROADMAP.md) перед стартом Этапа A.

Вопросов к архитектору нет — все 10 закрыты в [ARCHITECT_ANSWERS.md](ARCHITECT_ANSWERS.md).

---

## Справочные документы

**В папке ТЗ:**
- [SPEC.md](TZ_COMPACTION_UNIFY.md) — исходное ТЗ от архитектора
- [ANALYSIS.md](ANALYSIS.md) — кодовое ревью + вопросы + риски
- [ARCHITECT_ANSWERS.md](ARCHITECT_ANSWERS.md) — ответы на 10 вопросов
- [ROADMAP.md](ROADMAP.md) — рабочий план (6 этапов)
- [CHANGELOG.md](CHANGELOG.md) — локальная история

**Внешние (для быстрого reference):**
- [specs/WORKFLOW.md](../../WORKFLOW.md) — процесс
- [specs/ROADMAP_GUIDE.md](../../ROADMAP_GUIDE.md) — шаблон ROADMAP
- [DOCUMENTATION_GUIDE.md](../../../DOCUMENTATION_GUIDE.md) — чеклист для Этапа E
- [docs/decisions/053-aisdk-invocation-contract.md](../../../docs/decisions/053-aisdk-invocation-contract.md) — 5-й аспект будет edit-иться
- [docs/decisions/042-compaction-dual-strategy.md](../../../docs/decisions/042-compaction-dual-strategy.md) — супередируется
- [docs/decisions/052-context-management-strategy-per-provider.md](../../../docs/decisions/052-context-management-strategy-per-provider.md) — супередируется

**Ключевые файлы кода (будут правиться):**
- `lib/ai/context-limits.ts`, `lib/ai/model-catalog.ts`, `lib/ai/task-assignments.ts`
- `lib/ai/memory/extract.ts`, `lib/ai/memory/index.ts`
- `lib/prompts/memory/extract.md` (удаление)
- `lib/ai/compaction/types.ts`, `lib/ai/compaction/prepare-messages.ts`
- `app/(chat)/api/chat/route.ts`
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts`
- `components/elements/context.tsx`

---

**Статус:** Фаза 2 завершена. Ждём одобрение ROADMAP от владельца.
