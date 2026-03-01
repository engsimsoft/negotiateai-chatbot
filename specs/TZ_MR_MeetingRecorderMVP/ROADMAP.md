# Roadmap ТЗ-MR: Meeting Recorder MVP

**Создан:** 2026-03-02
**Версия проекта:** 3.60.0 → 3.61.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 5 |
| Текущий этап | 4 |
| Сессий (оценка) | 3-5 |

## Согласованные решения (из ANALYSIS.md)

- Deepgram batch: raw `fetch` к REST API (без SDK)
- Upload больших файлов: `@vercel/blob/client` + серверный `handleUpload`
- `maxDuration: 300` (проверка Fluid Compute при деплое)
- Подключение аудио к старым записям — отложено
- Title: Claude генерирует в промпте (первая строка → парсим)
- Без DevPanel / PipelineTrace в MVP
- Без Prompt Caching
- Только русский язык (`language: "ru"`)

---

## Этап 1: Фундамент (БД + маршрут + карточка)

**Статус:** ✅ Завершён

**Цель:** Таблица в БД, пустая страница `/meeting`, карточка "Запись встречи" на дашборде.

**Задачи:**
- [x] Создать таблицу `MeetingRecord` в `lib/db/schema.ts` (id, userId, title, durationSeconds, speakerCount, summaryLevel, transcript, summary, metadata, createdAt)
- [x] Создать и применить миграцию Drizzle
- [x] Добавить CRUD-queries в `lib/db/queries.ts` (saveMeetingRecord, getMeetingRecords, getMeetingRecordById, deleteMeetingRecord)
- [x] Создать страницу `app/(dashboard)/meeting/page.tsx` (Server Component, auth guard, пока заглушка)
- [x] Создать компонент `components/meeting/meeting-card.tsx` по паттерну BriefingCard (2 состояния: есть записи / пустое)
- [x] Добавить MeetingCard в `components/glavnaya/tools-section.tsx`
- [x] Загрузить данные для карточки в `app/(dashboard)/dashboard/page.tsx`

