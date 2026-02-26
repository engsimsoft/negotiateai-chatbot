# ADR 023: Guardian Phase 2 — Blocking Strategy (Full Buffering)

**Дата:** 2026-02-26
**Статус:** Принято
**ТЗ:** FIX1.2

## Контекст

Guardian Phase 1 (v3.50.0, ADR 022) обнаруживает галлюцинации tool calls в тексте AI, но не блокирует их — текст доходит до пользователя. Нужен механизм блокировки: буферизация текста на уровне stream, анализ на step-finish, решение flush/block.

## Решение

**Полная буферизация text events per step** во всех трёх routes:
- `chat/route.ts`
- `service-chat/route.ts`
- `tasks/[taskId]/chat/route.ts`

### Механизм

1. Все text-related events (`text-start`, `text-delta`, `text-end`, `reasoning-*`) буферизуются в массив `stepTextBuffer`
2. На `finish-step` Guardian анализирует накопленный текст
3. Если `detected === false` → flush buffer (enqueue все events) → `consecutiveHallucinations = 0`
4. Если `detected === true` → drop buffer → `consecutiveHallucinations++`
5. Если `consecutiveHallucinations >= 2` → enqueue error message пользователю
6. На `done` (конец stream) → flush remaining buffer (safety net)

### Рассмотренные альтернативы

**Smart buffering** (early flush при отсутствии tool mentions после N символов):
- Плюс: меньше задержка для "чистых" шагов
- Минус: сложнее, граничные случаи, ложные flush
- Решение: отвергнуто после теста — streaming в чате не виден пользователю (текст приходит сразу), задержка незаметна

**Per-chunk filtering** (анализ каждого text-delta отдельно):
- Минус: недостаточно контекста для детекции в маленьком чанке
- Отвергнуто

## Известные ограничения

1. **Детекция зависит от упоминания tool names в тексте.** Модель может описать результаты без naming tools (`@channel — живой` вместо `readTelegramChannel показал`). В этом случае `findToolMentions()` возвращает `[]` → детекция не срабатывает → текст пропускается.

2. **Tool call с фейковыми данными не детектируется.** Если модель вызывает `updateBriefingPreview` реально, но с выдуманными данными — `toolCallCount > 0` → Guardian пропускает (by design).

3. **Event types специфичны для `toUIMessageStream()`.** Используются `start-step`/`finish-step` (не `step-start`/`step-finish`) и `.delta` (не `.textDelta`). Это не документировано в AI SDK и было выявлено дебагом.

## Последствия

**Плюсы:**
- Механизм блокировки на месте — при улучшении детекции блокировка заработает автоматически
- Нулевое влияние на нормальный поток (clean steps flush мгновенно)
- Единый паттерн во всех 3 routes

**Минусы:**
- Детекция Phase 1 покрывает только случаи с явным упоминанием tool names
- Для полного решения потребуется Phase 3 (расширенная детекция или валидация в tools)
