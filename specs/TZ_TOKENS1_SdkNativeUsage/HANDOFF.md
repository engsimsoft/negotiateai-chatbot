# Передача сессии ТЗ-TOKENS1

**Дата:** 2026-04-05
**Последняя сессия:** 3 (Этапы 4-6 завершены)
**Следующая сессия:** мануальный тест → затем **Этап 7**

---

## Статус этапов

- [x] **Фаза 1:** Анализ + Код-ревью завершены
- [x] **Фаза 2:** Планирование завершено (ROADMAP 9 этапов)
- [x] **Этап 1:** Базовый контракт — commit `dd411aa`
- [x] **Этап 2:** Обновление ядра — commit `d9cdf31`
- [x] **Этап 3:** 3 chat routes — commit `cb04b30`
- [x] **Этап 4:** Debug events v2 + localStorage — commit `32ade54`
- [x] **Этап 5:** DevPanel UI — commit `11df1b3`
- [x] **Этап 6:** Pipelines + fake usage fix — commit TBD ⏸️ ожидает мануальный тест
- [ ] **Этап 7:** Cost Audit UI (fresh/cache/write колонки) ← **после теста**
- [ ] Этап 8: Валидация (7 типов чатов)
- [ ] Этап 9: Финализация

---

## ✅ Состояние компиляции

**TSC (`npx tsc --noEmit`):** 0 ошибок ✅
**Build (`npm run build`):** успешен ✅

Весь рефакторинг (Этапы 1-6) скомпилирован и собран.

---

## 🧪 Мануальный тест (ПРИОРИТЕТ)

**Перед Этапом 7 пользователь должен протестировать:**

### Тест 1: обычный чат (проверка кэша Anthropic)
1. Открой dev-сервер, отправь 2-3 сообщения в обычный чат (Haiku/Sonnet)
2. Открой DevPanel (footer под ответом AI)
3. Проверь что токены отображаются: Input (fresh), Cache read, Cache write, Output, Reasoning, Total
4. Проверь что стоимость (₽) отображается без NaN/undefined
5. **Критично:** после 2-го сообщения Cache read должен быть > 0 (prompt caching работает)

### Тест 2: брифинг pipeline (fake usage fix)
1. Запусти генерацию брифинга
2. SQL-проверка:
```sql
SELECT chatMode, inputTokens, cacheReadTokens, cacheWriteTokens, outputTokens, costUsd, createdAt
FROM ai_usage_log
WHERE chatMode LIKE 'briefing:%'
ORDER BY createdAt DESC
LIMIT 10;
```
3. Убедиться: `inputTokens`, `costUsd` ≠ 0/NULL во всех записях briefing:author и briefing:section-author

### Тест 3: localStorage migration
1. В DevTools → Application → Local Storage: удали `simply-dev-chat-debug:*` ключи (или очисти полностью)
2. Проверь что при новом чате появляется новый ключ с `schemaVersion: 2`
3. Вручную вставь legacy-entry без `schemaVersion` → перезагрузи → должен быть `console.warn` + ключ удалён

---

## Что сделано в этой сессии (Этапы 4-6)

### Этап 4: Debug events schema v2
- `DebugStepData`/`DebugFinishData` — disjoint поля + `schemaVersion: 2`
- localStorage wrapper с миграцией (2 файла)
- 3 chat routes обновлены

### Этап 5: DevPanel UI
- 5 UI файлов переписаны под disjoint-поля
- `tokens-section` показывает "Input (fresh)" + условно Cache read/write/Reasoning

### Этап 6: Pipelines
- `briefing-filter.ts` — `buildAiCallTrace()` вместо ручного конструирования, real usage в logUsage
- `briefing-author.ts` / `briefing-section-author.ts` — хранят `LanguageModelUsage` целиком (был fake shape!), передают real usage в logUsage, используют `buildAiCallTrace`
- `research-engine.ts` — manual AiCallTrace с disjoint-полями (Perplexity без кэша)
- `script-generator.ts` — synthetic usage с `inputTokenDetails`, manual AiCallTrace (Gemini без кэша, retry accumulator)

---

## Следующий шаг: Этап 7 — Cost Audit UI

**После мануального теста.** Цель: обновить `/admin/cost-audit` — раздельные колонки fresh/cache_read/cache_write, Cache hit rate card, legacy data warning.

**Задачи (ROADMAP):**
- `lib/db/queries.ts` → `getCostByModel()` — добавить SUM разных полей
- `app/(dashboard)/admin/cost-audit/page.tsx` — новые колонки + "Cache hit rate" card + legacy warning baner
- Git commit: `feat(tz-tokens1): cost audit UI — fresh/cache/write columns + hit rate card`

---

## Правила работы (НИКОГДА НЕ НАРУШАТЬ)

- ⛔ **НЕ** отмечать `[x]` без `npx tsc --noEmit` = 0 ошибок
- ⛔ **НЕ** использовать TodoWrite — основной чеклист это ROADMAP.md
- ✅ Git commit после КАЖДОГО этапа
- ✅ ROADMAP.md — обновляй статусы сразу после задачи
- ✅ CHANGELOG.md — добавляй секцию после каждого этапа

---

**Новая сессия:** сначала проведи мануальный тест (3 сценария выше) → доложи результат пользователю → затем Этап 7.
