# ADR 017: Архитектура Podcast Engine — двухэтапный Gemini-пайплайн

**Дата:** 2026-02-22
**Статус:** Принято

---

## Контекст

Simply добавляет функцию озвучки брифингов — из текстовых секций генерируются подкасты в формате диалога двух ведущих. Движок должен быть переиспользуемым для любого контента, не только брифингов.

**Ключевые вопросы:**
- Какой TTS-провайдер использовать для русскоязычного multi-speaker?
- Один SDK или два (script + TTS)?
- Как обойти ограничения bundler'а для lamejs (CJS-only)?
- Как управлять concurrency при параллельной генерации нескольких тем?
- Как хранить аудио и обновлять статус по мере готовности?

---

## Решение

### 1. Gemini для всего пайплайна (скрипт + TTS)

Podcast Engine использует **Google Gemini** для обоих этапов:

- **Скрипт:** Gemini 2.5 Flash (`@ai-sdk/google`, `generateText`) — генерация диалогового сценария (Host/Expert)
- **TTS:** Gemini 2.5 Flash TTS (`@google/genai`, native multi-speaker) — озвучка сценария

### 2. Два SDK для разных задач

```
Script: @ai-sdk/google (generateText) — совместимость с Vercel AI SDK
TTS:    @google/genai (native SDK)     — единственный SDK с multi-speaker TTS
```

### 3. Native multi-speaker TTS (один вызов)

Вместо ручного парсинга реплик и отдельных TTS-вызовов для каждой — нативный multi-speaker:

```typescript
const config = {
  responseModalities: ["AUDIO"],
  speechConfig: {
    multiSpeakerVoiceConfig: {
      speakerVoiceConfigs: [
        { speaker: "Host", voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
        { speaker: "Expert", voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } },
      ],
    },
  },
};
```

### 4. lamejs через `new Function()` (обход CJS/ESM бага)

lamejs — CJS-only библиотека, webpack/turbopack не могут её корректно импортировать (`MPEGMode is not defined`). Решение:

```typescript
const lameCode = fs.readFileSync(require.resolve("lamejs/lame.all.js"), "utf-8");
const lameModule: Record<string, unknown> = {};
new Function("module", "exports", lameCode)(lameModule, lameModule);
```

Дополнительная страховка: `serverExternalPackages: ["lamejs"]` в `next.config.ts`.

### 5. `p-limit(2)` для concurrency

Параллельная генерация тем с ограничением — не больше 2 одновременных запросов к Gemini API.

### 6. Инкрементальное обновление БД (JSONB patch)

По мере готовности каждой темы — немедленное обновление JSONB-полей в БД:

```
audioUrls:      { [topicId]: blobUrl }
audioDurations: { [topicId]: seconds }
audioStatus:    'generating' → 'ready' | 'partial'
```

### 7. Outdated hook при обновлении секции

Если пользователь обновляет секцию брифинга (refresh-section), audioStatus автоматически переключается на `'outdated'` — сигнал UI для предложения перегенерации.

---

## Причины

### Почему Gemini, а не стороннний TTS (ElevenLabs, OpenAI TTS)

1. **Нативный multi-speaker** — один API-вызов для диалога двух голосов, не нужно парсить реплики и склеивать аудио
2. **Русский язык** — Gemini TTS хорошо озвучивает русский текст (проверено: Kore и Puck)
3. **Единый API-ключ** — тот же `GOOGLE_GENERATIVE_AI_API_KEY` уже используется для vision-ocr и briefing-фильтра
4. **Бесплатный tier** — достаточен для текущей нагрузки (15 RPM)
5. **Один провайдер** — и скрипт, и озвучка через Gemini, меньше зависимостей

### Почему два SDK, а не один

1. **`@ai-sdk/google`** — для `generateText` (скрипт), полная совместимость с Vercel AI SDK, привычный паттерн
2. **`@google/genai`** — единственный SDK с поддержкой `multiSpeakerVoiceConfig`. Vercel AI SDK (`@ai-sdk/google`) не поддерживает TTS Gemini

### Почему lamejs, а не ffmpeg/sox

1. **Без бинарных зависимостей** — lamejs — чистый JavaScript, работает на Vercel Serverless Functions
2. **Размер** — ~300KB vs ffmpeg (~100MB+)
3. **Простота** — PCM → MP3 без промежуточных форматов
4. **Надёжность** — проверенная библиотека, работает в Node.js

### Почему `new Function()` вместо стандартного import

