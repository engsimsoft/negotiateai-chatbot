# ТЗ-FIX2: Research Progress Mode

**Приоритет:** КРИТИЧЕСКИЙ  
**Зависимости:** нет  
**Оценка:** средний scope  

---

## Проблема

В briefing-onboarding модель оркестрирует 12+ tool calls (deepResearch → fetchUrl → readTelegramChannel) самостоятельно. При сложных цепочках модель галлюцинирует: описывает результаты текстом без реальных вызовов, или вызывает финальный tool (updateBriefingPreview/saveBriefingProfile) с выдуманными данными. Промптовые правила и Guardian не решают — это фундаментальное ограничение LLM.

Генерация брифинга (`/api/briefing/generate`) уже работает правильно: вся оркестрация в коде, модель получает готовые данные. Онбординг — единственное место где модель оркестрирует поиск. Нужно привести к тому же паттерну.

## Решение

Новый tool `startResearch` — модель вызывает один раз, server-side код делает всю цепочку: поиск → верификация → результат. Модель получает готовые проверенные источники.

## Новый tool: startResearch

### Input

```typescript
{
  topics: Array<{
    topicId: string;      // "formula-1", "ai-tools"
    topicName: string;    // "Formula 1", "AI для разработчиков"
    emoji: string;
    briefingStyle: string; // "техническая аналитика с цифрами"
  }>;
}
```

### Что делает (server-side, без участия модели)

Для каждой темы параллельно:

1. **deepResearch** — Perplexity sonar-pro: "лучшие источники новостей по {topicName} 2026, {briefingStyle}". Получает content + citations.

2. **Парсинг citations** — из ответа Perplexity извлекает URL источников.

3. **fetchUrl** для каждого URL — проверяет доступность, получает title и content. Таймаут 8с на источник.

4. **Поиск Telegram-каналов** — deepResearch: "telegram каналы по {topicName} @username". Из ответа извлекает @username паттерны.

5. **readTelegramChannel** для каждого найденного username — валидация, получение постов.

6. **Классификация** — каждый проверенный источник получает: tier (flagship/respected/niche/community), fetchMethod (rss/jina/telegram_parse), sourceLanguage.

### Output

```typescript
{
  success: true,
  results: Array<{
    topicId: string;
    topicName: string;
    emoji: string;
    sources: Array<{
      sourceName: string;
      sourceUrl: string;
      rssUrl?: string;
      fetchMethod: "rss" | "jina" | "telegram_parse";
      sourceLanguage: string;
      tier: string;
      verified: true;           // всегда true — прошёл проверку
      verificationMethod: string; // "fetchUrl" | "readTelegramChannel"
      snippet: string;          // краткое описание контента (для модели)
    }>;
    sourcesChecked: number;     // сколько проверено
    sourcesVerified: number;    // сколько прошло проверку
  }>;
  totalSources: number;
  totalVerified: number;
}
```

Если по теме найдено < 2 источников — в результате будет `sourcesVerified < 2`, модель скажет пользователю.

### Где расположить

```
lib/briefing/research-engine.ts    — основная логика
  ├── researchTopics(topics[]) → ResearchResult
  ├── researchSingleTopic(topic) → TopicResult
  ├── extractCitations(perplexityResponse) → url[]
  ├── extractTelegramHandles(text) → username[]
  └── classifySource(url, content) → {tier, fetchMethod, language}
```

Tool definition — inline в service-chat/route.ts, рядом с updateBriefingPreview. Execute вызывает `researchTopics()`.

### Прогресс для клиента

Пока startResearch работает (может занять 30-60с), клиент не должен видеть пустоту. Через dataStream отправлять progress events:

```typescript
// В execute startResearch:
dataStream.write({ type: "research-progress", data: { 
  phase: "searching", topic: "Formula 1" 
}});
// ...после deepResearch...
dataStream.write({ type: "research-progress", data: { 
  phase: "verifying", topic: "Formula 1", found: 8 
}});
// ...после fetchUrl/readTelegramChannel...
dataStream.write({ type: "research-progress", data: { 
  phase: "done", topic: "Formula 1", verified: 5 
}});
```

