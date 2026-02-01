# AI-провайдеры и модели

**Версия:** 1.0.0
**Последнее обновление:** 2026-02-02
**Статус:** 2 провайдера, 5 моделей

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
| SDK | `@ai-sdk/openai` (совместимый API) |
| Base URL | `https://openrouter.ai/api/v1` |
| API Key | `OPENROUTER_API_KEY` |
| Документация | https://openrouter.ai/docs |

---

## Модели

### Google Gemini

| Модель | ID в проекте | Реальный ID | Input | Output | Контекст | Особенности |
|--------|--------------|-------------|-------|--------|----------|-------------|
| **Gemini 3 Pro** | `gemini-3-pro` | `gemini-3-pro-preview` | $2.00/1M | $12.00/1M | 1M токенов | Dynamic thinking, 64K output |
| **Gemini 2.5 Flash** | `gemini-2.5-flash` | `gemini-2.5-flash` | $0.075/1M | $0.30/1M | 200K токенов | Быстрый, дешёвый |
| **Gemini 2.5 Pro** | `artifact-model` | `gemini-2.5-pro` | $1.25/1M | $5.00/1M | 1M токенов | Для suggestions |

### Anthropic Claude (через OpenRouter)

| Модель | ID в проекте | OpenRouter ID | Input | Output | Контекст | Особенности |
|--------|--------------|---------------|-------|--------|----------|-------------|
| **Claude Sonnet 4** | `claude-sonnet-4` | `anthropic/claude-sonnet-4` | $3.00/1M | $15.00/1M | 200K токенов | Быстрый и умный |
| **Claude Opus 4** | `claude-opus-4` | `anthropic/claude-opus-4` | $15.00/1M | $75.00/1M | 200K токенов | Максимальное качество |

> **Примечание:** Цены OpenRouter могут включать наценку ~5-10% к оригинальным ценам Anthropic.

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
import { claudeSonnet, claudeOpus, getClaudeModel } from '@/lib/ai/providers';

// Прямое использование
const result = await generateText({
  model: claudeSonnet,
  prompt: '...',
});

// Или через функцию
const model = getClaudeModel('opus');
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
| Claude Sonnet 4 | $0.018 | $0.060 |
| Claude Opus 4 | $0.090 | $0.300 |

---

## Выбор модели

### Когда использовать какую модель

| Задача | Рекомендуемая модель | Причина |
|--------|---------------------|---------|
| Сложный анализ | Gemini 3 Pro | Dynamic thinking |
| Быстрые ответы | Gemini 2.5 Flash | Скорость + цена |
| Креативный текст | Claude Sonnet 4 | Качество генерации |
| Критически важные задачи | Claude Opus 4 | Максимальное качество |

### Автовыбор в проекте

Система автоматически выбирает модель на основе:
1. Агента (см. [ai-agents.md](ai-agents.md))
2. Ручного переключения пользователем

---

## История изменений

| Дата | Версия | Изменения |
|------|--------|-----------|
| 2026-02-02 | 1.0.0 | Создание документа, добавлены Google и OpenRouter |

---

**Обновлено:** 2026-02-02
