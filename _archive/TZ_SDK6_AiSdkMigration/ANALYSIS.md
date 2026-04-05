# Анализ ТЗ-SDK6: Миграция AI SDK v5 → v6

## Резюме

Миграция `ai@5.0.123` → `ai@6.x` для получения нативных типов `cacheWriteTokens` и устранения `(usage as any)` кастов. Затрагивает ~62 файла с импортами из `"ai"`.

---

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.
> Каждая рекомендация требует согласования с архитектором.

### ✅ Согласен с ТЗ

- **Пункт 1 (обновление зависимостей)** — ОК, четыре пакета чётко определены
- **Пункт 2 (codemod)** — ОК, правильный подход
- **Пункт 3 (extractUsageFields)** — ОК, это центральная точка, правильно выделена
- **Пункт 5 (финальная проверка)** — ОК, `tsc --noEmit` + ручной тест
- **Скоуп "что НЕ делаем"** — ОК, `generateObject` оставить на потом — разумно

### ⚠️ Рекомендую изменить / уточнить

| # | Было (ТЗ) | Рекомендация | Обоснование из кода |
|---|-----------|--------------|-------------------|
| 1 | `CoreMessage → ModelMessage` в lib/utils.ts | **Уже мигрировано.** `lib/utils.ts:4` уже импортирует `ModelMessage`, функция `sanitizeCoreMessages` уже типизирована как `(messages: ModelMessage[]): ModelMessage[]`. Codemod здесь ничего менять не будет | Проверено: `lib/utils.ts:4` — `import { ModelMessage }` |
| 2 | Проверить `@openrouter/ai-sdk-provider` совместимость | **Пакет не используется в коде.** `@openrouter/ai-sdk-provider@^1.5.4` есть в package.json, но ни один `.ts/.tsx` файл его не импортирует. Рекомендую удалить из dependencies при миграции — мёртвая зависимость | `grep` по `@openrouter/ai-sdk-provider` в `*.{ts,tsx}` — 0 результатов |
| 3 | ТЗ упоминает 4 файла с `(usage as any)` | **Фактически кастов больше, чем описано.** Помимо `extractUsageFields()`, каждый из 3 route-файлов содержит **свои** inline `(usage as any)` касты для debug events (onStepFinish, onFinish). Это 12+ отдельных каст-выражений, не покрываемых только правкой `extractUsageFields()` | `chat/route.ts:680-681,765-766,775`, `service-chat/route.ts:803-804,850-851,858`, `tasks/.../chat/route.ts:343-344,397-398,405` |
| 4 | `toUIMessageStreamResponse()` может измениться в v6 | **Используется только в 1 файле** (`ben/route.ts:48`). Основные 3 route используют паттерн `createUIMessageStream` + `JsonToSseTransformStream`, который тоже может измениться. Нужно проверить оба API | `ben/route.ts:48` — `toUIMessageStreamResponse()`. Остальные: `createUIMessageStream` + `JsonToSseTransformStream` |
| 5 | `convertToCoreMessages` → `await convertToModelMessages` | **Только 3 файла, не 5.** `lib/utils.ts` не вызывает `convertToCoreMessages` — только использует тип `ModelMessage`. `lib/ai/professor-pipeline.ts` тоже только импортирует тип `CoreMessage`. Реальные вызовы `convertToCoreMessages()`: `chat/route.ts` (2 вызова), `tasks/.../chat/route.ts` (1 вызов), `ben/route.ts` (1 вызов) | grep по `convertToCoreMessages(` — 4 вызова в 3 файлах |

### ❓ Согласовано с архитектором

1. **Inline `(usage as any)` в debug events — В СКОУПЕ.** 12+ inline кастов в 3 route-файлах убираем в том же проходе. Один проход, не два.
2. **`@openrouter/ai-sdk-provider` — УДАЛИТЬ.** Мёртвая зависимость, убираем из package.json в том же коммите.
3. **Мануальный тест — 1 сообщение × 5 типов чатов** + проверка DevPanel что `cacheWriteTokens` ненулевой.

---

## Потенциальные риски

