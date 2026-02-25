# ТЗ-OPT1: Usage Logging + Миграция Sonnet 4.6

**Дата:** 2026-02-25
**Приоритет:** Высокий
**Две задачи в одном ТЗ** — они независимы, можно делать в любом порядке.

---

## Часть A: Usage Logging

### Цель

Записывать в БД стоимость каждого AI-вызова. Данные уже считаются в `onFinish` через TokenLens — нужно сохранять их в таблицу, а не только отправлять в dev panel.

### Что сделать

**1. Новая таблица `ai_usage_log`** (Drizzle ORM, новая миграция):

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid, PK | — |
| chatId | uuid, FK → Chat | — |
| userId | uuid, FK → User | — |
| modelId | varchar | реальный ID модели (например `claude-sonnet-4-5-20250929`) |
| inputTokens | integer | `usage.promptTokens` |
| outputTokens | integer | `usage.completionTokens` |
| thinkingTokens | integer, default 0 | на будущее |
| cacheWriteTokens | integer, default 0 | на будущее |
| cacheReadTokens | integer, default 0 | на будущее |
| costUsd | real | из TokenLens `summary.totalCost` |
| chatMode | varchar | chat / expertise / create / project:executor / project:expert / project:professor |
| durationMs | integer, nullable | `totalTime` из Performance логов |
| createdAt | timestamp, default now() | — |

Индексы: `(userId, createdAt)`, `(chatMode, createdAt)`.

**2. Функция записи** в `lib/db/queries.ts`:

```typescript
saveAiUsageLog({ chatId, userId, modelId, inputTokens, outputTokens, thinkingTokens, cacheWriteTokens, cacheReadTokens, costUsd, chatMode, durationMs })
```

**3. Интеграция** в `app/(chat)/api/chat/route.ts`:

В `onFinish` callback, после блока где формируется `finalMergedUsage` (после `const summary = getUsage(...)`) — добавить вызов `saveAiUsageLog(...)`. Вызов fire-and-forget (`.catch(console.error)`) — не блокировать streaming.

Откуда брать данные — всё уже доступно в scope:
- `usage.promptTokens`, `usage.completionTokens` — из callback
- `summary.totalCost` — из TokenLens
- `modelId` — уже вычисляется в этом блоке
- `chatMode` — из requestBody
- `id` (chatId), `session.user.id` — из scope route
- `totalTime` — из Performance логов (переменная `totalTime = Date.now() - startTime`)
- Для проектных чатов: chatMode = `project:${tier}`

**4. Professor pipeline** (`lib/ai/professor-pipeline.ts`):

Professor имеет 3 фазы streamText (Анализ, Исполнение, Синтез) — логировать каждую фазу отдельно (3 записи на один professor-запрос). ChatMode для всех трёх: `project:professor`.

### Ограничения

- Не трогать UI
- Не трогать dev panel / `data-usage` поток — он продолжает работать как есть
- Если TokenLens не вернул summary (ошибка) — не записывать (не падать)

### Проверка

Отправить сообщение в режиме Экспертизы → в таблице `ai_usage_log` должна появиться запись с заполненными полями.

---

## Часть B: Миграция Sonnet 4.5 → 4.6

### Цель

Переключить основную модель Sonnet с `claude-sonnet-4-5-20250929` на `claude-sonnet-4-6`. Та же цена, лучше качество.

### Что сделать в `lib/ai/providers.ts`

Три замены:

1. `customProvider.languageModels["claude-sonnet"]`: `anthropic("claude-sonnet-4-5-20250929")` → `anthropic("claude-sonnet-4-6")`
2. `customProvider.languageModels["artifact-model"]`: `anthropic("claude-sonnet-4-5-20250929")` → `anthropic("claude-sonnet-4-6")`
3. Прямой экспорт `claudeSonnet`: `anthropic("claude-sonnet-4-5-20250929")` → `anthropic("claude-sonnet-4-6")`

### Что НЕ трогать

- `claude-haiku` — остаётся `claude-haiku-4-5-20251001`
- `claude-opus` — остаётся `claude-opus-4-6`
- `title-model` — остаётся Haiku
- Ключ `"claude-sonnet-4-6"` — остаётся как есть (используется для Briefing Author)
- Никакие `providerOptions` / thinking / effort — это следующее ТЗ

### Обновить документацию

В `docs/ai-providers.md` — таблица "Использование в коде через myProvider":
- Строка `claude-sonnet`: реальный ID → `claude-sonnet-4-6`
- Строка `artifact-model`: реальный ID → `claude-sonnet-4-6`

### Проверка

Отправить пару сообщений в Экспертизе и Создании — должны отвечать без ошибок.

---

## Порядок выполнения

Части A и B независимы. Рекомендуемый порядок: сначала A (logging), потом B (миграция) — тогда после миграции usage logging уже будет писать данные новой модели.
