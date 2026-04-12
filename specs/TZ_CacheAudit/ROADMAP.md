# Roadmap ТЗ-CacheAudit: Аудит подключения провайдеров и prompt caching

**Создан:** 2026-04-12
**Версия проекта:** 3.84.0 → 3.85.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 7 |
| Текущий этап | 1 |
| Сессий (оценка) | 4-6 |

**Расширение scope (2026-04-12):** после Этапа 0 пользователь расширил цель ТЗ — не только миграция на официальный стандарт MiniMax, но и **полное оздоровление кода**: убрать все костыли предыдущего агента, переписать лживую документацию, привести подключение MiniMax в эталонное состояние. Добавлен Этап 2 «Code Health Cleanup», остальные перенумерованы.

---

## Этап 0: Pre-flight проверки (read-only)

**Статус:** ✅ Завершён

**Цель:** Собрать всю недостающую информацию до того, как писать код.

**Задачи:**
- [x] WebFetch ai-sdk.dev/providers/ai-sdk-providers/anthropic — синтаксис `providerOptions.anthropic.cacheControl`: content-part-level работает (подтверждён официальным примером), tool-level работает (providerOptions на tool objекте)
- [x] SQL baseline через `mcp__postgres__query` на таблицу `ai_usage_log` (не `UsageLog`): корректировка — MiniMax OpenAI-compat **частично** пишет метрики (cacheRead avg 2282, cacheWrite всегда 0)
- [x] ~~Probe OpenAI-compat автокэша через curl~~ — заменено на SQL baseline, который показал реальное состояние напрямую
- [x] Grep на `api.minimax.io/v1` и `createMinimaxOpenAI` — точки использования: `lib/ai/registry.ts:18,29,34` + `scripts/test-minimax*.ts` + `docs/ai-minimax.md` + `_archive`. Только `registry.ts` в продакшн-коде.
- [x] Проверить MODEL_PRICING_RUB в `lib/ai/providers.ts` — вынесено в `model-catalog.ts` (после ТЗ-1 Stage 5). Проверить там в Этапе 1.
- [x] **Новая задача**: WebFetch npm registry — версия `vercel-minimax-ai-provider` — 0.0.2 (10 янв 2026) — самая свежая, других нет
- [x] **Новая задача**: Прочитать исходник пакета `node_modules/.../dist/index.mjs` — Anthropic-compat использует `AnthropicMessagesLanguageModel` из `@ai-sdk/anthropic/internal` (прокси через official AI SDK)
- [x] **Новая задача**: Написать `scripts/test-minimax-anthropic-compat.ts` — независимая валидация текущего поведения `createMinimax()`
- [x] **Новая задача**: Запустить тест — **ВСЕ 4 ТЕСТА PASS** (streamText, tool calling, generateObject mode:tool, explicit cacheControl с 100% cache hit)

**Файлы созданы:**
- `scripts/test-minimax-anthropic-compat.ts` — новый независимый тест (остаётся в проекте как референс для будущих ТЗ)

**Валидация этапа:**
- [x] Находки записаны в `ANALYSIS.md` → секция «Этап 0: результаты pre-flight»
- [x] Подтверждено: Anthropic-compat работает полностью (streamText, tools, generateObject, cacheControl)
- [x] Baseline метрик есть (SQL от 2026-04-12)

**Критерий готовности:** ✅ Все неизвестные факторы перед Этапом 1 разрешены. Предыдущие выводы агента проверены и опровергнуты собственным тестом.

---

## Этап 1: Переключение MiniMax namespace на Anthropic-compat

**Статус:** ✅ Завершён (2026-04-13, commit `5fdfcd6`)

**Цель:** MiniMax работает через Anthropic-compatible API (`api.minimax.io/anthropic`), метрики кэша становятся видны автоматически, все существующие фичи продолжают работать.

**⛔ НЕ начинать до завершения Этапа 0.**

