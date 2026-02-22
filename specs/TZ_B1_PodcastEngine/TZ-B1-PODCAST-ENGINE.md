# ТЗ-Б1: Podcast Engine

**Задача:** Backend-пайплайн генерации подкаста из текстового брифинга  
**Результат:** По API-запросу генерируются MP3-файлы для каждой темы, сохраняются в Vercel Blob, прогресс стримится клиенту  
**Спецификация:** `PODCAST_SPEC.md`

---

## Что нужно сделать

### 1. Podcast Engine — переиспользуемый модуль `/lib/podcast/`

Модуль НЕ внутри `/lib/briefing/`. Будущий инструмент «Подкаст» на дашборде будет использовать тот же движок.

**Три компонента:**

**ScriptGenerator** — принимает текст + контекст, возвращает сценарий диалога.
- Модель: Gemini 2.5 Flash
- Промпт: `briefing-scriptwriter` (system prompt и user template — см. PE контракт ниже)
- Вход: текст секции, заголовок, контекст (isFirst, isLast, sectionTitles)
- Выход: текст сценария в формате `Host: ... Expert: ...`

**TTSProvider** — принимает сценарий, возвращает PCM audio buffer.
- Модель: `gemini-2.5-flash-preview-tts`
- SDK: `@google/genai` (напрямую, НЕ через Vercel AI SDK — он не поддерживает TTS)
- Голоса: Kore (Host, Firm) + Puck (Expert, Upbeat)
- Метод: multi-speaker TTS — парсим сценарий на реплики, чередуем голоса
- Выход: PCM buffer (16-bit, 24kHz, mono — параметры Gemini TTS по умолчанию)

**AudioConverter** — конвертирует PCM в MP3.
- Инструмент: `lamejs` (pure JS MP3 encoder)
- Причина: Vercel Functions не имеют ffmpeg
- Вход: PCM buffer
- Выход: MP3 buffer

**Абстракция TTSProvider** — интерфейс для будущего переключения на ElevenLabs. Сейчас только Gemini-реализация. Интерфейс: `generateSpeech(script: string, voices: VoiceConfig): Promise<Buffer>`.

### 2. API endpoint — `POST /api/briefing/podcast/generate`

Streaming endpoint по паттерну А5 (`ReadableStream`, JSON Lines, `application/x-ndjson`).

**Вход (body):** `{ topicIds?: string[] }` — если пусто, все темы (полный выпуск).

**Пайплайн для каждой темы (параллельно через Promise.allSettled):**
1. ScriptGenerator → сценарий (стрим прогресса: `{ step: "script", topicId, message, replicaCount }`)
2. TTSProvider → PCM audio (стрим: `{ step: "recording", topicId, message }`)
3. AudioConverter → MP3 buffer
4. Vercel Blob upload → URL (стрим: `{ step: "done", topicId, url, durationSeconds }`)

**Если тема упала** — не блокирует остальные. Стрим: `{ step: "error", topicId, message }`.

**Финальное событие:** `{ step: "complete", readyCount, failedCount }`.

**maxDuration:** 120 (сценарий ~2сек + TTS ~5-10сек на тему, 5 тем параллельно ≈ 30-60 сек).

**Обновление БД** — по мере готовности каждой темы обновлять `audioUrls`, `audioDurations`. В конце — обновить `audioStatus`.

### 3. БД — три новых колонки в `briefingHistory`

```
audioUrls     JSONB     default null
-- Формат: { "topic-1": "https://blob.vercel-storage.com/...", "topic-2": "..." }

audioStatus   TEXT      default 'none'  
-- Значения: none | generating | ready | partial | outdated

audioDurations JSONB    default null
-- Формат: { "topic-1": 134, "topic-2": 138 } (секунды)
```

Drizzle миграция. Колонки nullable, существующие записи не трогаем.

### 4. Vercel Blob storage

MP3 сохраняются через `@vercel/blob` (уже в проекте). При удалении брифинга (уже есть `deleteOldBriefingHistory`) — добавить cleanup: удалять MP3 из Blob по URL из `audioUrls`.

### 5. Статус `outdated`

Когда пользователь обновляет секцию через `/api/briefing/refresh-section` (ТЗ-BF4) — если у брифинга `audioStatus === 'ready' || 'partial'`, переключить на `outdated`.

### 6. NPM зависимости

```
@google/genai     — Gemini TTS SDK
lamejs            — pure JS MP3 encoder
```

`@vercel/blob` уже в проекте.

---

## PE контракт: briefing-scriptwriter

**System prompt** — файл `lib/prompts/briefing/briefing-scriptwriter.md`. Содержимое получено от PE:

```
{СОДЕРЖИМОЕ briefing-scriptwriter.md — вложить в чат при реализации}
```

**User message template** — файл `lib/prompts/briefing/briefing-scriptwriter-user-template.md`:

```
{СОДЕРЖИМОЕ briefing-scriptwriter-user-template.md — вложить в чат при реализации}
```

Claude Code получит содержимое промптов при реализации — они будут вложены в чат как отдельные файлы.

---

## Ключевые ограничения

- **НЕ использовать Inngest** — текущий паттерн streaming ReadableStream (как А5) проще и консистентнее. Inngest добавим в Фазе Г (cron-генерация)
- **НЕ генерировать отдельный full MP3** — темы играют подряд, «полный выпуск» = плейлист на клиенте
- **НЕ использовать Vercel AI SDK для TTS** — он не поддерживает Gemini TTS, только `@google/genai` напрямую
- **lamejs, НЕ ffmpeg** — Vercel Functions не имеют нативных бинарников
- **Промпт scriptwriter — файл на диске** как остальные промпты (`lib/prompts/briefing/`), загрузка через fs

---

## Структура файлов (ожидаемая)

```
lib/podcast/
  types.ts              — интерфейсы: TTSProvider, VoiceConfig, PodcastSegment
  script-generator.ts   — генерация сценария (Gemini Flash + scriptwriter промпт)  
  tts-gemini.ts         — Gemini TTS реализация TTSProvider
  audio-converter.ts    — PCM → MP3 (lamejs)
  index.ts              — публичный API модуля

lib/prompts/briefing/
  briefing-scriptwriter.md            — system prompt сценариста
  briefing-scriptwriter-user-template.md  — шаблон user message

app/(chat)/api/briefing/podcast/
  generate/route.ts     — streaming endpoint генерации подкаста
```

---

## Как проверить

1. Вызвать `POST /api/briefing/podcast/generate` с существующим брифингом
2. В стриме должны появляться события прогресса по каждой теме
3. В БД: `audioStatus = 'ready'`, `audioUrls` и `audioDurations` заполнены
4. MP3 доступны по URL из `audioUrls` (проверить в браузере — должен играть)
5. При ошибке одной темы: `audioStatus = 'partial'`, остальные темы готовы
