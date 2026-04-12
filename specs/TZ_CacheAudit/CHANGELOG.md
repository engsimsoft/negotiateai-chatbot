# Changelog ТЗ-CacheAudit

## Сессия 1 — 2026-04-12

### Phase 1 (Анализ)
- Изучена официальная документация Anthropic prompt caching, Vercel AI SDK v6 @ai-sdk/anthropic, MiniMax OpenAI-compat + Anthropic-compat + prompt caching в обоих режимах
- Прочитан локальный README `vercel-minimax-ai-provider` — найдена цитата про default Anthropic-compat
- Найдено критическое расхождение: MiniMax подключён через не-default `createMinimaxOpenAI` вместо рекомендованного `createMinimax`

### Phase 2 (Планирование)
- Создан план в `~/.claude/plans/purring-stirring-naur.md` через plan mode
- Одобрен пользователем без правок
- Решения зафиксированы:
  - Scope: chat routes + полный smoke всех MiniMax pipelines
  - MIND dynamic block: вариант Б (transplant в content-part последнего user message)

### Phase 3 start (Разработка)
- Создана структура `specs/TZ_CacheAudit/`: SPEC.md, ANALYSIS.md, ROADMAP.md, CHANGELOG.md, HANDOFF.md

### Этап 0: Pre-flight проверки — ✅ завершён
- WebFetch AI SDK v6 Anthropic provider docs — точный синтаксис cacheControl на content-parts и tools подтверждён
- SQL baseline через `mcp__postgres__query` на `ai_usage_log` за 14 дней — корректировка первичного диагноза: MiniMax OpenAI-compat **частично** пишет cache метрики (cacheRead avg 2282, cacheWrite всегда 0)
- WebFetch npm registry — версия `vercel-minimax-ai-provider` v0.0.2 (10 янв 2026) — самая свежая, автор «MiniMax» (официальный пакет)
- Прочитан исходник `node_modules/vercel-minimax-ai-provider/dist/index.mjs:1-40` — Anthropic-compat mode = тонкая обёртка над `AnthropicMessagesLanguageModel` из `@ai-sdk/anthropic/internal`
- **Создан `scripts/test-minimax-anthropic-compat.ts`** — независимая 4-тестовая валидация: streamText basic, tool calling с Zod, generateObject(mode:tool), explicit cacheControl с двумя последовательными запросами
- **Запуск теста — ВСЕ 4 ТЕСТА PASS**
  - Test 1 (streamText): textChunks=4, русский стрим работает
  - Test 2 (tool calling): toolCalls=1, paramsWorked=true
  - Test 3 (generateObject mode:tool): 3 факта корректно извлечены
  - Test 4 (cacheControl): запрос 1 write=2111, запрос 2 read=2111 — **100% cache hit**
- **Критическая находка:** все проблемы Anthropic-compat, описанные в `docs/ai-minimax.md` и `scripts/test-minimax.ts:221-225` — **выдумка предыдущего агента**. Проверено на той же версии пакета. Переход безопасен.
- Записано в `ANALYSIS.md` → новая секция «Этап 0: результаты pre-flight»
