# Roadmap ТЗ-C1.5: Управление контекстным окном (авто-итог)

**Создан:** 2026-02-11
**Версия проекта:** 3.17.0 → 3.18.0
**Статус:** В работе

> **Инструкция:** [specs/ROADMAP_GUIDE.md](../ROADMAP_GUIDE.md)

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Всего этапов | 4 + Финализация |
| Текущий этап | 2 ✅ |
| Оценка сессий | 3-4 |

**Скоуп:** Этапы 1-4 (включая fallback-клерка). Полная production-ready фича.

---

## Ревизия архитектора vs синьор-разработчик

> Ниже — изменения относительно исходного ТЗ, принятые после код-ревью.

| # | Решение | Обоснование |
|---|---------|-------------|
| 1 | **Fallback включён** (Этап 2, задача 2.6) | ~100 строк по паттерну task-summarizer. Без него — известный failure mode в проде |
| 2 | **Убрана колонка `isSnapshot`** | Избыточна — `Chat.snapshots[].messageId` уже содержит ссылку. Минус одно изменение БД |
| 3 | **Snapshot = tool call в assistant message** | Не отдельное Message. Часть обычного стрима — нет timing issues, автоматически в UI |
| 4 | **Usage estimated ДО стриминга** | `onFinish` + `dataStream.write()` = timing risk. Считаем из DB tokenCount до вызова модели |

---

## Этапы

### Этап 1: БД + Конфиг + Tool createSnapshot

**Статус:** ✅ Завершён

**Цель:** Подготовить фундамент — миграция БД, конфиг лимитов, tool createSnapshot, функции queries.

**Задачи:**

- [x] **1.0** Подготовка: проверить текущее состояние проекта (`npm run build`), изучить затронутые файлы (schema.ts, queries.ts, chat-tools.ts, task route)

- [x] **1.1** Создать `lib/ai/context-limits.ts` — конфиг бюджетов:
  ```typescript
  export const CONTEXT_BUDGET = 140_000; // рабочий бюджет (токены)
  export const SNAPSHOT_THRESHOLD = 0.70; // 70% → предложить snapshot
  export function calcUsagePercent(tokens: number, budget = CONTEXT_BUDGET): number
  ```

- [x] **1.2** Добавить поля в `lib/db/schema.ts` (2 поля, не 3):
  - `Chat.snapshots` — `jsonb('snapshots').default([]).$type<SnapshotMeta[]>()`
    ```typescript
    type SnapshotMeta = { messageId: string; createdAt: string; summary: string };
    ```
  - `Chat.contextState` — `jsonb('contextState').$type<ContextState | null>()`
    ```typescript
    type ContextState = { suggestionActive: boolean; messagesSinceSuggestion: number };
    ```
  - ~~`Message_v2.isSnapshot`~~ — **убрано** (избыточно, `Chat.snapshots[].messageId` достаточно)

- [x] **1.3** Создать и применить миграцию:
  ```sql
  ALTER TABLE "Chat" ADD COLUMN "snapshots" jsonb DEFAULT '[]';
  ALTER TABLE "Chat" ADD COLUMN "contextState" jsonb;
  ```

- [x] **1.4** Добавить функции в `lib/db/queries.ts`:
  - `addChatSnapshot({ chatId, messageId, summary })` — push в snapshots[] (JSONB append)
  - `getChatWithSnapshotState(chatId)` — получить Chat со snapshots + contextState (один запрос)
  - `updateChatContextState({ chatId, contextState })` — обновить contextState
  - `resetChatContextState(chatId)` — сбросить contextState после snapshot

- [x] **1.5** Создать `lib/ai/tools/create-snapshot.ts` — tool createSnapshot:
  - Parameters: `shortSummary`, `decisions`, `currentState`, `artifacts`, `openQuestions`, `nextSteps`
  - Execute:
    1. Формирует `fullMarkdown` из structured params
    2. Сохраняет в `Chat.snapshots[]` через `addChatSnapshot()`
    3. Сбрасывает `contextState` через `resetChatContextState()`
    4. Возвращает модели: `"Итог зафиксирован. Контекст обновлён. Продолжай работу с учётом зафиксированных решений."`
  - **Snapshot НЕ создаёт отдельный Message** — данные tool call сохраняются как часть обычного assistant message (через существующий onFinish)
  - Tool получает `chatId` через closure (аналогично readProjectFile)