**Файлы:**
- `lib/db/schema.ts` — новая таблица MeetingRecord
- `lib/db/queries.ts` — CRUD-queries
- `drizzle/NNNN_*.sql` — миграция
- `app/(dashboard)/meeting/page.tsx` — новая страница (заглушка)
- `components/meeting/meeting-card.tsx` — новый компонент
- `components/glavnaya/tools-section.tsx` — добавление карточки
- `app/(dashboard)/dashboard/page.tsx` — загрузка данных

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] SQL: таблица MeetingRecord существует, колонки корректны
- [ ] Браузер: карточка "Запись встречи" видна на дашборде, тап → `/meeting`
- [ ] Браузер: страница `/meeting` загружается (заглушка ОК)
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add [файлы этапа]
git commit -m "feat(tz-mr): database + route + dashboard card"
```

**Критерий готовности:** Карточка на дашборде, тап ведёт на /meeting, таблица в БД.

---

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 1

## Этап 2: Рекордер + загрузка аудио + UI страницы

**Статус:** ✅ Завершён

**Цель:** Полная страница /meeting: встроенный рекордер (запись/пауза/стоп/таймер), загрузка аудиофайла (до 200MB через client-side Blob upload), локальный аудиоплеер, выбор формата, кнопка "Создать документ".

**Задачи:**
- [x] Создать хук `hooks/use-meeting-recorder.ts` (MediaRecorder API: idle/recording/paused/stopped, таймер, blob, mimeType detection с fallback)
- [x] Создать серверный route `app/(chat)/api/meeting/upload/route.ts` (handleUpload для `@vercel/blob/client`, accept `audio/*`, лимит 200MB)
- [x] Создать клиентскую страницу `components/meeting/meeting-page.tsx` с layout:
  - Два режима входа: Записать (большая кнопка) / Загрузить файл (file picker)
  - UI записи: кнопка записи с пульсацией, таймер, пауза, стоп (лимит 3ч)
  - После записи/загрузки: аудиоплеер (Object URL), выбор формата (3 radio: Сводка/Протокол/Детальный), кнопка "Создать документ"
- [x] Подключить клиентскую страницу к `app/(dashboard)/meeting/page.tsx`
- [x] Реализовать client-side upload через `upload()` из `@vercel/blob/client`

**Файлы:**
- `hooks/use-meeting-recorder.ts` — новый хук
- `app/(chat)/api/meeting/upload/route.ts` — новый API route
- `components/meeting/meeting-page.tsx` — клиентский компонент страницы
- `app/(dashboard)/meeting/page.tsx` — подключение клиентского компонента

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] Браузер: кнопка записи → запись идёт (таймер, пульсация) → пауза → стоп → аудиоплеер играет
- [ ] Браузер: загрузка MP3/M4A файла → аудиоплеер играет
- [ ] Браузер: выбор формата (3 варианта), кнопка "Создать документ" активна
- [ ] Браузер: большой файл (~50MB+) успешно загружается через client-side upload
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add [файлы этапа]
git commit -m "feat(tz-mr): recorder + file upload + meeting page UI"
```

**Критерий готовности:** Можно записать аудио или загрузить файл, услышать playback, выбрать формат.

---

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 2

## Этап 3: Backend Pipeline (Deepgram + Claude + streaming)

**Статус:** ✅ Завершён

**Цель:** Полный backend: транскрипция (Deepgram batch API), суммаризация (Claude Sonnet, 3 промпта), NDJSON streaming прогресса, сохранение в БД, cleanup Blob.

**Задачи:**
- [x] Создать утилиту `lib/meeting/deepgram-transcribe.ts` — raw fetch к `POST https://api.deepgram.com/v1/listen` (model: nova-3, language: ru, smart_format, diarize, utterances, paragraphs). Форматирование результата: `[ЧЧ:ММ:СС] Спикер N: текст`
- [x] Создать 3 промпта суммаризации:
  - `lib/prompts/meeting/meeting-summary-compact.md` (Сводка, ~1 стр)
  - `lib/prompts/meeting/meeting-summary-standard.md` (Протокол, ~2-3 стр)
  - `lib/prompts/meeting/meeting-summary-detailed.md` (Детальный, полный + тайм-коды)
  - Каждый: "Первой строкой верни краткий заголовок встречи (до 60 символов), затем --- и документ"
- [x] Создать pipeline `lib/meeting/meeting-pipeline.ts`:
  - Input: blobUrl, summaryLevel, userId
  - Шаги: upload check → transcribe (Deepgram) → summarize (Claude Sonnet) → save DB → delete blob
  - onProgress callback для NDJSON (паттерн briefing-pipeline)
  - Парсинг title из ответа Claude (первая строка до ---)
  - Подсчёт speakerCount из diarization
- [x] Создать API route `app/(chat)/api/meeting/process/route.ts`:
  - POST, auth guard, maxDuration: 300
  - Принимает: { blobUrl, summaryLevel }
  - ReadableStream + TextEncoder для NDJSON
  - Вызывает runMeetingPipeline
- [x] Создать хук `hooks/use-meeting-processing.ts` (паттерн use-briefing-generation: streaming fetch → parse NDJSON → state)
- [x] Создать компонент `components/meeting/meeting-progress.tsx` (паттерн briefing-generation-progress: шаги, анимация, ошибка/retry)
- [x] Интегрировать прогресс и результат в `components/meeting/meeting-page.tsx`

**Файлы:**
- `lib/meeting/deepgram-transcribe.ts` — новая утилита
- `lib/meeting/meeting-pipeline.ts` — новый pipeline
- `lib/meeting/meeting-types.ts` — типы (MeetingProgressEvent, MeetingProgressStep, MeetingPipelineResult)
- `lib/prompts/meeting/meeting-summary-compact.md` — промпт Сводка
- `lib/prompts/meeting/meeting-summary-standard.md` — промпт Протокол
- `lib/prompts/meeting/meeting-summary-detailed.md` — промпт Детальный
- `app/(chat)/api/meeting/process/route.ts` — новый API route
- `hooks/use-meeting-processing.ts` — новый хук
- `components/meeting/meeting-progress.tsx` — новый компонент
- `components/meeting/meeting-page.tsx` — интеграция прогресса

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] End-to-end: записать/загрузить аудио → нажать "Создать документ" → видеть прогресс (3 шага) → получить markdown документ
- [x] Проверить что title извлечён корректно (SQL: "Тест записи аудио и проверка обработки транскрипции")
- [x] Проверить что speakerCount определён (SQL: speakerCount=1)
- [x] SQL: запись в MeetingRecord существует со всеми полями (2 записи, metadata с inputTokens/outputTokens/deepgramDurationMs)
- [ ] Проверить что blob удалён после обработки
- [x] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add [файлы этапа]
git commit -m "feat(tz-mr): Deepgram transcription + Claude summarization pipeline"
```

**Критерий готовности:** Полный flow работает: аудио → прогресс → документ в БД.

---

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 3

## Этап 4: Результат UI + список записей

**Статус:** ⬜ Не начат

**Цель:** Финальный UI результата (markdown render + метаданные + кликабельные тайм-коды), список предыдущих записей.

**Задачи:**
- [ ] Создать компонент `components/meeting/meeting-result.tsx`:
  - Markdown рендер результата (MarkdownViewer, паттерн briefing-article-view)
  - Метаданные: дата, длительность, количество спикеров, уровень
  - Аудиоплеер (если есть локальный blob)
  - Кликабельные тайм-коды `[ЧЧ:ММ:СС]` → seek аудиоплеера (только если аудио доступно)
- [ ] Создать компонент `components/meeting/meeting-list.tsx`:
  - Список предыдущих записей (дата, длительность, превью title, уровень)
  - Тап → загрузка результата из БД
  - Без аудиоплеера для старых записей (аудио не хранится)
- [ ] Добавить API route `app/(chat)/api/meeting/records/route.ts` (GET: список записей пользователя)
- [ ] Добавить API route `app/(chat)/api/meeting/records/[id]/route.ts` (GET: конкретная запись, DELETE: удаление)
- [ ] Интегрировать list + result в meeting-page.tsx (state machine: empty → recording/uploading → processing → result, + навигация к старым записям)
- [ ] Обновить meeting-card.tsx: показывать количество записей / последнюю запись

**Файлы:**
- `components/meeting/meeting-result.tsx` — новый компонент
- `components/meeting/meeting-list.tsx` — новый компонент
- `app/(chat)/api/meeting/records/route.ts` — новый API route
- `app/(chat)/api/meeting/records/[id]/route.ts` — новый API route
- `components/meeting/meeting-page.tsx` — интеграция
- `components/meeting/meeting-card.tsx` — обновление

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: после обработки — виден markdown документ с метаданными
- [ ] Браузер: тайм-коды в детальном режиме кликабельны → аудио перематывается
- [ ] Браузер: список записей показывает предыдущие записи
- [ ] Браузер: тап на запись → загружается результат из БД
- [ ] Браузер: удаление записи работает
- [ ] Браузер: карточка на дашборде отражает наличие записей
- [ ] 🧪 Мануальный тест пользователем (полный E2E flow)

**Git (после валидации):**
```bash
git add [файлы этапа]
git commit -m "feat(tz-mr): result UI + meeting records list"
```

**Критерий готовности:** Полный E2E: запись → обработка → результат → список. Все 11 критериев приёмки из ТЗ выполнены.

---

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 4

## Этап 5: Финализация

**Статус:** ⬜ Не начат

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../DOCUMENTATION_GUIDE.md) — пройти чеклист.

**Задачи:**

**Документация (обязательная):**
- [ ] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти "✅ Чек-лист при изменениях"
- [ ] Обновить главный CHANGELOG.md
- [ ] Обновить SIMPLY_STATUS.md
- [ ] Обновить CLAUDE.md (новая секция Meeting Recorder)
- [ ] Обновить package.json: 3.60.0 → 3.61.0

**Документация (по чеклисту — оценить каждый пункт):**
- [ ] ADR нужен? → Да: `docs/decisions/NNN-meeting-recorder-architecture.md` (новый pipeline, client-side blob upload — новый паттерн, Deepgram batch API без SDK)
- [ ] `docs/architecture.md` нужно обновить? → Да (новый модуль meeting, новая таблица)
- [ ] `docs/ai-tools.md` нужно обновить? → Нет (meeting не использует AI tools)
- [ ] `docs/ai-chats-map.md` нужно обновить? → Да (новый Claude call для суммаризации)
- [ ] `docs/ai-agents.md` нужно обновить? → Нет
- [ ] `docs/design-system.md` нужно обновить? → Да (новая страница /meeting)
- [ ] `docs/ai-providers.md` → Реестр: добавить meeting summarization (Claude Sonnet, temperature, etc.)

**Верификация docs против кода (Правило 5):**
- [ ] `docs/ai-providers.md` → Реестр конфигураций сверен с grep по коду
- [ ] `docs/ai-chats-map.md` → код-блок myProvider совпадает с `providers.ts`
- [ ] `CLAUDE.md` → пути файлов и описания актуальны

**Проверка БД:**
- [ ] SQL: таблица MeetingRecord — колонки, типы, FK, индексы

**Завершение:**
- [ ] Финальное мануальное тестирование (пользователь) — все 11 критериев приёмки
- [ ] Переместить папку: `mv specs/TZ_MR_MeetingRecorderMVP/ _archive/`

**Валидация:**
- [ ] `npm run build` — успешен
- [ ] Документация актуальна (проверено по чеклисту выше)

**Git (после валидации):**
```bash
git add [файлы документации]
git commit -m "chore(tz-mr): finalization + docs — v3.61.0"
```

**Критерий готовности:** Все 11 критериев приёмки из ТЗ, документация обновлена и верифицирована, папка в архиве.
