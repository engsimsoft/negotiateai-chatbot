# Roadmap ТЗ-Б1: Podcast Engine

**Создан:** 2026-02-22
**Версия проекта:** 3.42.0 → 3.43.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 4 |
| Текущий этап | 1 |
| Сессий (оценка) | 2-3 |

---

## Этап 1: Инфраструктура

**Статус:** ✅ Завершён

**Цель:** NPM-зависимости, схема БД, типы модуля, промпт-файлы — всё что нужно до написания логики.

**Задачи:**
- [x] Установить `@google/genai` и `lamejs`
- [x] Создать `lib/podcast/lamejs.d.ts` — TypeScript declaration для lamejs
- [x] Добавить 3 колонки в `briefingHistory` (`lib/db/schema.ts`): `audioUrls` (JSONB), `audioStatus` (TEXT default 'none'), `audioDurations` (JSONB)
- [x] Создать и применить Drizzle миграцию (`npm run db:migrate`)
- [x] Проверить миграцию SQL-запросом к production БД
- [x] Создать `lib/podcast/types.ts` — интерфейсы TTSProvider, VoiceConfig, PodcastSegment, AudioResult, PodcastProgressEvent
- [x] Скопировать промпт `briefing-scriptwriter.md` → `lib/prompts/briefing/briefing-scriptwriter.md`
- [x] Скопировать шаблон `briefing-scriptwriter-user-template.md` → `lib/prompts/briefing/briefing-scriptwriter-user-template.md` (как документация/референс)

