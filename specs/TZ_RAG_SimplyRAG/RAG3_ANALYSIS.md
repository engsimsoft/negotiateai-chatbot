# Анализ ТЗ-RAG3: Compaction — Бесконечный чат

**Дата:** 2026-04-07
**Входной документ:** TZ_RAG3_COMPACTION_SPEC.md (концепт архитектора)

---

## Резюме

Заменить самодельную snapshot-систему (ТЗ-C1.5/C3) на Anthropic Compaction API (`compact_20260112`), который нативно поддерживается в `@ai-sdk/anthropic@3.0.66`. Удалить ~500 строк snapshot-кода (клерк, tool, UI, queries, context tracking). Добавить ~10 строк `providerOptions.anthropic.contextManagement` в два route handler'а.

---

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.
> Входной документ — концепт архитектора, не жёсткая спецификация.
> Финальные решения принимает разработчик на основе реального кода.

### Согласен с концептом

- **Полная замена snapshot, не fallback** — правильно. Два параллельных механизма = двойная сложность
- **`pauseAfterCompaction: false`** — верно. MIND retrieval инжектируется в system prompt ДО streamText, system prompt не сжимается
- **Trigger 100K** — разумный порог для 200K окна
- **Не удалять колонку `snapshots` из БД** — правильно, schema change отдельно
- **Включать только в длинных чатах** (chat, expertise, create, task-expert) — верно

### Рекомендую изменить

| # | Было (концепт) | Рекомендация | Обоснование из кода |
|---|---------------|--------------|-------------------|
| 1 | Список файлов неполный (5 удалить, 5 изменить) | **11 файлов на удаление/изменение** — полный список ниже | Grep по `snapshot\|SnapshotCard\|context-indicator\|contextState` выявил зависимости в 11+ файлах |
| 2 | `snapshot-divider.tsx` указан как отдельный файл | **Не существует** — `SnapshotDivider` экспортируется из `snapshot-card.tsx` | `Glob("**/snapshot-divider*")` → 0 результатов |
| 3 | Оценка "Простое (1-2 сессии)" | **Среднее (2-3 сессии)** — удаление snapshot-кода из 11 файлов с нетривиальной логикой (dimming, boundary detection, fallback injection, sidebar "Итоги") | `chat/route.ts` содержит ~80 строк snapshot-логики, `messages.tsx` — сложную boundary detection |
| 4 | Cost tracking через `usage.iterations` — "проверить наличие" | **Конкретный план:** SDK маппит iterations через `AnthropicMessageMetadata`. Доступ в `onStepFinish` через `response.providerMetadata?.anthropic?.iterations` | `node_modules/@ai-sdk/anthropic/dist/index.mjs:1645` — SDK суммирует iterations автоматически для основного usage. Нужно только для DevPanel breakdown |
| 5 | Нет упоминания `getMessagesByChatId` с `maxTokens: 140000` | **Убрать sliding window в `getMessagesByChatId`** — Compaction сам управляет контекстом, загрузка всех сообщений чата допустима | `lib/db/queries.ts:412` — сейчас грузит последние N сообщений до 140K токенов, это дублирует функцию Compaction |
| 6 | Нет упоминания `data-context-usage` stream event | **Удалить** — `chat.tsx:242` слушает `data-context-usage` → `setContextPercent`. Без ContextIndicator — не нужен | `chat/route.ts` эмитит этот event, `chat.tsx:242` обрабатывает |
| 7 | Нет упоминания `chat.tsx` изменений | **Удалить ContextIndicator из chat.tsx** — state (`contextPercent`), `data-context-usage` handler, JSX `<ContextIndicator>` | `components/chat.tsx:103,244,470` |
| 8 | Нет упоминания `task-chat.tsx` ContextIndicator | **task-chat.tsx тоже использует ContextIndicator** — нужно убрать | `components/projects/task-chat.tsx:28` импортирует ContextIndicator |

### Требует уточнения

Нет открытых вопросов — все технические детали проверены в коде.

---

## Верификация compaction blocks persistence (ключевой технический риск)

Проверил цепочку сохранения compaction blocks в SDK:

1. **API → SDK response parser** (`index.mjs:3878`): Anthropic возвращает `type: "compaction"`, SDK конвертирует в text part с `providerMetadata: { anthropic: { type: "compaction" } }`
2. **SDK UI message stream** (`index.mjs:5435,5449`): `providerMetadata` сохраняется на text parts: `textPart.providerMetadata = chunk.providerMetadata`
3. **Наш onFinish** (`chat/route.ts:1047-1051`): Фильтр оставляет `type === 'text'` — compaction blocks пройдут (они text parts)
4. **saveMessages** (`queries.ts:402-407`): Сохраняет `parts` как JSONB — `providerMetadata` сериализуется
5. **При загрузке** (`convertToModelMessages`): SDK маппит `part.providerMetadata` → `providerOptions` (`index.mjs:3958,8356`), затем Anthropic provider читает `providerOptions.anthropic.type === "compaction"` и конвертирует обратно в `{ type: "compaction", content: text }` (`index.mjs:2335`)

