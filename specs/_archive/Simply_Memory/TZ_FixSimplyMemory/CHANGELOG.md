# Changelog ТЗ-A.2: FIX-SIMPLY-MEMORY

## Сессия 1 — 2026-04-27

### Fixed
- Simply Chat больше не теряет память между turns. Убран фильтр `excludeExtracted: isSimplyChat` в `getMessagesByChatId` (route.ts:596). История = primary source, MIND = augmentation.

### Changed
- `maxTokens` для Simply 180000 → 140000 (унификация с другими chatMode, оставляем ~60K на system + tools + MIND + new + response).
- `CompactionContext` расширен полем `alreadyExtractedIds?: Set<string>` (lib/ai/compaction/types.ts).
- Pre-compact extract в Compaction middleware фильтрует `split.toCompact` по `alreadyExtractedIds` — если все extracted, extract step скипается полностью (нет дубликатного Grok-вызова).
- Лог `[Compaction] pre-compact-extract` расширен полем `skipped:N` для observability.

### Validated
- tsc=0 после Этапов 1+2.
- pnpm build успешен.
- Мануальный тест на чате `3353a183-...` (192 сообщения): модель перечислила все 7 артефактов сессии с ID. До фикса — амнезия.

### Measurements (FINDINGS.md)
- До фикса: 7 156 input tokens, ₽0.15/turn, амнезия.
- После фикса: 82 712 input tokens, ₽1.68/turn, помнит всё.
- Compaction в этом чате noop (82K < Soft 100K) — нормальное поведение.

### Files
- app/(chat)/api/chat/route.ts
- lib/ai/compaction/types.ts
- lib/ai/compaction/prepare-messages.ts
- CHANGELOG.md (главный)
- SIMPLY_STATUS.md
- package.json (3.99.3 → 3.100.0)
- specs/_backlog/TRIAGE.md (A.2 ✅)
- specs/_backlog/TZ_SimplyChatMemoryRegression.md (удалён)
