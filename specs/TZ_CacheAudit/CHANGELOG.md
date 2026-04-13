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

### Этап 1: Переключение фабрики — ✅ завершён (2026-04-13)
- `lib/ai/registry.ts`: `createMinimaxOpenAI` → `createMinimax` для `minimax` и `minimaxLong` namespace, явная передача `apiKey: process.env.MINIMAX_API_KEY`
- `lib/ai/getModel.ts:171-179`: **удалён хак** мутации `config.includeUsage = true` через `as unknown as` — не нужен, т.к. `AnthropicMessagesLanguageModel` эмитит usage нативно (поле `includeUsage` было специфично для OpenAI-compat кастомной реализации в пакете)
- `scripts/test-minimax-via-registry.ts` (новый): integration тест через `getModel → registry → language model` для `simply-chat` и `briefing:filter` — оба резолвятся корректно
- Валидация: `npx tsc --noEmit` → 0 ошибок; `npm run build` → успех
- Git commit: `5fdfcd6`
- **Валидация через UI (2026-04-13):**
  - Simply Chat текст (msg 1): MiniMax-M2.7, inputTokens=14280, cacheRead=0, cost $0.0044 — первое сообщение ОК
  - Simply Chat текст (msg 2): MiniMax-M2.7, inputTokens=14342, **cacheRead=13883 (96.8%)**, cost $0.0011 — **4× экономия** через passive autoocache
  - Simply Chat «Думать»: резолвится в `claude-haiku-4-5-20251001` (НЕ Sonnet как врёт `docs/ai-minimax.md` — побочная находка, фиксится в Этапе 2), cacheWriteTokens=19065 native Anthropic cache работает отлично
  - Briefing generation: filter + author через `minimaxLong` за 153с, usage корректно пишется ($0.0022 + $0.0074)
  - Service-chat: **пропущено**, система deprecated по решению пользователя 2026-04-13, выпиливается отдельно
- **Побочная находка:** `[Jina Reader] QUOTA EXCEEDED: url=https://thecode.media/` в briefing — НЕ связано с нашим переключением, внешняя квота Jina Reader исчерпана, код корректно fallback на Readability (`Full text hit: 4/4 candidates`), briefing завершился успешно
- **Scope update:** service-chat удалён из всех последующих этапов — система deprecated
- Переход к Этапу 2 (Code Health Cleanup) — разрешён пользователем

### Этап 2: Code Health Cleanup — 🔄 код готов, ждёт мануального smoke-теста
- **Удалены 3 untracked мусорных скрипта** — `scripts/test-minimax.ts`, `scripts/test-minimax-generate-object.ts`, `scripts/test-think-models.ts`. Все три не были в git, созданы предыдущим агентом как локальный artifact, содержали ложные сравнительные данные и костыль `includeUsage: true` через `as any`. Единым источником правды по провайдеру MiniMax теперь является `scripts/test-minimax-anthropic-compat.ts` (в git с Этапа 0).
- **`app/(chat)/api/chat/route.ts`**: переименована `stripMiniMaxToolParts` → `stripLegacyOpenAICompatToolParts` с полным историческим docstring объясняющим, что это legacy compatibility layer для старых сообщений в БД с форматом `toolCallId: call_function_*`, созданных до ТЗ-CacheAudit (2026-04-13). **Исправлен скрытый баг**: функция теперь применяется ВСЕГДА для `chatMode === "simply"`, а не только в Anthropic ветке. До правки: после переключения на Anthropic-compat MiniMax перестал чистить legacy parts, только случайное отсутствие legacy данных в тестовом чате спасло Этап 1 от 400-ошибки. Также добавлен inline-комментарий про media stripping для non-Anthropic моделей (Gemini/MiniMax).
- **`docs/ai-minimax.md`**: полностью переписан с нуля. Удалены все 4 ложных утверждения предыдущего агента:
  - ❌ «используется minimaxOpenAI, НЕ minimax. Причина: Anthropic endpoint не возвращает cache tokens» — опровергнуто независимым тестом Этапа 0
  - ❌ «generateObject не работает, возвращает Markdown» — опровергнуто тестом (Test 3 `mode: "tool"` возвращает 3 корректно извлечённых факта)
  - ❌ «Кнопка Думать → Sonnet» — реально Claude Haiku 4.5 (проверено в логах Этапа 1, Проверка 3)
  - ❌ Костыль `includeUsage: true` через `as any` — удалён из кода и документации (не нужен в Anthropic-compat режиме, `AnthropicMessagesLanguageModel` эмитит usage нативно)

  Добавлены:
  - ✅ Раздел 5 про passive auto-cache + explicit cacheControl breakpoints с реальными метриками из Этапа 1 (96.8% hit rate, 4× экономия на 2-м сообщении)
  - ✅ Раздел 10 про `stripLegacyOpenAICompatToolParts` с условием удаления (SQL count legacy parts = 0)
  - ✅ Полная история миграций с честным признанием ошибки v3.77 и откатом в v3.85
  - ✅ Ссылки на официальную документацию MiniMax Anthropic-compat

