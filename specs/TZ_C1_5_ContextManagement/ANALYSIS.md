# Анализ ТЗ-C1.5: Управление контекстным окном (авто-итог)

**Дата анализа:** 2026-02-11
**Ревизия:** v2 (после код-ревью синьора)

---

## Резюме

Реализация системы мониторинга контекстного окна + автоматического создания snapshot для длинных диалогов в TaskChat. При заполнении 70% рабочего бюджета (140K токенов) Эксперт предлагает зафиксировать прогресс. Snapshot заменяет историю для модели, пользователь видит всё. Fallback-клерк подстраховывает если модель проигнорирует сигнал.

Скоуп: 4 этапа + финализация. Production-ready фича.

---

## Ключевые решения

### Из обсуждения с архитектором (v1)

1. **`parts` формат** — Snapshot данные хранятся в `parts[]` (консистентно с Message_v2)
2. **Snapshot поверх sliding window** — Sliding window (140K) не убираем — страховочная сетка
3. **Порог 70% от рабочего бюджета** — 70% от 140K (~98K), не от лимита модели (1M)
4. **Stateless route → Chat JSONB** — `contextState` хранится в Chat
5. **ContextIndicator** — Прямо в task-chat.tsx, изолированно
6. **shortSummary** — Tool получает как параметр; клерк генерирует сам

### Ревизия синьора (v2) — отклонения от ТЗ

| # | Было (ТЗ) | Стало | Почему |
|---|-----------|-------|--------|
| 1 | Fallback отложен | **Включён в Этап 2** | ~100 строк по паттерну task-summarizer. Без него — failure mode в проде |
| 2 | `isSnapshot` колонка в Message_v2 | **Убрана** | Избыточна — `Chat.snapshots[].messageId` достаточно |
| 3 | Snapshot = отдельное Message | **Snapshot = tool call в assistant message** | Нет timing issues, автоматически в UI через стрим |
| 4 | Usage tracking в `onFinish` | **Estimated ДО стриминга из DB** | `onFinish` + `dataStream.write()` = timing risk |

---

## Архитектура snapshot (v2)

### Что хранится где

```
Chat.snapshots[] = [
  { messageId: "uuid-of-assistant-msg", createdAt: "ISO", summary: "short text" }
]

Chat.contextState = { suggestionActive: true, messagesSinceSuggestion: 3 }

Assistant Message.parts[] = [
  { type: "text", text: "Давайте зафиксируем..." },
  { type: "tool-call", toolCallId: "...", toolName: "createSnapshot", args: {...} },
  { type: "tool-result", toolCallId: "...", result: "Итог зафиксирован..." }
]
```

### Что видит модель (после snapshot)

```
system_prompt
  + <previous_context>{fullMarkdown}</previous_context>
  + <project_passport>...</project_passport>
  + <current_task>...</current_task>
  + <previous_summaries>...</previous_summaries>
+ messages ПОСЛЕ snapshot (включая snapshot message)
```

### Что видит пользователь

```
[msg1..msg50] — opacity-60 (приглушены)
[SnapshotCard] — карточка с expand/collapse
────────── 📋 Контекст обновлён ──────────
[msg51..msgN] — нормальная opacity
[ContextIndicator] — полоска под инпутом
```

---

## Потенциальные риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Модель не вызывает createSnapshot | Средняя | Среднее | Системный сигнал + **fallback-клерк** (5 пар → авто) |
| Snapshot слишком краткий / неполный | Низкая | Высокое | Structured params в tool |
| Race condition при обновлении contextState | Низкая | Низкое | JSONB update атомарный в PostgreSQL |
| Estimated usage неточный | Низкая | Низкое | Апроксимация достаточна для порога. tokenCount в DB + estimateMessageTokens fallback |
| Tool call parts не сохраняются | Средняя | Высокое | Добавить `"tool-createSnapshot"` в фильтр onFinish |

---

## Затронутые компоненты

**Модификация:**
- `lib/db/schema.ts` — 2 новых поля в Chat
- `lib/db/queries.ts` — 4 новых функции
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — snapshot loading, usage, signal, fallback
- `lib/ai/tools/chat-tools.ts` — регистрация createSnapshot + chatId param
- `lib/prompts/build-task-expert-prompt.ts` — блок `<previous_context>`
- `components/projects/task-chat.tsx` — ContextIndicator, onData handler
- `components/messages.tsx` — приглушение, разделитель
- `components/message.tsx` — обнаружение snapshot tool call

**Новые файлы:**
- `lib/ai/context-limits.ts` — конфиг бюджетов и утилиты
- `lib/ai/tools/create-snapshot.ts` — tool createSnapshot
- `lib/ai/clerks/snapshot-creator.ts` — fallback клерк
- `lib/prompts/clerks/snapshot-creator.md` — промпт клерка
- `components/projects/snapshot-card.tsx` — UI карточка snapshot
- `components/projects/context-indicator.tsx` — полоска под инпутом
- `drizzle/XXXX_snapshot_fields.sql` — миграция

---

## Оценка

- [ ] Простое (1-2 сессии)
- [x] Среднее (3-4 сессии)
- [ ] Сложное (5+ сессий)

**Обоснование:** 4 этапа. Fallback добавляет ~1-2 часа (паттерн task-summarizer). Основная сложность — интеграция snapshot в message flow (route + prompt builder + UI). Каждый этап изолированный, валидируемый.
