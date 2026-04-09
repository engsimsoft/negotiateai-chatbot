# ТЗ-Briefing-2: Подкаст — Script (M2-Her) + TTS (Speech 2.6)

**Версия:** 3.81.0  
**Приоритет:** Высокий  
**Цель:** Решить две проблемы подкаста — однообразие сценариев и акцент/искажения в TTS  
**Scope:** script-generator.ts, tts-gemini.ts → tts-minimax.ts, podcast-pipeline.ts

---

## Проблемы

**1. Сценарии стали однообразными.** После 10 подкастов Gemini 2.5 Flash повторяет одни и те же фразы и переходы. Слушать раздражает.

**2. TTS Gemini Flash — плохой русский.** Сильный акцент, искажение фамилий и имён собственных. Неприемлемо для русскоязычной аудитории 40-60+.

---

## Решение

### Часть A: Script → M2-Her

**M2-Her** — специализированная модель MiniMax для мульти-персонажных диалогов. Три года разработки против «repetition collapse». Строгое разделение голосов персонажей, динамическое развитие сюжета, антипаттерны шаблонных фраз.

| | Gemini 2.5 Flash (сейчас) | M2-Her (замена) |
|--|---------------------------|-----------------|
| Цена | $0.15/$0.60 за 1M | $0.30/$1.20 за 1M |
| Стоимость скрипта 10 секций | ~$0.006 | ~$0.006 |
| Разнообразие диалогов | Низкое (повторы после 10 подкастов) | Высокое (обучена против повторов) |
| Разделение персонажей | Слабое | Строгое (Host ≠ Expert) |
| Контекст | 1M | 66K (достаточно для скрипта) |

**Файл:** `script-generator.ts`, строка 24

```typescript
// БЫЛО:
const model = google("gemini-2.5-flash");

// СТАЛО:
const model = minimaxModel("MiniMax-M2-her");
```

**Адаптация:** `generateObject` → `generateText + JSON.parse + Zod` (тот же паттерн что Author). Промпт можно обогатить sample-диалогами через роли M2-Her (`sample_message_user`, `sample_message_ai`), чтобы задать стиль подкаста.

---

### Часть B: TTS → MiniMax Speech 2.6

**Speech 2.6** — №1 в мире по качеству TTS. 40+ языков включая русский, 300+ голосов, эмоции, умный парсинг имён/дат/URL.

| | Gemini Flash TTS (сейчас) | MiniMax Speech 2.6 Turbo (замена) |
|--|---------------------------|-----------------------------------|
| Качество русского | Акцент, искажение фамилий | Топовое, natural prosody |
| Мультиспикер | Да (Kore + Iapetus в одном запросе) | Нет (один голос за запрос) |
| Цена | ~$0.000006/секцию | ~$0.06–0.10 за 1K символов |
| Эмоции | Нет | auto, happy, calm, surprised и др. |
| Формат | PCM 24kHz → MP3 | MP3/WAV/PCM/FLAC напрямую |

**API endpoint:**

```
POST https://api.minimax.io/v1/t2a_v2
Authorization: Bearer MINIMAX_API_KEY

{
  "model": "speech-2.6-turbo",
  "text": "Текст для озвучки",
  "voice_id": "Russian_Male_Voice_ID",
  "speed": 1.0,
  "vol": 1.0,
  "pitch": 0,
  "audio_sample_rate": 32000,
  "bitrate": 128000,
  "format": "mp3",
  "emotion": "auto"
}
```

**Ответ:** `{ "audio_file": "base64_encoded_audio_data" }`

**API ключ:** Тот же `MINIMAX_API_KEY` что уже используется. Дополнительных ключей не нужно.

---

## Архитектура изменений

### Текущий flow (Gemini):

```
Секция → Script (Gemini Flash, generateObject)
       → TTS (Gemini Flash TTS, мультиспикер: Kore + Iapetus, один вызов)
       → PCM → MP3 (lamejs)
       → Upload Blob
```

### Новый flow (MiniMax):

```
Секция → Script (M2-Her, generateText + JSON.parse)
       → Разделить текст на реплики Host и Expert
       → TTS Host (Speech 2.6 Turbo, голос A, один вызов) → MP3
       → TTS Expert (Speech 2.6 Turbo, голос B, один вызов) → MP3
       → Merge реплик в правильном порядке (audio-merger.ts)
       → Upload Blob
```

**Ключевое отличие:** вместо одного мультиспикер-вызова — два TTS-вызова на секцию + сшивка. У нас уже есть `audio-merger.ts` — его можно адаптировать для merge реплик (сейчас он мержит секции).

---

## Что сделать

### 1. Создать TTS-клиент MiniMax

Файл: `lib/ai/tts-minimax.ts` (новый)

```typescript
interface MiniMaxTTSOptions {
  text: string;
  voiceId: string;
  model?: "speech-2.6-turbo" | "speech-2.6-hd";
  speed?: number;      // default 1.0
  emotion?: "auto" | "happy" | "calm" | "neutral";
  format?: "mp3" | "wav" | "pcm";
  sampleRate?: number;  // default 32000
  bitrate?: number;     // default 128000
}

async function generateSpeech(options: MiniMaxTTSOptions): Promise<Buffer> {
  // POST to https://api.minimax.io/v1/t2a_v2
  // Auth: Bearer MINIMAX_API_KEY
  // Response: { audio_file: base64 } → decode to Buffer
}
```

### 2. Определить русские голоса