**Вывод:** Цепочка замкнута. Compaction blocks будут корректно сохраняться и восстанавливаться. Но нужно убедиться что наш `filteredParts` в onFinish не теряет `providerMetadata` при копировании (сейчас parts проходят as-is через `.filter()` — OK, filter не мутирует объекты).

---

## Полный список затронутых файлов

### Удалить (6 файлов)

| Файл | Строк | Назначение |
|------|-------|-----------|
| `lib/ai/clerks/snapshot-creator.ts` | ~211 | Fallback-клерк суммаризации |
| `lib/ai/tools/create-snapshot.ts` | ~122 | Tool вызываемый Expert'ом |
| `lib/prompts/clerks/snapshot-creator.md` | ? | Промпт клерка |
| `lib/ai/context-limits.ts` | ~25 | CONTEXT_BUDGET, SNAPSHOT_THRESHOLD, calcUsagePercent |
| `components/projects/snapshot-card.tsx` | ~118 | SnapshotCard + SnapshotDivider UI |
| `components/projects/context-indicator.tsx` | ~65 | Progress bar контекста |

### Изменить (11 файлов)

| Файл | Что убрать | Что добавить |
|------|-----------|-------------|
| `app/(chat)/api/chat/route.ts` | Snapshot imports, getChatWithSnapshotState, snapshot trimming, context-usage event, fallback creation, updateChatContextState (~80 строк) | `providerOptions.anthropic.contextManagement` (~10 строк) |
| `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` | Аналогичная snapshot-логика (~70 строк) | `providerOptions.anthropic.contextManagement` (~10 строк) |
| `lib/ai/tools/chat-tools.ts` | Import и регистрация `createSnapshot` в toolbox | — |
| `lib/db/queries.ts` | 4 функции: getChatWithSnapshotState, addChatSnapshot, updateChatContextState, resetChatContextState (~100 строк) | — |
| `components/message.tsx` | Import SnapshotCard/SnapshotDivider, рендер tool-createSnapshot | — |
| `components/messages.tsx` | Import SnapshotDivider, snapshot boundary detection, message dimming, fallback divider rendering (~60 строк) | — |
| `components/chat-sidebar.tsx` | Snapshot extraction в useExtractedMaterials, секция "Итоги" (~40 строк) | — |
| `components/chat.tsx` | `contextPercent` state, `data-context-usage` handler, `<ContextIndicator>` JSX | — |
| `components/projects/task-chat.tsx` | Import ContextIndicator, snapshots prop, ContextIndicator JSX | — |
| `app/(task)/projects/[id]/tasks/[taskId]/page.tsx` | `chat.snapshots` prop passing | — |
| `lib/ai/debug-events.ts` | — | `DebugCompactionData` тип, `emitDebugCompaction()` |

### Новые файлы

Нет. Compaction — это конфиг в providerOptions + удаление старого кода.

---

## Ключевое архитектурное решение: sliding window

**Текущее:** `getMessagesByChatId()` грузит последние сообщения до `maxTokens: 140000`. Это наш самодельный sliding window.

**С Compaction:** API сам решает что сжимать при `input_tokens > trigger`. Но мы всё равно не можем грузить ВСЕ сообщения чата — чат на 1000 сообщений = гигабайты в JSONB.

**Решение:** Оставить `getMessagesByChatId` с `maxTokens`, но:
- Увеличить `maxTokens` до разумного лимита (например, 180K — почти всё окно 200K)
- Compaction сработает если сумма input превысит trigger
- Это НЕ дублирование — это protection against DB overload

Альтернатива: убрать `maxTokens` лимит и грузить все сообщения. Но тогда чат на 500 сообщений будет тяжёлой DB-операцией. Не рекомендую.

---

## Потенциальные риски

| Риск | Вероятность | Митигация |
|------|------------|-----------|
| Compaction blocks не сохраняются в DB | Низкая (проверено в SDK коде) | Этап 1: включить compaction, проверить в DevPanel что blocks есть |
| Compaction Beta нестабильна | Низкая (SDK v3.0.66 уже поддерживает) | Поэтапное включение: сначала добавить, потом удалить snapshot |
| Message dimming сломается при удалении | Нет (удаляем полностью) | Dimming = artifact snapshot-системы, без неё не нужен |
| UI "Итоги" в sidebar пропадёт | Намеренно | MIND Memory заменяет эту функцию — факты хранятся в pgvector |

---

## Оценка сложности

- [ ] Простое (1-2 сессии)
- [x] Среднее (2-3 сессии)
- [ ] Сложное (5+ сессий)

**Обоснование:** Добавление Compaction тривиально (~10 строк). Основной объём — аккуратное удаление snapshot-кода из 11 файлов с проверкой что ничего не сломалось. DevPanel integration + cost tracking = дополнительная сессия.

---

## Рекомендуемая последовательность этапов

1. **Этап 1: Включить Compaction** — добавить providerOptions в два route handler'а, DevPanel badge. НЕ удалять snapshot-код. Протестировать что compaction blocks сохраняются.
2. **Этап 2: Удалить snapshot-систему** — удалить все 6 файлов, очистить 11 файлов от snapshot-логики. Убрать ContextIndicator, dimming, "Итоги".
3. **Этап 3: Cost tracking + Финализация** — iterations parsing для DevPanel, документация, ADR.
