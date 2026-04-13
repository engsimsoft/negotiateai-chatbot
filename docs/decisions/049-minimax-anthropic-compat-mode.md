# ADR 049: MiniMax через Anthropic-compat режим как SSOT подключения

**Дата:** 2026-04-13
**Статус:** Принято
**ТЗ:** TZ-CacheAudit (v3.85.0)

---

## Контекст

MiniMax M2.7 — основной не-Anthropic провайдер в Simply. Обслуживает Simply Chat (текстовая), briefing-filter, briefing-author, podcast script generation. Пакет `vercel-minimax-ai-provider@0.0.2` предоставляет **две фабрики** для одной модели:

- `createMinimax()` — **default**, Anthropic-совместимый режим. Под капотом — тонкая обёртка над `AnthropicMessagesLanguageModel` из `@ai-sdk/anthropic/internal`. Endpoint: `https://api.minimax.io/anthropic/v1/messages`.
- `createMinimaxOpenAI()` — OpenAI-совместимый режим через кастомную реализацию. Endpoint: `https://api.minimax.io/v1/chat/completions`.

На момент начала ТЗ-CacheAudit MiniMax был подключён через `createMinimaxOpenAI()` — решение предыдущего ТЗ-MinimaxCleanup (v3.77.0). Обоснование в документации: «Anthropic-compat режим не работает — textDelta пустой, tool params теряются, cacheTokens не возвращаются». Для поддержки usage logging в SDK v6 требовался дополнительный костыль — мутация `config.includeUsage = true` через `as unknown as` cast.

В рамках pre-flight ТЗ-CacheAudit было проведено независимое тестирование обоих режимов на той же версии пакета 0.0.2. Все 4 теста Anthropic-compat режима прошли без замечаний:

- Test 1 (streamText basic): стриминг работает, русский язык корректен
- Test 2 (tool calling с Zod): параметры передаются правильно
- Test 3 (generateObject mode:tool): структурированный вывод валиден
- Test 4 (explicit cacheControl): 100% cache hit на повторном запросе, поля `cacheReadTokens`/`cacheWriteTokens` в AI SDK v6 стандартном формате

**Критическая находка:** утверждения предыдущей документации о поломках Anthropic-compat режима оказались ложными. Это подтверждается и архитектурно — Anthropic-compat фабрика MiniMax делегирует всю работу `AnthropicMessagesLanguageModel`, то есть использует **тот же класс**, что и чистый Claude через `@ai-sdk/anthropic`. Если бы что-то было сломано, ломался бы и Claude.

---

## Решение

**Подключать MiniMax через `createMinimax()` (Anthropic-compat режим) как SSOT во всех namespace registry.**

Конкретные изменения (`lib/ai/registry.ts`):

```ts
import { createMinimax } from "vercel-minimax-ai-provider";

const minimax = createMinimax({ apiKey: process.env.MINIMAX_API_KEY });
const minimaxLong = createMinimax({
  apiKey: process.env.MINIMAX_API_KEY,
  fetch: createLongTimeoutFetch(180_000), // 180s для briefing pipelines
});
```

Удалены:
- `createMinimaxOpenAI` импорт и использование
- Костыль мутации `config.includeUsage = true` в `lib/ai/getModel.ts:171-179` — не нужен, `AnthropicMessagesLanguageModel` эмитит usage нативно
- Лживая документация `docs/ai-minimax.md` о неработоспособности Anthropic-compat — переписана с нуля на основе независимых тестов

---

## Причины

1. **SSOT правды — исходник пакета, а не документация.** Чтение `node_modules/vercel-minimax-ai-provider/dist/index.mjs:1-40` показало, что Anthropic-compat — это тонкая обёртка над `AnthropicMessagesLanguageModel`. Одна строка в исходнике стоит дороже всей накопленной лживой документации.

2. **Единый code path с Claude = единая стратегия кэширования.** `providerOptions.anthropic.cacheControl`, `providerOptions.anthropic.contextManagement`, reasoning parts, multi-turn tool use — всё что работает для Claude, работает для MiniMax. Поддержка кэширования в pipelines и chat-routes становится унифицированной.

3. **Unified observability через SDK v6 нативные поля.** `cacheReadTokens` и `cacheWriteTokens` теперь эмитятся в стандартном формате `inputTokenDetails`, без ручного парсинга и `as any` cast. Это закрыло measurement blind spot, существовавший в OpenAI-compat режиме (`cacheWriteTokens` всегда был 0).

4. **Удаление костылей.** Ручная мутация `config.includeUsage` была специфична для OpenAI-compat кастомной реализации. Anthropic-compat режим не требует никаких workaround'ов — используется стандартный AI SDK v6 интерфейс.

5. **Независимая верификация важнее авторитета предыдущего решения.** Правило 1 WORKFLOW (Official docs FIRST) было нарушено в ТЗ-MinimaxCleanup — решение принималось на основе «мне кажется, что не работает». Полноценный независимый тест на той же версии пакета показал обратное.

---

## Последствия

### Плюсы

