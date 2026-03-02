# ТЗ-CACHE2: Unified Usage Logging

**Дата:** 2026-03-01  
**Цель:** Полная видимость расхода AI-токенов по ВСЕМ 21 точкам вызовов (6 исправить + 15 добавить)

---

## Контекст

После ТЗ-CACHE1 (prompt caching включён) мы не видим экономию в своих логах: 6 существующих `saveAiUsageLog` не передают cache/thinking токены, хотя колонки в БД (`cacheReadTokens`, `cacheWriteTokens`, `thinkingTokens`) уже есть. Ещё 15 AI-вызовов вообще не логируются — мы платим за них, но не знаем сколько.

**SDK:** `ai@5.0.123` + `@ai-sdk/anthropic@2.0.63` (AI SDK v5)

---

## Что сделать

### Часть 1 — Утилита `extractUsageFields()`

**Файл:** `lib/ai/usage-utils.ts` (новый)

Единая функция извлечения ВСЕХ доступных полей из AI SDK usage объекта. Сейчас в коде россыпь `(usage as any)?.cachedInputTokens` — заменить на одну утилиту.

```typescript
interface ExtractedUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  thinkingTokens: number;
}

function extractUsageFields(usage: LanguageModelUsage): ExtractedUsage
```

**Как извлекать поля (AI SDK v5):**
- `inputTokens` = `usage.inputTokens ?? 0`
- `outputTokens` = `usage.outputTokens ?? 0`
- `cacheReadTokens` = `(usage as any)?.cachedInputTokens ?? 0`
- `thinkingTokens` = `(usage as any)?.reasoningTokens ?? 0`
- `cacheWriteTokens` — **в AI SDK v5 это поле НЕ доступно в плоской структуре usage.** Проверь: возможно `(usage as any)?.cacheWriteInputTokens` или `(usage as any)?.cacheCreationInputTokens` содержит значение (Anthropic API возвращает `cache_creation_input_tokens`, провайдер может пробрасывать). Если нет — оставить 0, задокументировать в коде как TODO для миграции на AI SDK v6.

**Важно:** Проверить реальный runtime usage объект (console.log в dev mode) — в нём могут быть поля, которых нет в TypeScript-типах.

### Часть 2 — Исправить 6 существующих вызовов

Заменить ручное извлечение токенов на `extractUsageFields()` и передавать ВСЕ 5 полей в `saveAiUsageLog`.

| # | Файл | Что поменять |
|---|------|-------------|
| 1 | `app/(chat)/api/chat/route.ts` | `usageLogMeta` — добавить `cacheReadTokens`, `cacheWriteTokens`, `thinkingTokens` |
| 2 | `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` | `saveAiUsageLog` в `onFinish` — добавить 3 поля |
| 3 | `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` | Guardian meta log — добавить 3 поля |
| 4 | `lib/ai/professor-pipeline.ts` | Analyze phase — добавить 3 поля |
| 5 | `lib/ai/professor-pipeline.ts` | Execute phase — добавить 3 поля |
| 6 | `lib/ai/professor-pipeline.ts` | Synthesize phase — добавить 3 поля |

### Часть 3 — Добавить `saveAiUsageLog` в 15 новых точек

**Паттерн для всех:** fire-and-forget, `.catch(() => {})`, никогда не блокирует основную логику.

#### Anthropic streaming (1 точка, 4 контекста)

| # | Файл | chatMode | Модель | Примечание |
|---|------|----------|--------|-----------|
| 7 | `app/(chat)/api/service-chat/route.ts` | `service:{context}` (ben / project-creation / project-manager / briefing-onboarding) | Haiku / Sonnet | Один `saveAiUsageLog` в `onFinish`, `chatMode` формировать как `service:${context}`. chatId — берётся из request body. userId — из session |

**Важно для service-chat:** Это streaming route с `onFinish`. Паттерн — такой же как в `chat/route.ts`. Нужно получить `resolvedModelId` из `myProvider.languageModel(modelId).modelId` и `costUsd` через `calcCostUsd()`.

#### Anthropic generateText/generateObject (11 точек)

