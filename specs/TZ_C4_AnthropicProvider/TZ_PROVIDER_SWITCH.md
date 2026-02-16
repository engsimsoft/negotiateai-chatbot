# ТЗ: Переключение AI-провайдера на Anthropic Claude

**Дата:** 2026-02-16
**Приоритет:** Критический
**Тип:** Инфраструктура
**Версия ТЗ:** 1.1 (обновлено после code review)

---

## Суть задачи

Переключить весь AI-бэкенд Simply с Google Gemini на Anthropic Claude через прямой API (`@ai-sdk/anthropic`). OpenRouter больше не используется. Google Gemini остаётся ТОЛЬКО как будущий tool для vision (не в этом ТЗ).

---

## Карта моделей

| Внутренний ID | Модель Anthropic | Назначение |
|---|---|---|
| `claude-haiku` | `claude-haiku-4-5-20251001` | Simply Chat, Бен, Секретарь, клерки, классификатор, title-model |
| `claude-sonnet` | `claude-sonnet-4-5-20250929` | Основной чат (бывший gemini-3-pro), Менеджер, Эксперт |
| `claude-opus` | `claude-opus-4-6` | Профессор (планирование, проверка) |

**Принцип:** Haiku = быстро и дёшево. Sonnet = основная работа. Opus = критическая аналитика.

---

## Шаги выполнения

### Шаг 0: Зависимости и ENV

```bash
npm install @ai-sdk/anthropic
```

В `.env.local` добавить:
```
ANTHROPIC_API_KEY=<ключ уже создан, workspace Simply_1>
```

В Vercel Environment Variables — добавить `ANTHROPIC_API_KEY` для production и preview.

OpenRouter можно пока не трогать (закомментирован), удалим позже при чистке.

---

### Шаг 1: `lib/ai/providers.ts`

**Что сделать:** Заменить Google на Anthropic как основной провайдер.

**Было:**
```typescript
import { createGoogleGenerativeAI } from "@ai-sdk/google";
const google = createGoogleGenerativeAI({ ... });

export const myProvider = customProvider({
  languageModels: {
    "auto": google("gemini-2.5-flash"),
    "gemini-3-pro": google("gemini-3-pro-preview"),
    "gemini-2.5-flash": google("gemini-2.5-flash"),
    "title-model": google("gemini-2.5-flash"),
    "artifact-model": google("gemini-2.5-pro"),
  },
});
```

**Стало:**
```typescript
import { createAnthropic } from "@ai-sdk/anthropic";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const myProvider = isTestEnvironment
  ? (() => {
      const { chatModel, titleModel, artifactModel } = require("./models.mock");
      return customProvider({
        languageModels: {
          "claude-sonnet": chatModel,
          "claude-haiku": chatModel,
          "claude-opus": chatModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        "claude-sonnet": anthropic("claude-sonnet-4-5-20250929"),
        "claude-haiku": anthropic("claude-haiku-4-5-20251001"),
        "claude-opus": anthropic("claude-opus-4-6"),
        "title-model": anthropic("claude-haiku-4-5-20251001"),
        "artifact-model": anthropic("claude-sonnet-4-5-20250929"),
      },
    });

// Прямые экспорты для использования в проектах и pipeline
export const claudeHaiku = anthropic("claude-haiku-4-5-20251001");
export const claudeSonnet = anthropic("claude-sonnet-4-5-20250929");
export const claudeOpus = anthropic("claude-opus-4-6");

export function getClaudeModel(name: "haiku" | "sonnet" | "opus") {
  switch (name) {
    case "haiku": return claudeHaiku;
    case "opus": return claudeOpus;
    default: return claudeSonnet;
  }
}
```

**Удалить:** весь закомментированный код OpenRouter, импорт `createGoogleGenerativeAI`.
**Не удалять:** `@ai-sdk/google` из package.json (понадобится для vision tool позже).

---

### Шаг 2: `lib/prompts/types.ts`

**Что сделать:** Обновить `ModelId`.

**Было:**
```typescript
export type ModelId =
  | 'gemini-3-pro'
  | 'gemini-2.5-flash'
  | 'claude-sonnet-4-20250514'
  | 'claude-opus-4-20250514'
  | 'gpt-4o'
  | 'gpt-4o-mini';
```

**Стало:**
```typescript
export type ModelId =
  | 'claude-haiku'
  | 'claude-sonnet'
  | 'claude-opus';
```

---

### Шаг 3: `lib/prompts/builder/composer.ts`

**Что сделать:** Заменить все defaultModel на Claude.

Найти и заменить:

| Где | Было | Стало |
|---|---|---|
| `composeChatPrompt()` return | `model: context.model \|\| 'gemini-3-pro'` | `model: context.model \|\| 'claude-sonnet'` |
| `composeAgentPrompt()` return | `model: (context.model \|\| agent.model \|\| 'gemini-2.5-flash') as ModelId` | `model: (context.model \|\| 'claude-haiku') as ModelId` |
| `composeSkillPrompt()` return | `model: context.model \|\| 'gemini-3-pro'` | `model: context.model \|\| 'claude-sonnet'` |

