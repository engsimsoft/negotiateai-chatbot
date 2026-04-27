# Roadmap ТЗ-RAG1: MIND Extract + Retrieve

**Создан:** 2026-04-06
**Версия проекта:** 3.70.0 → 3.71.0
**Статус:** В работе
**Scope:** [PHASES.md](PHASES.md) → RAG-1

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 6 |
| Текущий этап | 1 |
| Сессий (оценка) | 2-4 |

**Что делаем:** AI запоминает факты из чатов и использует их в будущих разговорах.

**Архитектура:**
```
Пользователь пишет сообщение
       ↓
① Retrieve: searchSimilarMemories() → top-5 фактов
       ↓
② Инжекция фактов в system prompt
       ↓
③ streamText() → Claude отвечает (видит факты)
       ↓
④ Fire-and-forget: Sonnet извлекает новые факты из пары user+assistant
       ↓
⑤ Voyage embed → pgvector (дедупликация → supersede или insert)
```

---

## Этап 1: Промпт извлечения + extract.ts

**Статус:** ✅ Завершён

**Цель:** Sonnet извлекает факты из разговора — structured JSON с category и confidence.

**Задачи:**
- [x] Создать `lib/prompts/memory/extract.md` — промпт для Sonnet:
  - Input: последнее сообщение пользователя + ответ AI (пара)
  - Output: JSON массив фактов `[{content, category, confidence}]`
  - Категории: fact, task, preference, calendar, person, decision
  - Инструкция: извлекать только значимые факты, не тривиальные
  - Инструкция: если изображение — описать его содержимое как текстовый факт
  - Инструкция: возвращать пустой массив `[]` если фактов нет
- [x] Создать `lib/ai/memory/extract.ts`:
  - `extractFactsFromMessages(userId, userMessage, assistantMessage, sourceType, sourceChatId?, sourceProjectId?)` → Promise<ExtractedFact[]>
  - Вызов Claude Sonnet через `generateObject()` с Zod-схемой
  - Fire-and-forget: вызывающий код не ждёт результата
  - logUsage() с chatMode `memory:extract` после завершения
- [x] Создать Zod-схему для ответа (массив фактов)
- [x] Добавить `extractAndStoreFacts()` — orchestrator: extract → embed → deduplicate → upsert
  - Для каждого извлечённого факта: embedText(content, "document")
  - Дедупликация: searchSimilarMemories с порогом 0.92 + category match
  - Если дубль: supersedeMemoryEntry(old, new)
  - Если новый: insertMemoryEntry()
  - logUsage() с chatMode `memory:embed` для каждого Voyage вызова

**Файлы:**
- `lib/prompts/memory/extract.md` — новый
- `lib/ai/memory/extract.ts` — новый

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] Ручной тест: вызвать extractFactsFromMessages() с тестовым диалогом → JSON фактов
- [ ] 🧪 Мануальный тест

**Git:** `git commit -m "feat(tz-rag1): memory extraction — Sonnet fact extractor + Voyage embed"`

**Критерий готовности:** extractAndStoreFacts() принимает пару сообщений → извлекает факты → сохраняет в memory_entry с дедупликацией.

---

## Этап 2: Retrieval + инжекция в prompt

**Статус:** ✅ Завершён

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 1

**Цель:** При каждом запросе — найти релевантные факты и добавить в system prompt.

**Задачи:**
- [x] Создать `lib/ai/memory/retrieve.ts`:
  - `retrieveMemoryContext(userId, queryText)` → `{ promptBlock, facts, voyageTokens, durationMs }`
  - Вызов searchSimilarMemories() с limit=10, minSimilarity=0.3
  - logUsage() с chatMode `memory:search` для Voyage embed запроса
  - Форматирование фактов для system prompt
