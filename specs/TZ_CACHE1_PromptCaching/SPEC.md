# ТЗ-CACHE1: Включить Anthropic Prompt Caching

**Приоритет:** Критический (экономия 60-90% на повторных input-токенах)  
**Оценка:** 30-45 минут  
**Зависимости:** Нет

---

## Контекст

Сейчас каждый запрос к Anthropic API отправляет системный промпт и всю историю чата как новые токены. При включённом prompt caching повторные токены стоят **0.1×** от обычной цены (cache read), а первая отправка — **1.25×** (cache write). Для чата из 10 сообщений с системным промптом ~2000 токенов экономия ~6× только на промпте.

## Что нужно сделать

### 1. Добавить `cacheControl` в 3 streaming route

Во всех трёх route, где вызывается `streamText()` с Anthropic моделями, добавить `providerOptions` с `cacheControl`.

**Файлы и текущее состояние:**

#### A. `app/(chat)/api/chat/route.ts` — основной чат

Здесь 2 точки `streamText()`:
1. **Standard streaming mode** (~строка с `const result = streamText({`) — обычные чаты и проекты. Сейчас **НЕТ providerOptions**. Добавить:
```typescript
const result = streamText({
  model: modelToUse,
  // ...существующие параметры...
  providerOptions: {
    anthropic: {
      cacheControl: { type: 'ephemeral' },
    },
  },
  // ...onStepFinish, onFinish...
});
```

2. **Professor Pipeline** (`lib/ai/professor-pipeline.ts`) — 3 фазы streamText с Opus и Haiku. Тоже **НЕТ providerOptions**. Добавить `cacheControl` в каждый `streamText()`.

#### B. `app/(chat)/api/service-chat/route.ts` — сервисные чаты

Одна точка `streamText()`. Текущая логика:
- `briefing-onboarding` → `providerOptions: { anthropic: { thinking: adaptive, effort: high } }`
- Все остальные контексты (ben, project-creation, project-manager) → **НЕТ providerOptions**

Нужно:
```typescript
// Для ВСЕХ контекстов — добавить cacheControl
// Для briefing-onboarding — к существующим thinking/effort
providerOptions: {
  anthropic: {
    cacheControl: { type: 'ephemeral' },
    // + условно thinking/effort для briefing-onboarding
    ...(context === "briefing-onboarding" ? {
      thinking: { type: "adaptive" as const },
      effort: "high" as const,
    } : {}),
  },
},
```

#### C. `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — эксперт по задаче

Одна точка `streamText()`. Сейчас **НЕТ providerOptions**. Добавить аналогично пункту A.

### 2. Backend generateText/generateObject — НЕ в этом ТЗ

Одноразовые вызовы (auto-naming, task-reviewer, plan generation, snapshot-creator и т.д.) не выигрывают от prompt caching: каждый вызов — уникальный контент, нет повторных обращений к тому же промпту в пределах 5-минутного TTL. Это **не приоритет**.

### 3. Проверить минимальный порог

Anthropic требует **≥1024 токена** для кэширования (для Sonnet/Opus/Haiku 4.5). Наши системные промпты значительно больше — проблемы быть не должно. Но если где-то в service-chat промпт короткий — это нормально, запрос просто пройдёт без кэширования.

### 4. НЕ трогать

- Gemini endpoints (briefing generate, podcast) — у Google другой механизм кэширования
- `lib/ai/providers.ts` — `createAnthropic()` менять не нужно, cacheControl задаётся на уровне запроса
- Формулу расчёта стоимости — это отдельное ТЗ
- UI компоненты — это отдельное ТЗ

## Как проверить

1. Сделать 2+ сообщения в одном чате
2. В Anthropic Console (Settings → Usage) → Group by "token type"
3. Должны появиться `cache_creation_input_tokens` (первое сообщение) и `cache_read_input_tokens` (последующие)
4. В DevPanel Footer `cachedTokens` должны стать > 0 (код уже читает `(usage as any)?.cachedInputTokens`)

## Ожидаемый результат

- Cache read tokens в Anthropic Console > 0
- Стоимость в Console снижается при активном использовании чатов
- Никаких изменений в UX — пользователь ничего не замечает, просто дешевле

## Справка из документации

Vercel AI SDK (ai-sdk.dev/providers/ai-sdk-providers/anthropic):
- `cacheControl: { type: 'ephemeral' }` — 5 min TTL (по умолчанию)
- Можно задать `ttl: '1h'` для 1-часового кэша (дороже write: 2× вместо 1.25×)
- Минимум 1024 токена для Sonnet/Opus, 2048 для Haiku 3
- SDK автоматически помечает последний content block для кэширования

Anthropic Pricing (cache multipliers):
- Cache write (5m): 1.25× base input price
- Cache write (1h): 2.0× base input price  
- Cache read: 0.1× base input price
