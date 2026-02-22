# Анализ ТЗ-Б1: Podcast Engine

**Дата анализа:** 2026-02-22

---

## Резюме

Backend-пайплайн генерации подкаста из текстового брифинга. Три компонента: ScriptGenerator (Gemini Flash → сценарий), TTSProvider (Gemini TTS → PCM audio), AudioConverter (lamejs → MP3). Streaming прогресс клиенту через JSON Lines. Отдельные MP3 на каждую тему, хранение в Vercel Blob.

---

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.
> Все рекомендации согласованы с архитектором (22.02.2026).

### ✅ Согласен с ТЗ

- **Модуль `lib/podcast/`** — ОК, переиспользуемый движок вне `lib/briefing/`
- **3 колонки в briefingHistory** — ОК, nullable JSONB + TEXT, минимальная миграция
- **lamejs для PCM→MP3** — ОК, pure JS, нет ffmpeg на Vercel Functions
- **ReadableStream + JSON Lines** — ОК, паттерн из `app/(chat)/api/briefing/generate/route.ts`
- **Promise.allSettled** — ОК, ошибка одной темы не блокирует остальные
- **Blob cleanup в deleteOldBriefingHistory** — ОК, сейчас просто `DELETE FROM` без чистки файлов
- **outdated hook в refresh-section** — ОК, простой UPDATE
- **Промпты через fs** — ОК, паттерн из `briefing-author.ts`
- **maxDuration: 120** — ОК, 5 тем × ~10с TTS (параллельно) ≈ 30-60с

### ⚠️ Рекомендовано изменить (согласовано)

| # | Было (ТЗ) | Рекомендация | Обоснование |
|---|-----------|--------------|-------------|
| 1 | SDK для ScriptGenerator не уточнён | `@ai-sdk/google` (generateText) для скрипта, `@google/genai` только для TTS | Консистентность: `briefing-filter.ts:3` и `vision-ocr.ts:10` уже используют `createGoogleGenerativeAI`. Один новый пакет вместо двух задач через новый SDK |
| 2 | «парсим сценарий на реплики, чередуем голоса» | Нативный multi-speaker TTS — один вызов с voice mapping | Gemini TTS поддерживает multi-speaker нативно: 1 API-вызов вместо N, естественные переходы, проще код |
| 3 | Promise.allSettled (все 5 тем параллельно) | `p-limit(2)` — максимум 2 темы одновременно | Страховка от rate limit 429 на preview-модели. 2+2+1 ≈ 3 цикла vs 1, некритичное замедление |
| 4 | Blob path не уточнён | `briefing-podcast/{userId}/{topicId}-{timestamp}.mp3` | Структурированный путь для идентификации и cleanup |

---

## Вопросы для уточнения

> Все вопросы закрыты (22.02.2026)

| # | Вопрос | Ответ |
|---|--------|-------|
| 1 | API-ключ для `@google/genai` — тот же `GOOGLE_GENERATIVE_AI_API_KEY`? | Да, один ключ, один проект Google Cloud |
| 2 | Rate limits Gemini TTS preview? | Точных лимитов нет. `p-limit(2)` + retry с backoff |
| 3 | Kore/Puck на русском — проверялось? | Да, в Б0. Фирменная пара NotebookLM, русский звучит нормально |
| 4 | Cleanup Blob — нужен TTL? | Нет. Живёт один выпуск (~15MB). Сироты при падении cleanup — не критично |

---

## Потенциальные риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| `gemini-2.5-flash-preview-tts` нестабилен (preview) | Средняя | Высокое | Retry 1 раз, error per-topic, audioStatus=partial |
| Лимит длины текста для TTS (~5000 символов) | Низкая | Среднее | Сценарий 200-450 слов ≈ 1500-3000 символов, ниже лимита |
| lamejs без TypeScript типов | Точно | Низкое | Создать `.d.ts` declaration file |
| Memory при 5 темах × ~8MB PCM | Низкая | Низкое | ~40MB peak, далеко от лимита Vercel (1024MB) |
| Rate limit 429 от Gemini | Средняя | Среднее | `p-limit(2)`, retry с exponential backoff |

---

## Зависимости

**Что нужно до начала:**
- [x] Env var `GOOGLE_GENERATIVE_AI_API_KEY` — уже настроен
- [x] `@vercel/blob` — уже установлен (v0.24.1)
- [x] `@ai-sdk/google` — уже установлен (v2.0.44)
- [ ] Установить `@google/genai` — новая зависимость
- [ ] Установить `lamejs` — новая зависимость

**Затронутые компоненты:**
- `lib/db/schema.ts` — +3 колонки в briefingHistory
- `lib/db/queries.ts` — +updateBriefingAudio, расширить deleteOldBriefingHistory
- `app/(chat)/api/briefing/refresh-section/route.ts` — hook outdated
- `lib/prompts/briefing/` — +2 файла промптов
- `lib/podcast/` — новый модуль (5 файлов)
- `app/(chat)/api/briefing/podcast/generate/route.ts` — новый endpoint

---

## Оценка

- [ ] Простое (1-2 сессии)
- [x] Среднее (3-5 сессий)
- [ ] Сложное (5+ сессий)

**Обоснование:** Чётко определённая архитектура, готовые паттерны в коде, главный риск — стабильность preview TTS API. 4 этапа разработки.

---

**Обновлено:** 2026-02-22
