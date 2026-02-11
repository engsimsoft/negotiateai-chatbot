# ТЗ-C1.5: Управление контекстным окном (авто-итог)

**Версия:** 1.0  
**Дата:** 2026-02-11  
**Зависимости:** C1 (ExpertTaskChat) ✅, C2 (TaskCompletion) ✅  
**Вдохновение:** Claude Code context summarization, VS Code Copilot shaded bar  

---

## Цель

Пользователь работает над задачей в чате с Экспертом. Диалог растёт, контекстное окно заполняется, качество ответов деградирует. Пользователь этого не понимает — думает «AI стал хуже работать».

**Решение:** Мониторинг заполнения контекста → мягкое предложение зафиксировать прогресс → snapshot заменяет историю для модели → чистый контекст, работа продолжается. Пользователь видит всю историю, модель — только snapshot + новые сообщения.

**Референс:** Claude Code при исчерпании контекста автоматически создаёт summary предыдущей сессии — компактный блок с кнопкой "Show more". Мы делаем то же самое, но проактивно (до исчерпания) и user-friendly.

---

## Что делаем

### 1. Мониторинг токенов (серверная сторона)

**Где:** API route чата с Экспертом (`/api/projects/[id]/tasks/[taskId]/chat/route.ts`)

**Как:** Gemini / Claude API возвращает `usage` в каждом ответе (totalTokens или input_tokens + output_tokens). Server route вычисляет процент заполнения и передаёт на клиент через dataStream annotation.

```typescript
// После получения ответа от модели
const usagePercent = Math.round((usage.totalTokens / MODEL_CONTEXT_LIMIT) * 100);

dataStream.writeMessageAnnotation({
  type: 'context_usage',
  percent: usagePercent,
  tokens: usage.totalTokens,
  limit: MODEL_CONTEXT_LIMIT
});
```

**Лимиты моделей** — конфиг, не хардкод:
```typescript
const CONTEXT_LIMITS: Record<string, number> = {
  'gemini-3-pro': 1_000_000,      // 1M
  'gemini-2.5-flash': 1_000_000,  // 1M  
  'claude-sonnet': 200_000,        // 200K
  'claude-opus': 200_000,          // 200K
};
```

> **Примечание для Claude Code:** Конкретные значения лимитов могут быть неточными — сверься с актуальной документацией провайдеров и обнови конфиг. Важна архитектура (конфиг), а не конкретные числа.

**Системный сигнал при пороге 70%:**

Когда `usagePercent >= 70` И snapshot ещё не предлагался в этой серии сообщений → инжектируем в system prompt дополнительную инструкцию:

```
[SYSTEM: Контекстное окно заполнено на {X}%. Мягко предложи пользователю зафиксировать прогресс. Не навязывай — предложи. Если пользователь согласится, вызови tool createSnapshot.]
```

Флаг `snapshotSuggested` хранится в памяти route (не в БД) — сбрасывается после создания snapshot.

---

### 2. Визуальный индикатор контекста (клиент)

**Компонент:** `ContextIndicator` — тонкая полоска (2-3px) под полем ввода сообщения.

**Три состояния:**

| Диапазон | Цвет | Текст | Поведение |
|----------|------|-------|-----------|
| 0-60% | `muted-foreground/20` | Нет | Почти невидимая, не отвлекает |
| 60-80% | `amber-500` | `{X}%` | Появляется процент справа |
| 80-100% | `orange-500` | `{X}%` | Мягкий пульс (`animate-pulse`), Эксперт уже предложил итог |

**Hover/tap → tooltip:**
```
Контекст диалога
━━━━━━━━━━░░░  72%

~36K из ~50K слов
Сообщений: 47

💡 Зафиксируйте итог
   чтобы освободить место
```

> Tooltip — для заинтересованных. Основной UI — только полоска и процент. Для аудитории 40-60+ никаких "токенов" — используем "контекст диалога" или просто процент.

**Данные:** компонент читает annotation `context_usage` из последнего сообщения через `useChat` callback. Хранит в `useState`.

**Где используется:** В MVP — только в чате задач (`TaskChat`). Архитектурно компонент универсальный, позже подключим к основному чату и другим.

---

### 3. Tool `createSnapshot`

**Регистрация:** В `getStandardTools()` (chat-tools.ts) — добавляется когда `isProjectChat === true`.

```typescript
createSnapshot: tool({
  description: 'Зафиксировать итог текущей работы. Вызывай когда пользователь согласился зафиксировать прогресс, или когда контекстное окно заполнено и нужно освободить место.',
  parameters: z.object({
    decisions: z.array(z.string()).describe('Принятые решения'),
    currentState: z.string().describe('Где остановились — текущее состояние работы'),
    artifacts: z.array(z.string()).describe('Созданные файлы и документы'),
    openQuestions: z.array(z.string()).describe('Нерешённые вопросы'),
    nextSteps: z.array(z.string()).describe('Что делать дальше'),
  }),
  execute: async (params) => {
    // 1. Формирует Markdown из params
    // 2. Создаёт Message (role: 'assistant', isSnapshot: true)
    // 3. Обновляет Chat.snapshots[]
    // 4. Возвращает подтверждение
  }
})
```