- **Кэширование MiniMax стало возможным.** Без Anthropic-compat режима Simply Chat получил бы maximum 20-30% экономии от passive cache. С явными breakpoints (ТЗ-CacheAudit Этап 3) — 54% на втором сообщении, валидировано UI-тестом.
- **Единый паттерн для Claude и MiniMax.** Любой новый разработчик, знающий как работает `@ai-sdk/anthropic`, сразу понимает MiniMax без изучения отдельной спеки. Меньше когнитивная нагрузка.
- **Closed measurement blind spot.** До ТЗ-CacheAudit MiniMax `cacheWriteTokens` всегда был 0 в `ai_usage_log` из-за OpenAI-compat кастомной реализации. После переключения — реальные значения пишутся автоматически. DevPanel показывает корректную разбивку.
- **Код проще и короче.** Удалён один файл с костылями (`config.includeUsage` hack), удалены два файла тестов OpenAI-compat режима, документация `docs/ai-minimax.md` сократилась вдвое при увеличении точности.
- **Меньше поверхность для ошибок в Compaction API.** `providerOptions.anthropic.contextManagement` (`compact_20260112`) теперь работает для MiniMax в теории (требует capability-gate по модели — см. ADR 050).

### Минусы

- **Риск регрессии если MiniMax изменит Anthropic-compat endpoint.** Теоретически MiniMax может убрать или сломать `/anthropic/v1/messages` endpoint в будущих версиях пакета. Митигация: pin версии `vercel-minimax-ai-provider@0.0.2` в `package.json`, тест `scripts/test-minimax-anthropic-compat.ts` как early warning system.
- **Зависимость от внутреннего API `@ai-sdk/anthropic/internal`.** MiniMax пакет импортирует непубличный API AI SDK. Если @ai-sdk/anthropic сломает backward compat внутренних модулей — MiniMax может не собраться. Митигация: pin версии обоих пакетов.
- **Необходимость capability-гейтинга Compaction API.** Compaction `compact_20260112` поддерживается Anthropic API только для Sonnet 4+/Opus 4+, но не для Haiku и не для MiniMax. При передаче `contextManagement` через Anthropic-compat MiniMax — неизвестно, передаст ли пакет опцию в upstream или проигнорирует. См. ADR 050 для конкретной реализации гейта.

---

## Альтернативы

### Альтернатива 1: Оставить OpenAI-compat режим

**Что это:** Продолжать использовать `createMinimaxOpenAI()` с костылём `config.includeUsage = true`.

**Почему отклонили:**
- Измерение кэша сломано (`cacheWriteTokens` всегда 0)
- Ручная поддержка `providerOptions` для кэширования невозможна — OpenAI-compat не имеет эквивалента `cacheControl`
- Costly billing observability: при passive cache hit на MiniMax OpenAI-compat cost в `ai_usage_log` отличался от реального расхода на MiniMax Balance на 10-25%
- Основание отказа от Anthropic-compat в ТЗ-MinimaxCleanup оказалось ложным — независимый тест опроверг

**Когда может быть лучше:** Никогда в рамках Simply. OpenAI-compat имеет смысл только для подключения MiniMax из не-Anthropic-экосистемных клиентов (например, LangChain с OpenAI adapter).

### Альтернатива 2: Написать собственного провайдера MiniMax

**Что это:** Реализовать `MinimaxLanguageModel implements LanguageModel` напрямую, минуя пакет `vercel-minimax-ai-provider`.

**Почему отклонили:**
- Объём работы: ~500-1000 строк кода на полную реализацию streaming, tool calling, cache parsing, error handling
- Дублирование: `AnthropicMessagesLanguageModel` уже делает всё что нужно, просто выбрасывает результат через другой endpoint. Писать свой = переписывать готовое
- Поддержка: при выходе новых фич AI SDK (например, reasoning parts в v7) нужно будет вручную добавлять в свой провайдер
- Риск ошибок: любой edge case (orphan tool_use, retry on 529, token counting) нужно воспроизводить с нуля

**Когда может быть лучше:** Если MiniMax полностью откажется от Anthropic-compat endpoint и нужно будет срочно мигрировать.

### Альтернатива 3: Использовать OpenRouter как прокси

**Что это:** Подключить MiniMax через OpenRouter, который унифицирует все модели под один интерфейс.

**Почему отклонили:**
- Дополнительная зависимость от стороннего сервиса
- OpenRouter markup 5-10% на каждый вызов → увеличение стоимости
- Двойная точка отказа (OpenRouter + MiniMax)
- Проблема latency: +50-150ms на каждый запрос из-за дополнительного hop'а
- Нет прямого доступа к специфичным фичам MiniMax, если они появятся в будущем

**Когда может быть лучше:** Для разработческих экспериментов с быстрой сменой моделей без изменения registry.

---

## Ссылки и ресурсы

- **Независимый тест:** `scripts/test-minimax-anthropic-compat.ts` — 4 теста (streamText, tool calling, generateObject, cacheControl)
- **Integration тест:** `scripts/test-minimax-via-registry.ts` — резолв через `getModel()`
- **Исходник пакета:** `node_modules/vercel-minimax-ai-provider/dist/index.mjs:1-40`
- **Переписанная документация:** `docs/ai-minimax.md`
- **Связанный ADR:** [050 Cache Breakpoints Strategy](050-cache-breakpoints-strategy.md)
- **Спецификация ТЗ:** `_archive/TZ_CacheAudit/SPEC.md`

---

## История изменений

- **2026-04-13** — Документ создан в рамках финализации ТЗ-CacheAudit (v3.85.0). Автор: Claude Opus 4.6 по запросу владельца (Vladimir Sharandin).
