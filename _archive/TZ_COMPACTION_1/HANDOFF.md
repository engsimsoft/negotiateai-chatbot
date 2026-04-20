# Передача сессии ТЗ-COMPACTION-1

**Дата:** 2026-04-19
**Сессия:** 2 (Фаза 3 — Разработка: Этапы A1-A5 завершены, A6 UI готов, ждёт build + smoke test)

---

## Статус этапов

- [x] Фаза 1 — Анализ (сессия 1, 2026-04-18)
- [x] Фаза 2 — Планирование — ROADMAP + ARCHITECT_ANSWERS (сессия 1)
- [x] Этап A1: SSOT — taskId + 4 константы
- [x] Этап A2: `getCompactionStrategy` + тип `CompactionStrategy`
- [x] Этап A3: БД миграция — 3 колонки в Chat + SQL файл 0056 + journal entry
- [x] Этап A4: Middleware `lib/ai/compaction/` — 6 файлов (types, prompt, summarize, db-queries, prepare-messages, events)
- [x] Этап A5: Интеграция в `app/(chat)/api/chat/route.ts` (4 правки: imports, `effectiveModelId`, `supportsCompaction` rewrite, middleware gate)
- [x] Этап A6 UI: виджет `CompactionIndicator` в `context.tsx` с mode-aware терминологией
- [ ] **Этап A6 validation: `npm run build` + smoke test + git commit — ЖДЁТ СЛЕДУЮЩЕЙ СЕССИИ**
- [ ] Этап B1: расширение gate на `create` (одна строка + smoke test)
- [ ] Финализация: CHANGELOG, SIMPLY_STATUS, package.json 3.93.0 → 3.94.0, ADR 053 расширение, docs sync, архивация папки

---

## Следующая сессия: начни с