- **`docs/ai-providers.md`**: секция MiniMax обновлена. Новые значения: `createMinimax()` фабрика, endpoint `https://api.minimax.io/anthropic/v1`, прокси через `AnthropicMessagesLanguageModel` из `@ai-sdk/anthropic/internal`. Добавлен блок про passive + explicit prompt caching с формулами.
- **`docs/architecture.md:113`**: строка про `vercel-minimax-ai-provider` обновлена с «OpenAI-compatible для MiniMax» на «Anthropic-compatible для MiniMax, прокси через `@ai-sdk/anthropic/internal`».
- **`docs/ai-chats-map.md`**: grep подтвердил отсутствие устаревших упоминаний `createMinimaxOpenAI` / `api.minimax.io/v1` — файл уже синхронен.

### Этап 2 — Technical debt (follow-up backlog)
В ходе ревизии обнаружены дополнительные костыли в pipeline-файлах, которые НЕ правятся в этом ТЗ и зафиксированы в `ANALYSIS.md → Technical debt` как follow-up:
1. **Хардкод `cacheReadTokens: 0`/`cacheWriteTokens: 0` + `as any` cast** в `lib/podcast/script-generator.ts`, `lib/briefing/research-engine.ts`, `lib/briefing/briefing-author.ts`. Ручной аккумулятор `totalPromptTokens` теряет cache поля. После переключения MiniMax на Anthropic-compat эти поля заполнятся в response, но pipeline код их игнорирует — в итоге занижение стоимости briefing/podcast в `ai_usage_log` на 10-25%.
2. **`as any` в Gemini TTS** — `lib/podcast/tts-gemini.ts` — legitimate workaround для non-LLM usage типа, не настоящий костыль.
3. **Jina Reader quota exceeded** — внешний сервис (`lib/ai/tools/jina-reader.ts`), засветился в логах Этапа 1 во время briefing. Fallback работает корректно. Требует upgrade квоты или мониторинга.

**Причина отложения:** все pipeline-файлы содержат uncommitted changes от замороженного ТЗ-MindArtifacts. Правка привела бы к merge-конфликту на чужой работе. После разморозки MindArtifacts — создать отдельное ТЗ `CachePipelineMetrics` или аналог.

### Этап 2 — Валидация
- `npx tsc --noEmit`: 0 ошибок
- `npm run build`: успех (пришлось сначала остановить dev server + `rm -rf .next` — был конфликт dev и prod артефактов в `.next` dir)
- Файлы затронуты в Этапе 2: `app/(chat)/api/chat/route.ts`, `docs/ai-minimax.md`, `docs/ai-providers.md`, `docs/architecture.md`, `specs/TZ_CacheAudit/*`
- Файлы удалены: `scripts/test-minimax.ts`, `scripts/test-minimax-generate-object.ts`, `scripts/test-think-models.ts` (untracked)

