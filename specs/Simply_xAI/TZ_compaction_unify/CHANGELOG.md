# Changelog ТЗ-COMPACTION-UNIFY

> История изменений по этому ТЗ (локальный CHANGELOG).
> После финализации содержимое будет перенесено в главный [CHANGELOG.md](../../../CHANGELOG.md).

---

## Сессия 1 — 2026-04-20 — Фаза 1 (Анализ) + Фаза 2 (Планирование)

### Added
- `SPEC.md` — получен от архитектора (название `TZ_COMPACTION_UNIFY.md`)
- `ANALYSIS.md` — кодовое ревью ТЗ, 10 вопросов архитектору, 7 рисков, оценка сложности
- `ARCHITECT_ANSWERS.md` — ответы архитектора, подтверждение расширения scope
- `ROADMAP.md` — 6 этапов (A/B1/B2/C/D/E), gate-keeping, критерии приёмки
- `CHANGELOG.md` — этот файл
- `HANDOFF.md` — мост в следующую сессию

### Decisions
- **Scope расширен:** добавлен второй handler `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` (критерий приёмки #11 был невыполним)
- **Scope сокращён:** ручная кнопка «Новый чат с итогом» убрана из ТЗ полностью (перенос в COMPACTION-3)
- **Middleware инкапсулирует extract → compact** (добавлен `userId` в `CompactionContext`)
- **Полная чистка dead code:** `extractFactsFromMessages`, `extractAndStoreFacts`, `EXTRACT_SYSTEM_PROMPT`, `lib/prompts/memory/extract.md`
- **CompactionEvent.kind** удаляется целиком (не упрощается до одного kind)
- **ADR 054** новый + супередирование 042/052 + edit 050/053
- **Оценка:** ~5 сессий, 6 этапов, ~15 файлов кода + ~10 документов

### Files (пока только специфика ТЗ)
- `specs/Simply_xAI/TZ_compaction_unify/SPEC.md` (через TZ_COMPACTION_UNIFY.md)
- `specs/Simply_xAI/TZ_compaction_unify/ANALYSIS.md`
- `specs/Simply_xAI/TZ_compaction_unify/ARCHITECT_ANSWERS.md`
- `specs/Simply_xAI/TZ_compaction_unify/ROADMAP.md`
- `specs/Simply_xAI/TZ_compaction_unify/CHANGELOG.md`
- `specs/Simply_xAI/TZ_compaction_unify/HANDOFF.md`

### Next session start point
Ожидается одобрение владельцем ROADMAP. После одобрения — старт Этапа A (Core Refactor).