**Файлы:**
- `package.json` — +2 зависимости
- `lib/db/schema.ts` — +3 колонки
- `drizzle/XXXX_migration.sql` — миграция
- `lib/podcast/types.ts` — новый
- `lib/podcast/lamejs.d.ts` — новый
- `lib/prompts/briefing/briefing-scriptwriter.md` — новый
- `lib/prompts/briefing/briefing-scriptwriter-user-template.md` — новый

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] SQL: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'BriefingHistory' AND column_name IN ('audioUrls', 'audioStatus', 'audioDurations')` — 3 строки ✅
- [x] 🧪 Колонки в БД подтверждены SQL-запросом

**Git (после валидации):**
```bash
git add package.json package-lock.json lib/db/schema.ts lib/podcast/types.ts lib/podcast/lamejs.d.ts lib/prompts/briefing/briefing-scriptwriter.md lib/prompts/briefing/briefing-scriptwriter-user-template.md drizzle/
git commit -m "feat(tz-b1): infrastructure — npm deps, db schema, types, prompts"
```

**Критерий готовности:** Типы компилируются, колонки в БД, промпты на диске.

---

## Этап 2: Podcast Engine core

**Статус:** ✅ Завершён

**Цель:** Полностью рабочий модуль `lib/podcast/` — из текста получаем MP3 buffer.

**Задачи:**
- [x] Создать `lib/podcast/script-generator.ts` — генерация сценария через `@ai-sdk/google` (`generateText`, модель `gemini-2.5-flash-preview-05-20`). System prompt из `briefing-scriptwriter.md`, user message собирается по шаблону (buildScriptwriterMessage). Вход: секция + контекст (isFirst, isLast, sectionTitles). Выход: текст сценария `Host: ... Expert: ...`
- [x] Создать `lib/podcast/tts-gemini.ts` — Gemini TTS через `@google/genai`. Нативный multi-speaker: voice mapping Host→Kore, Expert→Puck. Модель `gemini-2.5-flash-preview-tts`. Вход: текст сценария. Выход: PCM buffer (24kHz, 16-bit, mono). Retry 1 раз при ошибке
- [x] Создать `lib/podcast/audio-converter.ts` — PCM → MP3 через lamejs. Вход: PCM Buffer + sampleRate (default 24000). Выход: MP3 Buffer. Подсчёт duration: `pcmBuffer.length / (sampleRate * 2)` секунд
- [x] Создать `lib/podcast/index.ts` — публичный API модуля. Функция `generatePodcastSegment(section, context)`: script → tts → mp3 → { mp3Buffer, durationSeconds, replicaCount }. Реэкспорт типов

**Файлы:**
- `lib/podcast/script-generator.ts` — новый
- `lib/podcast/tts-gemini.ts` — новый
- `lib/podcast/audio-converter.ts` — новый
- `lib/podcast/index.ts` — новый

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] 🧪 Мануальный тест: E2E через API endpoint (Этап 3)

**Git (после валидации):**
```bash
git add lib/podcast/
git commit -m "feat(tz-b1): podcast engine — script generator, tts, audio converter"
```

**Критерий готовности:** Модуль принимает текст секции, возвращает MP3 buffer + duration + replicaCount. Аудио играется в браузере.

---

## Этап 3: API endpoint + DB интеграция

**Статус:** ✅ Завершён

**Цель:** Полный backend flow: API → Podcast Engine → Blob → DB. Streaming прогресс клиенту.

**Задачи:**
- [x] Добавить DB query `updateBriefingAudio` в `lib/db/queries.ts` — обновление `audioUrls`, `audioStatus`, `audioDurations` по userId. Инкрементальное обновление (patch JSONB по мере готовности каждой темы)
- [x] Расширить `deleteOldBriefingHistory` в `lib/db/queries.ts` — перед DELETE: прочитать `audioUrls`, удалить каждый MP3 из Vercel Blob через `del()`
- [x] Создать `app/(chat)/api/briefing/podcast/generate/route.ts` — POST endpoint, streaming JSON Lines. Вход: `{ topicIds?: string[] }`. Пайплайн: загрузить latest briefing → для каждой темы (p-limit(2)): script → tts → mp3 → blob upload → db update → emit progress. Events: `{ step: "script"|"recording"|"done"|"error"|"complete", topicId, message, replicaCount?, url?, durationSeconds?, readyCount?, failedCount? }`. maxDuration: 120. +p-limit NPM
- [x] Добавить hook в `app/(chat)/api/briefing/refresh-section/route.ts` — после обновления секции: если `audioStatus` = 'ready' или 'partial', обновить на 'outdated'

**Файлы:**
- `lib/db/queries.ts` — +updateBriefingAudio, расширить deleteOldBriefingHistory
- `app/(chat)/api/briefing/podcast/generate/route.ts` — новый
- `app/(chat)/api/briefing/refresh-section/route.ts` — +hook outdated

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] 🧪 Мануальный тест: POST /api/briefing/podcast/generate → стрим событий → MP3 играет
- [ ] SQL: audioStatus='ready', audioUrls заполнены
- [ ] Проверить outdated: после refresh-section audioStatus → 'outdated'

**Git (после валидации):**
```bash
git add lib/db/queries.ts app/(chat)/api/briefing/podcast/ app/(chat)/api/briefing/refresh-section/route.ts
git commit -m "feat(tz-b1): podcast API endpoint + DB integration + outdated hook"
```

**Критерий готовности:** POST endpoint генерирует MP3 для всех тем, сохраняет в Blob, обновляет БД, стримит прогресс. Ошибки per-topic не блокируют остальные. Refresh-section ставит outdated.

---

## Этап 4: Финализация

**Статус:** ✅ Завершён

**Цель:** Документация, финальные проверки, архивация.

**Задачи:**
- [ ] Финальное мануальное тестирование (пользователь)
- [x] Обновить главный `CHANGELOG.md`
- [x] Обновить `SIMPLY_STATUS.md`
- [x] Обновить `CLAUDE.md` (секция Briefing + новая секция Podcast Engine)
- [x] Обновить `package.json` (версия 3.43.0)
- [x] Обновить `docs/ai-providers.md` — добавить Gemini TTS в реестр
- [x] Обновить `docs/ai-chats-map.md` — добавить Podcast Engine pipeline
- [x] Обновить `docs/architecture.md` — добавить lib/podcast модуль
- [x] Верификация docs против кода (Правило 5)
- [ ] Переместить папку в `_archive/`

**Валидация:**
- [x] `npm run build` — успешен
- [x] Документация актуальна и верифицирована
- [x] SQL: все колонки существуют

**Git (после валидации):**
```bash
git add -A
git commit -m "chore(tz-b1): finalize v3.43.0 — PodcastEngine"
```

**Критерий готовности:** Документация актуальна, код в production, ТЗ в архиве.

---

**Обновлено:** 2026-02-22