- [x] Создать `formatMemoryForPrompt(facts)` — форматирование блока для system prompt:
  - Заголовок: "Из предыдущих разговоров известно:"
  - Каждый факт: `- [категория] содержимое (уверенность: X%)`
  - Инструкция: использовать мягко, не навязывать, упоминать только если релевантно
  - Пустой блок если фактов нет (не инжектировать ничего)
- [x] Максимальный бюджет: ~500 токенов на блок памяти (top-5 фактов)

**Файлы:**
- `lib/ai/memory/retrieve.ts` — новый

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] Ручной тест: retrieveMemoryContext() → факты с similarity + formatted prompt block
- [ ] 🧪 Мануальный тест

**Git:** `git commit -m "feat(tz-rag1): memory retrieval — semantic search + prompt injection format"`

**Критерий готовности:** retrieveMemoryContext() возвращает formatted блок для system prompt с релевантными фактами.

---

## Этап 3: Интеграция в chat/route.ts

**Статус:** ✅ Завершён

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 2

**Цель:** Подключить retrieve + extract к основному чату.

**Задачи:**
- [x] В `app/(chat)/api/chat/route.ts` — добавить retrieve ПЕРЕД streamText:
  - `retrieveMemoryContext(userId, userQueryText)` → инжекция `promptBlock` в system prompt
  - Только для chatMode: chat, expertise, create (не service chats)
- [x] В `app/(chat)/api/chat/route.ts` — добавить extract ПОСЛЕ onFinish:
  - `void extractAndStoreFacts(...)` — fire-and-forget, не блокирует сохранение
