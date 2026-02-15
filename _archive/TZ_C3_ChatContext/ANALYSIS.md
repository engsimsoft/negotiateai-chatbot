# Анализ ТЗ-C3: Context Window Management для обычного чата

**Дата анализа:** 2026-02-15

---

## Резюме

Портировать систему управления контекстным окном (snapshot-aware trimming, suggestion injection, fallback clerk, ContextIndicator, sidebar секция "Итоги") из проектного чата Эксперта (`tasks/[taskId]/chat/route.ts`) в универсальный чат (`chat/route.ts`). Вся инфраструктура уже готова — нужно подключить.

---

## Вопросы для уточнения

> Ответь на эти вопросы перед началом разработки

1. **[Версия]:** Версия проекта 3.21.0 → 3.22.0? Или minor patch?
2. **[Промпт клерка]:** Для fallback-клерка — создать отдельный промпт `snapshot-creator-chat.md` или сделать `snapshot-creator.md` универсальным (с условием task/chat)?
3. **[Git ветка]:** Работаем в текущей `feature/design-system` или создаём новую ветку `feature/chat-context`?

---

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.
> Каждая рекомендация требует согласования с архитектором.

### ✅ Согласен с ТЗ

- **Переиспользование инфраструктуры** — ОК. `SnapshotCard`, `SnapshotDivider`, dimming в `messages.tsx`, рендер в `message.tsx` — всё уже работает generic, не привязано к проектам. Ноль изменений в этих файлах.
- **DB-схема** — `Chat.snapshots[]` и `Chat.contextState` уже в schema.ts, все query-функции (`addChatSnapshot`, `getChatWithSnapshotState`, `resetChatContextState`, `updateChatContextState`) готовы и generic.
- **Tool `createSnapshot`** — Zod-схема и `buildFullMarkdown()` подходят и для свободного чата (shortSummary, decisions, currentState, artifacts, openQuestions, nextSteps — структура универсальная).
- **ChatSidebar "Итоги"** — логично добавить рядом с "Артефакты" и "Вложения", паттерн тот же (кнопка → scrollToMessage).

### ⚠️ Рекомендую изменить

| # | Было (ТЗ) | Рекомендация | Обоснование из кода |
|---|-----------|--------------|-------------------|
| 1 | "Переиспользовать клерка as-is" | Адаптировать `createFallbackSnapshot()` — сделать `taskTitle`/`taskGoal` **опциональными**, добавить `chatTitle?: string` | `snapshot-creator.ts` строка ~20: `taskTitle: string` и `taskGoal: string` — required. Для обычного чата задачи нет. Передаём `chatTitle` (из Chat.title) или дефолт. |
| 2 | "Переиспользовать промпт as-is" | Создать **отдельный промпт** `snapshot-creator-chat.md` | `snapshot-creator.md` говорит "Эксперт", "задача", "цель задачи" — это task-specific язык. Отдельный промпт чище, чем if/else в одном. Структура выхода (Zod) — та же. |
| 3 | "Подключить createSnapshot к обычному чату" | В `getStandardTools()` убрать условие `isProjectChat` для `createSnapshot`, вместо этого проверять наличие `chatId && messageId` | `chat-tools.ts`: сейчас `...(isProjectChat && chatId && messageId ? { createSnapshot(...) } : {})`. Нужно: `...(chatId && messageId ? { createSnapshot(...) } : {})` |
| 4 | — | В `chat/route.ts` генерировать `assistantMessageId` **до** вызова `streamText` и передавать в tools | Task chat route (`tasks/[taskId]/chat/route.ts` строка 256-257) делает `const assistantMessageId = generateUUID()` до streaming. В `chat/route.ts` этого нет — messageId генерится внутри `createUIMessageStream` (строка 551). Нужно вынести наружу. |
| 5 | — | `snapshotContext` в обычном чате инжектировать напрямую в systemPrompt как `\n\n<previous_context>\n{snapshotContext}\n</previous_context>` | В task chat это делает `buildTaskExpertPrompt({ snapshotContext })`. В обычном чате промпт строится через `buildChatPrompt()` — туда snapshotContext не передаётся. Проще вставить блок напрямую в route. |

### ❓ Требует уточнения

- **Fallback clerk для чата** — какую модель использовать? Сейчас клерк использует `gemini-2.5-flash`. Для обычного чата то же самое?
- **System signal текст** — сейчас для Эксперта: `"Мягко предложи пользователю зафиксировать прогресс"`. Для обычного чата нужен другой тон? Или идентичный?

