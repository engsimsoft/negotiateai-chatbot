# ТЗ-RAG3: Compaction — Бесконечный чат

**Версия:** 1.0
**Дата:** 2026-04-07
**Статус:** К разработке
**Основа:** [SIMPLY_RAG_UNIFIED_CONCEPT.md], [PHASES.md] — RAG-3
**Версия проекта:** после RAG-2 → следующая версия

---

## Контекст

Simply использует самодельную snapshot-систему (ТЗ-C3) для управления контекстным окном: когда чат приближается к лимиту, Claude Haiku (клерк) суммаризирует историю, результат сохраняется в `snapshots: jsonb`. Это работает, но:

- Haiku теряет нюансы при суммаризации
- Наш код считает токены приблизительно, Anthropic знает точно
- Snapshot блокирует ответ пользователю
- Нет возможности инжектировать MIND-контекст после сжатия
- Много кода: snapshot-creator, context-limits, context-indicator, snapshot-card

Anthropic выпустил Compaction API (`compact-2026-01-12`) — серверная суммаризация контекста. **Vercel AI SDK уже поддерживает нативно** через `providerOptions.anthropic.contextManagement`. Работает с Opus 4.6 и Sonnet 4.6.

**Решение:** Полностью заменить snapshot-систему на Compaction. Не fallback, не dual mode — полная замена. До продакшена месяцы работы, к тому времени Compaction будет стабильным. Даже beta Anthropic качественнее нашего самодельного решения.

---

## Цель

Бесконечный разговор без «начните новый чат». Пользователь пишет — система сама управляет контекстом. Никаких уведомлений, никаких кнопок «сжать историю».

---

## Scope

### Что входит

1. **Compaction API** — включить через `providerOptions.anthropic.contextManagement` в streaming routes
2. **Удаление snapshot-системы** — полная очистка: клерк, UI, логика, константы
3. **Синергия с MIND** — `pauseAfterCompaction` для инжекции фактов после сжатия
4. **Dev Panel** — показать compaction events
5. **Cost tracking** — compaction tokens в `ai_usage_log`

### Что НЕ входит

- Изменение MIND extract/retrieve (RAG-1, уже работает)
- Консолидация и Opus-профиль (RAG-2, в работе)
- Библиотека (RAG-4)

---

## Техническая реализация

### 1. Включить Compaction в streaming routes

Vercel AI SDK поддерживает Compaction нативно. Не нужен прямой вызов `@anthropic-ai/sdk`.

```typescript
// В streamText вызовах — добавить providerOptions
const result = streamText({
  model: claudeModel,
  messages,
  providerOptions: {
    anthropic: {
      contextManagement: {
        edits: [{
          type: 'compact_20260112',
          trigger: { type: 'input_tokens', value: 100000 },
          instructions: 'Сохрани обязательно: имена людей, даты, принятые решения, числа и суммы, контекст проекта, незавершённые задачи. Удали: повторяющиеся приветствия, формальности, промежуточные рассуждения которые привели к уже зафиксированному результату.',
          pauseAfterCompaction: false,  // см. секцию "Синергия с MIND"
        }]
      }
    }
  },
  // ... остальные параметры без изменений
});
```

**Где включить:**
- `app/(chat)/api/chat/route.ts` — основной чат (chat, expertise, create)
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — project task chats

**Где НЕ включать:**
- `app/(chat)/api/ben/route.ts` — короткие сессии, не нужно
- Service chats (project-creation, project-manager) — короткие, не нужно

### 2. Trigger — порог токенов

| Модель | Контекстное окно | Trigger (рекомендация) |
|--------|-----------------|----------------------|
| Haiku (chatMode: chat) | 200K | 100,000 |
| Sonnet (chatMode: expertise, create) | 200K | 100,000 |
| Sonnet (task-expert) | 200K | 100,000 |

Trigger на 100K — Compaction сжимает первую половину контекста, оставляя 100K для продолжения. Достаточный запас.