**Важно:** В `composeAgentPrompt` убрать `agent.model` из fallback-цепочки — модель теперь определяется здесь, не в config.yaml агента. Это проще и не требует обновления каждого yaml-файла.

---

### Шаг 4: `lib/ai/models.ts`

**Что сделать:** Обновить UI-список моделей.

**Стало:**
```typescript
export const DEFAULT_CHAT_MODEL: string = "claude-sonnet";

export const chatModels: ChatModel[] = [
  {
    id: "claude-sonnet",
    name: "Claude Sonnet",
    description: "Основная модель — баланс скорости и качества",
    pricing: { input: "$3", output: "$15" },
  },
  {
    id: "claude-haiku",
    name: "Claude Haiku",
    description: "Быстрая модель для простых задач",
    pricing: { input: "$1", output: "$5" },
  },
  {
    id: "claude-opus",
    name: "Claude Opus",
    description: "Максимальное качество для сложных задач",
    pricing: { input: "$15", output: "$75" },
  },
];
```

**Примечание:** Убрать модель "auto" — она больше не нужна, модель определяется контекстом (чат, агент, проект).

---

### Шаг 5: `lib/ai/model-tiers.ts`

**Что сделать:** Переключить модели проектов на Claude.

```typescript
export const PROJECT_MODELS: Record<ProjectModelTier, ModelTierConfig> = {
  executor: {
    id: "executor",
    name: "Исполнитель",
    description: "Быстрый и экономичный для простых задач",
    model: myProvider.languageModel("claude-haiku"),
    icon: "⚡",
    pricing: { input: 1.0, output: 5.0 },
  },
  expert: {
    id: "expert",
    name: "Эксперт",
    description: "Баланс скорости и качества",
    model: myProvider.languageModel("claude-sonnet"),
    icon: "🎯",
    pricing: { input: 3.0, output: 15.0 },
  },
  professor: {
    id: "professor",
    name: "Профессор",
    description: "Максимальное качество, сложные задачи",
    model: myProvider.languageModel("claude-opus"),
    icon: "🎓",
    pricing: { input: 15.0, output: 75.0 },
  },
};
```

---

### Шаг 6: `lib/ai/entitlements.ts`

**Что сделать:** Обновить доступные модели.

```typescript
export const userEntitlements: Entitlements = {
  maxMessagesPerDay: 999999,
  availableChatModelIds: ["claude-sonnet", "claude-haiku", "claude-opus"],
};
```

---

### Шаг 7: `lib/prompts/agents/ben/config.yaml`

**Что сделать:** Обновить модель (хотя composer уже не читает это поле, для консистентности).

```yaml
model: claude-haiku
```

---

### Шаг 8: Конкретный список файлов с заменой model ID

> **Добавлено v1.1:** Code review выявил файлы не покрытые шагами 1-7.
> Без обновления этих файлов проект НЕ ЗАПУСТИТСЯ — `myProvider.languageModel("gemini-3-pro")` упадёт.

#### 8a: `app/(chat)/api/chat/schema.ts`

**Было:**
```typescript
selectedChatModel: z.enum(["auto", "gemini-3-pro", "gemini-2.5-flash"]),
```

**Стало:**
```typescript
selectedChatModel: z.enum(["claude-sonnet", "claude-haiku", "claude-opus"]),
```

#### 8b: `app/(chat)/api/chat/route.ts` — 3 изменения

**8b-1: Убрать Gemini `providerOptions` (строки ~527-533)**

**Было:**
```typescript
providerOptions: isProjectChat ? {} : {
  google: {
    thinkingConfig: {
      thinkingBudget: 1024,
    },
  },
},
```

**Стало:** Удалить весь блок `providerOptions`.

> **Решение:** Claude Sonnet работает качественно без extended thinking. Если понадобится — включим точечно позже через `anthropic: { thinking: { type: "enabled", budgetTokens: N } }`.

**8b-2: Заменить логику выбора модели (строки ~381-385)**

**Было:**
```typescript
// Regular chat: use Gemini
const builtPrompt = buildChatPrompt(promptContext);
systemPromptText = builtPrompt.systemPrompt;
const geminiModel = selectedChatModel === "auto" ? "gemini-3-pro" : selectedChatModel;
modelToUse = myProvider.languageModel(geminiModel);
```

**Стало:**
```typescript
// Regular chat: use Claude
const builtPrompt = buildChatPrompt(promptContext);
systemPromptText = builtPrompt.systemPrompt;
modelToUse = myProvider.languageModel(selectedChatModel);
```

**8b-3: Включить `convertTextFilePartsInMessage` обратно (строки ~289-292)**

