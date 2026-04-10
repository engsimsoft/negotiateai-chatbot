# Roadmap ТЗ-Briefing-2: Подкаст MiniMax

**Создан:** 2026-04-09
**Версия проекта:** 3.80.0 → 3.81.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 4 |
| Текущий этап | 1 |
| Сессий (оценка) | 1-2 |

---

## Этап 1: TTS-клиент MiniMax + Провайдер M2-Her

**Статус:** ✅ Завершён

**Цель:** Создать TTS-клиент для Speech 2.8 HD и экспорт модели M2-Her. Добавить pricing.

**Задачи:**
- [x] Создать `lib/podcast/tts-minimax.ts` — HTTP-клиент Speech 2.8 HD (POST api.minimax.io/v1/t2a_v2, Bearer auth, base64→Buffer, MP3 output)
- [x] Добавить `generateReplicasSpeech()` с trace и usage logging + pLimit(4) + паузы <#0.3#>
- [x] Добавить экспорт M2-Her модели в `lib/ai/providers.ts` (minimaxM2Her, аналогично minimaxM27)
- [x] Добавить pricing в `MODEL_PRICING_RUB`: `"MiniMax-M2-her"` (same as M2.7: input 0.03, output 0.12)
- [x] Заменить `calculateGeminiTtsCostUsd()` на `calculateMinimaxTtsCostUsd()` в `providers.ts`
- [x] Обновить `buildTtsTrace()` в `pipeline-trace.ts` — char-based pricing, model "speech-2.8-hd"

**Файлы:**
- `lib/podcast/tts-minimax.ts` — новый
- `lib/ai/providers.ts` — добавить M2-Her экспорт + pricing

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] 🧪 Мануальный тест: запуск тестового скрипта TTS (одна реплика → MP3 файл)

**Git (после валидации):**
```bash
git add lib/podcast/tts-minimax.ts lib/ai/providers.ts
git commit -m "feat(tz-briefing-2): MiniMax Speech 2.8 HD TTS client + M2-Her provider"
```

**Критерий готовности:** TTS-клиент компилируется, pricing добавлен, M2-Her экспортирован

---

## Этап 2: Script Generator → M2-Her + JSON формат

**Статус:** ✅ Завершён

**Цель:** Перевести генерацию скриптов на M2-Her с JSON output. Обновить промпт.

**Задачи:**
- [x] Обновить `lib/podcast/script-generator.ts`: Gemini → M2-Her (minimaxM2Her из providers.ts)
- [x] Изменить метод: `generateText` + JSON.parse + Zod (паттерн briefing-author) + plain text fallback
- [x] Добавить Zod-схему скрипта: `{ lines: [{ speaker: "host"|"expert", text: string }] }`
- [x] Обновить counting — считать из parsed JSON вместо regex
- [x] Обновить `lib/prompts/briefing/briefing-scriptwriter.md` — JSON формат, интонационные теги, антипаттерны повторов
- [x] Обновить `lib/podcast/types.ts` — добавить `ScriptLine` тип
- [x] Удалить import `@ai-sdk/google` из script-generator.ts

**Файлы:**
- `lib/podcast/script-generator.ts` — переработка
- `lib/prompts/briefing/briefing-scriptwriter.md` — обновить формат + теги
- `lib/podcast/types.ts` — добавить ScriptLine

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] 🧪 Мануальный тест: генерация скрипта одной секции → JSON парсится, реплики разделены

**Git (после валидации):**
```bash
git add lib/podcast/script-generator.ts lib/prompts/briefing/briefing-scriptwriter.md lib/podcast/types.ts
git commit -m "feat(tz-briefing-2): script generator M2-Her + JSON format"
```

**Критерий готовности:** M2-Her генерирует JSON скрипт, парсится Zod, реплики host/expert разделены

---

## Этап 3: Pipeline Integration + Cleanup

**Статус:** ✅ Завершён

**Цель:** Подключить новый TTS и скрипт в pipeline. Удалить Gemini зависимости.

**Задачи:**

