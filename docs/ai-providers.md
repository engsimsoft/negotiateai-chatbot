# AI-провайдеры и модели

**Версия:** 3.0.0
**Последнее обновление:** 2026-02-21
**Статус:** 2 провайдера, 4 модели Anthropic + 3 модели Gemini

---

## О документе

Этот документ — **единственный источник правды** для:
- AI-провайдеров (Anthropic, Google)
- Моделей и их характеристик
- **Реестра конфигураций** — какая модель где и с какими настройками
- Цен на токены
- API ключей и настроек

**Связанные документы:**
- [ai-chats-map.md](ai-chats-map.md) — карта чатов и UI
- [ai-agents.md](ai-agents.md) — агенты и промпты
- [ai-tools.md](ai-tools.md) — инструменты

**Ключевые файлы:**
- [lib/ai/providers.ts](../lib/ai/providers.ts) — конфигурация провайдеров
- [lib/ai/chat-mode-config.ts](../lib/ai/chat-mode-config.ts) — chatMode → модель
- [lib/ai/model-tiers.ts](../lib/ai/model-tiers.ts) — уровни моделей для проектов
- [lib/briefing/briefing-config.ts](../lib/briefing/briefing-config.ts) — модели Gemini для брифинга

---

## Провайдеры

### Anthropic (основной — v3.23.0+)

| Параметр | Значение |
|----------|----------|
| SDK | `@ai-sdk/anthropic@2.0.63` |
| API Key | `ANTHROPIC_API_KEY` |
| Документация | https://docs.anthropic.com/ |

> **Важно:** Используем `@ai-sdk/anthropic@2.0.63` (не v3.x), т.к. v3 возвращает `LanguageModelV3`, несовместимый с текущим `ai@5.0.123` (ожидает `LanguageModelV2`).

### Google AI (vision-ocr + Briefing pipeline)

| Параметр | Значение |
|----------|----------|
| SDK | `@ai-sdk/google` |
| API Key | `GOOGLE_GENERATIVE_AI_API_KEY` |
| Документация | https://ai.google.dev/ |

> Google AI используется только для vision-ocr и Briefing pipeline. Все остальные AI-запросы — Anthropic.

---

## Модели

### Anthropic Claude

| Модель | ID в проекте | Реальный ID | Input | Output | Контекст | Max Output |
|--------|--------------|-------------|-------|--------|----------|------------|
| **Claude Sonnet 4.6** | `claude-sonnet-4-6` | `claude-sonnet-4-6` | — | — | — | — |
| **Claude Sonnet 4.5** | `claude-sonnet` | `claude-sonnet-4-5-20250929` | $3.00/1M | $15.00/1M | 200K (1M бета) | 64K |
| **Claude Haiku 4.5** | `claude-haiku` | `claude-haiku-4-5-20251001` | $1.00/1M | $5.00/1M | 200K | 64K |
| **Claude Opus 4.6** | `claude-opus` | `claude-opus-4-6` | $5.00/1M | $25.00/1M | 200K (1M бета) | 128K |

**Алиасы:**
- `title-model` → `claude-haiku-4-5-20251001`
- `artifact-model` → `claude-sonnet-4-5-20250929`

### Google Gemini

| Модель | Реальный ID | Использование | Конфиг |
|--------|-------------|---------------|--------|
| **Gemini 3 Pro** | `gemini-3-pro-preview` | Briefing: автор статьи (Stage 2) | `lib/briefing/briefing-config.ts` |
| **Gemini 2.5 Pro** | `gemini-2.5-pro` | Briefing: fallback автор | `lib/briefing/briefing-config.ts` |
| **Gemini 2.5 Flash** | `gemini-2.5-flash` | Vision OCR (image, PDF) | `lib/ai/vision-ocr.ts` |
| **Gemini 2.0 Flash** | `gemini-2.0-flash` | Briefing: фильтр (Stage 1) | `lib/briefing/briefing-config.ts` |

> **ВАЖНО:** ID модели Gemini 3 Pro — именно `gemini-3-pro-preview` (с суффиксом `-preview`). Без суффикса API возвращает ошибку.

---

## Реестр конфигураций (SSOT)

> **Назначение:** Единая таблица ВСЕХ точек использования моделей. При миграции на новую модель (напр. claude-sonnet-4-6) — пройди по таблице и обнови нужные строки.

### Anthropic Claude — Streaming чаты