**Что делает execute:**

1. Собирает structured JSON из параметров
2. Генерирует два формата:
   - `shortSummary` — 2-3 предложения (для компактной карточки в чате)
   - `fullMarkdown` — полный Markdown с секциями (для раскрытия по кнопке "Подробнее")
3. Создаёт `Message` с `role: 'assistant'`, `isSnapshot: true`, `content` содержит JSON:
```json
{
  "type": "snapshot",
  "index": 1,
  "shortSummary": "Выбрана стратегия X, создана таблица сравнения конкурентов. Осталось доработать финансовую модель.",
  "decisions": ["Стратегия X", "Ценообразование: модель Y"],
  "currentState": "Финансовая модель в процессе",
  "artifacts": ["Таблица сравнения конкурентов", "Черновик ценовой политики"],
  "openQuestions": ["Согласовать скидочную политику"],
  "nextSteps": ["Доработать финансовую модель", "Финализировать презентацию"],
  "fullMarkdown": "## Итог работы\n\n### Решения\n- Выбрана стратегия X\n..."
}
```
4. Добавляет указатель в `Chat.snapshots[]`:
```json
{ "messageId": "uuid", "createdAt": "ISO", "summary": "shortSummary text" }
```
5. Возвращает модели: `"Итог зафиксирован. Продолжаем работу — контекст обновлён."`

**shortSummary формируется моделью** — tool получает structured данные, а краткую сводку модель пишет сама в описании tool call (перед вызовом). Альтернативно: генерируем shortSummary из первых элементов decisions + currentState автоматически.

---

### 4. Рендеринг snapshot в чате (компактная карточка)

**Референс: Claude Code** — сжатый блок с серым фоном и кнопкой "Show more".

**Компонент:** `SnapshotCard` — рендерится вместо обычного сообщения когда `message.isSnapshot === true`.

**Дизайн — два состояния:**

**Состояние 1: Свёрнуто (по умолчанию)**
```
┌─────────────────────────────────────────────────┐
│ 📋 Итог зафиксирован                            │
│                                                 │
│ Выбрана стратегия X, создана таблица сравнения  │
│ конкурентов. Осталось доработать финансовую      │
│ модель.                                         │
│                                        [Подробнее] │
└─────────────────────────────────────────────────┘
```

- Фон: `muted` (серый, как у Claude Code)
- Иконка: 📋 или `FileText` из lucide
- Текст: `shortSummary` (2-3 предложения)
- Кнопка: "Подробнее" / "Свернуть" (toggle)

**Состояние 2: Развёрнуто (после клика "Подробнее")**
```
┌─────────────────────────────────────────────────┐
│ 📋 Итог зафиксирован                            │
│                                                 │
│ Выбрана стратегия X, создана таблица сравнения  │
│ конкурентов. Осталось доработать финансовую      │
│ модель.                                         │
│                                                 │
│ ── Решения ──                                   │
│ • Выбрана стратегия X                           │
│ • Ценообразование: модель Y                     │
│                                                 │
│ ── Создано ──                                   │
│ • Таблица сравнения конкурентов                  │
│ • Черновик ценовой политики                      │
│                                                 │
│ ── Открытые вопросы ──                          │
│ • Согласовать скидочную политику                 │
│                                                 │
│ ── Следующие шаги ──                            │
│ • Доработать финансовую модель                   │
│ • Финализировать презентацию                     │
│                                        [Свернуть] │
└─────────────────────────────────────────────────┘
```

**Реализация:** Парсим `message.content` как JSON, проверяем `type === 'snapshot'`. Для рендеринга fullMarkdown используем существующий `MarkdownViewer`.

**Визуальный разделитель:** После snapshot-карточки — тонкая горизонтальная линия с текстом по центру:

```
────────── 📋 Контекст обновлён ──────────
```

Сообщения ДО разделителя визуально приглушаются (opacity: 0.6). Это подсказка пользователю что модель "помнит" только то что после разделителя + сам snapshot.

---

### 5. Сброс контекста (API route)

**Где:** В route handler чата задачи, при формировании массива `messages` для отправки модели.

**Логика:**

