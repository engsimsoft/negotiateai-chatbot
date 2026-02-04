# AI-провайдеры и модели

**Версия:** 1.1.1
**Последнее обновление:** 2026-02-03
**Статус:** 2 провайдера, 6 моделей

---

## О документе

Этот документ — **единственный источник правды** для:
- AI-провайдеров (Google, OpenRouter)
- Моделей и их характеристик
- Цен на токены
- API ключей и настроек

**Связанные документы:**
- [ai-agents.md](ai-agents.md) — агенты и промпты
- [ai-tools.md](ai-tools.md) — инструменты
- [deployment.md](deployment.md) — настройка production

**Ключевые файлы:**
- [lib/ai/providers.ts](../lib/ai/providers.ts) — конфигурация провайдеров
- [lib/ai/models.ts](../lib/ai/models.ts) — список моделей для UI

---

## Провайдеры

### Google AI (основной)

| Параметр | Значение |
|----------|----------|
| SDK | `@ai-sdk/google` |
| API Key | `GOOGLE_GENERATIVE_AI_API_KEY` |
| Документация | https://ai.google.dev/ |

### OpenRouter (для Claude)

| Параметр | Значение |
|----------|----------|
| SDK | `@openrouter/ai-sdk-provider@1.5.4` |
| API Key | `OPENROUTER_API_KEY` |
| Документация | https://openrouter.ai/docs |

> **Важно:** Используем официальный OpenRouter SDK, а не generic `@ai-sdk/openai`. Это необходимо для корректной работы tool calls с Claude-моделями.

---

## Модели

### Google Gemini

| Модель | ID в проекте | Реальный ID | Input | Output | Контекст | Особенности |
|--------|--------------|-------------|-------|--------|----------|-------------|
| **Gemini 3 Pro** | `gemini-3-pro` | `gemini-3-pro-preview` | $2.00/1M | $12.00/1M | 1M токенов | Dynamic thinking, 64K output |
| **Gemini 2.5 Flash** | `gemini-2.5-flash` | `gemini-2.5-flash` | $0.075/1M | $0.30/1M | 200K токенов | Быстрый, дешёвый |
| **Gemini 2.5 Pro** | `artifact-model` | `gemini-2.5-pro` | $1.25/1M | $5.00/1M | 1M токенов | Для suggestions |

### Anthropic Claude 4.5 (через OpenRouter)

| Модель | Экспорт | OpenRouter ID | Input | Output | Контекст | Особенности |
|--------|---------|---------------|-------|--------|----------|-------------|
| **Claude Haiku 4.5** | `claudeHaiku` | `anthropic/claude-haiku-4.5` | $1.00/1M | $5.00/1M | 200K | Самый быстрый и дешёвый |
| **Claude Sonnet 4.5** | `claudeSonnet` | `anthropic/claude-sonnet-4.5` | $3.00/1M | $15.00/1M | 1M | Баланс скорости и качества |
| **Claude Opus 4.5** | `claudeOpus` | `anthropic/claude-opus-4.5` | $5.00/1M | $25.00/1M | 200K | Reasoning, сложные задачи |

> **Ссылки:** [Haiku](https://openrouter.ai/anthropic/claude-haiku-4.5) | [Sonnet](https://openrouter.ai/anthropic/claude-sonnet-4.5) | [Opus](https://openrouter.ai/anthropic/claude-opus-4.5)

---

## Использование в проекте

### Основные модели (через myProvider)

```typescript
import { myProvider } from '@/lib/ai/providers';

// Используются в streamText/generateText
const model = myProvider.languageModel('gemini-3-pro');
```

| ID | Назначение |
|----|------------|
| `auto` | Автовыбор (fallback на gemini-2.5-flash) |
| `gemini-3-pro` | Профессиональные задачи |
| `gemini-2.5-flash` | Быстрые/простые задачи |
| `title-model` | Генерация заголовков чатов |
| `artifact-model` | Генерация suggestions |

### Claude модели (прямой экспорт)

```typescript
import { claudeHaiku, claudeSonnet, claudeOpus, getClaudeModel } from '@/lib/ai/providers';

// Прямое использование
const result = await generateText({
  model: claudeSonnet,
  prompt: '...',
});

// Или через функцию
const model = getClaudeModel('haiku');  // 'haiku' | 'sonnet' | 'opus'
```

---

## Настройки моделей

### Gemini 3 Pro

```typescript
{
  temperature: 1.0,
  thinkingConfig: {
    thinkingBudget: 1024,  // токенов на размышление
  },
  maxSteps: 5,             // для tool calls
}
```

### Gemini 2.5 Flash

```typescript
{
  temperature: 1.0,
}
```

### Claude (общие)

```typescript
{
  temperature: 1.0,
  // OpenRouter автоматически применяет настройки
}
```

---

## Лимиты и квоты

### Google AI

| Лимит | Free tier | Pay-as-you-go |
|-------|-----------|---------------|
| RPM (requests/min) | 15 | 1000+ |
| TPM (tokens/min) | 1M | 4M+ |
| RPD (requests/day) | 1500 | Unlimited |

### OpenRouter

| Лимит | Значение |
|-------|----------|
| Rate limit | Зависит от модели |
| Concurrent requests | По балансу аккаунта |

---

## Environment Variables

```bash
# Google AI (обязательно)
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key

# OpenRouter (для Claude)
OPENROUTER_API_KEY=your_openrouter_api_key
```

### Где получить ключи

| Провайдер | URL |
|-----------|-----|
| Google AI | https://aistudio.google.com/apikey |
| OpenRouter | https://openrouter.ai/keys |

---

## Расчёт стоимости

Проект использует **tokenlens** для автоматического расчёта:

```typescript
import { getUsage } from 'tokenlens/helpers';

const summary = getUsage({ modelId, usage, providers });
// Возвращает: { inputCost, outputCost, totalCost }
```

### Пример расчёта

| Модель | 1K input + 1K output | 10K input + 2K output |
|--------|---------------------|----------------------|
| Gemini 3 Pro | $0.014 | $0.044 |
| Gemini 2.5 Flash | $0.000375 | $0.00135 |
| Claude Haiku 4.5 | $0.006 | $0.020 |
| Claude Sonnet 4.5 | $0.018 | $0.060 |
| Claude Opus 4.5 | $0.030 | $0.100 |

---

## Выбор модели

### Когда использовать какую модель

| Задача | Рекомендуемая модель | Причина |
|--------|---------------------|---------|
| Сложный анализ | Gemini 3 Pro | Dynamic thinking |
| Быстрые ответы | Gemini 2.5 Flash | Скорость + цена |
| Простые задачи (Claude) | Claude Haiku 4.5 | Дешёвый, быстрый |
| Креативный текст | Claude Sonnet 4.5 | Качество + 1M контекст |
| Критически важные задачи | Claude Opus 4.5 | Reasoning, сложные задачи |

### Автовыбор в проекте

Система автоматически выбирает модель на основе:
1. Агента (см. [ai-agents.md](ai-agents.md))
2. Ручного переключения пользователем

---

## История изменений

| Дата | Версия | Изменения |
|------|--------|-----------|
| 2026-02-03 | 1.1.1 | Переход на официальный OpenRouter SDK (`@openrouter/ai-sdk-provider`) |
| 2026-02-02 | 1.1.0 | Обновлены модели Claude на 4.5 (Haiku, Sonnet, Opus) |
| 2026-02-02 | 1.0.0 | Создание документа, добавлены Google и OpenRouter |

---

**Обновлено:** 2026-02-03
