# ADR 042: Compaction API — dual strategy (snapshot + compaction)

**Дата:** 2026-04-07
**Статус:** Accepted
**ТЗ:** RAG-3

## Контекст

Simply использовала самодельную snapshot-систему (ТЗ-C1.5/C3) для управления контекстным окном: клерк Haiku суммаризирует историю, результат сохраняется в `Chat.snapshots[]`. Anthropic выпустил Compaction API (`compact_20260112`) — нативную серверную суммаризацию контекста.

## Решение

**Dual strategy:** Compaction для Sonnet/Opus, snapshot для Haiku.

Причина: **Haiku 4.5 не поддерживает Compaction API.** Только Sonnet 4.6 и Opus 4.6.

### Где что используется

| Модель | chatMode | Контекст-менеджмент |
|--------|----------|-------------------|
| Haiku 4.5 | `chat` | Snapshot (legacy) |
| Sonnet 4.6 | `expertise`, `create` | Compaction API |
| Sonnet/Opus | project tasks | Compaction API |

### Compaction конфиг

```typescript
providerOptions: {
  anthropic: {
    contextManagement: {
      edits: [{
        type: 'compact_20260112',
        trigger: { type: 'input_tokens', value: 100_000 },
        pauseAfterCompaction: false,
        instructions: '...' // русский, что сохранять/удалять
      }]
    }
  }
}
```

### Синергия с MIND

MIND extract работает в `onFinish` — факты извлекаются ДО следующего compaction. MIND retrieval инжектируется в system prompt ДО `streamText` — system prompt не сжимается. Значит compaction не теряет MIND-контекст.

## Альтернативы

1. **Полная замена snapshot → compaction** — невозможно, Haiku не поддерживает
2. **Переключить chat на Sonnet** — дороже в ~10x, обычный чат = 90% трафика
3. **Оставить snapshot везде** — теряем нативное качество Anthropic для Sonnet/Opus

## Последствия

- Snapshot-файлы (клерк, tool, UI) остаются в проекте
- Snapshot-логика в `chat/route.ts` обёрнута в `if (chatMode === "chat")`
- Task chat route полностью очищен от snapshot
- ContextIndicator показывается только для Haiku-чатов
- При будущей поддержке Compaction в Haiku — можно удалить snapshot полностью