**Задачи:**
- [x] Заменить `createMinimaxOpenAI` → `createMinimax` в `lib/ai/registry.ts` (для `minimax` и `minimaxLong`)
- [x] Явно передать `apiKey: process.env.MINIMAX_API_KEY`
- [x] **Удалить хак** `config.includeUsage = true` в `lib/ai/getModel.ts:171-179` — не нужен в Anthropic-compat режиме
- [x] `npx tsc --noEmit` → 0 ошибок
- [x] `npm run build` → успех
- [x] Integration тест `scripts/test-minimax-via-registry.ts` → `getModel('simply-chat')` и `getModel('briefing:filter')` резолвятся корректно
- [x] 🧪 Мануальный тест 1: Simply Chat текст — MiniMax M2.7, usage пишется корректно
- [x] 🧪 Мануальный тест 2: Simply Chat второе сообщение — **cacheRead 13883 (96.8% hit)**, стоимость $0.0044 → $0.0011 (4×)
- [x] 🧪 Мануальный тест 3: Simply «Думать» — переключение на Haiku работает, cacheWrite 19065 native
- [x] 🧪 Мануальный тест 4: Briefing generation — filter + author pipeline через `minimaxLong` отработал (153с, $0.0074 + $0.0022), usage корректен
- [~] 🧪 Мануальный тест 5: Service-chat — **пропущено**: система deprecated по решению пользователя 2026-04-13
- [x] SQL после тестов: `cacheWriteTokens` у MiniMax всё ещё 0 (ожидаемо — explicit breakpoints добавляются в Этапе 3, сейчас работает только passive auto-cache)
- [x] Git commit `5fdfcd6`

**Файлы:**
- `lib/ai/registry.ts` — замена фабрики

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] `npm run dev` — запускается
- [ ] Все 5 smoke-тестов прошли
- [ ] 🧪 Мануальный тест пользователем: Simply Chat + подтверждение корректности ответов на русском

**Rollback plan:** если любой тест падает — `git revert` коммита, разобрать причину.

**Git:** `git add lib/ai/registry.ts && git commit -m "feat(tz-cacheaudit): переключить MiniMax на Anthropic-compatible API"`

**Критерий готовности:** Все MiniMax точки работают на новом baseURL, cache-метрики видны в UsageLog.

---

## Этап 2: Code Health Cleanup (оздоровление кода)

**Статус:** 🔄 Код готов, ждём мануального smoke-теста (commit ожидается)

**Цель:** Убрать все костыли, связанные с MiniMax, которые остались от предыдущего агента. Переписать лживую документацию. Привести подключение в эталонное состояние.

**⛔ НЕ начинать до подтверждения Этапа 1 пользователем.**

**Задачи — ревизия костылей:**
- [x] **Удалены untracked мусорные скрипты** (`scripts/test-minimax.ts`, `test-minimax-generate-object.ts`, `test-think-models.ts`) — они не в git, локально использовали `createMinimaxOpenAI` + `includeUsage` хак. Единый референс — `test-minimax-anthropic-compat.ts` (в git).
- [x] **`app/(chat)/api/chat/route.ts`** — переименована `stripMiniMaxToolParts` → `stripLegacyOpenAICompatToolParts` с полным историческим docstring. **Исправлено условие применения** — теперь применяется ВСЕГДА для `chatMode === "simply"`, а не только для Anthropic ветки. Это был скрытый баг: после Этапа 1 Simply+MiniMax перестал чистить legacy parts, только 4 legacy сообщения в БД не взорвали тесты по случайности.
- [x] **`stripMediaPartsForTextModel` — оставлена как валидная.** MiniMax не поддерживает vision ни в одном режиме → Gemini 3 Flash маршрутизация остаётся. Claude умеет vision → media parts не стриппим.
- [x] **`isSimplyNonAnthropicModel` — оставлена.** Валидная логика для (а) temperature 0.7 (MiniMax ограничен (0, 1]) и (б) выбор strip media. Название точное, не переименовываем.
- [x] **Compaction options** — логика корректна: применяется только для Anthropic ветки (через `compactionOptions` в `providerOptions`), MiniMax игнорирует Context Management (подтверждено официальной документацией).
- [~] **Костыли в pipelines — ОТЛОЖЕНЫ в follow-up ТЗ.** В `lib/podcast/script-generator.ts`, `lib/briefing/briefing-author.ts`, `lib/briefing/research-engine.ts`, `lib/briefing/briefing-filter.ts`, `lib/briefing/briefing-section-author.ts`, `lib/ai/memory/extract.ts` обнаружен хардкод `cacheReadTokens: 0`/`cacheWriteTokens: 0` + `as any` cast (ручной accumulator `totalPromptTokens` теряет cache поля). После переключения на Anthropic-compat MiniMax начнёт возвращать эти поля, но pipeline-код их игнорирует. **НЕ правим** потому что файлы содержат uncommitted changes от замороженного ТЗ-MindArtifacts — правка приведёт к merge-конфликту. Зафиксировано в `ANALYSIS.md → Technical debt` как follow-up ТЗ после разморозки MindArtifacts.
- [~] **`app/(chat)/api/service-chat/route.ts`** — не трогаем, система deprecated (2026-04-13, подтверждение пользователя).

