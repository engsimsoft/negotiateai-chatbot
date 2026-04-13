# HANDOFF — TZ_CreateSnapshotAudit

**Статус:** ✅ ЗАВЕРШЕНО в одну сессию (v3.87.3, 2026-04-14)
**Архив:** `_archive/TZ_CreateSnapshotAudit/`

## Резюме

Finding #8 из TZ_LegacyChatCleanup закрыт полным удалением мёртвой фичи createSnapshot + документированием стратегии context management в ADR 052.

**SQL audit показал:** 2 вызова tool за всю историю (оба через Sonnet-«Думать»), 0 из project task expert (ожидавшегося context), 1 из 2 упал с JSON parse error. Колонки `Chat.snapshots` + `Chat.contextState` фактически пусты (1/11 и 0/11).

## Что удалено

- 4 файла: `create-snapshot.ts`, `snapshot-creator.ts`, `snapshot-creator.md`, `snapshot-card.tsx`
- 4 DB queries: `addChatSnapshot`, `resetChatContextState`, `getChatWithSnapshotState`, `updateChatContextState`
- 2 schema types: `SnapshotMeta`, `ContextState`
- 2 DB columns: `Chat.snapshots`, `Chat.contextState` (migration 0054)
- Dead references в 8+ файлах (routes, UI components, chat-tools, debug-events, dev-panel, task-chat, task page, ai-tools docs, ai-chats-map, ai-agents, TOOLS_AUDIT)

## Что добавлено

- **ADR 052** — `docs/decisions/052-context-management-strategy-per-provider.md`
  - 4-уровневая стратегия: L1 Extract-on-compression (provider-agnostic) + L2 Anthropic Compaction (provider-specific) + L3 Sliding window 180K (provider-agnostic) + L4 Server-side compression middleware (planned)
  - Таблица защит × провайдеров
  - Future-proof план для multi-provider resilience (когда/если понадобится provider-agnostic compression)

## Ключевые файлы

- [lib/db/migrations/0054_drop-snapshot-columns.sql](lib/db/migrations/0054_drop-snapshot-columns.sql) — миграция (применена)
- [docs/decisions/052-context-management-strategy-per-provider.md](docs/decisions/052-context-management-strategy-per-provider.md) — ADR
- [CHANGELOG.md](CHANGELOG.md) раздел `[3.87.3]` — полное описание

## Не осталось незакрытых концов

- tsc ✅ 0 ошибок
- build ✅ exit 0, `Compiled successfully in 13.4s`, 61/61 static pages
- SQL verify ✅ 0 строк в `information_schema` для snapshots/contextState в Chat
- Smoke test ✅ user-confirmed («после перезагрузки страницы сообщения ушло»)
- Backlog ✅ обновлён (TZ_CreateSnapshotAudit в «Закрытые»)

## Lessons zafiksirovano

1. `npm run build` auto-runs migrations через pipeline `tsx lib/db/migrate && next build` — любая «валидация» через build = hard-to-reverse действие. Правило на будущее: **явно предупредить пользователя** прежде чем запускать build с pending schema changes
2. SQL audit > grep-based guessing — SPEC ожидал tool живым, данные опровергли
3. Multi-provider resilience — валидный концерн, но solution должен быть on-demand (ADR с планом), не insurance (dead tool «на всякий случай»)
4. Drizzle meta history broken (gap 29-53) — pre-existing, workaround через `--custom` flag. **Backlog item для будущего:** восстановить meta history
5. Dependency-ordered deletion (routes → components → tools → files → queries → schema → migration) минимизирует cascade errors в tsc
