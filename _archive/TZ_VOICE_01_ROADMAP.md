# Дорожная карта: ТЗ-VOICE-01 — Voice Input (MVP)

## Цель

Добавить возможность голосового ввода сообщений в чат. Пользователь нажимает кнопку микрофона, говорит — текст появляется в поле ввода с возможностью редактирования перед отправкой.

**Технология:** AssemblyAI Universal-Streaming (multilingual, ~300ms latency)

**Детали:** См. [TZ_VOICE_01_VOICE_INPUT_MVP.md](TZ_VOICE_01_VOICE_INPUT_MVP.md)

## Текущий статус

- **Этап:** ТЗ-VOICE-01 (Voice Input MVP) — ✅ ЗАВЕРШЁН
- **Прогресс:** 34/34 задач (100%)
- **Предыдущий:** ТЗ-6 — Excel Tool (завершён)

---

## Этапы реализации

### VOICE-01.0 Пререквизиты — Валидация и настройка (4 задачи)

**Цель:** Убедиться, что проект работает и настроить API ключ.

- [ ] Production build успешен (`npm run build`)
- [ ] Приложение запускается локально (`npm run dev`)
- [ ] Получить API ключ AssemblyAI (см. инструкцию в ТЗ)
- [ ] Добавить `ASSEMBLYAI_API_KEY` в `.env.local` и `.env.example`

**Команды:**
```bash
# Проверка
npm run build
npm run dev

# .env.local
ASSEMBLYAI_API_KEY=your_api_key_here
```

---

### VOICE-01.1 Серверный endpoint — Token API (4 задачи)

**Цель:** Создать безопасный endpoint для получения temporary token от AssemblyAI.

- [ ] Создать `app/(chat)/api/assemblyai/token/route.ts`
- [ ] Реализовать авторизацию через NextAuth session
- [ ] Запрос temporary token через AssemblyAI API
- [ ] Возврат token браузеру (JSON response)

**API:**
```typescript
// POST /api/assemblyai/token
// Auth: Required (session)
// Returns: { token: string, expiresAt: number }
```

**Документация AssemblyAI:**
- https://www.assemblyai.com/docs/guides/streaming

---

### VOICE-01.2 Аудио утилиты и типы (4 задачи)

**Цель:** Создать базовую инфраструктуру для работы с аудио.

- [ ] Создать `lib/audio/types.ts` — TypeScript типы (VoiceState, AudioChunk, TranscriptResult)
- [ ] Создать `lib/audio/utils.ts` — утилиты (PCM конвертация, Float32 → Int16)
- [ ] Создать `lib/audio/constants.ts` — константы (SAMPLE_RATE: 16000, CHUNK_SIZE)
- [ ] Создать `lib/audio/index.ts` — экспорт всех модулей

**Файлы:**
```
lib/audio/
├── types.ts
├── utils.ts
├── constants.ts
└── index.ts
```

---

### VOICE-01.3 Хук записи аудио — useVoiceRecorder (6 задач)

**Цель:** Создать React хук для записи и стриминга аудио в AssemblyAI.

- [ ] Создать `hooks/use-voice-recorder.ts`
- [ ] Реализовать запрос разрешения на микрофон (getUserMedia)
- [ ] Реализовать захват аудио через Web Audio API (AudioContext, ScriptProcessorNode)
- [ ] Реализовать WebSocket соединение с AssemblyAI
- [ ] Реализовать отправку audio chunks в WebSocket
- [ ] Реализовать получение transcript и обработку `end_of_turn`

**API хука:**
```typescript
const {
  isRecording,      // boolean
  isProcessing,     // boolean
  transcript,       // string
  error,            // Error | null
  startRecording,   // () => Promise<void>
  stopRecording,    // () => void
} = useVoiceRecorder({
  onTranscript: (text: string) => void,
  onError: (error: Error) => void,
});
```

**Референс:**
- https://github.com/AssemblyAI/realtime-transcription-browser-js-example

---

### VOICE-01.4 UI компоненты — VoiceButton (4 задачи)

**Цель:** Создать кнопку микрофона с визуальными состояниями.

- [ ] Создать `components/voice-button.tsx`
- [ ] Реализовать состояние "idle" — иконка 🎤 (MicrophoneIcon)
- [ ] Реализовать состояние "recording" — иконка ⏹️ (StopIcon) + пульсация
- [ ] Реализовать состояние "processing" — spinner

**Состояния:**
```
idle       → 🎤 кнопка микрофона
recording  → 🔴 пульсация + ⏹️ кнопка стоп
processing → ⏳ spinner
error      → 🎤 + tooltip с ошибкой
```

**Файлы:**
- `components/voice-button.tsx`
- `components/icons.tsx` — добавить MicrophoneIcon если нет

---

### VOICE-01.5 Интеграция в multimodal-input (4 задачи)

**Цель:** Добавить VoiceButton в поле ввода сообщений.

