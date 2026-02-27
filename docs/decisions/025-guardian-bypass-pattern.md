# ADR 025: Guardian Bypass для multi-step AI flows

**Дата:** 2026-02-27
**Статус:** Принято
**Версия:** 3.53.0

---

## Контекст

Tool Call Guardian (ТЗ-FIX1/FIX1.2) анализирует каждый step AI-ответа изолированно: если `toolCallCount === 0` и текст упоминает инструмент с паттерном результата ("нашёл", "проверил") — это галлюцинация, текст блокируется.

В briefing-onboarding (30-шаговый flow) AI законно пересказывает результаты из предыдущих шагов. Guardian блокировал эти тексты как галлюцинации (233 chunks suppressed, confidence 0.7-0.9). Пользователь видел "Запускаю поиск..." — и тишина.

---

## Решение

**Guardian bypass** — для `context === "briefing-onboarding"` текст проходит напрямую без буферизации. Guardian продолжает анализировать и логировать (`console.warn`), но не блокирует.

```typescript
const guardianBypass = context === "briefing-onboarding";

// В instrumentedStream:
if (guardianBypass) {
  // Feed text to Guardian for logging
  if (eventType === "text-delta") guardianTracker.addText(chunk);
  if (eventType === "finish-step") {
    const result = guardianTracker.analyze();
    if (result.detected) {
      console.warn(`[Guardian] Log-only: would block, bypassed`);
    }
  }
  // Pass everything through immediately
  controller.enqueue(value);
  continue;
}
```

Дополнительно: промпт v11 направляет AI вызывать `updateBriefingPreview` после research (tool call → `toolCallCount > 0` → Guardian пропускает), минимизируя ситуации текстового пересказа без tool call.

---

## Причины

1. **False positive rate 100%** — каждый тест создавал ложное срабатывание в финальном текстовом шаге
2. **Архитектурное ограничение Guardian** — step-изолированный анализ не учитывает контекст предыдущих шагов
3. **Риск галлюцинаций минимален** — briefing-onboarding использует реальные инструменты (deepResearch/Perplexity, fetchUrl, readTelegramChannel), AI пересказывает их результаты

---

## Альтернативы

| Вариант | Описание | Почему отклонили |
|---------|----------|-----------------|
| **A: Только промпт** | Промпт v11 запрещает текст без tool call | AI может игнорировать, не 100% гарантия |
| **B: Multi-step контекст в Guardian** | `previousStepsHadToolCalls` Set | Усложняет Guardian, может пропустить реальные галлюцинации |
| **C: Промпт + bypass (выбрано)** | Промпт как основной путь, bypass как страховка | — |

---

## Последствия

### Плюсы
- Briefing-onboarding работает без блокировок
- Guardian логирует — можно мониторить паттерны
- Для chat/projects — Guardian работает как раньше (без изменений)
- Паттерн расширяем на другие multi-step flows (добавить context в guardianBypass)

### Минусы
- Теоретически возможны галлюцинации в briefing-onboarding (низкий риск — реальные tools)
- Нужен мониторинг Guardian логов для оценки false positive rate

---

## Применимость к другим контекстам

Паттерн можно использовать для любого multi-step flow где AI законно ссылается на результаты предыдущих шагов:

```typescript
const guardianBypass = [
  "briefing-onboarding",
  // "future-multi-step-context",
].includes(context);
```

Критерии для включения контекста в bypass:
1. Flow использует реальные инструменты (не галлюцинирует)
2. AI предсказуемо пересказывает результаты предыдущих шагов
3. maxSteps > 3 (multi-step)

---

## Ссылки
- `app/(chat)/api/service-chat/route.ts` — instrumentedStream с bypass
- `lib/ai/tool-call-guardian.ts` — Guardian логика (не изменена)
- `specs/TZ_FIX3_OnboardingRestore/GUARDIAN_CONFLICT.md` — полное описание проблемы
- ADR 022: Tool Call Guardian
- ADR 023: Guardian Blocking Strategy

---

## История изменений
- **2026-02-27** — Документ создан (ТЗ-FIX3)
