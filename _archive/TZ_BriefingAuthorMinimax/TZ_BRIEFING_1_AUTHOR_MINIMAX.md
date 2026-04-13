# ТЗ-Briefing-1: Author Sonnet → MiniMax M2.7

**Версия:** 3.80.0  
**Приоритет:** Высокий  
**Цель:** Снизить стоимость ежедневного брифинга в 10 раз  
**Scope:** briefing-config.ts, briefing-author.ts, briefing-section-author.ts

---

## Проблема

Генерация текста брифинга (Author) — 80% стоимости pipeline. Claude Sonnet стоит $0.15–0.35 за один брифинг. За месяц ежедневного использования — $4.50–$10.50. Владимир перестал пользоваться брифингом из-за стоимости.

MiniMax M2.7 (Intelligence Index 50, уровень Opus) стоит $0.30/$1.20 за 1M токенов — в 10 раз дешевле Sonnet. Качество текста подтверждено в chatMode=simply. Паттерн `generateObject → generateText + JSON.parse + Zod` уже отработан на MIND pipeline (v3.78.0).

---

## Экономика

| Метрика | Sonnet (сейчас) | MiniMax M2.7 (после) |
|---------|----------------|----------------------|
| Стоимость Author за 1 брифинг | $0.15–0.35 | $0.015–0.035 |
| Стоимость всего брифинга (с подкастом) | ~$0.19 | ~$0.05 |
| За месяц (ежедневно) | ~$5.70 | ~$1.50 |
| Экономия | — | **~$4.20/мес (74%)** |

---

## Что сделать

### 1. Заменить модель Author в конфиге

Файл: `briefing-config.ts`, строка 33

```typescript
// БЫЛО:
export const AUTHOR_MODEL = "claude-sonnet-4-6";

// СТАЛО:
export const AUTHOR_MODEL = "MiniMax-M2.7";
```

Если AUTHOR_MODEL используется для создания провайдера — заменить на MiniMax provider из shared export (`providers.ts`).

### 2. Адаптировать briefing-author.ts

Файл: `briefing-author.ts`, строка 164-165

**Проблема:** `generateObject()` не работает с MiniMax.  
**Решение:** Заменить на `generateText()` + `JSON.parse()` + Zod-валидация.

Паттерн (уже работает в MIND pipeline):

```typescript
// БЫЛО:
const result = await generateObject({
  model: authorModel,
  schema: briefingSchema,
  // ...
});

// СТАЛО:
const result = await generateText({
  model: minimaxModel, // из shared provider
  prompt: `${originalPrompt}\n\nОтветь ТОЛЬКО валидным JSON без markdown-обёртки.`,
  // ...
});

const parsed = JSON.parse(result.text);
const validated = briefingSchema.parse(parsed); // Zod
```

**Важно:** Добавить в промпт явную инструкцию возвращать чистый JSON. MiniMax может обернуть в ```json```. Нужна очистка:

```typescript
const cleanJson = result.text
  .replace(/^```json\s*/i, '')
  .replace(/\s*```$/i, '')
  .trim();
const parsed = JSON.parse(cleanJson);
```

**Retry:** Сохранить существующий `retryWithLogging` (3 попытки). При JSON parse error — retry.

### 3. Адаптировать briefing-section-author.ts

Файл: `briefing-section-author.ts`, строка 132-133

Тот же паттерн: `generateObject` → `generateText` + JSON.parse + Zod. Использует ту же модель AUTHOR_MODEL.

### 4. Добавить pricing MiniMax для briefing в логирование

Если briefing логирует стоимость через `saveAiUsageLog` — убедиться что `chatMode` для briefing-вызовов корректно записывается и pricing MiniMax подхватывается из `MODEL_PRICING_RUB`.

### 5. MiniMax provider для briefing

MiniMax provider уже есть в shared export (`providers.ts`). Использовать тот же `minimaxModel()` функцию что и в route.ts. Не создавать новый instance.

---

## Что НЕ менять

| Компонент | Файл | Модель | Почему |
|-----------|------|--------|--------|
| Filter | briefing-filter.ts | Gemini 2.0 Flash | $0.03, работает |
| Script подкаста | script-generator.ts | Gemini 2.5 Flash | $0.006, работает |
| TTS подкаста | tts-gemini.ts | Gemini Flash TTS | Отдельное ТЗ (Briefing-2) |
| Onboarding диалог | service-chat/route.ts | Sonnet | Однократно, $0.04 |
| deepResearch | perplexity-client.ts | Sonar Pro | Однократно при настройке |

---

## Тестовый план

### Тест 1: Генерация полного брифинга

1. Запустить генерацию брифинга вручную (или дождаться cron)
2. Проверить:
   - Брифинг сгенерирован без ошибок ✅/❌
   - JSON распарсился корректно (Zod-валидация прошла) ✅/❌
   - Структура брифинга соответствует схеме (все секции на месте) ✅/❌
   - Текст на русском языке, качественный ✅/❌
   - Сохранился в БД ✅/❌
   - Доставлен в Telegram ✅/❌

### Тест 2: Section refresh

1. Вызвать обновление одной секции через briefing-section-author
2. Проверить: секция обновлена, JSON корректный ✅/❌

### Тест 3: Стоимость

1. Проверить `ai_usage_log` — записи с MiniMax для briefing
2. Сравнить стоимость с ожидаемой (~$0.015–0.035 за брифинг)
3. Подтвердить что cacheRead работает (автоматический кэш MiniMax)

### Тест 4: Подкаст (не должен сломаться)

1. Убедиться что подкаст генерируется корректно (он использует Gemini, не Author)
2. Script + TTS — без изменений

**Критерий приёмки:** Брифинг генерируется, доставляется в Telegram, стоимость Author ≤ $0.04, подкаст работает.

---

## Контекст для Claude Code

- Паттерн `generateText + JSON.parse + Zod` уже работает в MIND pipeline (v3.78.0): `batchExtractFacts`, консолидация, профиль
- MiniMax provider: shared export из `providers.ts`, функция `minimaxModel()`
- MiniMax не поддерживает `generateObject` — это ограничение провайдера, не модели
- MiniMax может оборачивать JSON в ```json``` — нужна очистка перед parse
- Temperature для MiniMax: 0.7 (не 0, вызовет ошибку)
- `includeUsage: true` уже настроен в shared provider
- Автоматическое кэширование MiniMax работает — system prompt + повторяющиеся части будут кэшироваться
