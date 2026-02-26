# ТЗ-FIX1.2: Guardian Phase 2 — Буферизация и блокировка

**Приоритет:** КРИТИЧЕСКИЙ  
**Зависимости:** ТЗ-FIX1 (v3.50.0) — детекция работает  
**Оценка:** малый scope — надстройка над существующим кодом  

---

## Проблема

Guardian (v3.50.0) детектирует галлюцинации tool calls и логирует, но НЕ блокирует. Пользователь видит фейковый прогресс. Детекция без блокировки бесполезна для пользователя.

## Решение

Изменить instrumentedStream в обоих routes: буферизировать text-delta внутри step, на step-finish решать — показать или заблокировать.

## Что менять

### 1. Буферизация text-delta (оба route)

Сейчас `controller.enqueue(value)` на каждый chunk — текст уходит к пользователю мгновенно.

Изменение: text-delta события **не** enqueue сразу. Копить в массив внутри step. Все остальные события (tool-input-start, tool-output-available, step-start, etc.) — enqueue сразу, как сейчас.

### 2. Решение на step-finish

```
step-finish →
  guardianTracker.analyze() →
    НЕ detected → flush: enqueue все накопленные text-delta из буфера
    detected →
      1. НЕ flush (текст не дойдёт до пользователя)
      2. Увеличить счётчик consecutiveHallucinations
      3. console.warn('[Guardian] Blocked hallucinated step N')
```

### 3. Лимит блокировок

Если `consecutiveHallucinations >= 2` — модель застряла в цикле галлюцинаций:

1. Записать через dataStream сообщение пользователю:
   ```
   dataStream.write({
     type: 'text-delta', 
     textDelta: 'Не удалось выполнить эту операцию автоматически. Попробуйте переформулировать запрос или разбить задачу на части.'
   });
   ```
2. Залогировать `[Guardian] Max retries exceeded, showing error to user`

Если после hallucinated step следует clean step — сбросить счётчик.

### 4. Где менять

**service-chat/route.ts** — instrumentedStream внутри `createUIMessageStream.execute`. Здесь briefing-onboarding, самый критичный route.

**chat/route.ts** — instrumentedStream внутри `createUIMessageStream.execute`. Общий чат и проекты.

**task-expert/route.ts** — добавить Guardian (сейчас отсутствует). По аналогии с chat/route.ts.

### 5. Изменения в tool-call-guardian.ts

Не нужны. `detectToolHallucination()`, `createStepTracker()`, все паттерны — работают. Изменения только в routes (consumers).

## Что НЕ делать

- Не менять tool-call-guardian.ts — детекция работает
- Не буферизировать не-текстовые события — только text-delta
- Не делать retry с inject системного сообщения — это невозможно в текущем streaming pipeline (streamText не поддерживает injection mid-stream). Блокировка + честная ошибка достаточна
- Не разбивать это ТЗ на фазы — scope маленький

## Ожидаемый результат

Пользователь **никогда** не видит "Проверяю @channel... канал живой". Если модель галлюцинирует — текст блокируется. Если галлюцинирует дважды подряд — честное сообщение об ошибке.

## Тестирование

briefing-onboarding → настройка 3-4 тем. Если модель описывает прогресс текстом → текст не появляется у пользователя. В логах: `[Guardian] Blocked hallucinated step`.