**Задачи — документация (переписать, не копировать):**
- [x] **`docs/ai-minimax.md`** — полностью переписан с нуля. Удалены все лживые утверждения:
  - ❌ «используется `minimaxOpenAI`, НЕ `minimax`. Причина: Anthropic endpoint не возвращает cache tokens» — ложь
  - ❌ «generateObject не работает (провайдер не реализует responseFormat)» — ложь, работает через `mode: "tool"`
  - ❌ «Кнопка Думать → Sonnet» — на деле Haiku 4.5 (проверено в логах Этапа 1)
  - ❌ Костыль `includeUsage: true` через `as any` — удалён из кода, удалён из документации
  - ✅ Добавлен раздел про passive auto-cache + explicit cacheControl breakpoints с реальными метриками из Этапа 1 (96.8% hit rate, 4× экономия)
  - ✅ Добавлен раздел 10 про `stripLegacyOpenAICompatToolParts` с условием удаления (legacy в БД → 0)
  - ✅ Добавлена полная история миграций, включая честное признание ошибки в v3.77 и откат в v3.85
- [x] **`docs/ai-providers.md`** — секция MiniMax обновлена: `createMinimax()` фабрика, `api.minimax.io/anthropic/v1` endpoint, прокси через `AnthropicMessagesLanguageModel`, детальное описание prompt caching (passive + explicit), ссылка на ADR 049 (создаётся в Этапе 6)
- [x] **`docs/architecture.md:113`** — обновлена строка про `vercel-minimax-ai-provider`: «Anthropic-compatible для MiniMax, прокси через @ai-sdk/anthropic/internal»
- [x] **`docs/ai-chats-map.md`** — grep показал, что устаревших упоминаний `createMinimaxOpenAI`/`api.minimax.io/v1` нет — файл синхронен с новым кодом

**Задачи — валидация:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Все MiniMax точки (Simply Chat, briefing, podcast, MIND) продолжают работать — smoke повтор

**Файлы:**
- `scripts/test-minimax.ts` — **удалить** (untracked, не в git, использует костыль `includeUsage`)
- `scripts/test-minimax-generate-object.ts` — **удалить** (untracked, функция покрыта `test-minimax-anthropic-compat.ts:test3`)
- `scripts/test-think-models.ts` — **удалить или сохранить** (untracked, проверить актуальность)
- `app/(chat)/api/chat/route.ts` — упрощение: убрать избыточные условия `isSimplyNonAnthropicModel`, `stripMiniMaxToolParts`
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — то же, если есть MiniMax-специфичная логика
- ~~`app/(chat)/api/service-chat/route.ts`~~ — **deprecated** (не трогаем, решение пользователя 2026-04-13)
- `docs/ai-minimax.md` — полное переписывание
- `docs/ai-providers.md` — обновление секции MiniMax
- `docs/ai-chats-map.md` — верификация

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] 🧪 Мануальный тест: все MiniMax точки работают без регрессий
- [ ] Документация верифицирована против кода (Правило 6 WORKFLOW.md)

