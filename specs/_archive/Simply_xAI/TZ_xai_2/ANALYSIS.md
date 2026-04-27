# Анализ ТЗ-XAI-2 — MIND pipeline → Grok 4.1 Fast

**Дата анализа:** 2026-04-14
**Целевая модель:** `grok-4-1-fast-non-reasoning` (для всех 5 taskId memory:*)
**Связанные:** [../SIMPLY_XAI_ROADMAP.md](../SIMPLY_XAI_ROADMAP.md) · [../SIMPLY_XAI_NOTES.md](../SIMPLY_XAI_NOTES.md) · [../SIMPLY_XAI_CHANGELOG.md](../SIMPLY_XAI_CHANGELOG.md)

---

## Изученная документация

- [docs.x.ai/docs/guides/structured-outputs](https://docs.x.ai/docs/guides/structured-outputs) — structured outputs поддерживается **всеми** language моделями через `response_format json_schema`
- [ai-sdk.dev/providers/ai-sdk-providers/xai](https://ai-sdk.dev/providers/ai-sdk-providers/xai) — `@ai-sdk/xai` поддерживает `generateObject` / `streamObject` «via AI SDK Core's Output feature» (формулировка намекает что под капотом переиспользуется Output mechanism)
- **Verified Grok parameter reference** в [SIMPLY_XAI_NOTES.md](../SIMPLY_XAI_NOTES.md) — `reasoningEffort` не передавать, `temperature`/`top_p` работают, `presence/frequency_penalty` не нужны

### Запрещённые JSON schema constraints в xAI

xAI structured outputs **не поддерживает**:
- `minLength` / `maxLength` для строк
- `minItems` / `maxItems` / `minContains` / `maxContains` для массивов
- `allOf`

Failure mode при использовании этих constraints **не задокументирован** — может быть как hard error, так и silent ignore.

---

## Инвентарь: 5 call sites MIND pipeline

### 1. `extractFactsFromMessages` — [lib/ai/memory/extract.ts:120-164](../../../lib/ai/memory/extract.ts#L120)

- **SDK:** `generateObject` + Zod
- **taskId:** `memory:extract` → сейчас `claude-sonnet-4-6`, цель `grok-4-1-fast-non-reasoning`
- **Schema:** `extractionResultSchema` = object { facts: array of { content: string, category: enum, confidence: number } }
- **Schema safety для xAI:** ✅ базовые типы + enum + array + object. Никаких запрещённых constraints
- **providerOptions:** отсутствуют
- **Temperature:** 0.1
- **Tools:** нет, vision нет

### 2. `batchExtractFacts` — [lib/ai/memory/extract.ts:269-436](../../../lib/ai/memory/extract.ts#L269)

- **SDK:** `generateText` + `JSON.parse` + `extractionResultSchema.parse()` (строки 311-335) — **legacy MiniMax workaround** потому что MiniMax через Anthropic-compat не давал нативного `generateObject`
- **taskId:** `memory:extract-batch` → сейчас `MiniMax-M2.7`, цель `grok-4-1-fast-non-reasoning`
- **Та же Zod schema** что у call site 1
- **Temperature:** 0.1
- **Очистка response:** `text.replace(/```json\s*|```\s*/g, "").trim()` — эвристика на случай markdown-обёрток
- **🎁 Бонус-рефакторинг:** под Grok можно переписать на native `generateObject` — удалится ~15 строк парсинг-логики

### 3. `verifyDuplicatesWithLLM` — [lib/ai/memory/extract.ts:449-499](../../../lib/ai/memory/extract.ts#L449)

- **SDK:** `generateObject` + Zod
- **taskId:** `memory:dedup-verify` → сейчас `claude-haiku-4-5-20251001`, цель `grok-4-1-fast-non-reasoning`
- **Schema:** `deduplicationSchema` = object { duplicateOf: string **nullable** }
- **⚠️ Единственный риск совместимости:** `.nullable()` в Zod. AI SDK транслирует в JSON schema как `{ "type": ["string", "null"] }` или `{ "anyOf": [..., { "type": "null" }] }`. xAI docs явно поддерживают `anyOf`. Но нужен smoke test перед прод
- **Temperature:** 0
- **Fallback** уже реализован: если LLM упадёт → embedding similarity ≥0.85 считается дубликатом

### 4. `runConsolidation` — [lib/ai/memory/consolidate.ts:124-195](../../../lib/ai/memory/consolidate.ts#L124)

- **SDK:** `generateText` + `JSON.parse` + Zod (строки 147-170) — **legacy MiniMax workaround**
- **taskId:** `memory:consolidate` → сейчас `MiniMax-M2.7`, цель `grok-4-1-fast-non-reasoning`
- **Schema:** `consolidationResultSchema` = object { actions: array of { factId, action: enum["supersede"|"merge"|"remove"], supersededById?, mergedContent?, reason } }
- **Schema safety для xAI:** ✅ enum + optional fields + array. Никаких запрещённых constraints
- **Temperature:** 0.1
- **Вызывается из** двух мест: `consolidateUserMemory` (full, nightly cron) и `miniConsolidateUserMemory` (event-triggered каждые 20 новых фактов). Разделяют общую функцию
- **🎁 Бонус-рефакторинг:** native `generateObject` → удалится ~13 строк парсинг-логики

### 5. `generateUserProfile` — [lib/ai/memory/profile.ts:88-163](../../../lib/ai/memory/profile.ts#L88)

- **SDK:** `generateText` (pure prose, no structured output)
- **taskId:** `memory:profile` → сейчас `MiniMax-M2.7`, цель `grok-4-1-fast-non-reasoning`
- **Temperature:** 0.3
- **Ничего рефакторить не нужно** — только переключение taskId

---

## Находки за пределами 5 call sites

1. **Dead import:** [extract.ts:25](../../../lib/ai/memory/extract.ts#L25) импортирует `calcCostUsd` но не использует — можно убрать как micro-cleanup. 1 строка. Не принципиально
2. **Никаких `providerOptions.anthropic.*`** (cacheControl, thinking, contextManagement) — в MIND pipeline ничего нет, миграция механически безопасна
3. **Event chain** (`extract → consolidate → profile`) работает на уровне приложения через `void ... .catch()`, а не через провайдерские механизмы — не чувствителен к смене модели
4. **Error handling** во всех 5 call sites: non-blocking `catch` + `console.warn/error`. Если Grok упадёт на запросе, пайплайн не ломается, следующий tick попробует заново

---

## Риски и митигации

| # | Риск | Вероятность | Влияние | Митигация |
|---|---|---|---|---|
| R-1 | `generateObject` через `@ai-sdk/xai` не работает нативно (формулировка docs «via AI SDK Core's Output feature» двусмысленна) | **Средняя** | Среднее (fallback = остаёмся на legacy pattern для 2 call sites) | **Smoke test перед переключением** — минимальный скрипт с `generateObject` + простая Zod schema |
| R-2 | `.nullable()` в `deduplicationSchema` транслируется в JSON schema неправильно, xAI возвращает Bad Request | Низкая | Низкое (fallback на embedding similarity ≥0.85 уже есть в коде) | Smoke test покрывает этот случай |
| R-3 | Grok 4.1 Fast non-reasoning даёт **худшее качество извлечения фактов** чем Claude Sonnet → больше шума в MIND памяти | **Средняя** | **Среднее** (засорение памяти = деградация user experience в долгосроке) | Оставляем за рамками ТЗ-XAI-2. Решение: после переключения 1-2 недели мониторим качество фактов в `/context` dashboard, если shit — поднимаем на Sonnet как override. Решение о дефолтной модели — отдельное продуктовое ТЗ в будущем |
| R-4 | `memory:dedup-verify` работает сейчас на Haiku (дёшево + быстро). Переход на Grok 4.1 Fast — экономия ($0.2/$0.5 vs $1/$5 per 1M) + возможно быстрее, но качество дедупликации — открытый вопрос | Низкая | Низкое (есть fallback в коде) | Оставляем в мониторинге |
| R-5 | xAI имеет недокументированные ограничения на output tokens (потолок 16K в нашем каталоге — догадка) → consolidate с 200 фактами может обрезаться | Низкая | Среднее (частичный ответ → некорректный JSON) | Есть `MAX_ACTIONS_PER_CALL = 20` cap + defensive JSON parsing с error log. Покрыто error handling |

---

## Вопросы пользователю

1. **Бонус-рефакторинг JSON.parse → generateObject** в `batchExtractFacts` и `runConsolidation`:
   - **A.** Делаем в ТЗ-XAI-2 одним коммитом вместе с переключением taskId — удалится ~28 строк legacy кода, чище и быстрее
   - **B.** Откладываем в follow-up backlog, в ТЗ-XAI-2 только переключаем taskId
   - **Моя рекомендация:** A. Зачем оставлять MiniMax workaround в коде который прямо сейчас трогаем. Но есть зависимость от smoke test (R-1) — если native generateObject на xAI не работает, пункт A невозможен

2. **Smoke test объём:**
   - **A. Минимум** — один вызов `generateObject` с простой Zod schema (object + array + enum + number) на `grok-4-1-fast-non-reasoning`. ~$0.001. Покрывает R-1 базово
   - **B. Расширенный** — плюс отдельный вызов с `.nullable()` schema (покрывает R-2). ~$0.002
   - **Моя рекомендация:** B. Оба case'а критичны для решения по бонус-рефакторингу

3. **Подход к переключению 5 taskId:**
   - Все 5 используют один провайдер, один variant, никаких зависимостей между ними — **переключаем все 5 одновременно одним коммитом**. Поэтапное переключение смысла не имеет — это не связанные задачи

4. **Dead import `calcCostUsd`** в extract.ts — убрать в этом ТЗ (1 строка) или игнорировать?

5. **Качество модели (R-3)** — принципиально ли готов терпеть возможное ухудшение качества извлечения фактов ради экономии ($3/$15 → $0.2/$0.5, в 15 раз дешевле)? Если нет — может лучше оставить `memory:extract` на Sonnet, а переключить только 4 оставшихся (extract-batch, dedup-verify, consolidate, profile)?

---

## План если все ответы «делаем просто и сразу»

Если ответы: A (бонус), B (расширенный smoke test), все 5 разом, dead import убрать, качество принимаем — тогда ТЗ в 3 этапа, одна сессия:

1. **Этап 1 — Smoke test** (5 мин, ~$0.002): мини-скрипт с `generateObject` простой + nullable → запуск → удалить скрипт → занести результат в [SIMPLY_XAI_NOTES.md](../SIMPLY_XAI_NOTES.md)
2. **Этап 2 — Переключение + рефакторинг** (20-30 мин):
   - `task-assignments.ts`: 5 строк → `grok-4-1-fast-non-reasoning`
   - `extract.ts`: убрать dead import + переписать `batchExtractFacts` на `generateObject`
   - `consolidate.ts`: переписать `runConsolidation` на `generateObject`
   - `npx tsc --noEmit` + `npm run build`
3. **Этап 3 — Смоук-тест в браузере** (10 мин): поговорить с Simply Chat, отправить 3-4 сообщения, проверить что в `/context` появляются факты; проверить batch extract trigger через sidebar debug — нужно только убедиться что пайплайн не упал

**Финал:** commit + запись в SIMPLY_XAI_CHANGELOG + NOTES + версия 3.88.0 → 3.89.0

---

## Что НЕ планируется в этом ТЗ

- Пересмотр промптов `lib/prompts/memory/*.md` — они написаны провайдер-нейтрально, на русском. Менять не нужно
- Изменение thresholds `MINI_CONSOLIDATION_THRESHOLD`, `MAX_BATCH_MESSAGES`, `MAX_FACTS_FOR_PROFILE` — они про поведение пайплайна, не про модель
- Изменение Voyage / pgvector / embed логики — не затронуто миграцией LLM
- Оценка качества извлечения фактов Grok vs Sonnet — отдельная продуктовая задача

---

## Ответы пользователя

> Заполняется пользователем

1. **Бонус-рефакторинг:** ...
2. **Smoke test объём:** ...
3. **Подход:** все 5 разом? да/нет
4. **Dead import:** убирать? да/нет
5. **Качество R-3:** готов принять? да/нет
