# ADR 022: Tool Call Guardian — детекция галлюцинаций tool calls

**Дата:** 2026-02-26
**Статус:** Принято

## Контекст

AI-модели иногда **галлюцинируют результаты tool calls** — описывают в тексте якобы полученные данные, не вызывая инструмент реально. Примеры:

- «Я проверил канал через readTelegramChannel — канал живой, 15 постов за неделю» (tool не вызывался)
- «Нашёл 10 результатов через deepResearch» (deepResearch не запускался)
- «Сайт доступен, контент свежий» (fetchUrl не вызывался)

Это критичнее обычных текстовых галлюцинаций, потому что пользователь **доверяет данным инструментов** больше, чем рассуждениям модели. Фейковые результаты tool calls подрывают это доверие.

**Масштаб проблемы:** Обнаружена в briefing-onboarding (модель «добавляла» Telegram-каналы без реального вызова readTelegramChannel) и в обычном чате (модель описывала результаты deepResearch без вызова).

## Решение

### Фаза 1: Detection & Logging (v3.50.0)

Создан модуль `lib/ai/tool-call-guardian.ts` — слой детекции в streaming pipeline. Работает как **observer** (не блокирует, не модифицирует поток).

### Архитектурный паттерн: instrumentedStream

```
streamText() → result.toUIMessageStream() → instrumentedStream → dataStream.merge()
                                                    │
                                            Guardian StepTracker
                                            (observe & analyze)
                                                    │
                                            guardianFlags → ai_usage_log
```

Guardian интегрирован в существующий `instrumentedStream` — ReadableStream-обёртку, которая перехватывает AI SDK v5 события (`step-start`, `text-delta`, `tool-input-start`, `step-finish`) без модификации потока.

### Детекция per-step

На каждом `step-finish` анализируется:
1. **toolCallCount** — сколько реальных tool calls было в этом step
2. **stepText** — весь текст, сгенерированный в step
3. Если `toolCallCount === 0` и текст содержит утверждения о результатах tool calls → **hallucination detected**

### Паттерны детекции

| Тип | Примеры | Confidence |
|-----|---------|------------|
| **result_claim** | «нашёл 5 источников через deepResearch» | 0.7 |
| **fake_progress** | «канал живой, 15 постов», «результат:» | 0.9 |

Различает легитимное упоминание («я могу использовать deepResearch») от утверждения о результате («deepResearch нашёл 10 статей»).

### Логирование

Результаты детекции записываются в `ai_usage_log.guardianFlags` (JSONB):
```json
{
  "detected": true,
  "detections": [{
    "stepNumber": 1,
    "confidence": 0.9,
    "details": [{ "type": "fake_progress", "confidence": 0.9, "text": "канал живой, 15 постов" }]
  }]
}
```

## Причины

1. **Observer, не blocker** — Фаза 1 только логирует. Блокировка/retry в будущих фазах, после сбора статистики false positive rates
2. **Per-step, не per-message** — AI SDK v5 позволяет multi-step (model вызывает tool, получает результат, продолжает). Каждый step анализируется отдельно
3. **instrumentedStream** — уже существовал для tool activity logging. Guardian добавлен в тот же поток, не создавая новый слой
4. **JSONB в ai_usage_log** — расширяет существующую таблицу (ADR 019), не создавая отдельную. Позволяет `WHERE guardianFlags IS NOT NULL` для аналитики
5. **Русский + английский** — паттерны для обоих языков (модель может переключаться)

## Последствия

### Плюсы

- Детекция без влияния на latency (observer pattern)
- Данные для аналитики: можно измерить частоту галлюцинаций per-model, per-chatMode
- Фундамент для Фазы 2 (buffering + retry) и Фазы 3 (model redirection)
- Работает в обоих streaming routes (chat + service-chat)

### Минусы

- False positives возможны (модель описывает план, похожий на утверждение)
- Regex-based детекция — не semantic. Сложные перефразировки могут проскочить
- Фаза 1 только логирует — пользователь всё ещё видит галлюцинацию

### Фазы развития

| Фаза | Описание | Статус |
|------|----------|--------|
| 1 — Detection & Logging | Observer в instrumentedStream, запись в ai_usage_log | ✅ v3.50.0 |
| 2 — Buffering & Retry | Буферизация step-finish, при детекции — retry без fake data | Планируется |
| 3 — Model Redirection | При повторной галлюцинации — переключение на модель с tool calling | Планируется |

## Альтернативы

### Альтернатива 1: Prompt-only решение

**Что это:** Усилить system prompt правилами «не описывай результаты без вызова tool»

**Почему недостаточно:** Уже попробовали (v3.49.0 — anti-hallucination rules в промпте). Снижает частоту, но не устраняет. Модель может игнорировать инструкции при сложных цепочках рассуждений

**Вердикт:** Используем как дополнение, не как основное решение

### Альтернатива 2: Post-hoc анализ (после полного ответа)

**Что это:** Анализировать полный ответ после завершения, до отправки клиенту

**Почему отклонили:** Требует буферизации всего ответа → убивает streaming UX. Пользователь ждёт полный ответ вместо потока

**Когда может быть лучше:** Для non-streaming API (batch processing)

### Альтернатива 3: Отдельный LLM-judge

**Что это:** Второй вызов AI модели для проверки ответа первой

**Почему отклонили:** +50-100% latency, +100% cost per request. Непропорционально для проблемы, которая встречается в <5% запросов

**Когда может быть лучше:** Для high-stakes сценариев (финансовые данные, медицинские)

## Связанные решения

- **ADR 019** — Usage Logging Architecture (ai_usage_log, куда пишем guardianFlags)
- **v3.49.0** — Anti-hallucination prompt rules (дополнительная защита на уровне промптов)

## Ссылки

- `lib/ai/tool-call-guardian.ts` — Реализация детектора
- `app/(chat)/api/chat/route.ts` — Интеграция в chat route (instrumentedStream)
- `app/(chat)/api/service-chat/route.ts` — Интеграция в service-chat route
- `lib/db/migrations/0040_guardian-flags.sql` — Миграция

## История изменений

- **2026-02-26** — Документ создан (v3.50.0, Фаза 1 — Detection & Logging)