Примечание: Opus 4.6 и Sonnet 4.6 поддерживают до 1M контекст, но 200K — стандарт без доплаты. 1M требует beta-заголовок и повышенный pricing. Для MVP: 200K окно, trigger на 100K.

### 3. Instructions — что сохранять при сжатии

```
Сохрани обязательно:
- Имена людей и организаций
- Даты, дедлайны, временные рамки
- Принятые решения и их обоснования
- Числа, суммы, метрики
- Контекст текущего проекта/задачи
- Незавершённые задачи и открытые вопросы
- Предпочтения и стиль пользователя

Удали:
- Повторяющиеся приветствия и формальности
- Промежуточные рассуждения, если итог уже зафиксирован
- Дублирующуюся информацию
- Технические детали инструментов (tool calls), если результат уже в контексте
```

Для project task chats — добавить: «Сохрани контекст задачи, связь с планом проекта, результаты предыдущих шагов.»

### 4. Compaction blocks — критический нюанс сохранения

**AI SDK обрабатывает compaction blocks автоматически.** Они приходят как text parts с `providerMetadata`. При использовании `useChat` / `createUIMessageStream` — блоки сохраняются корректно в message parts.

**Что нужно проверить при реализации:**
- Как `saveMessages()` в наших route handlers сохраняет compaction blocks в БД
- Compaction block — это `type: "text"` с `providerMetadata.anthropic.compaction = true`
- При загрузке истории чата (`getMessagesByChat`) — compaction blocks должны возвращаться как часть messages
- **Нельзя фильтровать** compaction blocks при загрузке — API использует их для замены старой истории

### 5. Синергия с MIND (RAG-1)

MIND extract (RAG-1) работает в `onFinish` — после каждого ответа Sonnet извлекает факты. Это происходит ДО compaction следующего запроса. Значит: даже если Compaction сожмёт разговор и потеряет деталь — факт уже сохранён в pgvector навсегда.

**`pauseAfterCompaction`:** В текущей реализации — `false`. MIND retrieval уже происходит ДО streamText (RAG-1 inject). Если compaction сработает внутри запроса, MIND-контекст уже инжектирован в system prompt и не будет затронут сжатием (system prompt не сжимается).

Если в будущем понадобится дополнительная инжекция ПОСЛЕ сжатия — включить `pauseAfterCompaction: true` и добавить логику повторного retrieval. Но для текущей архитектуры это избыточно.

### 6. Удаление snapshot-системы

**Удалить файлы:**
- `lib/ai/clerks/snapshot-creator.ts` — клерк-суммаризатор
- `lib/prompts/clerks/snapshot-creator.md` — промпт клерка
- `components/projects/snapshot-card.tsx` — UI карточка snapshot
- `components/projects/snapshot-divider.tsx` — UI разделитель (если существует)

**Удалить/упростить:**
- `lib/ai/context-limits.ts` — убрать `SNAPSHOT_THRESHOLD`, `CONTEXT_BUDGET`. Оставить только если есть другие константы, используемые вне snapshot-логики
- `components/projects/context-indicator.tsx` — убрать индикатор заполненности контекста (Compaction управляет этим автоматически)

**Очистить route handlers:**
- `app/(chat)/api/chat/route.ts` — убрать всю snapshot-логику: проверку порога, вызов snapshot-creator, обрезку сообщений, подстановку snapshot в начало
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — аналогично

**НЕ удалять (пока):**
- Колонку `snapshots: jsonb` в таблице `chat` — удаление колонки БД отдельной миграцией позже. Код перестаёт её использовать, но данные остаются

### 7. Dev Panel — compaction events

Добавить отображение compaction events в Dev Panel.

**Как определить compaction:**
- В AI SDK streaming — `providerMetadata` на text parts содержит информацию о compaction
- Или отслеживать через `onFinish` — проверить `response.providerMetadata`

