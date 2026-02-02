# ТЗ: Миграция Voice Input на Deepgram

**Версия:** 1.0  
**Дата:** 2026-02-01  
**Причина:** AssemblyAI Streaming не поддерживает русский язык  
**Решение:** Deepgram Nova-3 (поддерживает русский в streaming)

---

## Контекст

Текущая реализация Voice Input использует AssemblyAI Universal-Streaming. Проблема: этот API поддерживает только 6 языков (EN, ES, FR, DE, IT, PT). Русский язык НЕ поддерживается в streaming режиме.

**Deepgram Nova-3** поддерживает русский в real-time streaming.

---

## Что нужно изменить

### 1. Переменные окружения

**Было:**
```env
ASSEMBLYAI_API_KEY=xxx
```

**Стало:**
```env
DEEPGRAM_API_KEY=xxx
```

### 2. Серверный endpoint для получения токена

**Deepgram использует API ключ напрямую** — но его нельзя отдавать в браузер.

Варианты:
- **Вариант A (рекомендуется):** Проксировать WebSocket через сервер
- **Вариант B:** Использовать Deepgram API Keys с ограниченными правами

Для MVP — Вариант A проще и безопаснее.

### 3. WebSocket endpoint

**Было (AssemblyAI):**
```
wss://streaming.assemblyai.com/v3/ws
```

**Стало (Deepgram):**
```
wss://api.deepgram.com/v1/listen
```

### 4. Параметры подключения

**Deepgram параметры:**
```javascript
const params = new URLSearchParams({
  model: 'nova-3',
  language: 'ru',  // или 'multi' для автодетекции
  smart_format: 'true',
  punctuate: 'true',
  interim_results: 'true',
  endpointing: '300',  // ms тишины для авто-стопа
  utterance_end_ms: '1000'
});

const ws = new WebSocket(
  `wss://api.deepgram.com/v1/listen?${params}`,
  ['token', DEEPGRAM_API_KEY]  // авторизация через subprotocol
);
```

### 5. Формат аудио

**Deepgram принимает:**
- PCM 16-bit, 16000 Hz (как у AssemblyAI) ✓
- Или указать в параметрах: `encoding=linear16&sample_rate=16000`

### 6. Формат ответа

**Deepgram response:**
```json
{
  "type": "Results",
  "channel_index": [0, 1],
  "duration": 1.5,
  "start": 0.0,
  "is_final": true,
  "speech_final": true,
  "channel": {
    "alternatives": [
      {
        "transcript": "привет как дела",
        "confidence": 0.98,
        "words": [...]
      }
    ]
  }
}
```

**Ключевые поля:**
- `is_final: true` — финальный результат (не interim)
- `speech_final: true` — конец utterance (аналог end_of_turn у AssemblyAI)
- `channel.alternatives[0].transcript` — распознанный текст

### 7. Логика автостопа

**Deepgram использует `endpointing` и `utterance_end_ms`:**

```javascript
// Параметры при подключении
endpointing: 300,      // После 300ms тишины — финализировать
utterance_end_ms: 1000 // После 1000ms — считать utterance законченным

// В обработчике сообщений
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'Results') {
    const transcript = data.channel?.alternatives?.[0]?.transcript || '';
    
    if (data.is_final && transcript) {
      // Interim результат стал финальным
      updateInputField(transcript);
    }
    
    if (data.speech_final) {
      // Конец utterance — можно остановить запись
      stopRecording();
    }
  }
};
```

---

## Архитектура (рекомендуемая)

```
Browser                         Server                      Deepgram
   │                               │                            │
   │  1. Click 🎤                  │                            │
   │  ─────────────────────────►   │                            │
   │                               │                            │
   │  2. Start recording           │                            │
   │  (MediaRecorder)              │                            │
   │                               │                            │
   │  3. Connect WebSocket         │                            │
   │  ─────────────────────────►   │                            │
   │                               │  4. Connect to Deepgram    │
   │                               │  ─────────────────────────►│
   │                               │  (with API key)            │
   │                               │                            │
   │  5. Send audio chunks         │                            │
   │  ─────────────────────────►   │  6. Forward audio          │
   │                               │  ─────────────────────────►│
   │                               │                            │
   │                               │  7. Receive transcripts    │
   │  8. Receive transcripts       │◄─────────────────────────  │
   │◄─────────────────────────     │                            │
   │                               │                            │
   │  9. Update input field        │                            │
   │                               │                            │
   │  10. speech_final → stop      │                            │
   │                               │                            │
