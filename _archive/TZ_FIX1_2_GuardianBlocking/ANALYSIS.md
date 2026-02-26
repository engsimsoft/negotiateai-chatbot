# Анализ ТЗ-FIX1.2: Guardian Phase 2 — Буферизация и блокировка

**Дата анализа:** 2026-02-26
**Статус:** Требует обсуждения

---

## Резюме

Guardian Phase 1 (v3.50.0) детектирует галлюцинации tool calls, но не блокирует — пользователь видит фейковый прогресс. ТЗ предлагает буферизировать text-delta до step-finish и блокировать при обнаружении. Идея правильная, но **полная буферизация для chat и tasks убьёт streaming UX**. Предлагаю smart-подход.

---

## Что изучено

- `lib/ai/tool-call-guardian.ts` — полная реализация Phase 1
- `app/(chat)/api/service-chat/route.ts:820-873` — instrumentedStream + Guardian
- `app/(chat)/api/chat/route.ts:667-775` — instrumentedStream + Guardian + diagnostics
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts:335-387` — instrumentedStream **БЕЗ** Guardian

---

## Текущее состояние Guardian в routes

| Аспект | service-chat | chat | tasks/chat |
|--------|:---:|:---:|:---:|
| GuardianTracker создан | ✅ | ✅ | ❌ |
| text-delta → addText() | ✅ | ✅ | ❌ |
| step-start → reset() | ✅ | ✅ | ❌ |
| step-finish → analyze() | ✅ | ✅ | ❌ |
| tool-input-start → addToolCall() | ✅ | ✅ | ❌ |
| getAllDetections() на EOF | ❌ 🐛 | ✅ | ❌ |
| guardianFlags в ai_usage_log | ❌ 🐛 | ✅ | ❌ |

**Баг Phase 1:** service-chat.ts создаёт tracker, вызывает analyze(), но **никогда не собирает** `getAllDetections()` и не сохраняет guardianFlags. Данные детекции теряются. Нужно починить в рамках FIX1.2.

---

## ⚠️ КРИТИЧЕСКАЯ ПРОБЛЕМА: Полная буферизация убивает streaming UX

### Суть проблемы

ТЗ предлагает: **буферизировать ВСЕ text-delta до step-finish**.

Как устроены steps в Vercel AI SDK:
- **Текстовый ответ** (без tool calls) = **ОДИН step** на весь ответ
- **step-finish** приходит только когда модель **закончила генерацию**

Это значит:

| Сценарий | Без буферизации | С полной буферизацией (по ТЗ) |
|----------|:-:|:-:|
| Модель пишет 2000 символов текста | Streaming по словам | **Чёрный экран 8-15 сек** → весь текст разом |
| Модель вызывает инструмент | Текст стримится → инструмент → ответ стримится | Буфер → flush → инструмент → буфер → flush |
| Модель галлюцинирует | Фейковый текст стримится ❌ | Текст блокируется ✅ |

### Где это проблема, а где — нет

- **service-chat** — ОК. Модель **должна** вызывать инструменты, текст между вызовами короткий. Буферизация приемлема.
- **chat/route.ts** — ПРОБЛЕМА. Модель часто пишет длинные текстовые ответы без tool calls (80%+ запросов). Полная буферизация = потеря streaming.
- **tasks/chat** — ПРОБЛЕМА. Эксперт пишет развёрнутые ответы по задаче.

---

## Моя рекомендация: Tool-mention-gated buffering (для chat/tasks)

### Наблюдение

Галлюцинация **всегда** упоминает имя инструмента в тексте: "проверил через readTelegramChannel", "deepResearch нашёл 5 источников". Нормальный текст — не упоминает.

### Алгоритм (для chat и tasks)

```
text-delta →
  буферизировать + guardianTracker.addText()

  ЕСЛИ buffer.length > 200 chars И НЕТ упоминаний инструментов в буфере:
    → flush весь буфер (enqueue все накопленные chunks)
    → stepPassThrough = true (остаток степа стримится напрямую)

  ЕСЛИ найдено упоминание инструмента:
    → продолжить буферизацию до step-finish

step-finish →
  ЕСЛИ stepPassThrough:
    → analyze() для логов, но текст уже отправлен
  ЕСЛИ буфер не пуст:
    → analyze()
    → НЕ detected → flush буфер
    → detected → блокировать + consecutiveHallucinations++
