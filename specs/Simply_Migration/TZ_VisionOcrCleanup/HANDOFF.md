# Передача сессии ТЗ — Simply_Migration · Шаг 3

**Дата:** 2026-04-28
**Сессия:** 1

## Статус этапов

- [x] Phase 0 — Workflow setup
- [x] Phase 1 — Audit (read-only)
- [x] Phase 2 — Cleanup (vision-ocr.ts удалён, 5 правок task-assignments)
- [x] Phase 3 — Migration (contextWindow 2M, chat-vision default = Grok)
- [x] Phase 4 — Manual verification (Test 1 PASS provider=xai, Test 2 N/A, Test 3/4 covered)
- [x] Phase 5 — Docs (ai-chats-map.md, ai-providers.md, SIMPLY_STATUS.md)
- [ ] Phase 6 — Atomic commit ← **TODO**

## Следующая сессия: начни с

1. Прочитать SPEC.md, ROADMAP.md, ANALYSIS.md (особенно код-ревью архитекторского ТЗ)
2. Если Phase 2 ещё не стартовала — дождаться OK владельца, затем удалять `lib/ai/vision-ocr.ts` и записи `vision:ocr` из `task-assignments.ts` (строки 22, 80, 237, 337, 416)

## В процессе

- Архитекторский SPEC переименован, аудит сделан до создания ТЗ-папки — результаты записаны в ANALYSIS.md, не повторять
- В рабочем дереве: `lib/ai/compaction/prepare-messages.ts` + `lib/ai/registry.ts` (PAYLOAD-DEBUG из ТЗ-SimplyChatBillingLeak) — **не трогать, не коммитить с этим ТЗ**

## Блокеры / Вопросы

- Нет.
