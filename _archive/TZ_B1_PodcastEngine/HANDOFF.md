# Передача сессии ТЗ-Б1: Podcast Engine

**Дата:** 2026-02-22
**Сессия:** 2

## Статус этапов
- [x] Этап 1: Инфраструктура (npm deps, db schema, types, prompts)
- [x] Этап 2: Podcast Engine core (script-generator, tts-gemini, audio-converter, index)
- [x] Этап 3: API endpoint + DB интеграция + outdated hook
- [ ] Этап 4: Финализация (CLAUDE.md, SIMPLY_STATUS.md, ROADMAP, CHANGELOG) ← ТЕКУЩИЙ

## Что сделано в этой сессии
1. **Исправлен model name**: `gemini-2.5-flash-preview-05-20` → `gemini-2.5-flash` (не существовал)
2. **Исправлен lamejs CJS/ESM баг**: `MPEGMode is not defined` — lamejs загружается через `lame.all.js` + `new Function()`, минуя webpack/turbopack. Добавлен `serverExternalPackages: ["lamejs"]` в next.config.ts как страховка для production
3. **Pipeline протестирован и работает**: Формула-1 (20 реплик, 159 сек) + ИИ (22 реплики, 207 сек), MP3 в Vercel Blob, DB audioStatus=ready
4. **Docs sync**: Все 4 файла docs/ обновлены — добавлены Perplexity, Podcast модели, исправлена ошибка requestSuggestions (было "Gemini 2.5 Pro", реально Claude Sonnet)

## Git коммиты (все на master)
```
e7ecbbb feat(tz-b1): infrastructure — npm deps, db schema, types, prompts
afbde10 feat(tz-b1): podcast engine — script generator, tts, audio converter
7feb067 feat(tz-b1): podcast API endpoint + DB integration + outdated hook
9387e23 fix(tz-b1): lamejs bundler fix + correct Gemini model name
32f5cde docs: sync all AI model references with actual code
```

## Следующая сессия: начни с
1. Read `specs/TZ_B1_PodcastEngine/ROADMAP.md` → Этап 4 (Финализация)
2. Обновить CLAUDE.md (добавить Podcast в структуру кода)
3. Обновить SIMPLY_STATUS.md (v3.43.0 PodcastEngine)
4. Отметить [x] в ROADMAP.md
5. Обновить CHANGELOG.md
6. Финальный коммит + push

## Ключевые технические решения
| Решение | Выбор | Причина |
|---------|-------|---------|
| SDK для ScriptGenerator | `@ai-sdk/google` (generateText) | Совместимость с Vercel AI SDK |
| SDK для TTS | `@google/genai` (напрямую) | Единственный SDK с multi-speaker TTS |
| Multi-speaker TTS | Нативный (один вызов с voice mapping) | Лучше чем ручной парсинг реплик |
| Параллельность тем | `p-limit(2)` | Защита от rate limit |
| Blob path | `briefing-podcast/{userId}/{topicId}-{timestamp}.mp3` | Уникальность + cleanup |
| lamejs загрузка | `new Function(lame.all.js)` | Обход webpack/turbopack CJS бага |
| Модель скрипта | `gemini-2.5-flash` | Стабильная, не preview |
| Модель TTS | `gemini-2.5-flash-preview-tts` | Единственная доступная TTS модель |
| Голоса | Host → Kore, Expert → Puck | Проверено на русском в Б0 |

## Ключевые файлы (новые)
```
lib/podcast/                          # Podcast Engine модуль
├── index.ts                          # Public API: generatePodcastSegment()
├── script-generator.ts               # Gemini 2.5 Flash: generateScript()
├── tts-gemini.ts                     # Gemini TTS: synthesizeSpeech()
├── audio-converter.ts                # PCM → MP3 (lamejs via new Function)
├── types.ts                          # Все типы
└── lamejs.d.ts                       # TypeScript declarations

app/(chat)/api/briefing/podcast/
└── generate/route.ts                 # Streaming POST (p-limit(2), JSON Lines)

lib/prompts/briefing/
├── briefing-scriptwriter.md          # System prompt скриптрайтера
└── briefing-scriptwriter-user-template.md  # Шаблон user message

lib/db/migrations/
└── 0037_add-briefing-audio.sql       # audioUrls, audioStatus, audioDurations
```

## Модифицированные файлы
- `lib/db/schema.ts` — +3 колонки в briefingHistory
- `lib/db/queries.ts` — +updateBriefingAudio(), enhanced deleteOldBriefingHistory()
- `app/(chat)/api/briefing/refresh-section/route.ts` — outdated hook (6b)
- `next.config.ts` — serverExternalPackages: ["lamejs"]
- `package.json` — +@google/genai, +lamejs, +p-limit

## Блокеры / Вопросы
- Нет блокеров. Backend полностью работает.
- UI для подкаста ещё не реализован (отдельное ТЗ).
