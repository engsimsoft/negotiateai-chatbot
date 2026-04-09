# ADR 045: Podcast Pipeline — Gemini → MiniMax

**Дата:** 2026-04-09
**Статус:** Принято
**ТЗ:** Briefing-2 (v3.81.0)

## Контекст

Подкаст-пайплайн использовал два Gemini-компонента:
1. **Script (Gemini 2.5 Flash)** — генерация диалогового скрипта Host/Expert
2. **TTS (Gemini Flash TTS)** — мультиспикер озвучка (Kore + Iapetus)

Проблемы:
- TTS: сильный акцент в русском, искажение фамилий и имён собственных
- Script: однообразные сценарии после 10+ подкастов (repetition collapse)
- Три Google-зависимости (`@ai-sdk/google`, `@google/genai`, `lamejs`) ради одного пайплайна

## Решение

### Script: Gemini 2.5 Flash → MiniMax M2.7

M2.7 уже используется для Author и Filter брифинга. Тот же провайдер, тот же API ключ.
- Формат: JSON (`{lines: [{s:"h", t:"..."}]}`) + plain text fallback (universal parser)
- Universal parser обрабатывает все варианты: JSON, plain text с `\n`, inline без `\n`
- Temperature: 0.7 (как везде для MiniMax)

Первоначально планировалось использовать M2-Her (модель для мульти-персонажных диалогов), но она оказалась непригодна:
- Max output: 2048 токенов (JSON скрипт обрезается)
- Нестабильный формат вывода (RP-стиль со `*звёздочками*`, метакомментарии)
- Не следует структурным инструкциям промпта

### TTS: Gemini Flash TTS → MiniMax Speech 2.8 HD

- Нативный русский без акцента
- Per-replica TTS (отдельный вызов на каждую реплику, не мультиспикер)
- Voice routing: Host → `Russian_Professional_Broadcaster_v2`, Expert → `Russian_Overwhelmed_Vlogger_v1`
- MP3 напрямую (hex-encoded в `data.audio`), без PCM→MP3 конвертации
- Паузы `<#0.3#>` между репликами
- pLimit(4) для параллельных TTS-вызовов

### Удалённые зависимости

- `@google/genai` — Gemini TTS SDK
- `@ai-sdk/google` — Gemini AI SDK (последнее использование было в script-generator)
- `lamejs` — PCM→MP3 конвертер (Speech 2.8 HD отдаёт MP3)

## Причины

1. Качество русского TTS — приоритет для аудитории 40-60+
2. Унификация на одного провайдера (MiniMax) для всего briefing pipeline
3. Удаление 3 Google-зависимостей из production кода
4. Speech 2.8 HD — #1 в мире по качеству TTS (40+ языков, 300+ голосов)

## Последствия

**Плюсы:**
- Качество русского TTS несравнимо лучше
- Единый провайдер для всего briefing (filter + author + script + TTS)
- -3 зависимости, проще `next.config.ts`

**Минусы:**
- TTS дороже: ~$0.10-0.15 vs ~$0.00006 за подкаст
- Per-replica TTS = больше API-вызовов (10-20 на секцию vs 1)
- Зависимость от одного провайдера (MiniMax)

## Альтернативы

1. **Оставить Gemini TTS** — отклонено из-за акцента
2. **M2-Her для скриптов** — отклонено, 2048 output limit + нестабильный формат
3. **ElevenLabs TTS** — рассматривалось, но MiniMax дешевле и уже интегрирован

## API Details (для reference)

```
POST https://api.minimax.io/v1/t2a_v2
Authorization: Bearer MINIMAX_API_KEY

Body: {
  model: "speech-2.8-hd",
  text: "...",
  voice_setting: { voice_id: "...", speed: 1.0, vol: 1.0, pitch: 0 },
  audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3" }
}

Response: { data: { audio: "hex_encoded_mp3" } }
```