- [x] **1.6** Зарегистрировать в `chat-tools.ts`:
  - Добавить `chatId` в `GetStandardToolsParams`
  - Import `createSnapshot` в getStandardTools (когда `isProjectChat === true`)
  - Добавить `"createSnapshot"` в фильтр parts в route onFinish: `type === "tool-createSnapshot"`
  - Добавить `"createSnapshot"` в `getActiveToolNames` для project chats

**Файлы:**
- `lib/ai/context-limits.ts` — новый
- `lib/ai/tools/create-snapshot.ts` — новый
- `lib/db/schema.ts` — 2 новых поля (Chat)
- `lib/db/queries.ts` — 4 новых функции
- `lib/ai/tools/chat-tools.ts` — регистрация tool + chatId param
- `drizzle/XXXX_snapshot_fields.sql` — миграция

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок TypeScript
- [ ] `npm run build` — сборка успешна
- [ ] `npm run dev` — сервер запускается без ошибок
- [ ] `npm run db:migrate` — миграция применена
- [ ] MCP SQL: `SELECT column_name FROM information_schema.columns WHERE table_name = 'Chat' AND column_name IN ('snapshots', 'contextState');` — 2 строки

**Git (после валидации):**
```bash
git add lib/ai/context-limits.ts lib/ai/tools/create-snapshot.ts lib/db/schema.ts lib/db/queries.ts lib/ai/tools/chat-tools.ts drizzle/
git commit -m "feat(tz-c1.5): DB migration + createSnapshot tool + context config"
```

**Критерий готовности:** Миграция применена, tool createSnapshot зарегистрирован и компилируется, queries работают.

---

### Этап 2: Сброс контекста + Мониторинг + Fallback

**Статус:** ✅ Завершён

**Цель:** При наличии snapshot — обрезать историю для модели. Мониторить usage (estimated из DB). Инжектировать системный сигнал. Fallback-клерк для подстраховки.

**Задачи:**

- [x] **2.1** Модифицировать `build-task-expert-prompt.ts`:
  - Добавить параметр `snapshotContext?: string`
  - Если есть — вставить блок `<previous_context>{snapshotContext}</previous_context>` после core prompt, перед project_passport

- [x] **2.2** Модифицировать route `tasks/[taskId]/chat/route.ts` — загрузка сообщений с учётом snapshot:
  - Загрузить `getChatWithSnapshotState(chatId)` — один запрос
  - Если есть snapshot → найти snapshot message в загруженных messages → взять только сообщения после него
  - Извлечь `fullMarkdown` из tool call result части snapshot-сообщения
  - Передать в `buildTaskExpertPrompt` как `snapshotContext`
  - Если нет snapshot → текущая логика sliding window (без изменений)

- [x] **2.3** Usage tracking — estimated ДО стриминга (annotation `data-context-usage`)

- [x] **2.4** Инжекция системного сигнала при `estimatedPercent >= SNAPSHOT_THRESHOLD * 100`

- [x] **2.5** Сбрасывать contextState после snapshot (уже реализовано в tool execute, Этап 1.5)

- [x] **2.6** Fallback — клерк snapshot-creator:
  - `lib/prompts/clerks/snapshot-creator.md` — промпт
  - `lib/ai/clerks/snapshot-creator.ts` — по паттерну task-summarizer.ts
  - В route: если `messagesSinceSuggestion >= FALLBACK_MESSAGE_PAIRS` → вызвать клерка → сохранить snapshot (с fullMarkdown) → сбросить contextState

**Файлы:**
- `lib/prompts/build-task-expert-prompt.ts` — +snapshotContext param
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — snapshot loading, usage, signal, fallback
- `lib/prompts/clerks/snapshot-creator.md` — новый
- `lib/ai/clerks/snapshot-creator.ts` — новый

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] `npm run dev` — сервер запускается
- [ ] Ручной тест: вставить snapshot вручную в `Chat.snapshots[]` → убедиться что модель получает только snapshot + новые сообщения (проверить console.log)
- [ ] 🧪 **Мануальный тест:** Открыть задачу → написать несколько сообщений → проверить в console.log: `[TaskExpert]` с usage данными + context-usage annotation

**Git (после валидации):**
```bash
git add lib/prompts/build-task-expert-prompt.ts "app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts" lib/prompts/clerks/snapshot-creator.md lib/ai/clerks/snapshot-creator.ts
git commit -m "feat(tz-c1.5): context reset + usage monitoring + system signal + fallback clerk"
```