Клиент (briefing-setup-client.tsx) показывает структурированный прогресс вместо текста AI.

## Изменения в существующих tools

### saveBriefingProfile — добавить валидацию

Сейчас: passthrough, что пришло — то в БД.

Изменение: каждый source в input проверяется — имеет ли поле `verified: true`. Sources без verified отбрасываются. Лог предупреждения если модель пытается сохранить неверифицированные данные.

Это простая проверка на уровне tool execute, не требует внешних вызовов.

### updateBriefingPreview — без изменений

Preview остаётся passthrough — это live preview, не финальные данные. Пользователь видит промежуточный результат.

## Изменения в streamText

Для briefing-onboarding добавить:

```typescript
toolChoice: undefined  // оставить auto — модель должна разговаривать с пользователем
```

НЕ менять toolChoice. Модель должна свободно переключаться между разговором и вызовом startResearch. Принуждение через `required` сломает диалог. Защита — в другом: даже если модель решит не вызывать startResearch и выдумать данные, saveBriefingProfile отвергнет неверифицированные источники.

## Что убрать

deepResearch, fetchUrl, readTelegramChannel — **оставить** в списке tools для briefing-onboarding. Они нужны в edit-режиме (пользователь вручную даёт URL или @username). Но в промпте (PE зона) шаги create-режима будут указывать на startResearch.

## DEV Mode для briefing-onboarding

Сейчас DEV Mode (SIMPLY_DEV_MODE=true) работает только в chat/expertise/create — потому что composeChatPrompt() вызывается только там. Service-chat собирает промпт отдельно.

### Что сделать

1. **Вынести DEV injection в утилиту** — `lib/prompts/builder/dev-mode-inject.ts`:
   - `injectDevMode(systemPrompt: string, context: string): string`
   - Если `SIMPLY_DEV_MODE !== 'true'` — возвращает промпт без изменений
   - Если true — добавляет содержимое `dev-mode.md` + `<dev_reminder>` в конец промпта

2. **Вызвать в service-chat/route.ts** — после загрузки BRIEFING_ONBOARDING_PROMPT_TEMPLATE, перед передачей в streamText: `systemPrompt = injectDevMode(systemPrompt, 'briefing-onboarding')`

3. **Вызвать в composeChatPrompt()** — заменить текущую inline логику на вызов той же утилиты. Один код, два места.

4. **data-model-info в service-chat** — добавить `dataStream.write({ type: "data-model-info", data: { modelId, modelName } })` в instrumentedStream service-chat route. Аналогично chat route.

5. **BriefingChatPanel** — добавить обработку data-model-info для показа бейджа модели в dev environment.

### Зачем

При тестировании FIX2 нужно видеть: какие tools вызывались, какая модель отвечает, что модель "думает". Без DEV Mode мы слепые — повторится ситуация с @omggpt где проблему нашли только когда пользователь разозлился.

## Что НЕ делать

- Не менять промпт — это PE зона. ТЗ только про код.
- Не трогать briefing generate pipeline — он работает правильно.
- Не трогать Guardian — он работает параллельно как доп. слой.
- Не делать отдельный endpoint — startResearch это tool внутри service-chat.
- Не буферизировать дополнительно — FIX1.2 уже сделал.

## Критерий приёмки

1. **startResearch вызывается и возвращает реальные данные:** В briefing-onboarding попросить настроить 2 темы. Модель вызывает startResearch. В результате — реальные URL, реальные каналы, verified: true. Проверить через логи что deepResearch и fetchUrl вызывались внутри startResearch.

2. **Прогресс виден клиенту:** Во время работы startResearch пользователь видит "Ищу источники по Formula 1... Найдено 8, проверяю... Проверено 5". Не пустой экран.

3. **saveBriefingProfile отвергает фейк:** Если вручную передать sources без verified: true — они не записываются в БД. В логах предупреждение.

4. **Edit-режим работает:** Пользователь даёт @username — модель вызывает readTelegramChannel напрямую. Даёт URL — fetchUrl. Это не ломается.

5. **Обычный чат и проекты не затронуты:** startResearch доступен ТОЛЬКО в briefing-onboarding context.
