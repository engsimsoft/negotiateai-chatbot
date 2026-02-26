# Анализ ТЗ-FIX2: Research Progress Mode

**Дата:** 2026-02-26
**Статус:** ✅ Фаза 1 завершена — все вопросы согласованы

---

## Резюме

ТЗ решает реальную проблему: при онбординге брифинга модель оркестрирует 12+ tool calls и галлюцинирует результаты. Решение — вынести оркестрацию в серверный код (`startResearch` tool), а модели оставить только вызов и интерпретацию результатов.

**Scope:** 4 направления работы:
1. **Research Engine** — новый модуль `lib/briefing/research-engine.ts` + tool `startResearch`
2. **Прогресс для клиента** — отправка progress events во время работы startResearch
3. **Валидация saveBriefingProfile** — фильтрация неверифицированных источников
4. **DEV Mode** — вынос в утилиту + инъекция в service-chat + data-model-info

---

## Вопросы для уточнения

### 1. Классификация источников: AI или эвристика? ✅ РЕШЕНО

> **Решение архитектора:** Эвристика по умолчанию. AI-вызов — лишние токены и время.
> Правила: домен из топ-списка (reuters, bbc, rbc) → flagship; домен известный → respected;
> telegram → community; остальное → niche. Пользователь поменяет в edit-режиме при необходимости.

### 2. Telegram discovery — отдельный deepResearch call? ✅ РЕШЕНО

> **Решение архитектора:** Совмещать с основным deepResearch. Один запрос:
> "лучшие источники новостей по {topic} 2026, включая telegram каналы @username".
> Perplexity и так часто возвращает telegram для русскоязычных тем. Один call вместо двух.

### 3. Количество тем / 90 секунд ожидания ✅ РЕШЕНО

> **Решение архитектора:** Приемлемо для одноразового онбординга. Ключевое — прогресс должен быть видимым.
> Не пустой экран, а "Ищу по Formula 1... готово. Ищу по AI... нашёл 6 источников, проверяю..."
> С прогрессом ожидание терпимо. Как установка приложения — долго, но с прогрессом не бесит.

### 4. RSS discovery ✅ РЕШЕНО

> **Решение архитектора:** Да, парсить `<link rel="alternate" type="application/rss+xml">` из HTML при fetchUrl.
> Если нашёл — записать в rssUrl. Бесплатно, мы уже фетчим страницу.
> Но не делать отдельный запрос ради RSS — только из того что уже получили.

---

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.
> Каждая рекомендация требует согласования с архитектором.

### ✅ Согласен с ТЗ

- **startResearch как tool внутри service-chat** — правильный подход. Tools определяются inline в `if (context === "briefing-onboarding")` блоке (route.ts:652-744). Добавить startResearch рядом с существующими tools.
- **Оставить deepResearch/fetchUrl/readTelegramChannel** — для edit-режима. Промпт (PE зона) укажет модели использовать startResearch в create-режиме.
- **saveBriefingProfile валидация** — простое добавление фильтра в execute (route.ts:685-734).
- **DEV Mode extraction** — вынос из composer.ts:209-215 в утилиту `dev-mode-inject.ts` логично и чисто.
- **data-model-info в service-chat** — chat route уже делает это (chat/route.ts:523). Паттерн ясен.
- **Guardian — не трогать** — он работает параллельно. Но нужно добавить `startResearch` в `MONITORED_TOOLS` (tool-call-guardian.ts:55-74).

### ⚠️ Рекомендую изменить

