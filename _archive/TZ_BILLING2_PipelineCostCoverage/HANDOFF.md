# Передача сессии ТЗ-BILLING2

**Дата:** 2026-04-06
**Завершена сессия:** 1
**Причина передачи:** нужен системный подход, текущий BILLING2 scope недостаточен

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

## ⛔ СЛЕДУЮЩАЯ СЕССИЯ: СИСТЕМНЫЙ АУДИТ (НЕ ЗАПЛАТКИ)

**BILLING2 в текущем виде ЗАКРЫТ. Нужен новый scope — ТЗ-PIPELINE1.**

### Что делать ПЕРВЫМ ДЕЛОМ

1. **Изучить официальную документацию** — AI SDK (retry, usage, error handling), Anthropic API (billing за failed requests), Google AI SDK
2. **Полный аудит кода** — прочитать каждый файл pipeline от начала до конца:
   - `lib/briefing/briefing-pipeline.ts` — orchestrator
   - `lib/briefing/briefing-author.ts` — retry/fallback (ТУТ ОСНОВНЫЕ ПОТЕРИ)
   - `lib/briefing/briefing-section-author.ts` — аналогично
   - `lib/briefing/briefing-filter.ts` — Gemini
   - `lib/briefing/research-engine.ts` — Perplexity (не логирует)
   - `lib/podcast/script-generator.ts` — Gemini
   - `lib/podcast/tts-gemini.ts` — TTS
   - `app/(chat)/api/briefing/generate/route.ts` — streaming endpoint ("Controller is already closed")
3. **Составить полную карту** — каждый API-вызов, каждый retry, каждая точка отказа
4. **Спроектировать решение** — не писать код пока архитектура не согласована с пользователем

### Что НЕ ДЕЛАТЬ

- ❌ Не начинать кодить без изучения документации
- ❌ Не делать точечные фиксы ("добавить logUsage сюда")
- ❌ Не спешить к следующему этапу
- ❌ Не придумывать велосипед — использовать стандартные решения из SDK

### Что решение ДОЛЖНО включать

1. **Retry-архитектура:** `maxRetries: 0` в AI SDK + собственная retry-логика с логированием КАЖДОЙ попытки (включая failed)
2. **Убрать fallback Sonnet 4.5:** legacy модель с той же ценой, нет смысла
3. **Pipeline crash fix:** "Controller is already closed" — section-author не запускается
4. **Perplexity logUsage:** research-engine не логирует расход
5. **DevPanel для брифинга:**
   - Сколько вызовов к каким моделям
   - Сколько retry'ев и почему
   - Стоимость каждого вызова (включая failed)
   - Какие сайты прочитаны, сколько попыток
   - Какие инструменты использованы
   - Детекция галлюцинаций (модель придумывает новости — реальная проблема)
6. **Гарантия:** сумма в БД === Anthropic Console (допуск <5%)

### Масштаб потерь (тест 2026-04-06)

**Anthropic Console:**
- Total tokens in: **43 873**
- Total tokens out: **13 225**
- Sonnet 4.6: **$0.20** (4-5 вызовов, все failed retry — НИ ОДИН не залогирован)
- Sonnet 4.5: **$0.13** (1 вызов fallback — залогирован $0.0728)

**Наша БД:**
- Input: **8 774** (vs 43 873 — залогировано 20%)
- Output: **3 100** (vs 13 225 — залогировано 23%)
- Cost: **$0.074** (vs ~$0.33 — залогировано 22%)

**Потеряно 78% расхода.**

---

## Пользователь подтвердил

- ⛔ "НИКАКИХ ЗАПЛАТОК. Системный подход."
- ⛔ "Два месяца не можем починить — хватит придумывать велосипед"
- ⛔ "Нужно изучить официальную документацию и сделать полный аудит"
- ⛔ "DevPanel для брифинга — чтобы видеть что происходит, видеть галлюцинации"
- ⛔ "Решать проблему начнём с изучения документации, не с кода"