1. **webpack/turbopack несовместимость** — lamejs экспортирует через `module.exports`, bundler не может разрешить все зависимости (`MPEGMode`, `Tables`, и т.д.)
2. **`serverExternalPackages`** — работает для production, но `new Function()` гарантирует работу и в dev-режиме
3. **Изоляция** — код lamejs выполняется в собственном контексте, не конфликтует с bundler'ом

### Почему p-limit(2), а не Promise.all

1. **Rate limits** — Gemini API ограничивает RPM. Без лимита 10 тем = 20 одновременных запросов
2. **Стабильность** — при перегрузке API возвращает 429, retry увеличивает latency
3. **Per-topic resilience** — ошибка в одной теме не блокирует остальные

---

## Последствия

### Плюсы

- Переиспользуемый движок (`lib/podcast/`) — не привязан к briefing, может озвучить любой контент
- Один API-ключ для скрипта и озвучки
- Нативный multi-speaker — один вызов = полный диалог, без склейки
- Инкрементальные обновления БД — пользователь видит прогресс в реальном времени
- Serverless-compatible — никаких бинарных зависимостей
- Outdated hook — автоматическая инвалидация при изменении контента

### Минусы

- Два SDK для Google AI (`@ai-sdk/google` + `@google/genai`) — разные API, разные паттерны
- `new Function()` для lamejs — нестандартный подход, требует пояснения в коде
- Gemini TTS — preview-модель (`gemini-2.5-flash-preview-tts`), может измениться
- PCM → MP3 в serverless — ограничение по длительности (maxDuration: 120s)

---

## Альтернативы

### Альтернатива 1: ElevenLabs TTS

**Что это:** Коммерческий TTS с высококачественными голосами, multi-language.

**Почему отклонили:**
- Дополнительный API-ключ и биллинг
- Нет нативного multi-speaker в одном вызове — нужно парсить реплики, вызывать TTS для каждой, склеивать аудио
- Дороже для volume-usage

**Когда может быть лучше:**
- Если нужны custom-голоса или клонирование голоса
- Если качество Gemini TTS окажется недостаточным для production

### Альтернатива 2: OpenAI TTS

**Что это:** TTS от OpenAI, простой API, хорошее качество.

**Почему отклонили:**
- Нет multi-speaker в одном вызове
- Третий провайдер в проекте (уже Anthropic + Google)
- Ограниченная поддержка русского языка

### Альтернатива 3: ffmpeg для конвертации аудио

**Что это:** Стандартный инструмент для работы с аудио/видео.

**Почему отклонили:**
- Бинарная зависимость (~100MB+), не работает на Vercel Serverless
- Нужен custom Docker layer или специальный buildpack
- Overkill для простой задачи PCM → MP3

### Альтернатива 4: Ручной парсинг реплик + отдельные TTS-вызовы

**Что это:** Разбить сценарий на реплики, озвучить каждую отдельно, склеить аудио.

**Почему отклонили:**
- В 10-20 раз больше API-вызовов (20 реплик = 20 TTS-вызовов)
- Нужна аудио-склейка (crossfade, паузы)
- Больше точек отказа
- Native multi-speaker делает всё за один вызов

---

## Файловая структура

```
lib/podcast/
├── index.ts                # Public API: generatePodcastSegment()
├── script-generator.ts     # Gemini 2.5 Flash: generateScript()
├── tts-gemini.ts           # Gemini 2.5 Flash TTS: synthesizeSpeech()
├── audio-converter.ts      # PCM → MP3 (lamejs via new Function)
├── types.ts                # TypeScript типы
└── lamejs.d.ts             # TypeScript declarations

app/(chat)/api/briefing/podcast/
└── generate/route.ts       # Streaming POST (p-limit(2), JSON Lines)

lib/prompts/briefing/
├── briefing-scriptwriter.md              # System prompt
└── briefing-scriptwriter-user-template.md # User message template
```

---

## Ссылки

- Gemini Multi-Speaker TTS: [Google AI Docs](https://ai.google.dev/gemini-api/docs/text-to-speech)
- `@google/genai` SDK: [npm](https://www.npmjs.com/package/@google/genai)
- lamejs: [npm](https://www.npmjs.com/package/lamejs)
- p-limit: [npm](https://www.npmjs.com/package/p-limit)
- ADR 016: [Briefing Backend Architecture](016-briefing-backend-architecture.md) — родительское решение

---

## История изменений

- **2026-02-22** — ADR создан. Podcast Engine v3.43.0