```

---

## Серверный прокси (Next.js API Route)

Создать `/app/api/voice/route.ts` или использовать WebSocket через отдельный сервер.

**Важно:** Next.js App Router не поддерживает WebSocket напрямую. Варианты:

1. **Vercel Edge Functions** — не поддерживают WebSocket
2. **Отдельный WebSocket сервер** — усложняет деплой
3. **Использовать Deepgram JS SDK в браузере** — SDK умеет работать с ключом безопасно

### Рекомендация: Deepgram Browser SDK

Deepgram предоставляет официальный SDK для браузера:

```bash
npm install @deepgram/sdk
```

```javascript
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';

// Получить временный ключ с сервера
const response = await fetch('/api/deepgram/token');
const { key } = await response.json();

const deepgram = createClient(key);

const connection = deepgram.listen.live({
  model: 'nova-3',
  language: 'ru',
  smart_format: true,
  interim_results: true,
  utterance_end_ms: 1000,
  endpointing: 300
});

connection.on(LiveTranscriptionEvents.Transcript, (data) => {
  const transcript = data.channel?.alternatives?.[0]?.transcript;
  if (transcript) {
    // Обновить поле ввода
  }
});

// Отправлять аудио
connection.send(audioBlob);
```

### Серверный endpoint для временного ключа

`/app/api/deepgram/token/route.ts`:

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  // Deepgram позволяет создавать временные ключи
  // Но для MVP можно просто проверить авторизацию пользователя
  // и вернуть основной ключ (он всё равно ограничен по правам)
  
  // TODO: Создать временный ключ через Deepgram API
  // https://developers.deepgram.com/docs/authenticating#creating-an-api-key
  
  return NextResponse.json({ 
    key: process.env.DEEPGRAM_API_KEY 
  });
}
```

**Важно:** Для production нужно создавать temporary keys через Deepgram API с коротким TTL.

---

## Параметры для русского языка

```javascript
{
  model: 'nova-3',
  language: 'ru',           // Русский
  // ИЛИ
  language: 'multi',        // Автодетекция (RU, EN, и др.)
  
  smart_format: true,       // Умное форматирование чисел, дат
  punctuate: true,          // Автопунктуация
  interim_results: true,    // Промежуточные результаты
  endpointing: 300,         // 300ms тишины → финализация
  utterance_end_ms: 1000,   // 1000ms → конец utterance
}
```

---

## Тестирование

### Проверить:
1. Русские фразы: "Привет, как дела?"
2. Английские фразы: "Hello, how are you?"
3. Смешанные: "Давай обсудим meeting завтра"
4. Числа: "Позвони мне в 15:30"
5. Паузы в середине фразы
6. Автостоп после окончания речи

### Критерии успеха:
- Русский распознаётся корректно
- Автостоп срабатывает через ~1 сек тишины
- Ручной стоп работает
- Текст появляется в поле ввода

---

## Документация Deepgram

- **Streaming Guide:** https://developers.deepgram.com/docs/getting-started-with-live-streaming-audio
- **Live API Reference:** https://developers.deepgram.com/reference/listen-live
- **JavaScript SDK:** https://developers.deepgram.com/docs/js-sdk
- **Languages:** https://developers.deepgram.com/docs/models-languages-overview

---

## Checklist для разработчика

- [ ] Добавить `DEEPGRAM_API_KEY` в `.env.local`
- [ ] Установить `@deepgram/sdk` (если используем SDK)
- [ ] Создать `/api/deepgram/token` endpoint
- [ ] Заменить AssemblyAI WebSocket на Deepgram
- [ ] Обновить обработку ответов (формат отличается)
- [ ] Обновить логику автостопа (`speech_final`)
- [ ] Протестировать на русском языке
- [ ] Удалить неиспользуемый код AssemblyAI

---

**Документ создан:** 2026-02-01  
**Для:** Claude Code (разработчик)
