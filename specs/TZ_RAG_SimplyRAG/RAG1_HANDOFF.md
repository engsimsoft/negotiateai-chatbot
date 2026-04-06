# Передача сессии ТЗ-RAG1: MIND Extract + Retrieve

**Дата:** 2026-04-06
**Сессия:** 1 (ТЗ-RAG1 ЗАВЕРШЁН, v3.71.0)
**Коммит:** `0fe397a feat(tz-rag1): MIND Extract + Retrieve — v3.71.0`

---

## Статус: ТЗ-RAG1 ЗАВЕРШЁН

Все 6 этапов выполнены, протестированы, задокументированы, закоммичены.

## Что сделано в RAG-1 (v3.71.0)

### Новые файлы
- `lib/prompts/memory/extract.md` — промпт для Sonnet: извлечение фактов из пар сообщений
- `lib/ai/memory/extract.ts` — extractFactsFromMessages (generateObject) + extractAndStoreFacts (extract → embed → dedup → upsert)
- `lib/ai/memory/retrieve.ts` — retrieveMemoryContext (semantic search top-5) + formatMemoryForPrompt (XML `<memory>`)
- `components/dev-panel/sections/rag-section.tsx` — MIND Memory секция в Dev Panel
- `docs/decisions/040-mind-extract-retrieve-architecture.md` — ADR

### Изменённые файлы
- `app/(chat)/api/chat/route.ts` — retrieve перед streamText + extract fire-and-forget в onFinish
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — аналогично (sourceType="project")
- `lib/ai/debug-events.ts` — +DebugRagData, +emitDebugRag
- `components/dev-panel/dev-panel-provider.tsx` — парсинг data-debug-rag
- `components/dev-panel/dev-panel-drawer.tsx` — +RagSection
- `lib/ai/memory/index.ts` — re-exports extract + retrieve
- Документация: CHANGELOG, CLAUDE.md, SIMPLY_STATUS, package.json, docs/ai-providers.md

### Ключевые решения
- **Zod number()** — Anthropic API не поддерживает min/max → валидация через промпт
- **Voyage costUsd** — costUsdOverride (суммы слишком мелкие для RUB-rounding)
- **emitDebugRag** — должен быть ПОСЛЕ emitDebugPrompt (parseBatches нуждается в active batch)
- **VOYAGE_API_KEY** — обновлён на новый ключ (pa-ZmaI-...), старый не работал

## Следующие фазы (PHASES.md)

| Фаза | Версия | Статус | Что делать |
|------|--------|--------|------------|
| RAG-2 | 3.72.0 | ⬜ | MIND Consolidation + Profile + UI (управление фактами, объединение, пользовательский интерфейс) |
| RAG-3 | 3.73.0 | ⬜ | Compaction (бесконечный чат) — независим от RAG-2 |
| RAG-4 | 3.74.0 | ⬜ | Библиотека MVP (загрузка документов + search) |

## Для новой сессии

1. Прочитать `specs/TZ_RAG_SimplyRAG/PHASES.md` → выбрать следующую фазу
2. Прочитать `SIMPLY_STATUS.md` → текущее состояние
3. Следовать `specs/WORKFLOW.md`

## Что сделано (RAG-0, v3.70.0)

RAG-0 полностью завершён и закоммичен:
- pgvector v0.8.0 в Neon, таблица `memory_entry` с HNSW-индексом
- Voyage AI клиент: `lib/ai/memory/voyage-client.ts` (raw fetch, embed + batch)
- Memory queries: `lib/ai/memory/memory-queries.ts` (insert, search, supersede, delete)
- Types: `lib/ai/memory/types.ts`, exports: `lib/ai/memory/index.ts`
- Pricing voyage-4 + voyage-4-lite в `lib/ai/providers.ts`
- Всё верифицировано E2E (insert → search similarity 0.64-0.70 → supersede → delete)
- Коммит: `1f00e67 feat(tz-rag0): Simply RAG infrastructure — pgvector + Voyage AI — v3.70.0`

## Следующая сессия: начни с

1. **Прочитать** `specs/TZ_RAG_SimplyRAG/RAG1_ROADMAP.md` — полный план 6 этапов
2. **Прочитать** `specs/TZ_RAG_SimplyRAG/PHASES.md` → секция RAG-1 — scope, cost tracking, dev panel
3. **Прочитать** Этап 1 в RAG1_ROADMAP → создать промпт извлечения + extract.ts
4. Следовать `specs/WORKFLOW.md` — валидация после каждой задачи

## Ключевые файлы для RAG-1

### Уже готово (из RAG-0, можно использовать)
- `lib/ai/memory/voyage-client.ts` — `embedText(text, "document"|"query")` → 1024-dim vector
- `lib/ai/memory/memory-queries.ts` — `insertMemoryEntry()`, `searchSimilarMemories()`, `embedAndInsertMemory()`, `supersedeMemoryEntry()`
- `lib/ai/memory/types.ts` — MemoryCategory, NewMemoryEntry, MemorySearchOptions
- `lib/ai/memory/index.ts` — re-exports всего

### Нужно изучить перед началом
- `app/(chat)/api/chat/route.ts` — основной чат, точка интеграции retrieve + extract
  - Строка ~383: build prompt context (сюда инжектировать memory)
  - Строка ~968: onFinish (сюда waitUntil extract)
  - Строка ~146: logUsage паттерн (для memory:extract)
  - Строка ~570: emitDebugPrompt (паттерн для emitDebugRag)
- `lib/ai/usage-utils.ts` — `logUsage()` fire-and-forget паттерн
- `lib/ai/debug-events.ts` — `emitDebugPrompt()`, `emitDebugStep()` паттерны (для DebugRagData)
- `lib/ai/tools/perplexity-client.ts` — эталон raw fetch клиента (уже изучен)
- `lib/prompts/` — структура промптов (для extract.md)

### Нужно создать
- `lib/prompts/memory/extract.md` — промпт для Sonnet-извлечения фактов
- `lib/ai/memory/extract.ts` — extractFactsFromMessages() + extractAndStoreFacts()
- `lib/ai/memory/retrieve.ts` — retrieveMemoryContext() + formatMemoryForPrompt()
- `lib/ai/debug-events.ts` — +DebugRagData, +emitDebugRag()
- `components/dev-panel/sections/rag-section.tsx` — RagSection

## Архитектурные решения (уже приняты)

1. **Дедупликация:** cosine > 0.92 + category match → supersede старый факт
2. **Scope чатов:** chat, expertise, create, project tasks. НЕ service chats
3. **Cost tracking:** memory:embed, memory:search, memory:extract — с первого дня
4. **Graceful degradation:** Voyage API недоступен → чат работает без памяти, не падает
5. **Бюджет контекста:** ~500 токенов на блок памяти (top-5 фактов)
6. **Формат:** мягкая форма "Из предыдущих разговоров известно..." — не навязывать

## Замечания

- Voyage AI free tier: 3 RPM без payment method → payment method добавлен, лимиты стандартные
- Voyage pricing уже в MODEL_PRICING_RUB → calcCostUsd() подхватит автоматически
- `memory_entry.confidence` — numeric(3,2), хранится как string в Drizzle. При вставке: `String(confidence)`
- `"server-only"` guard в memory-queries.ts — нельзя вызывать из CLI напрямую (только из Next.js server)