### Этап 3: Cache breakpoints + MIND transplant — ✅ завершён (2026-04-13)
- **`lib/ai/tools/chat-tools.ts`**: добавлен helper `withCacheControlOnLastTool<T>()` который оборачивает последний tool в объекте через `providerOptions.anthropic.cacheControl: { type: 'ephemeral' }`. Последний ключ в `getStandardTools()` всегда `readTelegramChannel` (insertion order ES2015+), что гарантирует стабильный cache key между запросами. Per Anthropic spec, placing cacheControl на последнем tool кэширует ВСЕ предыдущие tool definitions одним breakpoint.
- **`app/(chat)/api/chat/route.ts`**:
  - Введена локальная переменная `isAnthropicProtocolModel = effectiveProvider === "anthropic" || effectiveProvider === "minimax"` — обоснование: `vercel-minimax-ai-provider@0.0.2` через `createMinimax()` проксирует запросы через `AnthropicMessagesLanguageModel` из `@ai-sdk/anthropic/internal`, поэтому MiniMax принимает идентичный `providerOptions.anthropic.*` синтаксис.
  - **Breakpoint 1** (system prompt): условие применения расширено с `isAnthropicModel` на `isAnthropicProtocolModel` — теперь работает и для MiniMax.
  - **Breakpoint 2** (tools): новый, через `withCacheControlOnLastTool(standardTools)` — применяется при `isAnthropicProtocolModel`.
  - **Breakpoint 3** (last user message content-part): новый, inline `providerOptions.anthropic.cacheControl` на последнем text-part последнего user message через мутацию `messagesForRequest[lastIdx]`.
  - **MIND dynamic block transplant**: перенесён из отдельного `system` message в trailing text-part последнего user message. Структура теперь: `[system, ...history, { role: 'user', content: [textPart(breakpoint), mindPart(dynamic)] }]`. MIND находится **за** breakpoint → не ломает кэш префикса при смене фактов между запросами.
  - Построение `messagesForRequest` вынесено из inline literal внутри `streamText({...})` до вызова — async `convertToModelMessages` + мутация последнего user message требовали раскрытия.
  - `compactionOptions` остаётся под `isAnthropicModel` (не `isAnthropicProtocolModel`) — MiniMax API **игнорирует** Context Management (подтверждено их документацией).
  - `temperature: isSimplyNonAnthropicModel ? 0.7 : 1.0` остаётся — MiniMax требует `(0, 1]`.

- **Reality check в мануальном UI тесте (2026-04-13) — ВСЕ МЕТРИКИ ЗЕЛЁНЫЕ:**

  **Claude Haiku 4.5 (Simply «Думать»):**
  | Msg | inputTokens | cacheWrite | cacheRead | costUsd |
  |-----|-----------|-----------|-----------|---------|
  | 1 cold | 32739 | **19065** | 0 | $0.0379 |
  | 2 hot | 32849 | 0 | **19065** (100%) | **$0.0160** (58% экономии) |

  **MiniMax M2.7 (Simply):**
  | Msg | inputTokens | cacheWrite | cacheRead | costUsd |
  |-----|-----------|-----------|-----------|---------|
  | 1 cold | 13841 | **8424** ⭐ | 0 | $0.005 |
  | 2 hot | 13971 | 0 | **8424** (100%) | **$0.0023** (54% экономии) |
  | 3 tool-call | 28111 | 0 | **16848** | $0.0045 |

  **⭐ Впервые в истории проекта** `cacheWriteTokens > 0` для MiniMax. Это закрывает одну из technical debt из Этапа 2 автоматически — MiniMax через Anthropic-compat режим возвращает `cache_creation_input_tokens`, AI SDK v6 мапит в `inputTokenDetails.cacheWriteTokens`, наш `extractUsageFields` читает корректно, `ai_usage_log` пишет ненулевое значение. Measurement blind spot исчез.

  Msg 3 с tool call (`getCurrentDate`) не сломал кэш — после tool_use + tool_result цикла MiniMax продолжил читать префикс. TTFT 7-13 мс во всех 5 запросах (включая Haiku), никаких ошибок/варнингов, Guardian ни разу не блокировал.

- **Stripcontext:** в логах подтверждено что MiniMax в Anthropic-compat режиме продолжает использовать `call_function_*` префикс для `toolCallId` (увидели в `msg 3 getCurrentDate` call). Значит `stripLegacyOpenAICompatToolParts` из Этапа 2 остаётся **постоянной** санитацией (а не только legacy) — нужно будет скорректировать docstring на Этапе 6 финализации.

- **Validation:**
  - `npx tsc --noEmit`: 0 ошибок (после `as unknown as` cast fix для AI SDK v6 union типов content parts)
  - `npm run build`: успех
  - Реальный UI тест: 5 сообщений (3 MiniMax + 2 Haiku), все метрики сошлись с ожиданиями
  - SQL `ai_usage_log` за последние 15 минут: все записи корректны, regressions нет