```typescript
async function buildMessagesForModel(chatId: string, allMessages: Message[]) {
  const chat = await getChatById(chatId);
  
  if (chat.snapshots?.length > 0) {
    const lastSnapshot = chat.snapshots[chat.snapshots.length - 1];
    const snapshotMessage = allMessages.find(m => m.id === lastSnapshot.messageId);
    
    if (snapshotMessage) {
      const snapshotIndex = allMessages.indexOf(snapshotMessage);
      const newMessages = allMessages.slice(snapshotIndex + 1);
      
      // Snapshot content вставляем как system context
      const snapshotContent = JSON.parse(snapshotMessage.content);
      
      return {
        snapshotContext: snapshotContent.fullMarkdown,  // в system prompt
        messages: newMessages                            // только новые
      };
    }
  }
  
  return {
    snapshotContext: null,
    messages: allMessages
  };
}
```

**В system prompt Эксперта** добавляется секция:
```xml
<previous_context>
{snapshotContent.fullMarkdown}
</previous_context>
```

**Что видит модель:** system_prompt + snapshot (в system prompt) + сообщения после snapshot.  
**Что видит пользователь:** ВСЮ историю (скроллит вверх), с визуальным разделителем.

---

### 6. Fallback (пояс и подтяжки)

**Проблема:** Модель может проигнорировать системный сигнал и не вызвать createSnapshot.

**Решение:** Серверный счётчик сообщений после сигнала. Если прошло 5 сообщений (user+assistant пар) после инжекции сигнала, а snapshot не создан:

1. Backend вызывает **клерка-snapshot-creator** (`lib/ai/clerks/snapshot-creator.ts`, Gemini 2.5 Flash)
2. Входные данные: последние N сообщений чата
3. Результат сохраняется как snapshot-сообщение (аналогично tool createSnapshot)
4. При следующем API-вызове — сброс контекста автоматически

**Fallback прозрачен для пользователя** — карточка snapshot появляется в чате как обычно. Единственное отличие: пользователь не давал явного согласия, но это лучше чем деградация качества.

---

### Важно: два разных клерка-суммаризатора

В проекте теперь два клерка, связанных с суммаризацией. Разные задачи, разные контракты, разные промпты:

| | **task-summarizer** (C2) | **snapshot-creator** (C1.5) |
|---|---|---|
| **Когда** | Задача завершена | Задача продолжается, контекст переполнен |
| **Цель** | Финальное резюме для передачи в следующие задачи | Сжатие контекста для продолжения работы в том же чате |
| **Куда идёт** | `ProjectTask.outputSummary` | `Message` (isSnapshot) + `Chat.snapshots[]` |
| **Кто потребляет** | Эксперт в **следующей** задаче | Тот же Эксперт в **той же** задаче |
| **Фокус промпта** | Что сделано, ключевые решения, артефакты | Где остановились, что продолжать, открытые вопросы |
| **Файлы** | `lib/ai/clerks/task-summarizer.ts` + `lib/prompts/clerks/task-summarizer.md` | `lib/ai/clerks/snapshot-creator.ts` + `lib/prompts/clerks/snapshot-creator.md` |

Не путать и не объединять — это разные роли.

---

### 7. Множественные snapshots

Если задача длинная — snapshots накапливаются. Каждый новый snapshot должен **включать контекст предыдущего** — модель при создании snapshot видит предыдущий snapshot в system prompt.

```
Чат: [msg1..msg50, snapshot#1, msg51..msg100, snapshot#2, msg101..]

Что видит модель на msg105:
  system_prompt + snapshot#2.fullMarkdown + [msg101..msg105]

Что видит пользователь:
  Вся история с двумя разделителями
```

`Chat.snapshots` — массив, но модель всегда видит только последний.

---

## Изменения в БД

**Одна миграция, два изменения:**

```sql
ALTER TABLE "Chat" ADD COLUMN "snapshots" jsonb DEFAULT '[]';
ALTER TABLE "Message_v2" ADD COLUMN "isSnapshot" boolean DEFAULT false NOT NULL;
```

**Schema (Drizzle):**

```typescript
// Chat table — добавить:
snapshots: jsonb('snapshots').default([]).$type<Array<{
  messageId: string;
  createdAt: string;
  summary: string;
}>>(),

// Message table — добавить:
isSnapshot: boolean('isSnapshot').default(false).notNull(),
```

---

## Изменения в существующих файлах

### API Route (`/api/projects/[id]/tasks/[taskId]/chat/route.ts`)

1. После получения ответа от модели — вычислить `usagePercent`, отправить annotation
2. При `usagePercent >= 70` — инжектировать системный сигнал в следующий запрос
3. При формировании messages — проверить `Chat.snapshots`, обрезать историю если нужно
4. Snapshot context вставить в system prompt Эксперта

### `chat-tools.ts`

Добавить `createSnapshot` в `getStandardTools()` когда `isProjectChat === true`.

### `task-chat.tsx` (клиент)

