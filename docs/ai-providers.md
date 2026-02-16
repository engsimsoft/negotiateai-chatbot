# AI-провайдеры и модели

**Версия:** 2.0.0
**Последнее обновление:** 2026-02-16
**Статус:** 2 провайдера, 3 основные модели + vision-ocr

---

## О документе

Этот документ — **единственный источник правды** для:
- AI-провайдеров (Anthropic, Google)
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

### Anthropic (основной — v3.23.0+)

| Параметр | Значение |
|----------|----------|
| SDK | `@ai-sdk/anthropic@2.0.63` |
| API Key | `ANTHROPIC_API_KEY` |
| Документация | https://docs.anthropic.com/ |

> **Важно:** Используем `@ai-sdk/anthropic@2.0.63` (не v3.x), т.к. v3 возвращает `LanguageModelV3`, несовместимый с текущим `ai@5.0.123` (ожидает `LanguageModelV2`).

### Google AI (только vision-ocr)

| Параметр | Значение |
|----------|----------|
| SDK | `@ai-sdk/google` |
| API Key | `GOOGLE_GENERATIVE_AI_API_KEY` |
| Документация | https://ai.google.dev/ |

> **Примечание:** Google AI используется только для vision-ocr (`lib/ai/vision-ocr.ts`). Все остальные AI-запросы идут через Anthropic.

---

## Модели

### Anthropic Claude

| Модель | ID в проекте | Реальный ID | Input | Output | Контекст | Особенности |
|--------|--------------|-------------|-------|--------|----------|-------------|
| **Claude Sonnet 4.5** | `claude-sonnet` | `claude-sonnet-4-5-20250929` | $3.00/1M | $15.00/1M | 200K токенов (1M бета) | Баланс скорости и качества (DEFAULT), max output 64K |
| **Claude Haiku 4.5** | `claude-haiku` | `claude-haiku-4-5-20251001` | $1.00/1M | $5.00/1M | 200K токенов | Самый быстрый и дешёвый, max output 64K |
| **Claude Opus 4.6** | `claude-opus` | `claude-opus-4-6` | $5.00/1M | $25.00/1M | 200K токенов (1M бета) | Максимальное качество, reasoning, max output 128K |

### Google Gemini (только vision-ocr)

| Модель | Использование |
|--------|---------------|
| Gemini (через `createGoogleGenerativeAI`) | OCR для изображений и PDF |

---

## Использование в проекте

### Основные модели (через myProvider)

```typescript
import { myProvider } from '@/lib/ai/providers';

// Используются в streamText/generateText
const model = myProvider.languageModel('claude-sonnet');
```

| ID | Назначение |
|----|------------|
| `claude-sonnet` | Основной чат (DEFAULT), Секретарь, Эксперт, артефакты |
| `claude-haiku` | Бен, Менеджер, Клерки, Исполнитель, заголовки чатов |
| `claude-opus` | Профессоры (планирование, ревью задач) |
| `title-model` | Генерация заголовков чатов (→ claude-haiku) |
| `artifact-model` | Генерация suggestions (→ claude-sonnet) |

### Прямые экспорты

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

### Claude (общие)

```typescript
{
  temperature: 1.0,
  maxSteps: 5,  // для tool calls
}
```

> **Примечание:** Claude не требует `providerOptions` (как `google.thinkingConfig` у Gemini). Extended thinking управляется через `maxSteps`.

---

## Лимиты и квоты

### Anthropic

| Лимит | Значение |
|-------|----------|
| RPM (requests/min) | Зависит от тарифа |
| TPM (tokens/min) | Зависит от тарифа |
| Concurrent requests | По тарифу аккаунта |

### Google AI (vision-ocr)

| Лимит | Free tier | Pay-as-you-go |
|-------|-----------|---------------|
| RPM (requests/min) | 15 | 1000+ |
| TPM (tokens/min) | 1M | 4M+ |
| RPD (requests/day) | 1500 | Unlimited |

---

## Environment Variables

```bash
# Anthropic (обязательно — основной провайдер)
ANTHROPIC_API_KEY=your_anthropic_api_key

# Google AI (для vision-ocr)
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key
```

### Где получить ключи

| Провайдер | URL |
|-----------|-----|
| Anthropic | https://console.anthropic.com/settings/keys |
| Google AI | https://aistudio.google.com/apikey |

---

## Расчёт стоимости

### Пример расчёта

| Модель | 1K input + 1K output | 10K input + 2K output |
|--------|---------------------|----------------------|
| Claude Haiku 4.5 | $0.006 | $0.020 |
| Claude Sonnet 4.5 | $0.018 | $0.060 |
| Claude Opus 4.6 | $0.030 | $0.100 |

---

## Выбор модели

### Когда использовать какую модель

| Задача | Рекомендуемая модель | Причина |
|--------|---------------------|---------|
| Быстрые ответы, клерки | Claude Haiku | Скорость + цена |
| Основной чат, экспертные задачи | Claude Sonnet | Баланс качества и цены |
| Планирование, ревью, критические задачи | Claude Opus | Максимальное качество reasoning |

### Автовыбор в проекте

Система автоматически выбирает модель на основе:
1. Роли (клерк/эксперт/профессор) — см. [ai-chats-map.md](ai-chats-map.md)
2. Ручного переключения пользователем (в основном чате)

---

## История изменений

| Дата | Версия | Изменения |
|------|--------|-----------|
| 2026-02-16 | 2.0.0 | Полное переключение на Anthropic Claude через `@ai-sdk/anthropic`. OpenRouter удалён. Google только для vision-ocr |
| 2026-02-03 | 1.1.1 | Переход на официальный OpenRouter SDK (`@openrouter/ai-sdk-provider`) |
| 2026-02-02 | 1.1.0 | Обновлены модели Claude на 4.5 (Haiku, Sonnet, Opus) |
| 2026-02-02 | 1.0.0 | Создание документа, добавлены Google и OpenRouter |

---

**Обновлено:** 2026-02-16