Нужно выбрать два голоса для подкаста:
- **Host** (ведущий) — женский, спокойный, уверенный
- **Expert** (эксперт) — мужской, энергичный, знающий

MiniMax предоставляет 300+ голосов. Для выбора:
- Открыть https://www.minimax.io/audio/text-to-speech/russian
- Прослушать русские голоса
- Выбрать два подходящих voice_id

**Или:** использовать Voice Design API — описать голос текстом, MiniMax создаст его.

### 3. Адаптировать script-generator.ts

- Модель: Gemini → M2-Her
- Метод: `generateObject` → `generateText + JSON.parse + Zod`
- Формат скрипта: оставить тот же (Host/Expert реплики), но обогатить промпт инструкциями для M2-Her

### 4. Адаптировать podcast-pipeline.ts

Заменить вызов `tts-gemini.ts` на `tts-minimax.ts`:

```typescript
// Для каждой секции:
const script = await generateScript(section); // M2-Her

// Разделить на реплики
const hostLines = script.lines.filter(l => l.speaker === "host");
const expertLines = script.lines.filter(l => l.speaker === "expert");

// TTS каждой реплики отдельно
const hostAudios = await Promise.all(
  hostLines.map(line => generateSpeech({
    text: line.text,
    voiceId: HOST_VOICE_ID,
    emotion: "auto"
  }))
);
const expertAudios = await Promise.all(
  expertLines.map(line => generateSpeech({
    text: line.text,
    voiceId: EXPERT_VOICE_ID,
    emotion: "auto"
  }))
);

// Merge в правильном порядке (по индексу в скрипте)
const merged = await mergeReplicas(script.lines, hostAudios, expertAudios);
```

### 5. Адаптировать или убрать PCM → MP3 конвертацию

Сейчас Gemini TTS отдаёт PCM → `audio-converter.ts` конвертирует в MP3 через lamejs. Speech 2.6 отдаёт MP3 напрямую (параметр `format: "mp3"`). Конвертация не нужна — шаг можно пропустить.

### 6. Добавить pricing Speech 2.6

В `providers.ts` / `MODEL_PRICING_RUB` добавить:

```typescript
"speech-2.6-turbo": {
  input: 6.0,   // $0.06/1K символов → ₽6.0/1K символов
  output: 0,    // аудио-вывод бесплатный
}
```

---

## Что НЕ менять

- Author (уже на MiniMax M2.7) — без изменений
- Filter (уже на MiniMax M2.7) — без изменений
- audio-merger.ts — адаптировать, не переписывать
- Blob upload — без изменений
- Telegram delivery — без изменений

---

## Стоимость

| Компонент | Gemini (было) | MiniMax (стало) |
|-----------|--------------|-----------------|
| Script ×10 секций | ~$0.006 | ~$0.006 |
| TTS ×10 секций | ~$0.00006 | ~$0.10–0.15 |
| **Итого подкаст** | **~$0.006** | **~$0.11–0.16** |

**TTS дороже** — ~$0.10–0.15 вместо $0.00006. Но:
- Качество несравнимо лучше (акцент исчезает, фамилии корректны)
- На фоне общей экономии (Author с $0.15 до $0.006) — бюджет подкаста вырос, но общая стоимость брифинга упала
- **Итого с подкастом:** было ~$0.19, стало ~$0.17. Дешевле даже с premium TTS

---

## Тестовый план

### Тест 1: Script M2-Her

1. Сгенерировать скрипт одной секции через M2-Her
2. Проверить:
   - JSON распарсился ✅/❌
   - Реплики Host и Expert разделены ✅/❌
   - Текст живой, не шаблонный ✅/❌
   - Каждый персонаж говорит своим стилем ✅/❌

### Тест 2: TTS Speech 2.6

1. Озвучить одну реплику Host (женский голос, русский)
2. Озвучить одну реплику Expert (мужской голос, русский)
3. Проверить:
   - Произношение без акцента ✅/❌
   - Фамилии и имена корректны ✅/❌
   - Эмоциональность естественная ✅/❌
   - Формат MP3, качество 128kbps ✅/❌

### Тест 3: Полный подкаст

1. Сгенерировать полный подкаст (5-10 секций)
2. Прослушать целиком
3. Проверить:
   - Переходы между репликами плавные ✅/❌
   - Нет повторяющихся фраз между секциями ✅/❌
   - Общее впечатление vs старый подкаст ✅/❌

### Тест 4: Стоимость

1. Проверить `ai_usage_log` — M2-Her script
2. Посмотреть баланс MiniMax — списание за TTS
3. Подтвердить общую стоимость подкаста ≤$0.20

**Критерий приёмки:** Владимир прослушает подкаст и скажет «лучше чем было».

---

## Контекст для Claude Code

- M2-Her доступна через тот же `vercel-minimax-ai-provider`, model name: `MiniMax-M2-her`
- M2-Her цена = M2.7: $0.30/$1.20. Контекст 66K (достаточно для скрипта ~2.5K)
- Speech 2.6 API — REST, не AI SDK. Нужен отдельный HTTP-клиент (fetch/axios)
- Auth Speech 2.6: тот же `MINIMAX_API_KEY`
- Speech 2.6 отдаёт MP3 напрямую — lamejs конвертация не нужна
- Паузы в тексте: `<#x#>` где x — секунды (0.01–99.99)
- Эмоции: `"auto"` — модель сама определяет тон по тексту
- Русские голоса: нужно выбрать voice_id на https://www.minimax.io/audio/text-to-speech/russian
- `pLimit(2)` для параллельности — оставить как есть