| # | Файл | chatMode | Модель | chatId | userId |
|---|------|----------|--------|--------|--------|
| 8 | `app/(chat)/api/assistant/ben/route.ts` | `legacy:ben` | Haiku | из request | из session |
| 9 | `lib/ai/professors/task-reviewer.ts` | `professor:reviewer` | Opus | из параметров | из параметров |
| 10 | `app/(chat)/api/projects/[id]/plan/route.ts` | `professor:planner` | Opus | null | из session |
| 11 | `lib/ai/clerks/snapshot-creator.ts` | `clerk:snapshot` | Haiku | из параметров | из параметров |
| 12 | `lib/ai/clerks/task-summarizer.ts` | `clerk:summarizer` | Haiku | из параметров | из параметров |
| 13 | `app/(chat)/api/projects/[id]/analyze-file/route.ts` | `clerk:file-analyzer` | Haiku | null | из session |
| 14 | `app/(chat)/api/projects/[id]/generate-summary/route.ts` | `clerk:project-summary` | Haiku | null | из session |
| 15 | `app/(chat)/actions.ts` | `util:generate-title` | Haiku | из параметров | из параметров |
| 16 | `app/(chat)/api/chat/[id]/generate-title/route.ts` | `util:auto-naming` | Haiku | из URL params | из session |
| 17 | `lib/briefing/briefing-author.ts` | `briefing:author` | Sonnet (+ Opus fallback) | null | из параметров |
| 18 | `lib/briefing/briefing-section-author.ts` | `briefing:section-author` | Sonnet (+ Opus fallback) | null | из параметров |

**Для функций без userId в параметрах (task-reviewer, snapshot-creator, task-summarizer, briefing-author, briefing-section-author):** Проверить, есть ли userId в текущих параметрах функции. Если нет — добавить опциональный параметр `userId?: string` и передавать из вызывающего кода. Если передать невозможно без большого рефакторинга — использовать placeholder `"system"` и оставить TODO.

#### Google Gemini generateText/generateObject (3 точки)

| # | Файл | chatMode | Модель | chatId | userId |
|---|------|----------|--------|--------|--------|
| 19 | `lib/briefing/briefing-filter.ts` | `briefing:filter` | Gemini 2.0 Flash | null | из параметров |
| 20 | `lib/podcast/script-generator.ts` | `podcast:script` | Gemini 2.5 Flash | null | из параметров |
| 21 | `lib/ai/vision-ocr.ts` | `util:vision-ocr` | Gemini 2.5 Flash | null | из параметров |

**Для Gemini:** Usage объект от `@ai-sdk/google` тоже содержит `inputTokens` и `outputTokens`. Cache/thinking поля — скорее всего 0 (Gemini не использует наш prompt caching). Проверить runtime usage объект и извлечь что есть. `costUsd` — через `calcCostUsd()` (TokenLens поддерживает Google модели). Если не поддерживает — передать `null`.

---

## Обновить сигнатуру `saveAiUsageLog`

Текущая сигнатура в `lib/db/queries.ts` может не принимать `cacheReadTokens`, `cacheWriteTokens`, `thinkingTokens`. Проверить и при необходимости расширить — колонки в БД уже есть, нужно только добавить поля в TypeScript-интерфейс и в INSERT.

---

## chatMode — конвенция именования

```
Streaming routes:      chat | expertise | create | project:{tier}
Service chats:         service:{context}
Professors:            professor:reviewer | professor:planner
Clerks:                clerk:snapshot | clerk:summarizer | clerk:file-analyzer | clerk:project-summary
Briefing:              briefing:author | briefing:section-author | briefing:filter
Podcast:               podcast:script
Утилиты:               util:generate-title | util:auto-naming | util:vision-ocr
Legacy:                legacy:ben
```

---

## НЕ менять

- Схему БД — колонки уже есть
- `calculateCostRub()` — уже корректна
- UI — отдельное ТЗ (CACHE3)
- `calcCostUsd()` / `calcStepCostRub()` — работают как есть

---

## Проверка после реализации

1. Отправить 2+ сообщения в чате → `ai_usage_log` содержит записи с `cacheReadTokens > 0`
2. Запустить briefing onboarding → запись с `chatMode = 'service:briefing-onboarding'`, `thinkingTokens > 0`
3. Создать проект (план) → запись с `chatMode = 'professor:planner'`
4. Сгенерировать брифинг → записи с `chatMode = 'briefing:filter'` и `chatMode = 'briefing:author'`
5. SQL проверка полноты: `SELECT chatMode, COUNT(*) FROM ai_usage_log GROUP BY chatMode ORDER BY COUNT(*) DESC` — должны быть все chatMode из конвенции

---

## Приоритет реализации

Если объём большой — можно реализовать в таком порядке:
1. Утилита `extractUsageFields()` + исправить 6 существующих (сразу видим cache/thinking)
2. service-chat (самый дорогой нелогируемый route)
3. Professors + Clerks (Opus-вызовы = дорого)
4. Briefing + Podcast + остальные

Но в идеале — всё за один коммит.
