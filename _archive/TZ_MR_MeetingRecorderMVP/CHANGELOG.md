# Changelog ТЗ-MR: Meeting Recorder MVP

## Сессия 1 — 2026-03-02

### Added
- Таблица `MeetingRecord` в schema.ts (10 полей, 2 индекса) + миграция применена
- CRUD-queries: saveMeetingRecord, getMeetingRecords, getMeetingRecordById, deleteMeetingRecord
- Карточка MeetingCard на дашборде (2 состояния)
- Страница /meeting (Server + Client Component)
- Хук use-meeting-recorder.ts (MediaRecorder API, таймер, пульсация, auto-stop 3ч)
- Server upload route api/meeting/upload (FormData → Vercel Blob put)
- Полный UI: запись/загрузка/плеер/выбор формата/кнопка "Создать документ"

### Changed
- tools-section.tsx — добавлен MeetingCard
- dashboard/page.tsx — загрузка getMeetingRecords

### Решения
- Upload: серверный FormData → put() (работает локально без ngrok)

## Сессия 2 — 2026-03-02

### Added
- `lib/meeting/meeting-types.ts` — типы pipeline (MeetingProgressEvent, MeetingPipelineInput, MeetingPipelineResult)
- `lib/meeting/deepgram-transcribe.ts` — raw fetch к Deepgram Nova-3 batch API (diarize, utterances, paragraphs, format [HH:MM:SS] Спикер N)
- 3 промпта суммаризации в `lib/prompts/meeting/`:
  - meeting-summary-compact.md (Сводка, ~1 стр)
  - meeting-summary-standard.md (Протокол, ~2-3 стр)
  - meeting-summary-detailed.md (Детальный, полный + тайм-коды)
- `lib/meeting/meeting-pipeline.ts` — pipeline: transcribe → summarize (Claude Sonnet) → save DB → delete blob, NDJSON onProgress
- `app/(chat)/api/meeting/process/route.ts` — POST, auth, maxDuration: 300, NDJSON streaming
- `app/(chat)/api/meeting/records/[id]/route.ts` — GET single record by ID
- `hooks/use-meeting-processing.ts` — streaming fetch → parse NDJSON → steps/error/recordId
- `components/meeting/meeting-progress.tsx` — live progress UI (framer-motion, 3 шага, error/retry)

### Changed
- `components/meeting/meeting-page.tsx` — подключён pipeline: upload → processing (прогресс) → result (markdown + метаданные). Убран placeholder "Этап 3"

### Verified (SQL)
- 2 записи в MeetingRecord с title, transcript, summary, metadata (inputTokens, outputTokens, deepgramDurationMs)