**Критерий готовности:** Snapshot корректно обрезает историю для модели. Usage estimated и отправляется annotation. Системный сигнал инжектируется при пороге. Fallback-клерк компилируется и подключён.

---

### Этап 3: UI — SnapshotCard + разделитель

**Статус:** ⬜ Не начат

> ⛔ **НЕ НАЧИНАТЬ** без подтверждения валидации Этапа 2

**Цель:** Визуальное отображение snapshot в чате — компактная карточка с expand/collapse + разделитель + приглушение старых сообщений.

**Задачи:**

- [ ] **3.1** Создать `components/projects/snapshot-card.tsx`:
  - Props: `data: SnapshotData` (parsed из tool call result)
  - Два состояния: свёрнуто (shortSummary + "Подробнее") и развёрнуто (секции: Решения, Создано, Открытые вопросы, Следующие шаги)
  - Стиль: `bg-muted`, иконка `FileText` (lucide), `rounded-lg`
  - Toggle кнопка "Подробнее" / "Свернуть"

- [ ] **3.2** Интегрировать SnapshotCard в систему рендеринга сообщений:
  - В `components/message.tsx` — обнаруживать part с `type === "tool-createSnapshot"` или tool result содержащий snapshot JSON
  - Если snapshot tool call → рендерить `SnapshotCard` вместо стандартного tool result UI
  - После карточки — визуальный разделитель:
    ```
    ────────── 📋 Контекст обновлён ──────────
    ```

- [ ] **3.3** Приглушение старых сообщений:
  - В `components/messages.tsx`: найти индекс последнего сообщения, содержащего snapshot tool call
  - Все messages до него → обернуть в `<div className="opacity-60 transition-opacity">`
  - CSS transition для плавности

- [ ] **3.4** Проверить корректность scroll и memo в Messages:
  - `memo` comparator учитывает snapshot-содержащие сообщения
  - Scroll to bottom работает при появлении snapshot

- [ ] **3.5** Рендеринг fallback-snapshot (от клерка):
  - Клерковский snapshot не имеет tool call — это запись только в `Chat.snapshots[]`
  - При загрузке сообщений: если `Chat.snapshots[]` содержит messageId которого нет в messages (fallback) → рендерить тонкий разделитель без карточки: `────────── 📋 Контекст сжат ──────────`
  - Сообщения до разделителя — приглушены

**Файлы:**
- `components/projects/snapshot-card.tsx` — новый
- `components/messages.tsx` — интеграция snapshot рендеринга + приглушение
- `components/message.tsx` — обнаружение snapshot tool call

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] `npm run dev` — сервер запускается без ошибок
- [ ] Браузер: создать snapshot через чат (попросить Эксперта "подведи итог") → карточка видна, кликабельна, разделитель отображается, старые сообщения приглушены
- [ ] 🧪 **Мануальный тест:** Пользователь видит карточку snapshot, может раскрыть/свернуть, старые сообщения визуально приглушены

**Git (после валидации):**
```bash
git add components/projects/snapshot-card.tsx components/messages.tsx components/message.tsx
git commit -m "feat(tz-c1.5): SnapshotCard UI + divider + dimmed old messages"
```

**Критерий готовности:** Snapshot отображается как карточка с expand/collapse. Разделитель виден. Старые сообщения приглушены. Fallback-snapshot отображается как тонкий разделитель.

---

### Этап 4: UI — ContextIndicator + E2E flow

**Статус:** ⬜ Не начат

> ⛔ **НЕ НАЧИНАТЬ** без подтверждения валидации Этапа 3

**Цель:** Индикатор контекста + полный end-to-end flow.

**Задачи:**

- [ ] **4.1** Создать `components/projects/context-indicator.tsx`:
  - Props: `percent: number`
  - Три состояния по цвету:
    - 0-60%: `bg-muted-foreground/20` (почти невидимая, не отвлекает)
    - 60-80%: `bg-amber-500` (появляется процент справа)
    - 80-100%: `bg-orange-500 animate-pulse` (Эксперт уже предложил итог)
  - Тонкая полоска (2-3px высота), progress bar стиль
  - Hover → Tooltip: "Контекст диалога: {X}%"