**Pipeline:**
- [x] Обновить `lib/podcast/index.ts` — заменить Gemini TTS на MiniMax TTS, убрать PCM→MP3 конвертацию
- [x] Per-replica TTS с voice_id routing реализован в `tts-minimax.ts:generateReplicasSpeech()`
- [x] `pLimit(4)` для параллельных TTS-вызовов внутри секции
- [x] Паузы `<#0.3#>` в начало текста каждой реплики (кроме первой)
- [x] Merge MP3 буферов реплик — Buffer.concat (MP3 streaming format)
- [x] Duration: сумма audio_length из API responses (с fallback на оценку по chars)
- [x] Re-exports обновлены

**Cleanup:**
- [x] Удалён `lib/podcast/tts-gemini.ts`
- [x] Удалён `lib/podcast/audio-converter.ts`
- [x] Удалён `lib/podcast/lamejs.d.ts`
- [x] Удалён `@google/genai` из package.json
- [x] Удалён `@ai-sdk/google` из package.json
- [x] Удалён `lamejs` из package.json
- [x] Очищен `next.config.ts` — убран lamejs из serverExternalPackages и outputFileTracingIncludes
- [x] `calculateGeminiTtsCostUsd()` → `calculateMinimaxTtsCostUsd()` в providers.ts
- [x] TTSProvider deprecated (будет удалён при следующей чистке types.ts)
- [x] Gemini pricing entry удалён из MODEL_PRICING_RUB и MODEL_CONTEXT_WINDOW
- [x] Grep подтвердил: 0 упоминаний @google/genai, @ai-sdk/google, lamejs, tts-gemini, audio-converter в lib/ и app/

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Grep: нет упоминаний `@google/genai`, `lamejs`, `tts-gemini`, `audio-converter` в production коде
- [ ] 🧪 Мануальный тест: полный подкаст (5-10 секций) → прослушать, проверить качество русского, паузы между репликами

**Git (после валидации):**
```bash
git add -A  # cleanup: много удалений
git commit -m "feat(tz-briefing-2): MiniMax podcast pipeline + remove Gemini deps"
```

**Критерий готовности:** Полный подкаст генерируется через MiniMax, Gemini зависимости удалены, качество русского приемлемо

---

## Этап 4: Финализация

**Статус:** ✅ Завершён

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 3

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../DOCUMENTATION_GUIDE.md) — пройти чеклист.

**Задачи:**

**Документация (обязательная):**
- [ ] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти "Чек-лист при изменениях"
- [ ] Обновить главный CHANGELOG.md
- [ ] Обновить SIMPLY_STATUS.md
- [ ] Обновить CLAUDE.md (Podcast Engine секция — M2-Her + Speech 2.8 HD)
- [ ] Обновить package.json: 3.80.0 → 3.81.0

**Документация (по чеклисту — оценить каждый пункт):**
- [ ] ADR нужен? → Да: `docs/decisions/NNN-podcast-minimax-migration.md` (миграция с Gemini на MiniMax для подкаста)
- [ ] docs/ai-chats-map.md → обновить (podcast models: Gemini → MiniMax)
- [ ] docs/ai-providers.md → обновить (удалить Gemini TTS, добавить Speech 2.8 HD + M2-Her)
- [ ] docs/ai-minimax.md → добавить секцию про M2-Her и Speech 2.8 HD

**⛔ Верификация docs против кода (Правило 5):**
- [ ] Grep models в providers.ts — сверить с ai-providers.md
- [ ] Grep `@ai-sdk/google`, `@google/genai` — подтвердить 0 результатов в production
- [ ] ai-chats-map.md → код-блок myProvider совпадает с providers.ts

**Завершение:**
- [ ] Финальное мануальное тестирование (пользователь)
- [ ] Переместить папку в _archive/

**Валидация:**
- [ ] `npm run build` — успешен
- [ ] Документация актуальна (проверено по чеклисту выше)

**Git (после валидации):**
```bash
git add -A
git commit -m "chore(tz-briefing-2): finalize docs + version bump — v3.81.0"
```
