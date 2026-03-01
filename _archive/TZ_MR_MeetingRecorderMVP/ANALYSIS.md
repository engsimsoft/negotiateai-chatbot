# Анализ ТЗ — Meeting Recorder MVP

## Резюме

Новый инструмент "Запись встречи" на дашборде: встроенный рекордер или загрузка аудиофайла → транскрипция (Deepgram Nova-3 batch) → суммаризация (Claude Sonnet) → структурированный документ (3 уровня). NDJSON streaming для прогресса, хранение результатов в БД, аудио — только транзитное (Vercel Blob, удаляется после обработки).

Затронутые области: дашборд (новая карточка), новая страница `/meeting`, новый API route, новая таблица БД, новый хук рекордера, промпты суммаризации.

---

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.
> Каждая рекомендация требует согласования с архитектором.

### ✅ Согласен с ТЗ

- **Карточка на дашборде** — ОК, паттерн BriefingCard в ToolsSection, grid уже поддерживает 3 колонки (`lg:grid-cols-3`)
- **MediaRecorder API для рекордера** — ОК, правильный выбор. Существующий voice recorder (`use-voice-recorder.ts`) использует Web Audio API + WebSocket для real-time streaming — это совершенно другой use case. MediaRecorder проще и идеален для batch-записи
- **NDJSON streaming** — ОК, паттерн из briefing pipeline (`briefing-pipeline.ts` + `use-briefing-generation.ts` + `api/briefing/generate/route.ts`) полностью переиспользуем
- **Три уровня суммаризации** — ОК, чистый подход. Промпты в `lib/prompts/meeting/*.md`
- **Claude Sonnet для суммаризации** — ОК, соответствует архитектуре Simply (Claude = основной провайдер)
- **Таблица MeetingRecord** — ОК, структура разумная, паттерн аналогичен `briefingHistory`
- **Удаление аудио из Blob после обработки** — ОК, паттерн `del()` из `@vercel/blob` уже используется (`lib/db/queries.ts:3558`)
- **Лимит 200MB для загрузки** — ОК, но потребует нового паттерна (см. рекомендации ниже)
- **Аудио не хранится, только текст** — ОК, экономит storage

### ⚠️ Рекомендую изменить

| # | Было (ТЗ) | Рекомендация | Обоснование из кода |
|---|-----------|--------------|---------------------|
| 1 | "Deepgram SDK: `@deepgram/sdk` — уже в проекте" | **`@deepgram/sdk` НЕ установлен.** В `package.json` его нет. Проект использует raw WebSocket для real-time streaming (`hooks/use-voice-recorder.ts`). Для batch transcription нужно либо установить SDK, либо использовать raw HTTP `fetch` к Deepgram REST API. **Рекомендую raw fetch** — одна функция `transcribeAudio(url)`, без лишней зависимости, полный контроль над retry/timeout. | `package.json` — нет `@deepgram/sdk`. `hooks/use-voice-recorder.ts` — WebSocket, не SDK |
| 2 | "Client-side upload в Vercel Blob (presigned URL)" | **В проекте нет паттерна presigned URL.** Все загрузки идут через server-side `put()` (`app/(chat)/api/files/upload/route.ts`, лимит 20MB). Для 200MB нужен `@vercel/blob/client` → `upload()` + серверный route с `handleUpload()`. Это **новый паттерн** — потребует: (a) серверный route `/api/meeting/upload` с `handleUpload`, (b) клиентский `upload()` из `@vercel/blob/client`. Альтернатива: ограничить загрузку до ~20MB через существующий паттерн (но это мало для 2-3 часовых записей). | `app/(chat)/api/files/upload/route.ts:11` — лимит 20MB. Grep по `handleUpload` — не найден в API routes, только в UI-компонентах |
| 3 | `maxDuration: 300` | **Риск таймаута.** Текущий максимум в проекте — 180 сек (`api/chat/route.ts`). 300 сек доступно на Fluid Compute, но Deepgram batch для 2ч аудио = ~2-3 мин + Claude ~30 сек = ~210 сек. Это ОК, но для 3-часового аудио может быть впритык. **Рекомендую:** (a) подтвердить что Fluid Compute включен, (b) добавить timeout-guard на клиенте. | `app/(chat)/api/chat/route.ts:72` — максимальный `maxDuration = 180` в проекте |
| 4 | "Кнопка 'Загрузить аудиофайл'" в списке записей | **Уточнить UX.** Если аудио удалено — кнопка "Загрузить аудиофайл" загружает новый файл к существующей записи? Или это для нового анализа? Тайм-коды в детальном режиме будут бессмысленны без аудио — нужен ли вообще этот flow? | Архитектурный вопрос: re-upload к существующей записи или новый анализ |
| 5 | Не упомянут | **Рекомендую добавить `language` selector.** Deepgram Nova-3 поддерживает multi-language. Текущая запись только `language: "ru"`. Если встречи бывают на английском — дать toggle RU/EN. Минимальное изменение, большая польза. Но если это out of scope для MVP — ОК, пропускаем. | `lib/audio/constants.ts` — `language: "ru"` hardcoded |
| 6 | Route group не указан | **Рекомендую `app/(dashboard)/meeting/page.tsx`** по паттерну briefing. Dashboard route group уже содержит: briefing, projects, chats, settings, groups. `/meeting` логично живёт там же. | `app/(dashboard)/briefing/page.tsx` — аналогичный инструмент в dashboard group |

