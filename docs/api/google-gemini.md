# Google Gemini API Integration

В проекте используется `Vercel AI SDK` для взаимодействия с Google Gemini API.

## Конфигурация

- **SDK:** `@ai-sdk/google`
- **Файл конфигурации:** `lib/ai/providers.ts`

### Используемая модель

Проект настроен на использование единой модели для всех задач:

- **Модель:** `gemini-2.5-pro`
- **Причины выбора:**
  - Стабильный релиз.
  - Большое контекстное окно (1M токенов), что идеально для работы с базой знаний через `system prompt`.
  - Поддержка `function calling` (tool use).
  - Нативная обработка документов через Vision API.

## Function Calling (Использование инструментов)

Vercel AI SDK предоставляет удобный интерфейс `streamText` и `generateText`, который автоматически обрабатывает вызов инструментов (tools).

**Пример вызова:**
```typescript
// app/(chat)/api/chat/route.ts

import { streamText } from 'ai';
import { google } from '@ai-sdk/google';

// ...

const { text, toolResults } = await streamText({
  model: google('gemini-2.5-pro'),
  system: systemPrompt,
  prompt: 'Твой запрос...',
  tools: {
    // ... определения инструментов
  }
});
```

## Streaming

Стриминг ответов от модели включен по умолчанию при использовании `streamText`. SDK самостоятельно обрабатывает поток данных и передает его на клиент в формате, совместимом с `useChat`.

Это обеспечивает "живой" отклик интерфейса, когда ответ от модели появляется постепенно, токен за токеном.