| # | Было (ТЗ) | Рекомендация | Обоснование из кода |
|---|-----------|--------------|-------------------|
| 1 | `dataStream.write()` внутри tool execute | **Паттерн progress callback через closure** | service-chat/route.ts:780 — `streamText()` вызывается ВНЕ `createUIMessageStream` (line 824). В отличие от chat/route.ts:596, где `streamText()` ВНУТРИ `createUIMessageStream` и tools получают `dataStream` как параметр через `getStandardTools({ dataStream })`. В service-chat tools не имеют прямого доступа к `dataStream`. Нужен shared ref паттерн — см. детали ниже. |
| 2 | Клиент показывает прогресс из dataStream | **Добавить consumption custom data parts в клиент** | briefing-setup-client.tsx НЕ читает data stream events. `useChat` возвращает `chatMessages`, `sendMessage`, `status` — НЕТ обработки `data`. Нужно добавить: (a) чтение data parts из `useChat`, (b) парсинг `research-progress` events, (c) UI-компонент прогресса. |
| 3 | `verified: true` флаг в sources | **Server-side verified URL set** ✅ ОДОБРЕНО | Модель заполняет tool parameters, включая `verified`. Она может просто поставить `verified: true` для выдуманных данных. Рекомендую: `startResearch` сохраняет Set<string> верифицированных URL в closure (server-side), `saveBriefingProfile` проверяет каждый sourceUrl против этого Set. Модель не может подделать server-side Set. |
| 4 | Perplexity call через существующий deep-research tool | **Вызывать Perplexity API напрямую** из research-engine.ts | deep-research.ts — это factory, возвращающий `tool()`. Его `execute` обёрнут в `wrapToolExecution()` (timeout 190s, logging). Для research engine нужен прямой API call без обёрток AI SDK. Рекомендую: извлечь core API call из deep-research.ts:131-148 в shared utility `lib/ai/tools/perplexity-client.ts`, использовать и в tool и в engine. |
| 5 | Tool definition inline в route.ts | **Execute вызывает `researchTopics()` из отдельного модуля** | Согласен с ТЗ по размещению. Уточняю: tool definition inline (schema + description), но вся логика в `lib/briefing/research-engine.ts`. Execute = 1 строка вызова `researchTopics()` + прокидывание progress callback. |

### Детали по рекомендации #1: Progress callback паттерн

**Проблема:** В service-chat route архитектура отличается от chat route:

```
Chat route:
  createUIMessageStream → streamText → tools получают dataStream

Service-chat route:
  streamText → createUIMessageStream (wraps result)
  Tools НЕ имеют доступа к dataStream
```

**Решение — shared reference через closure:**

```typescript
// Перед определением tools:
let progressWriter: ((event: ResearchProgressEvent) => void) | null = null;

// Tool definition:
tools.startResearch = tool({
  execute: async (input) => {
    return researchTopics(input.topics, (event) => progressWriter?.(event));
  }
});

// В createUIMessageStream:
const stream = createUIMessageStream({
  execute: async ({ writer: dataStream }) => {
    progressWriter = (event) => {
      dataStream.write({ type: "research-progress", data: event });
    };
    // ... merge instrumentedStream ...
  }
});
```

**Почему это безопасно:** `streamText()` возвращает lazy result (line 780). Tool execute запускается только когда stream processing дойдёт до tool call. К этому моменту `createUIMessageStream` уже выполнил свой execute callback и `progressWriter` установлен.

**Альтернатива (более чистая, но больший рефакторинг):** Перенести `streamText()` внутрь `createUIMessageStream` execute callback, как в chat route. Это потребует рефакторинга manager persistence logic (lines 799-818) и guardian setup (lines 820-822).

### Детали по рекомендации #3: Server-side verified URL set

```typescript
// В scope POST handler:
const verifiedSourceUrls = new Set<string>();

// startResearch execute:
tools.startResearch = tool({
  execute: async (input) => {
    const result = await researchTopics(input.topics, onProgress);
    // Запомнить все проверенные URL
    for (const topic of result.results) {
      for (const source of topic.sources) {
        verifiedSourceUrls.add(source.sourceUrl);
      }
    }
    return result;
  }
});

// saveBriefingProfile execute:
tools.saveBriefingProfile = tool({
  execute: async (input) => {
    // Фильтрация: verified set + existing DB sources
    // (старые источники из прошлых сессий не должны блокироваться)
    const existingSources = await getBriefingSources({ userId });
    const existingUrls = new Set(existingSources.map(s => s.sourceUrl));
    const filteredSources = input.sources.filter(s =>
      verifiedSourceUrls.has(s.sourceUrl) || existingUrls.has(s.sourceUrl)
    );

    if (filteredSources.length < input.sources.length) {
      console.warn(`[saveBriefingProfile] Rejected ${input.sources.length - filteredSources.length} unverified sources`);
    }
    // ... save filteredSources ...
  }
});
```