### ❓ Требует уточнения

1. **Формат записи MediaRecorder.** ТЗ указывает accept `audio/*` для загрузки, но не указывает `mimeType` для MediaRecorder. Браузерная совместимость: Chrome = `audio/webm;codecs=opus`, Safari = `audio/mp4`. Deepgram принимает оба. **Вопрос:** какой формат предпочтителен? Рекомендую `audio/webm` с fallback на `audio/mp4`.

2. **Автонейминг title.** ТЗ: "Автогенерируемый из контента". На каком этапе? Рекомендую: Claude генерирует title как часть суммаризации (добавить в промпт). Минимум токенов, максимум точности.

3. **DevPanel интеграция.** Нужен ли `PipelineTrace` для meeting pipeline (аналогично briefing)? Или это overkill для MVP? Если нужен — добавлю `TraceCollector("meeting")` + dev footer.

4. **Prompt Caching.** Мы только что внедрили Anthropic prompt caching (v3.60.0). Для meeting суммаризации базовый system prompt будет одинаковый для всех вызовов — имеет смысл закэшировать. Добавлять в MVP или потом?

5. **Список записей — пагинация?** Сколько записей ожидается у пользователя? Если <50, простой `limit(50)` достаточно. Если больше — нужна cursor-pagination по паттерну из telegram groups.

---

## Потенциальные риски

### Высокие
- **Vercel Blob upload 200MB** — новый паттерн, не обкатан в проекте. Нужен `@vercel/blob/client` + серверный `handleUpload`. Риск: сетевые обрывы при долгой загрузке на медленном соединении.
- **Deepgram timeout** — batch transcription для 3-часового аудио. Deepgram обещает ~3 мин, но при нагрузке может быть дольше. Нужен retry или fallback.

### Средние
- **MediaRecorder кросс-браузерность** — Safari поддерживает MediaRecorder с iOS 14.3+, но с ограничениями (только `audio/mp4`). Нужна проверка `isTypeSupported()`.
- **Function timeout 300 сек** — если Deepgram задержится, pipeline может не уложиться. Рекомендую: отдельный retry-механизм для Deepgram.

### Низкие
- **Размер транскрипта** — 2ч = ~30K слов = ~40K токенов. Claude 200K context — запас огромный. Для 3ч будет ~60K токенов — тоже ОК.
- **Blob cleanup** — если pipeline упадёт после upload, но до cleanup — файл останется. Рекомендую: scheduled cleanup job или TTL на blob.

---

## Зависимости

### Нужно до начала
- Подтвердить что Vercel Fluid Compute включен (для `maxDuration: 300`)
- Решение по `@deepgram/sdk` vs raw fetch для batch API

### Затронутые компоненты
- `components/glavnaya/tools-section.tsx` — добавление карточки
- `app/(dashboard)/dashboard/page.tsx` — загрузка данных для карточки
- `lib/db/schema.ts` — новая таблица `MeetingRecord`
- `lib/db/queries.ts` — CRUD для MeetingRecord
- Новые файлы: ~15-20 (компоненты, хуки, API routes, промпты, pipeline)

### Новые зависимости
- Потенциально: `@vercel/blob/client` (уже часть `@vercel/blob`)
- Deepgram REST API (без новых пакетов, raw fetch)

---

## Оценка сложности

- [x] Среднее (3-5 сессий)

**Обоснование:**
- Этап 1 (БД + карточка): ~1 сессия
- Этап 2 (Рекордер + Upload): ~1 сессия
- Этап 3 (Backend Pipeline: Deepgram + Claude): ~1-2 сессии
- Этап 4 (UI результата + список): ~1 сессия
- Финализация: ~0.5 сессии