| Функция | Файл | Модель | temperature | maxSteps | providerOptions | Примечание |
|---------|------|--------|-------------|----------|-----------------|------------|
| Чат (chatMode=chat) | `api/chat/route.ts` | `claude-haiku` | 1.0 | 5 | — | Via `getModelForChatMode()` |
| Экспертиза (chatMode=expertise) | `api/chat/route.ts` | `claude-sonnet` | 1.0 | 5 | — | Via `getModelForChatMode()` |
| Создание (chatMode=create) | `api/chat/route.ts` | `claude-sonnet` | 1.0 | 5 | — | Via `getModelForChatMode()` |
| Проект: Исполнитель | `api/chat/route.ts` | `claude-haiku` | 1.0 | 5 | — | Via `getProjectModel("executor")` |
| Проект: Эксперт | `api/chat/route.ts` | `claude-sonnet` | 1.0 | 5 | — | Via `getProjectModel("expert")` |
| Проект: Профессор | `api/chat/route.ts` | `claude-opus` | 1.0 | 5 | — | Via `getProjectModel("professor")` |
| Эксперт по задаче | `api/projects/[id]/tasks/[taskId]/chat/route.ts` | `claude-sonnet` (default) | 1.0 | 5 | — | Tier из ProjectTask, env: `EXPERT_MODEL` |
| Professor Pipeline: Анализ | `lib/ai/professor-pipeline.ts` | `claude-opus` | 1.0 | — | — | Phase 1 (streamText) |
| Professor Pipeline: Исполнение | `lib/ai/professor-pipeline.ts` | `claude-haiku` | 1.0 | — | — | Phase 2 (streamText) |
| Professor Pipeline: Синтез | `lib/ai/professor-pipeline.ts` | `claude-opus` | 1.0 | — | — | Phase 3 (streamText) |

### Anthropic Claude — Service чаты (streamText)

| Функция | Файл | Модель | temperature | providerOptions | Примечание |
|---------|------|--------|-------------|-----------------|------------|
| Бен (❓) | `api/service-chat/route.ts` | `claude-haiku` | 1.0 | — | context: ben |
| Секретарь (создание проекта) | `api/service-chat/route.ts` | `claude-sonnet` | 1.0 | — | context: project-creation |
| Менеджер проекта | `api/service-chat/route.ts` | `claude-haiku` | 1.0 | — | context: project-manager |
| **Briefing Онбординг** | `api/service-chat/route.ts` | **`claude-sonnet-4-6`** | 1.0 | — | context: briefing-onboarding |

### Anthropic Claude — Backend (generateText / generateObject)

| Функция | Файл | Модель | temperature | providerOptions | Примечание |
|---------|------|--------|-------------|-----------------|------------|
| Auto-naming чатов | `api/chat/route.ts` | `title-model` (haiku) | — | — | generateObject, Zod schema |
| Generate title | `api/chat/[id]/generate-title/route.ts` | `title-model` (haiku) | — | — | generateObject |
| Профессор планирования | `api/projects/[id]/plan/route.ts` | `claude-opus` | 0.2 | — | env: `PROFESSOR_MODEL` |
| Ревьюер задач | `lib/ai/professors/task-reviewer.ts` | `claude-opus` | 0.2 | — | env: `PROFESSOR_MODEL` |
| Суммаризатор задач | `lib/ai/clerks/task-summarizer.ts` | `claude-haiku` | 0.1 | — | env: `SUMMARIZER_MODEL` |
| Snapshot Creator | `lib/ai/clerks/snapshot-creator.ts` | `claude-haiku` | 0.1 | — | env: `SNAPSHOT_CLERK_MODEL` |
| Клерк-анализатор файлов | `api/projects/[id]/analyze-file/route.ts` | `claude-haiku` | 0.1 | — | Hardcoded |
| Project Summary | `api/projects/[id]/generate-summary/route.ts` | `claude-haiku` | — | — | Hardcoded |

### Google Gemini — Backend

| Функция | Файл | Модель | providerOptions | maxOutputTokens | Примечание |
|---------|------|--------|-----------------|-----------------|------------|
| Briefing: Фильтр | `lib/briefing/briefing-filter.ts` | `gemini-2.0-flash` | — | — | generateObject |
| Briefing: Автор | `lib/briefing/briefing-author.ts` | `gemini-3-pro-preview` | — | 8K/16K/32K по volume | generateObject |
| Briefing: Fallback | `lib/briefing/briefing-author.ts` | `gemini-2.5-pro` | — | 8K/16K/32K по volume | При ошибке primary |
| Vision OCR (Image) | `lib/ai/vision-ocr.ts` | `gemini-2.5-flash` | `thinkingBudget: 0` | — | Thinking выключен |
| Vision OCR (PDF) | `lib/ai/vision-ocr.ts` | `gemini-2.5-flash` | `thinkingBudget: 0` | — | Thinking выключен |