- [ ] Импортировать VoiceButton в `multimodal-input.tsx`
- [ ] Добавить кнопку в toolbar (после AttachmentsButton, перед ModelSelector)
- [ ] Подключить useVoiceRecorder с callback в setInput
- [ ] Скрыть кнопку если нет ASSEMBLYAI_API_KEY (проверка через API)

**Расположение в toolbar:**
```
[📎 Attachments] [🎤 Voice] [🖥️ Model] ... [💡 Hints] [➤ Submit/⏹️ Stop]
```

**Файлы:**
- `components/multimodal-input.tsx`

---

### VOICE-01.6 Обработка ошибок (3 задачи)

**Цель:** Корректная обработка всех ошибочных сценариев.

- [ ] Обработка отказа в разрешении на микрофон — toast с инструкцией
- [ ] Обработка отсутствия микрофона — toast с сообщением
- [ ] Обработка ошибок WebSocket/сети — toast + возможность повторить

**Сообщения:**
| Ситуация | Сообщение |
|----------|-----------|
| Нет разрешения | "Разрешите доступ к микрофону в настройках браузера" |
| Нет микрофона | "Микрофон не найден. Подключите микрофон и повторите" |
| Ошибка сети | "Ошибка соединения. Попробуйте ещё раз" |

---

### VOICE-01.7 Тестирование (5 задач)

**Цель:** Полное тестирование функционала.

#### Автоматическое:
- [ ] `npm run build` — production build успешен
- [ ] `npm run lint` — без ошибок

#### Мануальное:
- [ ] Короткая фраза на русском → корректное распознавание
- [ ] Длинная пауза (>2 сек) → автостоп
- [ ] Отказ в разрешении → понятное сообщение

**Полный чеклист тестов — см. ТЗ раздел "Тестирование"**

---

### VOICE-01.8 Документация и финализация (4 задачи)

**Цель:** Обновить документацию и завершить этап.

- [ ] Обновить `CLAUDE.md` — добавить Voice Input, версия
- [ ] Переместить `TZ_VOICE_01_VOICE_INPUT_MVP.md` в `_archive/TZ_VOICE_01_VOICE_INPUT_MVP.md`
- [ ] Переместить `TZ_VOICE_01_ROADMAP.md` в `_archive/TZ_VOICE_01_ROADMAP.md`
- [ ] Коммит: "feat: Voice Input MVP — ТЗ-VOICE-01 complete"

---

## Ключевые файлы

### Новые файлы:

```
app/(chat)/api/assemblyai/token/route.ts  — endpoint для токена

lib/audio/
├── index.ts              — экспорт модулей
├── types.ts              — TypeScript типы
├── utils.ts              — утилиты (PCM конвертация)
└── constants.ts          — константы (SAMPLE_RATE, etc.)

hooks/
└── use-voice-recorder.ts — хук записи и стриминга

components/
└── voice-button.tsx      — кнопка микрофона
```

### Модифицируемые файлы:

| Файл | Изменение |
|------|-----------|
| `components/multimodal-input.tsx` | Добавить VoiceButton в toolbar |
| `components/icons.tsx` | Добавить MicrophoneIcon (если нет) |
| `.env.local` | Добавить ASSEMBLYAI_API_KEY |
| `.env.example` | Документировать ASSEMBLYAI_API_KEY |
| `CLAUDE.md` | Обновить версию и features |

---

## Критерии готовности (Definition of Done)

### Функционал
- [ ] Кнопка микрофона отображается в UI
- [ ] Запись начинается по клику
- [ ] Есть визуальная индикация записи (пульсация)
- [ ] Текст появляется в поле ввода после распознавания
- [ ] Автостоп работает (по `end_of_turn`)
- [ ] Кнопка Стоп работает (ручная остановка)
- [ ] Можно редактировать текст перед отправкой

### Языки
- [ ] Русский язык распознаётся корректно
- [ ] Английский язык распознаётся корректно

### Ошибки
- [ ] Нет разрешения → понятное сообщение
- [ ] Нет микрофона → понятное сообщение
- [ ] Ошибка сети → понятное сообщение

### Безопасность
- [ ] API ключ не попадает в браузер (только через token endpoint)

### Общее
- [ ] Production build успешен
- [ ] Документация обновлена
- [ ] ТЗ и дорожная карта в архиве

---

## Связанные документы

- [TZ_VOICE_01_VOICE_INPUT_MVP.md](TZ_VOICE_01_VOICE_INPUT_MVP.md) — полное техническое задание
- [SIMPLY_STATUS.md](SIMPLY_STATUS.md) — текущее состояние проекта
- [CLAUDE.md](CLAUDE.md) — инструкция для Claude Code

---

## Вне скоупа (следующие ТЗ)

| Фича | Почему не сейчас |
|------|------------------|
| **VAD (локальный)** | Отдельный этап после стабилизации |
| **Диктофон** | Другой use case |
| **Voice Mode** | Этап 2, требует LiveKit |
| **Настройки Turn Detection** | Сначала тестируем defaults |

---

**Создано:** 2026-02-01
**Статус:** К разработке
**Источник:** TZ_VOICE_01_VOICE_INPUT_MVP.md
