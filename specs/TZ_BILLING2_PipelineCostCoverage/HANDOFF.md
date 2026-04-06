# Передача сессии ТЗ-BILLING2

**Дата:** 2026-04-06
**Завершена сессия:** 1
**Причина передачи:** исчерпан контекст, нужен системный подход

---

## Статус этапов
- [x] Этап 1: Fix extractUsageForPricing — **оказался уже починен TOKENS1**, Gemini costUsd теперь не NULL
- [ ] Этап 2: Perplexity research logUsage — не начат
- [ ] Этап 3: Верификация podcast:script — не начат
- [ ] Этап 4: Финализация — не начат

## ⛔ КРИТИЧЕСКАЯ ПРОБЛЕМА: pipeline теряет расходы

### Факты (тест 2026-04-06, генерация брифинга)

**Anthropic Console (source of truth):**
- Sonnet 4.6 (claude-sonnet-4-6): **$0.20**
- Sonnet 4.5 (claude-sonnet-4-5-20250929): **$0.13**
- **Итого Anthropic:** $0.33

**Наша БД (ai_usage_log):**
- briefing:author / sonnet-4.5: **$0.0728** (1 запись)
- briefing:section-author / sonnet-4.6: **$0** (0 записей — pipeline crash)
- briefing:filter / gemini-2.0-flash: $0.0011 (OK)
- **Итого в БД:** $0.074

**Потеряно: $0.26 (79% расхода Anthropic не залогировано)**

### Точки потери (из серверных логов)

1. **Primary Sonnet 4.6 failed** → retry'ы → Anthropic списал за input tokens, но наш код не получил usage → logUsage не вызывался
   ```
   [Briefing] Primary model claude-sonnet-4-6 failed, trying claude-sonnet-4-5-20250929: 
   Failed after 3 attempts. Last error: Cannot connect to API: other side closed
   ```

2. **section-author не запустился** — pipeline controller crashed:
   ```
   [Briefing] Generation failed: TypeError: Invalid state: Controller is already closed
   ```

3. **logUsage вызывается ТОЛЬКО после успешного ответа** — если API падает на полпути (input tokens уже отправлены), Anthropic списывает за input, а мы ничего не логируем

### Системные проблемы (НЕ заплатки)

| Проблема | Где | Последствие |
|----------|-----|-------------|
| Retry'ы не логируют failed attempts | briefing-author.ts | Потеря $0.057 на Sonnet 4.5 retry'ях |
| section-author не запускается при pipeline crash | briefing-pipeline.ts | Потеря $0.02 на Sonnet 4.6 |
| Fallback модель (Sonnet 4.5) — legacy | briefing-config.ts | Зачем fallback на старую модель? |
| logUsage только при success | Везде | Потеря при любых API errors |

### Откуда Sonnet 4.5?

`lib/briefing/briefing-config.ts:36`:
```typescript
export const AUTHOR_MODEL_FALLBACK = "claude-sonnet-4-5-20250929";
```

Когда primary Sonnet 4.6 падает → fallback на 4.5. Вопрос: зачем fallback на другую модель вместо retry той же?

---

## Следующая сессия: что делать

**НЕ продолжать Этап 2-3. Сначала системный аудит pipeline.**

1. Прочитать этот HANDOFF
2. Прочитать `lib/briefing/briefing-pipeline.ts` — полный flow
3. Прочитать `lib/briefing/briefing-author.ts` — retry/fallback логику
4. Прочитать `lib/briefing/briefing-section-author.ts` — аналогично
5. **Спроектировать решение** которое гарантирует:
   - Каждый API-вызов (включая failed retry'ы) логируется
   - Pipeline не crash'ится с "Controller is already closed"
   - Fallback модель либо убрать, либо обосновать
   - Сумма в БД === сумма в Anthropic Console (допуск <5%)
6. Показать план пользователю ПЕРЕД написанием кода

---

## Пользователь подтвердил

- ⛔ "Заплатки не работают. Нужен системный подход."
- ⛔ "Два месяца не можем починить"
- ⛔ Категорически против "двигаться дальше" пока текущее не работает правильно
