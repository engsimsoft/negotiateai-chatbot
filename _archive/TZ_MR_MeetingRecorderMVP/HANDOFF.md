# Передача сессии ТЗ-MR: Meeting Recorder MVP

**Дата:** 2026-03-02
**Сессия:** 2

## Статус этапов
- [x] Этап 1: Фундамент (БД + маршрут + карточка) ✅
- [x] Этап 2: Рекордер + загрузка аудио + UI страницы ✅
- [x] Этап 3: Backend Pipeline (Deepgram + Claude + streaming) ✅
- [ ] Этап 4: Результат UI + список записей ← СЛЕДУЮЩИЙ
- [ ] Этап 5: Финализация

## Следующая сессия: начни с
1. Прочитать ROADMAP.md → Этап 4
2. Создать `components/meeting/meeting-result.tsx` — Markdown рендер + метаданные + аудиоплеер + кликабельные тайм-коды
3. Создать `components/meeting/meeting-list.tsx` — список предыдущих записей (дата, title, уровень)
4. Добавить API route `app/(chat)/api/meeting/records/route.ts` (GET: список записей пользователя)
5. Добавить DELETE к `app/(chat)/api/meeting/records/[id]/route.ts` (уже есть GET)
6. Интегрировать list + result в meeting-page.tsx (навигация к старым записям)
7. Обновить meeting-card.tsx: показывать количество записей / последнюю запись

## Что сделано в сессии 2
- Полный backend pipeline: Deepgram Nova-3 → Claude Sonnet → save DB → delete blob
- 3 промпта суммаризации (compact/standard/detailed) с парсингом title
- NDJSON streaming прогресса (паттерн briefing-pipeline)
- API route /api/meeting/process (POST, maxDuration: 300)
- API route /api/meeting/records/[id] (GET single record)
- Hook use-meeting-processing (streaming fetch → state)
- Компонент MeetingProgress (framer-motion, 3 шага, error/retry)
- Интеграция в meeting-page.tsx: upload → processing → result (markdown + метаданные)
- Мануальный тест пользователем — 2 записи в БД, всё работает
- Git: 1 коммит (feat(tz-mr): Deepgram transcription + Claude summarization pipeline)

## Ключевые файлы (созданные в сессии 2)
- `lib/meeting/meeting-types.ts` — типы pipeline
- `lib/meeting/deepgram-transcribe.ts` — raw fetch Deepgram batch API
- `lib/meeting/meeting-pipeline.ts` — pipeline с NDJSON streaming
- `lib/prompts/meeting/meeting-summary-compact.md` — промпт Сводка
- `lib/prompts/meeting/meeting-summary-standard.md` — промпт Протокол
- `lib/prompts/meeting/meeting-summary-detailed.md` — промпт Детальный
- `app/(chat)/api/meeting/process/route.ts` — POST API route
- `app/(chat)/api/meeting/records/[id]/route.ts` — GET single record
- `hooks/use-meeting-processing.ts` — streaming hook
- `components/meeting/meeting-progress.tsx` — progress UI

## Ключевые файлы (из сессии 1)
- `lib/db/schema.ts` — таблица MeetingRecord (строка ~666)
- `lib/db/queries.ts` — 4 query функции в конце файла
- `lib/db/migrations/0044_meeting-record.sql`
- `hooks/use-meeting-recorder.ts` — MediaRecorder хук
- `app/(chat)/api/meeting/upload/route.ts` — серверный upload
- `components/meeting/meeting-card.tsx` — карточка дашборда
- `components/meeting/meeting-page.tsx` — основной UI (state machine: input→ready→uploading→processing→result)
- `app/(dashboard)/meeting/page.tsx` — серверная страница

## Согласованные решения
- Raw fetch для Deepgram batch API (без SDK, без @deepgram/sdk)
- Upload: серверный FormData → `put()` (для прода позже: client-side upload для файлов >4.5MB)
- maxDuration: 300 (проверка Fluid Compute при деплое)
- Title из Claude (первая строка промпта, парсим на бэкенде)
- Без DevPanel, без Prompt Caching
- Только русский язык (language: "ru")
- Подключение аудио к старым записям — отложено
- Claude Sonnet для суммаризации (temperature: 0.3, maxOutputTokens: 8192)
- AI SDK: `generateText()` с `usage.inputTokens` / `usage.outputTokens` (не promptTokens/completionTokens)

## Блокеры / Вопросы
- Blob cleanup не проверен (нужно подтвердить что del() удаляет файл после обработки)