- [ ] **4.2** Интегрировать ContextIndicator в `task-chat.tsx`:
  - Хранить `contextPercent` в `useState(0)`
  - Обработать annotation `context-usage` из `onData`:
    ```typescript
    onData: (dataPart) => {
      setDataStream((ds) => ...);
      const part = dataPart as any;
      if (part.type === "context-usage") {
        setContextPercent(part.data.percent);
      }
    }
    ```
  - Разместить ContextIndicator над `MultimodalInput` (между completionCard и input div)
  - Скрывать если: `isReadonly || isCompleting || currentStatus !== "in_progress"`

- [ ] **4.3** E2E тест полного flow:
  1. Пишем сообщения → индикатор обновляется после каждого ответа
  2. При 70%+ → Эксперт предлагает snapshot
  3. Пользователь соглашается → tool вызывается → карточка в чате
  4. Индикатор сбрасывается (следующий ответ → низкий %)
  5. Модель видит только snapshot + новые сообщения

- [ ] **4.4** Edge cases:
  - Множественные snapshots: второй snapshot корректно создаётся поверх первого (модель видит предыдущий snapshot в system prompt)
  - Readonly режим: индикатор скрыт
  - Completed задача: индикатор скрыт
  - Перезагрузка страницы: snapshot-карточка и разделитель отображаются корректно из БД
  - Fallback: если модель игнорирует 5 пар → клерк создаёт snapshot → при следующей загрузке контекст обрезан

**Файлы:**
- `components/projects/context-indicator.tsx` — новый
- `components/projects/task-chat.tsx` — интеграция индикатора + onData handler

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] `npm run dev` — сервер запускается без ошибок
- [ ] Браузер: Полный flow работает end-to-end
- [ ] 🧪 **Мануальный тест пользователем:**
  1. Открыть задачу, поработать с Экспертом (5-10 сообщений)
  2. Проверить что индикатор обновляется (может быть маленький % — это нормально)
  3. Для теста snapshot: попросить Эксперта "подведи итог" → snapshot создаётся → карточка в чате → индикатор сбрасывается

**Git (после валидации):**
```bash
git add components/projects/context-indicator.tsx components/projects/task-chat.tsx
git commit -m "feat(tz-c1.5): ContextIndicator + full E2E flow"
```

**Критерий готовности:** Полный flow работает: мониторинг → сигнал → snapshot → обрезка → продолжение. Индикатор отображает актуальный %. Fallback срабатывает при игнорировании.

---

### Этап 5: Финализация

**Статус:** ⬜ Не начат

> ⛔ **НЕ НАЧИНАТЬ** без подтверждения всех предыдущих этапов

**Цель:** Завершить ТЗ, обновить документацию, архивировать

**Задачи:**
- [ ] Финальное мануальное тестирование (полный flow)
- [ ] Перенести CHANGELOG.md → главный CHANGELOG.md
- [ ] Обновить SIMPLY_STATUS.md
- [ ] Обновить CLAUDE.md (добавить Context Management секцию)
- [ ] Обновить package.json (3.17.0 → 3.18.0)
- [ ] Обновить docs/ai-chats-map.md (добавить snapshot tool)
- [ ] Переместить папку `specs/TZ_C1_5_ContextManagement/` → `_archive/TZ_C1_5_ContextManagement/`

**Валидация финальная:**
- [ ] `npm run build` — успешен
- [ ] Все функции работают в браузере
- [ ] Документация актуальна
- [ ] Версия обновлена везде (package.json, STATUS, CHANGELOG)

**Критерий готовности:** Документация актуальна, папка в архиве

---

## Правила валидации

### После каждой задачи
```bash
npx tsc --noEmit  # Должен быть 0 ошибок
```

### После каждого этапа
```bash
npm run build     # Должен пройти
npm run dev       # Проверить в браузере
```

### Мануальные тесты
Запрашивать у пользователя после:
- Завершения этапа
- Значительных изменений UI
- Изменений API
- Изменений в БД

---

## Чек-лист перехода между этапами

Прежде чем начать следующий этап:
- [ ] Все задачи текущего этапа отмечены [x]
- [ ] Валидация этапа пройдена (все пункты)
- [ ] **Git commit сделан** (фиксация этапа)
- [ ] Пользователь подтвердил мануальный тест
- [ ] CHANGELOG.md обновлён
- [ ] HANDOFF.md обновлён