### ❓ Уточнения — решены

- **RSS discovery** — ✅ Да, парсить из HTML. Бесплатно.
- **Fallback при малом количестве источников** — оставить на модели (ТЗ approach)
- **Кеширование** — не в scope FIX2, можно добавить позже

---

## Потенциальные риски

### 1. Timing / Race condition (средний)
`result.consumeStream()` (line 822) вызывается ДО `createUIMessageStream` (line 824). При быстром API response возможна ситуация когда tool execute запустится до установки `progressWriter`. На практике модели нужно ~2-5 секунд для генерации tool call, поэтому риск минимален. Mitigation: null-safe `progressWriter?.(event)`.

### 2. Perplexity rate limits (средний)
5-8 тем × 2 deepResearch calls = 10-16 параллельных запросов к Perplexity API. Может упереться в rate limits. Mitigation: `p-limit(2)` для deepResearch calls, `p-limit(5)` для fetchUrl/readTelegram.

### 3. Timeout на длинных research chains (средний)
При 8 темах research может занять >120 секунд (`maxDuration = 120s`). Mitigation: ограничить максимум тем на один startResearch call (5-6), или увеличить maxDuration.

### 4. Большой tool result в контексте (низкий)
startResearch вернёт ~5-8 тем × 5-8 источников × snippet. Это 3-5 KB JSON в conversation history. При maxSteps=30 и нескольких tool calls может занять значительную часть context window. Mitigation: минимизировать snippet length (100-200 chars).

### 5. Client-side data consumption (низкий, но scope)
briefing-setup-client.tsx сейчас НЕ обрабатывает data stream events. Добавление этого функционала — отдельный scope работы (новый hook или расширение существующего useEffect).

---

## Зависимости

### Что нужно ДО начала
- Нет блокирующих зависимостей (ТЗ подтверждает)

### Затронутые компоненты

| Файл | Изменение |
|------|-----------|
| `lib/briefing/research-engine.ts` | **НОВЫЙ** — основная логика |
| `lib/ai/tools/perplexity-client.ts` | **НОВЫЙ** — shared Perplexity API utility |
| `app/(chat)/api/service-chat/route.ts` | Добавить startResearch tool, DEV mode, data-model-info, progress ref |
| `app/(dashboard)/briefing/setup/briefing-setup-client.tsx` | Добавить data stream consumption, progress UI |
| `app/(dashboard)/briefing/setup/components/` | Возможно: новый ResearchProgressCard компонент |
| `lib/ai/tool-call-guardian.ts` | Добавить startResearch в MONITORED_TOOLS |
| `lib/prompts/builder/dev-mode-inject.ts` | **НОВЫЙ** — extracted dev mode utility |
| `lib/prompts/builder/composer.ts` | Заменить inline dev mode на вызов утилиты |
| `lib/ai/tools/deep-research.ts` | Рефакторинг: извлечь Perplexity API call в shared utility |

### Не затронутые (подтверждение ТЗ)
- `app/(chat)/api/briefing/generate/route.ts` — не трогаем
- `app/(chat)/api/chat/route.ts` — не трогаем
- Guardian logic — не трогаем (добавляем только в список мониторинга)
- Промпты — PE зона, не трогаем

---

## Оценка сложности

- [x] Среднее (3-5 сессий)

**Разбивка:**
1. Research Engine + Perplexity client extraction (~1.5 сессии)
2. Tool integration + progress mechanism + client UI (~1.5 сессии)
3. saveBriefingProfile validation + DEV Mode + data-model-info (~1 сессия)
4. Финализация + тестирование (~0.5 сессии)
