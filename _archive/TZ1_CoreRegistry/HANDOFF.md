# Передача сессии ТЗ-1: Core Registry — ФИНАЛЬНЫЙ СТАТУС

**Дата закрытия:** 2026-04-11
**Статус:** ✅ **ТЗ ЗАВЕРШЕНО И ЗААРХИВИРОВАНО**
**Финальная версия:** `v3.83.0`
**Финальный коммит:** `6cd0a6b` — `docs(tz-1): finalize Core Registry — ADR 047, docs rewrite, bump to 3.83.0`

---

## Все этапы завершены

- [x] Фаза Анализ
- [x] Фаза Планирование
- [x] **Этап 1: Core Registry + Catalog + Task-assignments + миграция БД** — `836842a`
- [x] **HOTFIX: sanitizer + scrollbar** — `b4bce63`
- [x] **Этап 2: Миграция chat routes + service-chat + utils** — `5d629db`
- [x] **Этап 3: Миграция projects + clerks + professors + DevPanel в TaskChat** — `012145a`
- [x] **Этап 4: Миграция pipelines** — `da89f86` + `cfd61d8`
- [x] **Этап 5: Очистка legacy wrappers** — `62d672d` + `b9bc340` + `7e20a49`
- [x] **Этап 6: Финализация + ADR + docs** — `6cd0a6b`

Дополнительные коммиты вне Stages (инфраструктурные фиксы, выявленные в ходе тестирования ТЗ):
- `350df7b` — `fix(chat): sanitizeCoreMessages reorder tool-call to end`
- `83792b3` — `feat(tz-dev-panel-errors): Errors & Warnings diagnostic`
- `9fd9fe4` — `fix(db): switch Neon driver from WebSocket Pool to HTTP (neon-http)`
- `f918044` — `chore(deps): upgrade drizzle-orm 0.34.1 → 0.45.2, drizzle-kit 0.25.0 → 0.31.10`
- `5768fdd` — `feat(dev-panel): surface artifact sub-calls in Timeline`
- `d24bb17` — `fix(errors): preserve original database error through ChatSDKError`
- `38b8df2` — `fix(tools): log full Error in tool-wrapper, not just .message`

---

## Главное достижение

Смена default-модели для любой из **39 AI-точек** приложения теперь = **одна строка** в [lib/ai/task-assignments.ts](../../lib/ai/task-assignments.ts). HMR подхватывает автоматически, никакие call-sites не трогаются.

**Доказательство работоспособности:** во время Stage 3 мануального тестирования одной правкой переключили 8 taskId (chat:sonnet/opus, project:expert:haiku/sonnet/opus, professor:planning/review/pipeline-{analyze,synthesize}) с Opus/Sonnet на Haiku. Все вызовы перешли на новую модель без правки call-sites.

### Попутно вскрыта и починена архитектурная дыра

`providerOptions.anthropic.thinking: adaptive` был захардкожен в 3 местах. Haiku не поддерживает thinking → API 400 при переключении. Решено через `taskSupportsThinking(taskId)` — helper читает `capabilities.thinking` из model-catalog. Call-sites теперь передают thinking **условно**. System самоадаптируется под любую модель.

---

## Связанные артефакты

**ADR:** [docs/decisions/047-core-model-registry.md](../../docs/decisions/047-core-model-registry.md) — полное обоснование архитектуры, альтернативы, связи с ADR 035/036/037/038.

**Документация:**
- [docs/ai-providers.md](../../docs/ai-providers.md) — переписан, секция «Core Registry» вверху
- [docs/ai-chats-map.md](../../docs/ai-chats-map.md) — шапка + таблицы + секция «Конфигурация провайдеров»
- [docs/architecture.md](../../docs/architecture.md) — AI Layer секция
- [docs/ai-minimax.md](../../docs/ai-minimax.md) — раздел «Файлы в проекте» обновлён
- [docs/ai-agents.md](../../docs/ai-agents.md) — Эксперт по задаче, модель через `getModel("project:expert:${tier}")`
- [docs/ai-tools.md](../../docs/ai-tools.md) — `requestSuggestions` модель через `getModel("util:artifact-suggestions")`
- [CLAUDE.md](../../CLAUDE.md) — секция Core Model Registry + ТЗ-1 в «Завершены» + версия 3.83
- [SIMPLY_STATUS.md](../../SIMPLY_STATUS.md) — версия 3.83, строка Core Model Registry
- [CHANGELOG.md](../../CHANGELOG.md) — полная запись v3.83.0

**Финальная валидация (Правило 5 WORKFLOW):**
- `grep` по legacy символам (`myProvider`, `claudeHaiku/Sonnet/Opus`, `minimaxM27*`, `getClaudeModel`, `MODEL_CONTEXT_WINDOW`, `RegistryLanguageModel`, env-overrides) → **0 матчей в runtime коде**. Оставшиеся вхождения — исторические комментарии в `task-reviewer.ts` / `plan/route.ts` (breadcrumbs `// ТЗ-1: was process.env.PROFESSOR_MODEL`) + исторические docs/decisions/* + CHANGELOG.md. Всё корректно.
- `npx tsc --noEmit` → 0 ошибок
- `npm run build` → exit 0 (чистый rebuild после `rm -rf .next`)
- SQL: `ai_usage_log.provider` colum + все активные провайдеры пишутся (anthropic/minimax/voyage/deepgram/perplexity/google), backfill отработал на 288 исторических записях.

---

## Вне scope ТЗ-1 — список багов для следующих ТЗ

Полный перечень техдолга, собранный в ходе работы, пользователь сохранил в своём трекере. Главные пункты:

1. **UUID-галлюцинация MiniMax** в tool calls между `createDocument` → `updateDocument` (Zod validation at boundaries — решение)
2. **`_error` глотается в 6 местах вне queries.ts** (components/multimodal-input.tsx, artifact-actions.tsx, task chat route, non-throwing catches в queries.ts)
3. **Dead retry branch** в `script-generator.ts:149-154`
4. **Stale комментарий "M2-Her"** в `script-generator.ts:1`
5. **Hardcoded Voyage pricing** в `extract.ts:517` — вынести в catalog
6. **`retryWithLogging` не передаёт `provider`** — полагается на `inferProviderFromModelId` fallback

---

## Готовность к ТЗ-2 (User Overrides)

Сигнатура `getModel(taskId, context?: GetModelContext)` стабильна. `GetModelContext` уже принимает `{ userId?, requestCookies? }`, `lookupOverride()` — stub возвращает `null`. В ТЗ-2 потребуется только активировать `lookupOverride` без правок call-sites.

Плановый источник overrides:
1. Dev cookie `x-model-overrides` (игнорируется в production)
2. User-level overrides в БД (через `context.userId`)
3. localStorage на клиенте (применяется до вызова API)

---

## Блокеры / Вопросы

Нет. ТЗ закрыто.