- [x] В `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — аналогично:
  - Retrieve: инжекция фактов
  - Extract: с sourceType="project" и sourceProjectId
- [x] Graceful degradation: если Voyage API недоступен → чат работает без памяти (log warning, не crash)

**Файлы:**
- `app/(chat)/api/chat/route.ts` — изменение (retrieve + extract)
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — изменение (retrieve + extract)

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] E2E: написать "Меня зовут Владимир, я работаю в IT" → новый чат → "Как меня зовут?" → AI знает
- [ ] E2E: проверить что chat/expertise/create работают с памятью
- [ ] E2E: проверить что без VOYAGE_API_KEY чат не падает
- [ ] SQL: `SELECT COUNT(*) FROM memory_entry` — факты накапливаются
- [ ] 🧪 Мануальный тест: полный цикл запомнить → вспомнить

**Git:** `git commit -m "feat(tz-rag1): integrate MIND into chat — retrieve + extract in chat/route.ts"`

**Критерий готовности:** Пользователь говорит факт в одном чате → AI вспоминает в другом чате.

---

## Этап 4: Cost tracking

**Статус:** ✅ Завершён (встроен в Этапы 1-3)

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 3

**Цель:** Каждый вызов Voyage и Sonnet extract учитывается в ai_usage_log.

**Задачи:**
- [ ] В voyage-client.ts — добавить userId + logUsage в embedText/embedTexts:
  - Опция: передавать `{ userId, chatMode }` в embedText() для автоматического логирования
  - Или: логировать в вызывающем коде (extract.ts, retrieve.ts) — решить при реализации
- [ ] Проверить что extract.ts логирует:
  - Sonnet extract: chatMode `memory:extract`, modelId `claude-sonnet-4-6`
  - Voyage embed фактов: chatMode `memory:embed`, modelId `voyage-4`
- [ ] Проверить что retrieve.ts логирует:
  - Voyage embed запроса: chatMode `memory:search`, modelId `voyage-4-lite`
- [ ] SQL-верификация: `SELECT chatMode, modelId, COUNT(*), SUM("costUsd"::float) FROM ai_usage_log WHERE chatMode LIKE 'memory:%' GROUP BY chatMode, modelId`
- [ ] Проверить cost audit dashboard: новые chatMode видны в breakdowns

**Файлы:**
- `lib/ai/memory/voyage-client.ts` — возможно добавить logUsage option
- `lib/ai/memory/extract.ts` — проверить logUsage вызовы
- `lib/ai/memory/retrieve.ts` — проверить logUsage вызовы

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] SQL: записи с chatMode `memory:*` существуют, costUsd > 0
- [ ] 🧪 Мануальный тест: отправить сообщение → проверить ai_usage_log

**Git:** `git commit -m "feat(tz-rag1): cost tracking — memory:embed, memory:search, memory:extract in ai_usage_log"`

**Критерий готовности:** Каждый вызов Voyage/Sonnet виден в ai_usage_log с корректным costUsd.

---

## Этап 5: Dev panel — RagSection

**Статус:** ✅ Завершён

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 4

**Цель:** В dev panel видно какие факты найдены, similarity, tokens, duration.

**Задачи:**
- [ ] В `lib/ai/debug-events.ts`:
  - Добавить `DebugRagData` тип (query, facts[], voyageTokens, searchDurationMs, factsInjected)
  - Добавить `emitDebugRag(dataStream, data)` — паттерн как emitDebugPrompt
- [ ] В `app/(chat)/api/chat/route.ts`:
  - После retrieveMemoryContext() — вызвать emitDebugRag() (только если isSimplyDevMode)
- [ ] В `components/dev-panel/dev-panel-provider.tsx`:
  - Парсить `data-debug-rag` events, сохранять в DevPanelMessageData
- [ ] Создать `components/dev-panel/sections/rag-section.tsx`:
  - Заголовок: "🧠 Память (MIND)"
  - Кол-во найденных / инжектированных фактов
  - Список фактов: content (truncated), category badge, similarity bar (0.0–1.0)
  - Footer: Voyage tokens, cost (₽), search duration (ms)
  - Если фактов 0: "Нет релевантных воспоминаний"
- [ ] В `components/dev-panel/dev-panel-drawer.tsx`:
  - Добавить RagSection между PromptSection и GuardianSection

**Файлы:**
- `lib/ai/debug-events.ts` — изменение (+DebugRagData, +emitDebugRag)
- `components/dev-panel/sections/rag-section.tsx` — новый
- `components/dev-panel/dev-panel-drawer.tsx` — изменение (+RagSection)
- `components/dev-panel/dev-panel-provider.tsx` — изменение (+parsing)
- `app/(chat)/api/chat/route.ts` — изменение (+emitDebugRag)

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: dev panel показывает RagSection с фактами и similarity
- [ ] Браузер: при отсутствии фактов — "Нет релевантных воспоминаний"
- [x] 🧪 Мануальный тест: полный цикл в dev mode

**Git:** `git commit -m "feat(tz-rag1): dev panel RagSection — memory debug with similarity scores"`

**Критерий готовности:** В dev panel drawer видно какие факты из MIND использовались, с similarity score.

---

## Этап 6: Финализация

**Статус:** ✅ Завершён

**Задачи:**

**Документация (обязательная):**
- [x] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти чеклист
- [x] Обновить главный CHANGELOG.md (v3.71.0 — MIND Extract + Retrieve)
- [x] Обновить SIMPLY_STATUS.md
- [x] Обновить CLAUDE.md (новые файлы в секции MIND Memory)
- [x] Обновить package.json: 3.70.0 → 3.71.0

**Документация (по чеклисту):**
- [x] ADR нужен? → Нет, стандартный паттерн (generateObject + fire-and-forget)
- [x] docs/ai-chats-map.md → нет отдельной таблицы chatMode (не требуется)
- [x] docs/ai-providers.md → обновлён Реестр конфигураций (Sonnet extract + Voyage AI секция)

**Завершение:**
- [x] SQL-проверка: memory_entry содержит 8 фактов, ai_usage_log содержит memory:* записи
- [x] Мануальное тестирование: запомнить → новый чат → вспомнить ✅

**Валидация:**
- [x] `npm run build` — успешен
- [x] Документация актуальна

**Git:** `git commit -m "feat(tz-rag1): MIND Extract + Retrieve — v3.71.0"`