**Было:**
```typescript
// ⚠️ ВРЕМЕННО: Конвертация text/plain отключена (Gemini поддерживает)
// const processedMessage = await convertTextFilePartsInMessage(message as ChatMessage);
const uiMessages = [...convertToUIMessages(messagesForModel), message as ChatMessage];
```

**Стало:**
```typescript
// Claude API не поддерживает text/plain как file attachment — конвертируем в text
const processedMessage = await convertTextFilePartsInMessage(message as ChatMessage);
const uiMessages = [...convertToUIMessages(messagesForModel), processedMessage];
```

#### 8c: `lib/ai/professor-pipeline.ts` (строки 28-31)

**Было:**
```typescript
const analyzeModel = myProvider.languageModel("gemini-3-pro");
const executeModel = myProvider.languageModel("gemini-2.5-flash");
const synthesizeModel = myProvider.languageModel("gemini-3-pro");
```

**Стало:**
```typescript
const analyzeModel = myProvider.languageModel("claude-opus");
const executeModel = myProvider.languageModel("claude-haiku");
const synthesizeModel = myProvider.languageModel("claude-opus");
```

#### 8d: `app/(chat)/api/service-chat/route.ts` — функция `getModelId()` (строки ~99-109)

**Было:**
```typescript
function getModelId(context: ServiceChatContext): string {
  switch (context) {
    case "project-creation":
      return "gemini-3-pro";
    case "ben":
    case "project-manager":
      return "gemini-2.5-flash";
    default:
      return "gemini-2.5-flash";
  }
}
```

**Стало:**
```typescript
function getModelId(context: ServiceChatContext): string {
  switch (context) {
    case "project-creation":
      return "claude-sonnet";
    case "ben":
    case "project-manager":
      return "claude-haiku";
    default:
      return "claude-haiku";
  }
}
```

#### 8e: `app/(chat)/api/projects/[id]/generate-summary/route.ts` (строка ~73)

**Было:**
```typescript
model: myProvider.languageModel("gemini-2.5-flash"),
```

**Стало:**
```typescript
model: myProvider.languageModel("claude-haiku"),
```

#### 8f: Клерки и профессор — env fallbacks

| Файл | Строка | Было | Стало |
|---|---|---|---|
| `lib/ai/clerks/task-summarizer.ts` | ~141 | `"gemini-2.5-flash"` | `"claude-haiku"` |
| `lib/ai/professors/task-reviewer.ts` | ~121 | `"gemini-3-pro"` | `"claude-opus"` |
| `lib/ai/clerks/snapshot-creator.ts` | ~161 | `"gemini-2.5-flash"` | `"claude-haiku"` |

#### 8g: UI-компоненты — defaultModelId

| Файл | Строка | Было | Стало |
|---|---|---|---|
| `components/input/input-context.tsx` | ~96 | `defaultModelId = "auto"` | `defaultModelId = "claude-sonnet"` |
| `components/input/compact-input.tsx` | ~56 | `defaultModelId = "auto"` | `defaultModelId = "claude-sonnet"` |

---

### Шаг 9: Комментарии и пометки "ВРЕМЕННО"

Удалить/обновить все `⚠️ ВРЕМЕННО (v3.7.1)` комментарии в затронутых файлах. Они больше не актуальны — Claude теперь основной провайдер.

---

## Что НЕ входит в это ТЗ

- Переработка core blocks (`base.md`, `safety.md`, etc.) — отдельная задача
- Промпт Simply Chat — отдельная задача
- Промпт Бена — отдельная задача
- Vision tool (Gemini Pro) — будет позже. `lib/ai/vision-ocr.ts` НЕ ТРОГАЕМ (свой экземпляр Google)
- Обновление документации в `docs/` — после проверки что всё работает
- Extended Thinking для Claude — если понадобится, включим точечно

---

## Что НЕ трогаем

- `lib/ai/vision-ocr.ts` — использует свой `createGoogleGenerativeAI`, не через `myProvider`
- `@ai-sdk/google` в package.json — нужен для vision-ocr.ts
- Документация (`docs/`, ADR) — обновляется отдельно
- `_archive/` — история, не трогать

---

## Как проверить

1. `npx tsc --noEmit` — 0 ошибок типов
2. `npm run build` — билд проходит
3. `npm run dev` — проект стартует без ошибок
4. Основной чат — отправить сообщение, получить ответ от Claude (не Gemini)
5. Бен (кнопка ?) — отвечает
6. Создание проекта (Секретарь) — интервью работает
7. В консоли Anthropic (console.anthropic.com) — видны запросы в workspace Simply_1

---

## Риски

**Формат tool calls:** Claude и Gemini по-разному обрабатывают tools. Vercel AI SDK (`ai` package) абстрагирует это, но могут быть edge cases. Если tools ломаются — проверить формат определений в API route.

**Streaming:** `@ai-sdk/anthropic` поддерживает streaming через `streamText` из `ai` SDK. Должно работать без изменений, но проверить.

**text/plain attachments:** Решено включением `convertTextFilePartsInMessage` (шаг 8b-3).