1. Обработка annotation `context_usage` из `useChat`
2. Рендеринг `ContextIndicator` под инпутом
3. Распознавание snapshot-сообщений → рендеринг `SnapshotCard` вместо обычного message

### `build-task-expert-prompt.ts`

Добавить секцию `<previous_context>` если есть snapshot.

### `lib/db/queries.ts`

Новые функции:
- `addChatSnapshot({ chatId, messageId, summary })` — добавить snapshot в массив
- `getChatSnapshots(chatId)` — получить массив snapshots

---

## Новые файлы

| Файл | Назначение |
|------|------------|
| `components/projects/snapshot-card.tsx` | Компактная карточка snapshot с "Подробнее" |
| `components/projects/context-indicator.tsx` | Полоска индикатора контекста под инпутом |
| `lib/ai/context-limits.ts` | Конфиг лимитов моделей + утилиты расчёта процента |
| `lib/ai/tools/create-snapshot.ts` | Tool createSnapshot (вынести из chat-tools для чистоты) |
| `lib/ai/clerks/snapshot-creator.ts` | Клерк для fallback: создание snapshot из истории чата |
| `lib/prompts/clerks/snapshot-creator.md` | Промпт клерка snapshot-creator |

---

## User Flow

### Нормальный сценарий (модель сотрудничает)

```
Пользователь и Эксперт работают над задачей
  ↓
... 40-60 сообщений, индикатор постепенно заполняется ...
  ↓
Индикатор: 72% (жёлтый, появился процент)
Server route: инжектирует системный сигнал
  ↓
Эксперт: «Мы уже многое проработали. Предлагаю 
зафиксировать ключевые моменты, чтобы продолжить 
эффективно. Хотите?»
  ↓
Пользователь: «Да» (или любое согласие)
  ↓
Эксперт вызывает createSnapshot tool
  ↓
В чате появляется компактная карточка:

┌─────────────────────────────────────────────────┐
│ 📋 Итог зафиксирован                            │
│                                                 │
│ Выбрана стратегия X, создана таблица сравнения  │
│ конкурентов. Осталось доработать финансовую      │
│ модель.                                         │
│                                        [Подробнее] │
└─────────────────────────────────────────────────┘
────────── 📋 Контекст обновлён ──────────

  ↓
Эксперт: «Всё зафиксировано. Продолжаем — 
нам осталось доработать финансовую модель.»
  ↓
Индикатор: ~15% (нейтральный, почти невидимый)
Модель видит: system_prompt + snapshot + последние 2 сообщения
```

### Fallback сценарий (модель не реагирует)

```
Индикатор: 72%, системный сигнал инжектирован
  ↓
Модель продолжает работу, не предлагает snapshot
  ↓
5 пар сообщений без snapshot
  ↓
Backend: принудительно вызывает клерка snapshot-creator
  ↓
Snapshot-карточка появляется в чате автоматически
  ↓
При следующем запросе: контекст обрезан
```

---

## Ключевые ограничения MVP

- Только чат задач (TaskChat). Основной чат и сервисные чаты — позже.
- Порог 70% — захардкожен (позже можно сделать настраиваемым).
- Fallback — через отдельного клерка `snapshot-creator` (не task-summarizer из C2 — разные задачи, разные промпты).
- Snapshot не сохраняется как ProjectFile (только Message). Достаточно для MVP.
- Нет ручной команды «подведи итог» от пользователя (можно просто попросить в чате, Эксперт вызовет tool). При необходимости добавим кнопку в UI позже.

---

## Порядок реализации (рекомендация для Claude Code)

**Этап 1: БД + Tool**
- Миграция (snapshots в Chat, isSnapshot в Message)
- Tool createSnapshot в chat-tools.ts
- Функции queries: addChatSnapshot, getChatSnapshots

**Этап 2: Сброс контекста**
- Логика обрезки messages в route handler
- Инжекция snapshot в system prompt Эксперта
- Тест: создать snapshot вручную → убедиться что старые сообщения не уходят модели

**Этап 3: Мониторинг + сигнал**
- Конфиг лимитов моделей
- Расчёт usagePercent в route handler
- Annotation через dataStream
- Инжекция системного сигнала при пороге

**Этап 4: UI**
- SnapshotCard (компактная + развёрнутая)
- ContextIndicator (полоска под инпутом)
- Визуальный разделитель после snapshot
- Приглушение старых сообщений

**Этап 5: Fallback**
- Промпт `snapshot-creator.md` (отдельный от task-summarizer)
- `snapshot-creator.ts` — вызов клерка
- Серверный счётчик сообщений после сигнала
- Автоматическое создание snapshot при таймауте

---

## Результат

После реализации: пользователь может работать над задачей неограниченно долго. Контекст автоматически управляется, качество не деградирует, ничего не теряется. «AI стал хуже работать» — больше не проблема.