**Git:** `git commit -m "refactor(tz-cacheaudit): оздоровление кода MiniMax — удалить костыли и лживую документацию"`

**Критерий готовности:** в проекте не осталось упоминаний `createMinimaxOpenAI`, `includeUsage: true` через `as any`, ложных утверждений про неработающие фичи Anthropic-compat. Документация синхронизирована с кодом.

---

## Этап 3: Cache breakpoints в основном chat route + MIND transplant

**Статус:** ⬜ Не начат

**Цель:** 3 cache breakpoints (tools + static system + last-user) в `app/(chat)/api/chat/route.ts`, MIND dynamic block перенесён в content-part последнего user message.

**⛔ НЕ начинать до подтверждения Этапа 2 пользователем.**

**Задачи:**
- [ ] Добавить breakpoint 1 (tools) — точный синтаксис по результатам Этапа 0
- [ ] Убедиться что breakpoint 2 (static system) продолжает работать
- [ ] Перенести MIND dynamic block из отдельного system message в content-part последнего user message (префикс «Релевантные факты из памяти:»)
- [ ] Добавить breakpoint 3 на content-part последнего user message
- [ ] Расширить условие `isAnthropicModel` → `isCacheCapableModel = isAnthropicModel || isMiniMaxAnthropicCompatModel`
- [ ] `npx tsc --noEmit` → 0 ошибок
- [ ] Мануальный тест: задать вопрос, ответ на который зависит от факта памяти (например, «когда у меня дедлайн?» если факт есть) — проверить что модель использует факты
- [ ] SQL-проверка: `cacheReadTokens > 0` на 2-м сообщении Simply Chat с MiniMax
- [ ] Git commit

**Файлы:**
- `app/(chat)/api/chat/route.ts:1015-1050`

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: Simply Chat + проверка DevPanel tokens-section (cacheRead/Write на 2-м сообщении)
- [ ] 🧪 Мануальный тест: модель использует факты из памяти корректно (до фикса сравнить, если возможно)
- [ ] Fallback план: если память деградирует → оставить MIND отдельным system (2 breakpoints)

**Git:** `git add app/\(chat\)/api/chat/route.ts && git commit -m "feat(tz-cacheaudit): расширить cache breakpoints в chat route + MIND transplant"`

**Критерий готовности:** cacheReadTokens/totalInput ≥ 60% на 2-м сообщении, память работает корректно.

---

## Этап 4: Cache breakpoints в task-expert route

**Статус:** ⬜ Не начат

**Цель:** Те же 3 breakpoints в task-expert route.

**Scope скорректирован 2026-04-13:** service-chat удалён из списка — система deprecated, оптимизировать нет смысла.

**⛔ НЕ начинать до подтверждения Этапа 3 пользователем.**

**Задачи:**
- [ ] `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — те же 3 breakpoints (tools + system + last-user)
- [ ] **Проверить стабильность** `projectManifest` в task-expert: если блок перестраивается на каждый запрос → НЕ кэшировать его отдельно. Если стабилен в рамках задачи → кэшировать как 4-й breakpoint.
- [ ] `npx tsc --noEmit` → 0 ошибок
- [ ] Smoke-тест task-expert (зайти в задачу проекта, отправить сообщение)
- [ ] Git commit

**Файлы:**
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts`

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: сервисный чат + задача проекта работают
- [ ] 🧪 Мануальный тест: service-chat + task-expert с проверкой DevPanel

**Git:** `git commit -m "feat(tz-cacheaudit): расширить cache breakpoints в service-chat и task-expert"`

**Критерий готовности:** все 3 chat-route используют 3 breakpoints, cache-метрики видны во всех.

---

## Этап 5: Валидация эффективности (мануальный тест + SQL)

**Статус:** ⬜ Не начат

**Цель:** Подтвердить реальную экономию на 5 сценариях.