### Высокий риск
- **Breaking changes в streaming API.** `createUIMessageStream` + `JsonToSseTransformStream` используются в 3 основных route-файлах. Если API изменится в v6 — это core функциональность чатов
- **`@ai-sdk/react` breaking changes.** `DefaultChatTransport` используется в 5 компонентах (`chat.tsx`, `service-chat-core.tsx`, `task-chat.tsx`, `briefing-setup-client.tsx`, `project-creation-client.tsx`). Любое изменение ломает все чаты

### Средний риск
- **`generateObject` deprecated warning.** 5 файлов используют `generateObject`. ТЗ правильно исключает миграцию, но при `npm run build` могут появиться deprecation warnings → noise в логах
- **Codemod может не покрыть всё.** 62 файла с импортами из `"ai"` — codemod покроет известные паттерны, но edge cases (например, `streamObject` в `request-suggestions.ts`) могут потребовать ручной правки

### Низкий риск
- **`@openrouter/ai-sdk-provider`** — мёртвая зависимость, не блокирует миграцию, но может конфликтовать при установке если потребует peer dependency `ai@5`

---

## Зависимости

### Файлы по зонам влияния

**Streaming routes (core, высокий приоритет):**
- `app/(chat)/api/chat/route.ts` — главный чат
- `app/(chat)/api/service-chat/route.ts` — сервисные чаты (Бен, менеджер)
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — чат эксперта
- `app/(chat)/api/assistant/ben/route.ts` — legacy Бен

**Usage/pricing (ядро миграции):**
- `lib/ai/usage-utils.ts` — `extractUsageFields()` + `logUsage()`
- `lib/ai/tokenlens-catalog.ts` — `calcStepCostRub()`, `calcCostUsd()`
- `lib/ai/providers.ts` — `calculateCostRub()`

**generateText (pipeline):**
- `lib/ai/professor-pipeline.ts` — Professor
- `lib/ai/professors/task-reviewer.ts` — Task reviewer
- `lib/ai/clerks/task-summarizer.ts` — Summarizer
- `lib/ai/clerks/snapshot-creator.ts` — Snapshot
- `lib/meeting/meeting-pipeline.ts` — Meeting
- `lib/ai/vision-ocr.ts` — Vision OCR
- `app/(chat)/api/projects/[id]/plan/route.ts` — Professor plan
- `app/(chat)/api/projects/[id]/analyze-file/route.ts` — File analyzer
- `app/(chat)/api/projects/[id]/generate-summary/route.ts` — Summary
- `app/(chat)/api/chat/[id]/generate-title/route.ts` — Title + generateObject
- `lib/podcast/script-generator.ts` — Podcast script

**generateObject (deprecated но работает):**
- `lib/briefing/briefing-filter.ts`
- `lib/briefing/briefing-author.ts`
- `lib/briefing/briefing-section-author.ts`
- `app/(chat)/api/chat/[id]/generate-title/route.ts`
- `app/(chat)/api/chat/route.ts` (inline)

**Client components (useChat, DefaultChatTransport):**
- `components/chat.tsx`
- `components/service-chat/service-chat-core.tsx`
- `components/projects/task-chat.tsx`
- `app/(dashboard)/briefing/setup/briefing-setup-client.tsx`
- `app/(dashboard)/projects/new/project-creation-client.tsx`

**Типы и утилиты:**
- `lib/types.ts` — `InferUITool`, `UIMessage`
- `lib/utils.ts` — `ModelMessage`, `CoreAssistantMessage`, `CoreToolMessage`
- `lib/usage.ts` — `LanguageModelUsage`
- `lib/db/utils.ts` — `generateId`
- `lib/artifacts/server.ts` — `UIMessageStreamWriter`
- `components/data-stream-provider.tsx` — `DataUIPart`
- `components/elements/*.tsx` — UI типы

---

## Оценка сложности

- [x] Простое (1-2 сессии)

Обоснование: миграция формальная (codemod + ручные правки типов), без изменения логики. Основной риск — runtime поведение streaming, которое проверяется мануальным тестом.