---

## Затронутые компоненты (по результатам анализа кода)

### Нужно изменить:

| Файл | Что делаем | Объём |
|------|-----------|-------|
| `app/(chat)/api/chat/route.ts` | Добавить: загрузка snapshots, trimming, suggestion injection, fallback, emit `data-context-usage`, messageId для tools | **Основная работа** |
| `lib/ai/tools/chat-tools.ts` | Убрать `isProjectChat` условие для `createSnapshot` | 1 строка |
| `lib/ai/clerks/snapshot-creator.ts` | Сделать `taskTitle`/`taskGoal` optional, добавить `chatTitle` | ~10 строк |
| `lib/prompts/clerks/snapshot-creator-chat.md` | Новый промпт для чата (без "Эксперт", "задача") | Новый файл |
| `components/chat.tsx` | Добавить ContextIndicator + обработку `data-context-usage` | ~15 строк |
| `components/chat-sidebar.tsx` | Добавить секцию "Итоги" (extract snapshots + render) | ~40 строк |

### Не трогаем (уже работает generic):

| Файл | Почему не трогаем |
|------|-------------------|
| `components/message.tsx` | `tool-createSnapshot` рендерит SnapshotCard для любого чата |
| `components/messages.tsx` | Dimming + SnapshotDivider работает generic |
| `components/projects/snapshot-card.tsx` | Чистый presentation component |
| `components/projects/context-indicator.tsx` | Чистый presentation component |
| `lib/ai/context-limits.ts` | Constants, уже generic |
| `lib/ai/tools/create-snapshot.ts` | Tool implementation, generic |
| `lib/db/queries.ts` | Все snapshot-queries generic |
| `lib/db/schema.ts` | Поля уже в Chat table |

---

## Потенциальные риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Регрессия chat route (ломаем существующий чат) | Средняя | Высокое | Добавляем код блоками, `tsc` + `build` после каждого. Не меняем существующую логику — только добавляем рядом. |
| messageId рассинхрон (tool сохраняет один ID, message другой) | Низкая | Высокое | Генерировать `assistantMessageId` до streaming и использовать везде. Паттерн уже работает в task chat. |
| Fallback clerk тормозит response (awaits перед streaming) | Низкая | Среднее | Fallback вызывается до `streamText()`, как и в task chat. Клерк на Flash — быстро. При ошибке — reset state, не блокируем. |
| onFinish filter убирает snapshot parts | Средняя | Высокое | Текущий filter в `chat/route.ts` (строки 556-572) оставляет только text + step + createDocument/updateDocument. **Нужно добавить `tool-createSnapshot` в whitelist.** |

---

## Зависимости

**Что нужно до начала:**
- [x] Вся инфраструктура ТЗ-C1.5 (v3.18.0) — уже в коде
- [x] ChatSidebar (ТЗ-08CS, v3.21.0) — уже есть
- [ ] Ответы на вопросы выше

**Внешние зависимости:** Нет. Всё локально.

---

## Оценка сложности

- [x] Простое (1-2 сессии)
- [ ] Среднее (3-5 сессий)
- [ ] Сложное (5+ сессий)

**Обоснование:** 90% инфраструктуры готово. Основная работа — wiring в `chat/route.ts` (копирование паттерна из task chat) + мелкие адаптации (промпт клерка, ChatSidebar секция, ContextIndicator). Рисков мало.

---

## Ответы на вопросы

> Заполнено архитектором 2026-02-15

1. **Версия:** 3.22.0. Правая панель — 3.21.0, Context Management — следующий шаг.
2. **Промпт клерка:** Универсализировать существующий. Один клерк, одна логика. `taskTitle`/`taskGoal` optional — если есть, структурирует под задачу, если нет — общий итог чата. Отдельный файл — дублирование, которое потом разъедется.
3. **Git ветка:** Новая `feature/chat-context`. Отдельная фича, не связанная с design-system.

**По рекомендациям:**
- **#4 (onFinish filter):** Согласовано. Критически важно — добавить `tool-createSnapshot` в whitelist. Самый коварный баг: snapshot молча потеряется, всё остальное будет работать.
- **#1 (интерфейс клерка):** Согласовано. `taskTitle`/`taskGoal` optional. Клерк проверяет наличие task-контекста → условная логика внутри.