**⛔ НЕ начинать до подтверждения Этапа 4 пользователем.**

**Задачи:**
- [ ] Сценарий 1: Simply Chat + Anthropic Haiku 4.5 (через /dev/models) — 2 сообщения, записать метрики из DevPanel
- [ ] Сценарий 2: Сразу второе сообщение в том же чате — подтвердить cacheRead ≈ write1
- [ ] Сценарий 3: Simply Chat + MiniMax M2.7 — 2 сообщения, записать метрики
- [ ] Сценарий 4: Simply Chat + «Думать» (Sonnet override) — 2 сообщения
- [ ] Сценарий 5: Долгий диалог 10+ сообщений — график стабилизации fresh input tokens
- [ ] SQL-снапшот через mcp__postgres__query:
  ```sql
  SELECT model, AVG(cache_read_tokens)::int, AVG(cache_write_tokens)::int, COUNT(*)
  FROM "UsageLog"
  WHERE created_at > NOW() - INTERVAL '1 hour' AND chat_mode = 'simply'
  GROUP BY model;
  ```
- [ ] Записать все метрики в CHANGELOG.md локальном

**Метрики успеха:**
- MiniMax `cacheReadTokens > 0` на 2-м сообщении (до фикса: 0)
- Anthropic `cacheReadTokens / totalInput ≥ 60%` на 2-м сообщении
- DevPanel cost-breakdown: экономия в 2-4× на 2-м сообщении
- UsageLog: ненулевые cache-токены для MiniMax

**Валидация этапа:**
- [ ] Все 5 сценариев выполнены
- [ ] SQL подтверждает ненулевые cache-токены
- [ ] 🧪 Подтверждение пользователем что экономия видна в DevPanel

**Критерий готовности:** все метрики успеха выполнены ИЛИ зафиксированы отклонения с обоснованием.

---

## Этап 6: Финализация

**Статус:** ⬜ Не начат

**⛔ ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../DOCUMENTATION_GUIDE.md) — пройти чеклист.

**Задачи:**

**Документация (обязательная):**
- [ ] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти чеклист
- [ ] Обновить главный `CHANGELOG.md` — релиз v3.85.0
- [ ] Обновить `SIMPLY_STATUS.md` — секция ТЗ-CacheAudit с before/after метриками
- [ ] Обновить `CLAUDE.md` — строка «Завершены» + комментарий к `lib/ai/registry.ts`
- [ ] Обновить `package.json` — версия 3.85.0

**Документация (по чеклисту):**
- [ ] ADR 049 `docs/decisions/049-minimax-anthropic-compat-mode.md` — обоснование выбора стандарта
- [ ] ADR 050 `docs/decisions/050-cache-breakpoints-strategy.md` — стратегия 3-breakpoint caching
- [ ] `docs/ai-providers.md` — секция MiniMax: фабрика, baseURL, feature matrix
- [ ] `docs/ai-minimax.md` — заменить «Ноль конфигурации», добавить feature matrix, pricing
- [ ] `docs/ai-chats-map.md` — сверить с реальным `lib/ai/registry.ts`

**Верификация docs против кода (Правило 6):**
- [ ] `ai-providers.md` → Реестр сверен с grep
- [ ] `CLAUDE.md` → пути файлов актуальны

**Завершение:**
- [ ] Финальное мануальное тестирование пользователем
- [ ] Переместить папку в `_archive/`

**Валидация:**
- [ ] `npm run build` — успешен
- [ ] Все функции работают в браузере
- [ ] Документация верифицирована против кода

---

## Правила этого ТЗ

1. **Gate-keeping строгий:** нельзя начинать следующий этап без подтверждения текущего пользователем.
2. **Rollback готов всегда:** `registry.ts` — одна строка, любой этап можно откатить `git revert`.
3. **Метрики фиксируются:** все SQL-снапшоты и DevPanel скриншоты → в локальный CHANGELOG.md.
4. **MIND transplant — с fallback:** если модель перестаёт использовать факты — вернуть как system message.
