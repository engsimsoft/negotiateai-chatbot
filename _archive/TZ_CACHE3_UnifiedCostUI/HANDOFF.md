# Передача сессии ТЗ-CACHE3

**Дата:** 2026-03-06
**Сессия:** 3

## Статус этапов
- [x] Этап 1: Shared pricing constant — `991c1fa`
- [x] Этап 2: Pipeline Trace → TokenLens — `5a82177` (мануальный тест брифинга не проведён, но tsc + build ОК)
- [ ] Этап 3: UI — Context dropdown RUB + мелкие фиксы ← СЛЕДУЮЩИЙ
- [ ] Этап 4: Финализация

## ⛔ БЛОКЕР: DevPanelFooter не появляется с первого сообщения

### Суть проблемы
После перезапуска приложения DevPanel footer не отображается для первого ответа в чате. Появляется только после отправки второго сообщения (и то — под первым ответом, а не под вторым). Проблема **pre-existing** (не введена в CACHE3), но попытка фикса в этой сессии не дала результата.

### Root Cause (гипотеза, не подтверждена)
Race condition между `dataStream` (обновляется мгновенно через `setDataStream`) и `messages` (throttled через `experimental_throttle: 100` в useChat). Debug events приходят раньше, чем assistant message появляется в `messages`. Для быстрых ответов (Haiku ~200ms) batch может завершиться целиком до первого throttle flush `messages`.

### Что было попробовано (не помогло)
1. **Dynamic offset → fixed `initialAssistantCount`** — заменили `max(0, assistantMessages.length - batches.length)` на фиксированный `baseOffset = initialAssistantCountRef`. Не помогло: при быстром ответе `assistantMessages` всё равно пуст когда batch завершается.
2. **Two-phase assignment** — Phase 1 (locked для finished batches) + Phase 2 (tentative для streaming batch → last assistant message). Не помогло: если batch завершился до появления message, ни одна фаза его не подхватывает. А когда `messages` обновляется, `dataStream` уже не меняется → useMemo не перезапускается.
3. **Hydration fix** — добавлен `mounted` state в DevPanelFooter (это корректный fix, оставить).

### Что НЕ было попробовано — план для следующей сессии

**⛔ НЕ переходить к Этапу 3, пока DevPanel не работает корректно.**

Подход синьор-разработчика:

1. **Изучить официальную документацию AI SDK v5:**
   - Как именно работает `experimental_throttle` — когда первый flush, как batching
   - Что возвращает `useChat().status` и `useChat().messages` в каждый момент streaming lifecycle
   - Есть ли callback/event для момента "assistant message created" (до первого text chunk)
   - WebSearch: `ai sdk v5 experimental_throttle useChat messages timing`

2. **Изучить лучшие практики matching streaming data to messages:**
   - WebSearch: `vercel ai sdk useChat onData match message id`
   - WebSearch: `ai sdk v5 data stream events associate with message`
   - Проверить: может ли сервер включить `messageId` в debug events (Chat route имеет доступ к response?)

3. **Проверить гипотезу с console.log:**
   - Добавить временные логи в `dev-panel-provider.tsx` useMemo:
     ```
     console.log('[DevPanel] batches:', batches.length, 'assistantMsgs:', assistantMessages.length, 'assignments:', assignments.length)
     ```
   - Попросить пользователя воспроизвести проблему и прислать консоль
   - Это покажет ТОЧНУЮ последовательность renders и когда что появляется

4. **Рассмотреть альтернативные архитектуры:**
   - `useState` + `useEffect` вместо `useMemo` (чтобы `messages` update гарантированно триггерил пересчёт)
   - Передать `status` из `useChat` в DevPanelProvider (streaming → idle = момент финализации)
   - Убрать зависимость от position matching — использовать server-side messageId в debug events

### Ключевые файлы
- `components/dev-panel/dev-panel-provider.tsx` — вся logic matching (lines 122-211)
- `components/dev-panel/dev-panel-footer.tsx` — рендер footer (hydration fix на месте)
- `components/chat.tsx` — useChat config (`experimental_throttle: 100`, `onData`, line 219-227)
- `components/data-stream-provider.tsx` — simple context wrapper для dataStream
- `lib/ai/debug-events.ts` — server-side emit functions (emitDebugPrompt/Step/Finish)
- `app/(chat)/api/chat/route.ts` — где debug events эмитятся (lines 569, 692, 762, 894)

### Текущее состояние кода
- `dev-panel-provider.tsx` содержит two-phase strategy с `initialAssistantCountRef` + `batchAssignmentsRef`. Это НЕ рабочее решение — можно переписать с нуля или откатить к оригиналу.
- `dev-panel-footer.tsx` содержит `mounted` state для hydration fix — это корректный fix, **оставить**.
- Оригинальный код (до наших изменений) использовал dynamic offset: `max(0, assistantMessages.length - batches.length)`. Он тоже не работал с первого сообщения — проблема pre-existing.

## Незакоммиченные изменения
- `components/dev-panel/dev-panel-provider.tsx` — two-phase assignment (не работает)
- `components/dev-panel/dev-panel-footer.tsx` — hydration fix (работает, оставить)
- Рекомендация: закоммитить hydration fix отдельно, а provider changes — после решения проблемы

## Контекст ТЗ-CACHE3 (основная работа)
- Этапы 1-2 завершены и закоммичены
- Мануальный тест Этапа 2 (Pipeline Trace Footer при генерации брифинга) — не проведён
- Этап 3 (Context dropdown → RUB, timeline reasoning, fallback marker) — не начат
- Этап 4 (финализация) — не начат
- Побочная находка: `cache_creation_input_tokens` (cache write) не доступен в AI SDK v5 — будет решено в ТЗ-SDK6 (миграция на AI SDK v6)

## Следующая сессия: порядок действий
1. **Прочитать этот HANDOFF.md**
2. **Решить DevPanel проблему** (см. план выше). Исследование → прототип → тест. Не спешить.
3. Провести мануальный тест Этапа 2 (брифинг в dev mode → Pipeline Trace Footer)
4. Закоммитить DevPanel fix + отметить тест Этапа 2 в ROADMAP
5. Перейти к Этапу 3 по ROADMAP
