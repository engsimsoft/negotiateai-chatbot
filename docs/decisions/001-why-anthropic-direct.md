# ADR 001: Почему прямой Anthropic API (а не через OpenRouter)

**Дата:** 2025-10-14
**Статус:** Принято

---

## Контекст

Для проекта NegotiateAI Assistant нужно было выбрать способ подключения к Claude Sonnet 4.5. Рассматривались два варианта:

1. **Прямое подключение к Anthropic API** - официальный SDK от Anthropic
2. **Через OpenRouter** - агрегатор LLM API с единым интерфейсом

Требования:
- Чтение DOCX и PDF файлов напрямую
- Function calling (tools)
- Streaming responses
- Хорошая документация
- Надёжность

---

## Решение

Выбрали **прямое подключение к Anthropic API** через официальный `@anthropic-ai/sdk`.

---

## Причины

### 1. Нативная поддержка DOCX/PDF

**Anthropic API** имеет нативную поддержку чтения документов через Messages API:

```typescript
const response = await anthropic.messages.create({
  messages: [{
    role: 'user',
    content: [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          data: base64Content
        }
      }
    ]
  }]
});
```

**OpenRouter** на момент принятия решения не имел встроенной поддержки document input - пришлось бы конвертировать все DOCX/PDF в текст, теряя форматирование и структуру.

### 2. Официальная документация и SDK

**Anthropic:**
- Официальный TypeScript SDK с full type safety
- Детальная документация на [docs.anthropic.com](https://docs.anthropic.com)
- Примеры для всех use cases
- Быстрые обновления и support

**OpenRouter:**
- Использует OpenAI-совместимый формат
- Документация менее детальная
- Может быть задержка в поддержке новых features Claude

### 3. Прямой контроль и debugging

С прямым API:
- Полный контроль над запросами
- Понятные error messages от Anthropic
- Легче дебажить проблемы
- Нет промежуточного слоя

С OpenRouter:
- Дополнительный слой абстракции
- Ошибки могут быть менее понятны
- Сложнее trace проблемы

### 4. Стоимость

**Anthropic Direct:**
- Цена напрямую от Anthropic
- $3 за 1M input tokens
- $15 за 1M output tokens
- Нет дополнительных комиссий

**OpenRouter:**
- Те же цены (для Claude)
- Но могут добавлять небольшую наценку для некоторых моделей
- Зависит от их тарифов

### 5. Надёжность

**Anthropic Direct:**
- Прямое подключение к источнику
- Меньше точек отказа
- SLA от Anthropic

**OpenRouter:**
- Дополнительная точка отказа (их инфраструктура)
- Если OpenRouter down - API не работает, даже если Anthropic up

---

## Последствия

### Плюсы

- ✅ **Нативное чтение DOCX/PDF** - ключевая функция для проекта
- ✅ **Лучшая документация** - быстрее разработка
- ✅ **Type safety** - TypeScript SDK из коробки
- ✅ **Меньше зависимостей** - один прямой API
- ✅ **Легче debug** - понятные ошибки

### Минусы

- ❌ **Vendor lock-in** - привязка к Anthropic
- ❌ **Нет единого интерфейса** - если захотим другую LLM, придётся переписывать
- ❌ **Нужны отдельные ключи** - для каждого провайдера свой ключ

### Trade-offs

Мы выбрали **специализацию над универсальностью**. OpenRouter даёт гибкость переключаться между моделями, но мы получаем:
- Лучшую интеграцию с Claude
- Нативные features Anthropic API
- Более быстрый time-to-market

---

## Альтернативы

### Альтернатива 1: OpenRouter

**Что это:** Агрегатор API для множества LLM (Claude, GPT-4, Llama, и др.)

**Почему отклонили:**
- Нет нативной поддержки DOCX/PDF input (на момент решения)
- Дополнительный слой абстракции
- Менее детальная документация для Claude-специфичных features

**Когда может быть лучше:**
- Нужно быстро переключаться между разными моделями (A/B тестирование)
- Один интерфейс для всех LLM
- Нужна fallback стратегия (если одна модель недоступна - переключиться на другую)

**Пример use case для OpenRouter:**
```typescript
// Легко переключаться между моделями
const models = [
  'anthropic/claude-sonnet-4.5',
  'openai/gpt-4-turbo',
  'google/gemini-pro'
];

// Пробовать пока не сработает
for (const model of models) {
  try {
    return await openrouter.chat({model, messages});
  } catch (error) {
    continue;
  }
}
```

### Альтернатива 2: LangChain + любой провайдер

**Что это:** Framework для работы с LLM через абстрактные интерфейсы

**Почему отклонили:**
- Слишком тяжеловесный для простого чат-бота
- Больше кода и зависимостей
- Overkill для наших требований

**Когда может быть лучше:**
- Сложные multi-step workflows
- Нужны chains, agents, memory
- Интеграция с векторными БД

---

## Ссылки и ресурсы

- [Anthropic Messages API](https://docs.anthropic.com/claude/reference/messages_post)
- [Anthropic SDK for TypeScript](https://github.com/anthropics/anthropic-sdk-typescript)
- [Document Support in Claude](https://docs.anthropic.com/claude/docs/vision#document-support)
- [OpenRouter Documentation](https://openrouter.ai/docs)

---

## Примечания

### Возможный пересмотр решения

Если OpenRouter добавит:
1. Нативную поддержку DOCX/PDF input
2. Лучшую документацию для Claude features
3. Не добавит overhead в latency

Тогда можно будет пересмотреть решение для получения гибкости multi-model.

### Миграция на OpenRouter

Если потребуется в будущем, миграция относительно простая:

```typescript
// Было (Anthropic):
import Anthropic from '@anthropic-ai/sdk';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Станет (OpenRouter):
import OpenAI from 'openai';  // OpenRouter совместим с OpenAI SDK
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY
});
```

Основная работа будет в адаптации document input (конвертация DOCX/PDF в текст).

---

## История изменений

- **2025-10-14** - Документ создан (Владимир)
- Решение принято для MVP версии проекта