1. **Перечитать:**
   - [ROADMAP.md](./ROADMAP.md) §Этап A6 (validation задачи) и §Этап B1.
   - [FINDINGS.md](./FINDINGS.md) — 4 находки, две открыты (Finding #1 deprecated `generateObject` → backlog, Finding #4 закрыт в A4).
   - `git status` → увидишь 13 modified + 4 untracked файла (список ниже).

2. **Получить подтверждение владельца на `npm run build`** (правило 5 CLAUDE.md — ⛔ авто-миграция). Текст вопроса:
   > «Этап A6, сейчас запустим `npm run build` — накатится миграция Chat (3 новых колонки `compactionSummary/Index/Count`). Hard-to-reverse action. ОК?»

3. **После подтверждения:**
   ```bash
   npm run build
   ```
   Ожидаемо: `⏳ Running migrations... ✅ Migrations completed` + успешная сборка Next.

4. **SQL-верификация миграции** через `mcp__postgres__query`:
   ```sql
   SELECT column_name, data_type, is_nullable, column_default
   FROM information_schema.columns
   WHERE table_name = 'Chat' AND column_name LIKE 'compaction%';
   ```
   Ожидаемо: 3 строки — `compactionSummary` (text, YES, null), `compactionIndex` (integer, YES, null), `compactionCount` (integer, NO, 0).

5. **Запросить мануальный smoke test у владельца** — подробный сценарий в ROADMAP §A6 «Задачи (🧪 Мануальный тест)». Критически:
   - **Expertise** с крупным PDF (20K+ токенов), 15+ сообщений → наблюдать compaction при usage ≥100K, проверить `CompactionIndicator` появляется в popover виджета, SQL-проверка `Chat.compactionCount >= 1`.
   - **Регрессия Simply Chat vision** (Haiku) — загрузить картинку, Haiku отвечает как раньше (Simply Compaction gate на expertise — не задевает simply).
   - **Регрессия project:expert:* (важно!)** — см. Finding #3: удалена заплатка `|| isProjectChat`. Проверить на всех 3 tier'ах:
     - `project:expert:opus` → Anthropic Compaction API работает (как раньше).
     - `project:expert:sonnet` → Anthropic Compaction API работает (как раньше).
     - `project:expert:haiku` → **больше НЕ получает** Anthropic compactionOptions (корректно — Haiku не умеет Compaction API архитектурно). Чат должен продолжать работать через sliding window truncation (getMessagesByChatId maxTokens=140K). Это не регрессия, это фикс бага; проверить что Haiku не падает.
   - **MIND extract пост-compaction** — в expertise после сжатия проверить SQL `memory_entry` свежие записи (expertise не использует MIND, но тест гарантирует отсутствие регрессии).

6. **После подтверждения владельца** — git commit Этапа A:
   ```bash
   git add lib/ai/task-assignments.ts lib/ai/context-limits.ts lib/ai/model-catalog.ts \
           lib/ai/compaction/ lib/db/schema.ts lib/db/queries.ts \
           lib/db/migrations/0056_add-compaction-columns.sql lib/db/migrations/meta/_journal.json \
           lib/types.ts app/\(chat\)/api/chat/route.ts \
           components/elements/context.tsx components/multimodal-input.tsx \
           docs/design-system.md \
           specs/Simply_xAI/SIMPLY_COMPACTION_ARCHITECTURE.md \
           specs/TZ_COMPACTION_1/ specs/_backlog/TZ_UnifyContextThresholdBase.md \
           specs/_backlog/README.md
   git commit -m "feat(tz-compaction-1): Этап A — инфраструктура + pilot expertise"
   ```

7. **Этап B1** — расширение gate на `create` (одна строка в `chat/route.ts`). После ROADMAP: tsc, build, smoke test create, git commit Этапа B.

8. **Финализация** — см. ROADMAP §Финализация.

---

## Критические правила для следующей сессии

1. **⛔ Правило 5 CLAUDE.md** — `npm run build` = `tsx lib/db/migrate && next build` — авто-миграция. **Обязательно подтверждение владельца перед первым build.** Первый в этом ТЗ ещё не был.
2. **Правило 2 WORKFLOW** — после каждой задачи `npx tsc --noEmit` → 0 ошибок. Уже сейчас ✅.
3. **Правило 3 WORKFLOW** — после каждого этапа `npm run build` + мануальный тест + git commit + подтверждение.
4. **Терминология (жёстко, см. [project_mode_terminology.md](~/.claude/projects/-Users-mactm-Projects-NegotiateAI-Chatbot/memory/project_mode_terminology.md) + [docs/design-system.md §1.5](../../docs/design-system.md#15-терминология-режимов)):** в expertise/create/projects **НЕ употреблять «чат»**. expertise = «запрос», create = «задание», projects = «задача». Слово «чат» только для simply. Проверять в любых UI-строках этих режимов.
5. **Делегировать архитектору** — при архитектурных вопросах/deep research запрашивать у владельца передать архитектору (отдельная Opus-сессия). См. memory `feedback_delegate_to_architect.md`. В этой сессии это сохранило контекст на Finding #2.
6. **Propose, don't ask** — одно решение + обоснование, не бинарные вопросы.

---

## Архитектурные инварианты (не пересматриваются)

Из SPEC.md и архитектурного документа v1.10:

1. **Capability-driven compaction** — через `getCompactionStrategy(modelId)`, не chatMode/provider. Реализовано в A2 и интегрировано в A5.
2. **ADR 053 контракт** — `compaction:summarize` taskId имеет 4 аспекта: taskId + model (`grok-4-1-fast-non-reasoning`) + cap (4096) + call mode (generateObject). Реализовано в A1.
3. **Пороги:** Soft 50% (100K) / Hard 85% (170K) от `SIMPLY_CONTEXT_LIMIT = 200K`. Константы в `context-limits.ts`.
4. **Verbatim window:** 40K токенов, edge cases A (≤80K include whole) + B (>80K truncate top с маркером). Реализовано в `prepare-messages.ts:buildVerbatimWindow`.
5. **Summary:** target 3K / hard cap 4K, 5-секционный формат (Context/Materials/Decisions/Focus/OpenQuestions). Реализовано в `summarize.ts`.
6. **Модель:** `grok-4-1-fast-non-reasoning`, роль «подсобка».
7. **Scope MVP:** Этап A — expertise only (gate в `chat/route.ts:if (chatMode === "expertise")`). Этап B — расширение на create.
8. **Точка интеграции:** единый `app/(chat)/api/chat/route.ts`, middleware вызывается на `ChatMessage[]` **до** `convertToModelMessages` (Finding #4, разрешено в A4).
9. **Подсчёт токенов:** SSOT = `estimateMessageTokens` из `lib/utils.ts`. Формула идентична MIND extract trigger (chat/route.ts:787-793).
10. **DataStream events:** `data-compaction` (user-visible, без dev gating, через `emitCompactionEvent`) ≠ `data-debug-compaction` (dev-only, Anthropic iterations, через `emitDebugCompaction` из `debug-events.ts`). Два раздельных канала, решение архитектора 2026-04-19, Finding #2.

---

## Файлы изменены / созданы

### Созданы (7 файлов)
- `lib/ai/compaction/types.ts` (72 строки — `CompactionEvent`, `CompactionContext`, `PrepareMessagesResult`, re-export `CompactionStrategy`. БЕЗ `"server-only"` — типы также используются клиентом).
- `lib/ai/compaction/prompt.ts` (84) — `COMPACTION_SUMMARY_SYSTEM_PROMPT` + `buildCompactionUserPrompt` (rolling-update).
- `lib/ai/compaction/summarize.ts` (202) — `generateCompactionSummary` через `generateObject` + Zod 5-секций.
- `lib/ai/compaction/db-queries.ts` (92) — `get/saveCompactionState`, собственный Neon HTTP клиент.
- `lib/ai/compaction/prepare-messages.ts` (337) — основная middleware с verbatim window + edge cases.
- `lib/ai/compaction/events.ts` (40) — `emitCompactionEvent` для user-visible индикатора (решение архитектора Finding #2).
- `lib/db/migrations/0056_add-compaction-columns.sql` — миграция 3 колонок.

### Изменены (13 файлов)
- `lib/ai/task-assignments.ts` — `compaction:summarize` в TaskId union + DEFAULT_TASK_MODELS + DEFAULT_MAX_OUTPUT_TOKENS (A1).
- `lib/ai/context-limits.ts` — 4 константы `COMPACTION_THRESHOLD_SOFT/HARD/VERBATIM_WINDOW_TOKENS/SUMMARY_TARGET_TOKENS` (A1).
- `lib/ai/model-catalog.ts` — тип `CompactionStrategy` + функция `getCompactionStrategy` (A2).
- `lib/db/schema.ts` — 3 колонки в chat table (A3).
- `lib/db/migrations/meta/_journal.json` — idx:56 (A3, drizzle требует).
- `lib/db/queries.ts` — 3 поля в select `getChatsByUserId` (A3, tsc catch).
- `lib/types.ts` — `compaction: CompactionEvent` в `CustomUIDataTypes` (A6).
- `app/(chat)/api/chat/route.ts` — 4 правки в A5 (imports, effectiveModelId, supportsCompaction rewrite, middleware gate).
- `components/elements/context.tsx` — `CompactionIndicator` + `chatMode` prop + useDataStream подписка (A6).
- `components/multimodal-input.tsx` — `chatMode={chatMode}` прокинут в `<Context>` (A6).
- `docs/design-system.md` — §1.5 Терминология режимов (A6, правка терминологии).
- `specs/Simply_xAI/SIMPLY_COMPACTION_ARCHITECTURE.md` — v1.8 → v1.10 (Finding #2 resolution + правка терминологии).
- `specs/_backlog/README.md` — backlog index.

### Документация ТЗ (папка специфа)
- `specs/TZ_COMPACTION_1/` — SPEC, ANALYSIS, ARCHITECT_ANSWERS, ROADMAP, FINDINGS, HANDOFF (этот файл), CHANGELOG.
- `specs/_backlog/TZ_UnifyContextThresholdBase.md` — открытый backlog-долг (не блокирует ТЗ).

### Memory (сохранено за сессию)
- `feedback_delegate_to_architect.md` — когда делегировать архитектору.
- `project_mode_terminology.md` — mode terminology (чат/запрос/задание/задача), Simply ≠ чатбот.

---

## Находки в FINDINGS.md

- **Finding #1** (Medium, backlog-ТЗ): `generateObject` @deprecated в AI SDK v6 — рекомендуется миграция на `generateText({ output: Output.object({ schema }) })` для всего кодбейса (MIND + Compaction). Отложено.
- **Finding #2** (High, блокер был) ✅ **закрыт архитектором 2026-04-19** — раздельные event channels `data-compaction` (user) vs `data-debug-compaction` (dev).
- **Finding #3** (Low) ✅ **закрыт в A5** — убрана заплатка `|| isProjectChat`. **Важно:** поведение Haiku в project chat изменилось (больше не получает Anthropic Compaction, корректно — Haiku архитектурно не умеет). Smoke test A6 должен это подтвердить.
- **Finding #4** (Medium) ✅ **закрыт в A4** — middleware работает на ChatMessage[] до `convertToModelMessages`, не на ModelMessage[] после.

---

## Блокеры / Вопросы

**Блокер сейчас:** `npm run build` требует явного подтверждения владельца перед запуском (автомиграция). После подтверждения — технических блокеров нет.

**Открытых вопросов к архитектору нет.** Все решения зафиксированы (ARCHITECT_ANSWERS Group 1-2 + Finding #2 resolution 2026-04-19).

---

## Если возникнут архитектурные вопросы

Не тратить свой контекст на deep research — сформулировать вопрос, передать владельцу для архитектора (отдельная Opus-сессия). См. memory `feedback_delegate_to_architect.md`. В этой сессии этот паттерн сработал для Finding #2: архитектор дал готовое решение без нагрузки на разработчика.

---

**Обновлено:** 2026-04-19 — закрытие сессии 2 после завершения A1-A5 + UI виджет A6. Технически всё готово к build; ждёт подтверждения владельца и его smoke test.