### Env-переменные для override моделей

| Переменная | Default | Где используется |
|------------|---------|-----------------|
| `PROFESSOR_MODEL` | `claude-opus` | Планирование, ревью задач |
| `SUMMARIZER_MODEL` | `claude-haiku` | Суммаризатор задач |
| `SNAPSHOT_CLERK_MODEL` | `claude-haiku` | Snapshot Creator |
| `EXPERT_MODEL` | `claude-sonnet` | Эксперт по задаче |

---

## Миграция на новую модель (чеклист)

> При переходе на новую модель (напр. `claude-sonnet-4-5` → `claude-sonnet-4-6`):

**1. Обнови `lib/ai/providers.ts`:**
- Измени реальный ID в `customProvider.languageModels`
- Обнови прямые экспорты (`claudeSonnet`, etc.)

**2. Пройди Реестр конфигураций выше:**
- Найди все строки с целевой моделью
- Проверь, нужно ли добавить `providerOptions` (thinking/effort)
- Проверь совместимость `temperature` с новой моделью

**3. Если новая модель поддерживает thinking/effort:**
```typescript
// Пример: добавление thinking budget для Claude Sonnet 4.6
const result = await streamText({
  model: myProvider.languageModel('claude-sonnet-4-6'),
  providerOptions: {
    anthropic: {
      thinking: { type: 'enabled', budgetTokens: 10000 },
    },
  },
});
```

**4. Обнови эту таблицу** — заполни колонку `providerOptions` для каждой точки использования.

**5. Обнови [ai-chats-map.md](ai-chats-map.md)** — модели в быстром обзоре.

---

## Использование в коде

### Через myProvider (рекомендуется)

```typescript
import { myProvider } from '@/lib/ai/providers';

const model = myProvider.languageModel('claude-sonnet');
```

| ID | Реальный ID | Назначение |
|----|-------------|------------|
| `claude-sonnet` | `claude-sonnet-4-5-20250929` | Основной чат, Секретарь, Эксперт, артефакты |
| `claude-haiku` | `claude-haiku-4-5-20251001` | Бен, Менеджер, Клерки, Исполнитель, заголовки |
| `claude-opus` | `claude-opus-4-6` | Профессоры (планирование, ревью) |
| `claude-sonnet-4-6` | `claude-sonnet-4-6` | Briefing Онбординг |
| `title-model` | `claude-haiku-4-5-20251001` | Генерация заголовков чатов |
| `artifact-model` | `claude-sonnet-4-5-20250929` | Генерация suggestions |

### Прямые экспорты (для pipelines и clerks)

```typescript
import { claudeHaiku, claudeSonnet, claudeOpus, getClaudeModel } from '@/lib/ai/providers';

const model = getClaudeModel('haiku');  // 'haiku' | 'sonnet' | 'opus'
```

---

## Лимиты и квоты

### Anthropic

| Лимит | Значение |
|-------|----------|
| RPM (requests/min) | Зависит от тарифа |
| TPM (tokens/min) | Зависит от тарифа |
| Concurrent requests | По тарифу аккаунта |

### Google AI

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

# Google AI (для vision-ocr + briefing pipeline)
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key
```

### Где получить ключи

| Провайдер | URL |
|-----------|-----|
| Anthropic | https://console.anthropic.com/settings/keys |
| Google AI | https://aistudio.google.com/apikey |

---

## Расчёт стоимости

| Модель | 1K input + 1K output | 10K input + 2K output |
|--------|---------------------|----------------------|
| Claude Haiku 4.5 | $0.006 | $0.020 |
| Claude Sonnet 4.5 | $0.018 | $0.060 |
| Claude Opus 4.6 | $0.030 | $0.100 |

---

## История изменений

| Дата | Версия | Изменения |
|------|--------|-----------|
| 2026-02-21 | 3.0.0 | Добавлен Реестр конфигураций (SSOT), исправлены модели (claude-sonnet-4-6 для онбординга, gemini-2.5-flash для OCR), добавлен чеклист миграции |
| 2026-02-20 | 2.1.0 | Добавлены модели Gemini для Briefing pipeline |
| 2026-02-16 | 2.0.0 | Полное переключение на Anthropic Claude. OpenRouter удалён |
| 2026-02-03 | 1.1.1 | Переход на официальный OpenRouter SDK |
| 2026-02-02 | 1.1.0 | Обновлены модели Claude на 4.5 |
| 2026-02-02 | 1.0.0 | Создание документа |

---

**Обновлено:** 2026-02-21
