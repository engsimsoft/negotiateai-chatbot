# ADR 046: Podcast TTS Revert + Briefing Map-Reduce Rejected

**Дата:** 2026-04-10
**Статус:** Принято
**ТЗ:** MapReduceBriefing (v3.82.0)

## Контекст

Две связанные проблемы в одной сессии:

1. **Подкаст:** v3.81.0 мигрировал TTS на MiniMax Speech 2.8 HD. В production оказалось — качество русского хуже Gemini Flash, а цена $1+ за подкаст (vs $0.014 у Gemini).

2. **Брифинг:** при множестве тем (5+) Author с MiniMax M2.7 падает с `AI_APICallError: Cannot connect to API: other side closed`. Архитектор предложил Map-Reduce — генерировать секции отдельно через `generateSection()`.

## Решение

### Подкаст: возврат Gemini TTS

- **Script:** MiniMax M2.7 (оставляем — диалоги интереснее Gemini Flash)
- **TTS:** Gemini Flash TTS (возвращаем — приемлемое качество, $0.014 vs $1+)
- **Итого подкаст:** ~$0.019 (в 53 раза дешевле MiniMax Speech HD)

### Брифинг: Map-Reduce отклонён, оставлен монолит

Map-Reduce был реализован и протестирован. Результат: **на каждой попытке socket disconnect**.

**Технически:**
```typescript
const res = streamText({ model: minimaxM27Long, ... });
const text = await res.text;    // ← MiniMax закрывает сокет ПОСЛЕ стриминга текста
const usage = await res.usage;  // ← await на мёртвом сокете → "other side closed"
```

При retry Node.js пытается переиспользовать сокет из пула → мёртвый сокет → ошибка повторяется. Все 3 попытки `retryWithLogging` падают.

**Монолит работает потому что:**
- Один вызов = один сокет = одно соединение
- retryWithLogging создаёт новый `streamText()` → новый сокет
- Нет sequential socket reuse между секциями

Проверено в production: монолит стабильно генерирует брифинг с **26K+ input tokens** (5+ тем, 22 кандидата).

## Причины

1. **MiniMax Speech 2.8 HD не оправдал маркетинг** — реальное качество русского хуже Gemini Flash
2. **Цена несоразмерна** — $1+ vs $0.014 за подкаст (53x)
3. **Map-Reduce + MiniMax streaming несовместимы** — socket reuse баг в Node.js HTTP agent
4. **Монолит достаточен** — M2.7 справляется с 26K input tokens без disconnect

## Последствия

**Плюсы:**
- Подкаст работает стабильно по приемлемой цене
- Брифинг работает стабильно с любым количеством тем
- Меньше кода (Map-Reduce функции остались как dead code на будущее)

**Минусы:**
- Snowball: Google зависимости вернулись (`@google/genai`, `lamejs`)
- MiniMax Speech 2.8 HD клиент удалён, инвестиция в его интеграцию потеряна
- Map-Reduce инфраструктура (`generateArticleMapReduce`, `MAP_REDUCE_SECTION_PROMPT`) остались неиспользуемыми

## Что сохранено из ТЗ-MapReduce

Полезные фиксы оставлены в коде:

- **Filter retry** — `retryWithLogging` 3 попытки + content truncation 2K
- **topicId dedup в Author** — safety net на случай если M2.7 создаст дубли
- **Промпт Author** — правило "один topicId = одна секция"
- **Section author mode** — `mode: "initial" | "refresh"` для будущего Map-Reduce
- **UI null-guards** — briefing-page-client.tsx, briefing-sidebar.tsx
- **Simply Chat fix** — `stripMediaPartsForTextModel` обрабатывает text/plain файлы

## Альтернативы

1. **Map-Reduce с `generateText()` вместо `streamText()`** — теоретически решит socket bug, но не проверено
2. **Map-Reduce с custom HTTP agent** — отдельный fetch без connection pooling
3. **Fallback на Anthropic Sonnet** — стабильно, но дороже
4. **Все три отклонены** — монолит достаточен

## Будущее

Если объём кандидатов вырастет до точки где монолит начнёт падать:
- Сначала попробовать `generateText()` вместо `streamText()`
- Если не поможет — custom HTTP agent
- Anthropic fallback только как last resort

Сейчас — стабильность важнее преждевременной оптимизации.
