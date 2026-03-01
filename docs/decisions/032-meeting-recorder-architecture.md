# ADR 032: Meeting Recorder Architecture

**Дата:** 2026-03-02
**Статус:** Принято

## Контекст

Новый инструмент «Запись встречи» — первый pipeline в проекте, не связанный с AI-чатами или брифингом. Нужно выбрать подход к транскрипции аудио (Deepgram SDK vs raw fetch), загрузке файлов (server-side vs client-side), и архитектуре pipeline (streaming vs batch).

## Решение

### 1. Deepgram batch API без SDK

Используем raw `fetch` к `POST https://api.deepgram.com/v1/listen` вместо `@deepgram/sdk`.

**Почему:**
- SDK добавляет ~150KB к бандлу (серверному)
- Нам нужен только один endpoint (batch transcription)
- Raw fetch даёт полный контроль над параметрами и error handling
- Паттерн аналогичен `jina-reader.ts` и `perplexity-client.ts`

**Параметры:** `model: nova-3, language: ru, smart_format: true, diarize: true, utterances: true, paragraphs: true`

### 2. Server-side upload через FormData

Используем серверный `put()` из `@vercel/blob` вместо client-side `upload()`.

**Почему:**
- Проще реализация для MVP
- Не требует `handleUpload` callback boilerplate
- Лимит 4.5MB для Vercel serverless функций не критичен для коротких записей

**Ограничение:** Для файлов >4.5MB нужно будет перейти на client-side upload (`@vercel/blob/client`). Отложено.

### 3. NDJSON streaming для прогресса

Pipeline эмитит JSON Lines через `ReadableStream` (паттерн `briefing-pipeline.ts`).

**Почему:**
- Проверенный паттерн в проекте (briefing, podcast)
- Не требует WebSocket или data-stream protocol
- Простой парсинг на клиенте (`readline` + `JSON.parse`)

### 4. Claude Sonnet для суммаризации

`generateText()` с Claude Sonnet 4.6, `temperature: 0.3`, `maxOutputTokens: 8192`.

**Почему:**
- Высокое качество русского текста (проверено на брифинге)
- `temperature: 0.3` — баланс точности и читаемости
- Три промпта (compact/standard/detailed) покрывают все сценарии

### 5. Blob cleanup после обработки

Аудио удаляется из Vercel Blob после успешной транскрипции. В БД хранится только текст.

**Почему:**
- Экономия Blob Storage (аудио 10-200MB vs текст ~5KB)
- Аудио не нужно после транскрипции (тайм-коды в тексте достаточны)
- Для текущей сессии аудио доступно через Object URL в браузере

## Последствия

**Плюсы:**
- Минимальные зависимости (нет `@deepgram/sdk`)
- Проверенные паттерны (NDJSON, pipeline, generateText)
- Быстрый MVP (4 этапа, 3 сессии)

**Минусы:**
- Server-side upload ограничен ~4.5MB (нужна миграция для больших файлов)
- Аудио не сохраняется — для старых записей нет playback
- Только русский язык (hardcoded `language: "ru"`)

## Альтернативы

| Вариант | Почему отклонён |
|---------|-----------------|
| `@deepgram/sdk` | Избыточен для одного endpoint |
| Client-side Blob upload | Усложняет MVP без необходимости |
| Хранение аудио в Blob | Дорого по storage, не нужно для MVP |
| AssemblyAI вместо Deepgram | Deepgram уже используется для Voice Input |