**Что показать в Dev Panel:**
- Факт compaction (да/нет) — badge «Compaction» если сработал
- Количество сжатых токенов (было → стало)
- Если нет compaction в этом запросе — не показывать ничего (чисто)

**Файлы:**
- `lib/ai/debug-events.ts` — добавить `DebugCompactionData` тип, `emitDebugCompaction()` функция
- `components/dev-panel/sections/` — добавить compaction info в существующую секцию или как отдельный badge

### 8. Cost tracking

Compaction tokens считаются отдельно от основного запроса. Из документации Anthropic:

> The top-level `input_tokens` and `output_tokens` in the usage field do not include compaction iteration usage. To calculate the total tokens consumed, sum across all entries in `usage.iterations` array.

**Что нужно:**
- В `onFinish` / `onStepFinish` — проверить наличие `usage.iterations`
- Если iterations есть — суммировать все токены (основные + compaction)
- Логировать через существующий `logUsage()` с chatMode текущего чата
- Compaction tokens — это дополнительный расход, должен отражаться в DevPanel cost breakdown

---

## Согласованные решения

1. **Полная замена snapshot, не fallback.** До продакшена месяцы работы. Beta Anthropic > наш самодельный код. Не держим два параллельных механизма.
2. **Trigger: 100K input tokens.** Запас для 200K окна.
3. **`pauseAfterCompaction: false`** для текущей архитектуры. MIND retrieval уже в system prompt до streamText.
4. **Instructions на русском** — пользователи пишут по-русски, модель должна понимать контекст сохранения.
5. **Колонку `snapshots` не удаляем** — просто перестаём использовать. Миграция на удаление — отдельно.
6. **Compaction включаем только в длинных чатах** — chat, expertise, create, task-expert. Не в ben, не в service chats.

---

## Файлы

### Удаляемые
- `lib/ai/clerks/snapshot-creator.ts`
- `lib/prompts/clerks/snapshot-creator.md`
- `components/projects/snapshot-card.tsx`
- `components/projects/snapshot-divider.tsx` (если существует)
- `components/projects/context-indicator.tsx`

### Изменяемые
- `app/(chat)/api/chat/route.ts` — убрать snapshot-логику, добавить `providerOptions.anthropic.contextManagement`
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — аналогично
- `lib/ai/context-limits.ts` — убрать SNAPSHOT_THRESHOLD, CONTEXT_BUDGET (или удалить файл если пуст)
- `lib/ai/debug-events.ts` — добавить compaction debug event
- `components/dev-panel/` — показать compaction events

### Новые
- Нет новых файлов. Compaction — это ~10 строк в `providerOptions` + удаление старого кода.

---

## Верификация

| # | Проверка | Как |
|---|---------|-----|
| 1 | Compaction срабатывает | Отправить 50+ длинных сообщений, проверить в Dev Panel что compaction сработал |
| 2 | Чат продолжается после compaction | После сжатия модель помнит контекст, отвечает релевантно |
| 3 | MIND извлекает факты до compaction | Проверить что факты из начала длинного чата есть в `memory_entry` |
| 4 | Snapshot-код удалён | Grep по проекту: нет импортов snapshot-creator, нет SNAPSHOT_THRESHOLD |
| 5 | Dev Panel показывает compaction | Badge/info видна когда compaction произошёл |
| 6 | Cost tracking корректен | В ai_usage_log — compaction tokens учтены |
| 7 | Короткие чаты не затронуты | Ben, service chats — работают без providerOptions.contextManagement |
| 8 | Instructions работают | После compaction модель помнит имена, даты, решения из начала чата |

---

## Оценка сложности

- [x] Простое (1-2 сессии)
- [ ] Среднее (3-5 сессий)
- [ ] Сложное (5+ сессий)

Основная работа — удаление старого кода (snapshot-система). Добавление Compaction — ~10 строк providerOptions. Ключевой риск: как AI SDK сохраняет compaction blocks в message parts — нужно проверить при реализации.