```

### Что это даёт

| Сценарий | Поведение |
|----------|-----------|
| Нормальный текст (2000 символов) | ~200 символов задержки (~0.5с) → streaming как обычно |
| Галлюцинация ("проверил readTelegramChannel...") | Tool mention на ~50-м символе → буфер удерживается → step-finish → блокировка ✅ |
| Легитимный план ("давайте используем deepResearch...") | Tool mention → буфер → step-finish → isPlanDescription() → flush ✅ |

### Per-route стратегия

| Route | Подход | Почему |
|-------|--------|--------|
| **service-chat** | **Полная буферизация** (как в ТЗ) | Tool-heavy. Текст без tool calls подозрителен |
| **chat** | **Smart buffering** (early flush) | Длинные текстовые ответы — норма |
| **tasks/chat** | **Smart buffering** (early flush) | Эксперт пишет развёрнутые ответы |

---

## Механизм доставки error message

ТЗ предлагает: `dataStream.write({ type: 'text-delta', textDelta: '...' })`

**Сомнение:** `dataStream.write()` пишет в data-канал. text-delta через data-канал может не привязаться к assistant message корректно.

**Рекомендация:** Использовать `controller.enqueue()` на instrumentedStream — это message-канал, текст гарантированно попадёт в assistant message:

```typescript
controller.enqueue({
  type: 'text-delta',
  textDelta: 'Не удалось выполнить эту операцию. Попробуйте переформулировать запрос.'
});
```

Нужна проверка обоих вариантов. Если controller.enqueue работает — это чище.

---

## Дополнительные замечания

### Один export из guardian
Smart buffering требует проверки "есть ли упоминание инструмента в тексте" **во время** буферизации (не на step-finish). Функция `findToolMentions()` уже есть в guardian, но **приватная**. Нужно добавить `export`.

Это **единственное** изменение в tool-call-guardian.ts — и это export, не изменение логики.

### consecutiveHallucinations scope
Согласен с ТЗ:
- Per-stream (один запрос пользователя)
- Reset на clean step
- Лимит = 2

### tasks/chat — Phase 1 сначала
В tasks/chat Guardian вообще отсутствует. Нужно сначала добавить Phase 1 (tracker + events + log), затем Phase 2 (buffering). Это не "скопировать" — нужно аккуратно добавить все 4 event handler-а, getAllDetections(), guardianFlags.

---

## Вопросы к архитектору

### Q1: Smart buffering для chat/tasks?
Полная буферизация убивает streaming для 80%+ запросов в chat. Я предлагаю smart approach (early flush при отсутствии tool mentions после 200 chars). **Одобряешь?**

### Q2: Error message через controller.enqueue?
Я считаю controller.enqueue надёжнее dataStream.write для вставки текста в assistant message. **Согласен или настаиваешь на dataStream.write?**

### Q3: Export findToolMentions из guardian?
Smart buffering требует эту функцию в routes. ТЗ говорит "не менять guardian" — но добавить export ≠ изменение логики. **ОК?**

### Q4: Починка Phase 1 бага в service-chat?
service-chat.ts не собирает guardianFlags на EOF (данные теряются). Чиним в рамках FIX1.2? Это 3 строки кода.

---

## Потенциальные риски

| Риск | Вероятность | Влияние | Митигация |
|------|:-:|:-:|-----------|
| Smart buffering пропускает галлюцинацию (tool mention после 200 char) | Низкая | Среднее | Галлюцинации упоминают tools в первых 50-100 символах |
| controller.enqueue error message не рендерится корректно | Низкая | Среднее | Тестирование + fallback на dataStream.write |
| Задержка 200 chars заметна пользователю | Очень низкая | Низкое | 200 chars ≈ 0.3-0.5с при нормальной скорости |

---

## Затронутые компоненты

- `app/(chat)/api/service-chat/route.ts` — полная буферизация + fix Phase 1 bug
- `app/(chat)/api/chat/route.ts` — smart buffering
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — добавить Guardian Phase 1 + smart buffering
- `lib/ai/tool-call-guardian.ts` — добавить export к findToolMentions (1 строка)

---

## Оценка

- [x] Простое (1-2 сессии)
- [ ] Среднее (3-5 сессий)
- [ ] Сложное (5+ сессий)

**Обоснование:** 3 файла routes + 1 строка export. Логика чёткая, паттерн одинаковый. Основная работа — аккуратная интеграция буферизации в существующие instrumentedStream.

---

## Ответы на вопросы

> Заполнено архитектором 2026-02-26

1. **Q1 (Smart buffering):** ✅ Да. Полная буферизация в chat/tasks неприемлема.
2. **Q2 (controller.enqueue):** ✅ Да. Ошибка Guardian должна выглядеть как текст ассистента.
3. **Q3 (export findToolMentions):** ✅ Да. Одна строка, нужна для smart buffering.
4. **Q4 (Phase 1 bug fix):** ✅ Да. Баг Phase 1, надо закрыть.
