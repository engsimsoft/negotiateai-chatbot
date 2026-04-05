# ТЗ-SDK6: Миграция AI SDK v5 → v6

**Версия:** v3.65.0  
**Приоритет:** HIGH — закрывает 25% gap в расчёте стоимости (cacheWriteTokens)

---

## Контекст

Simply использует `ai@5.0.123` и `@ai-sdk/anthropic@2.0.63`. В v5 поле `cacheWriteTokens` (`cache_creation_input_tokens` от Anthropic) недоступно нативно — отсюда `(usage as any)` касты и нулевые значения при cache write. AI SDK v6 даёт нативные типы через `inputTokenDetails` и `outputTokenDetails`.

---

## Цель

- Получить нативный `cacheWriteTokens` без костылей
- Убрать все `(usage as any)` касты
- TypeScript компилируется чисто

---

## Что делаем

### 1. Обновить зависимости

Запустить codemod:

```bash
npx @ai-sdk/codemod v6
```

Обновить `package.json` вручную до актуальных мажорных версий:

```
ai              5.0.123  →  6.x
@ai-sdk/anthropic  2.0.63  →  3.x
@ai-sdk/google     2.0.44  →  3.x
@ai-sdk/react     2.0.105  →  совместимая с ai@6
```

⚠️ Проверить `@openrouter/ai-sdk-provider` — если несовместим с `LanguageModelV3`, временно заменить OpenRouter-маршруты на прямой `@ai-sdk/anthropic`.

---

### 2. Проверить результат codemod

Codemod автоматически переименует:
- `CoreMessage` → `ModelMessage`
- `convertToCoreMessages` → `convertToModelMessages` (+ добавит `await`)

Файлы затронутые переименованием (из аудита):

| Файл | Что меняется |
|---|---|
| `app/(chat)/api/chat/route.ts` | `convertToCoreMessages` → `await convertToModelMessages`, `CoreMessage` → `ModelMessage` |
| `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` | то же |
| `app/(chat)/api/assistant/ben/route.ts` | `convertToCoreMessages` → `await convertToModelMessages` |
| `lib/ai/professor-pipeline.ts` | `CoreMessage` → `ModelMessage` |
| `lib/utils.ts` | `CoreMessage` → `ModelMessage` (в `sanitizeCoreMessages`) |

Убедиться что `await` проставлен корректно — особенно в route-файлах где вызов мог быть синхронным.

---

### 3. Обновить `extractUsageFields()` в `lib/ai/usage-utils.ts`

В v6 usage имеет вложенную структуру вместо плоской. Заменить тело функции:

```ts
export function extractUsageFields(
  usage: LanguageModelUsage | undefined | null,
): ExtractedUsage {
  if (!usage) {
    return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, thinkingTokens: 0 };
  }

  return {
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    cacheReadTokens: usage.inputTokenDetails?.cachedTokens ?? 0,
    cacheWriteTokens: usage.inputTokenDetails?.cacheWriteTokens ?? 0,
    thinkingTokens: usage.outputTokenDetails?.reasoningTokens ?? 0,
  };
}
```

Убрать все `(usage as any)` касты в 4 файлах из аудита:
- `app/(chat)/api/chat/route.ts`
- `app/(chat)/api/service-chat/route.ts`
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts`
- `lib/ai/usage-utils.ts`

---

### 4. Проверить streaming routes

После миграции убедиться что 3 streaming route работают корректно — в v6 возможны изменения в `toUIMessageStreamResponse()` и связанных методах:
- `app/(chat)/api/chat/route.ts`
- `app/(chat)/api/service-chat/route.ts`
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts`

---

### 5. Финальная проверка

```bash
tsc --noEmit
```

Исправить все ошибки компиляции — в 62 файлах с импортами из `"ai"` могут быть переименованные или удалённые символы. Исправить до деплоя.

---

## Что НЕ делаем в этом ТЗ

- `generateObject` — deprecated в v6, но работает. Миграция на `generateText + Output.object()` — отдельное ТЗ
- Никаких изменений в логике, промптах, UI, БД

---

## Ожидаемый результат

- `cacheWriteTokens` заполняется нативно во всех 21 точке логирования
- Нет `(usage as any)` в кодовой базе
- `tsc --noEmit` — без ошибок
- Все streaming routes работают в dev и production
