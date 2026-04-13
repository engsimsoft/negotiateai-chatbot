# Session Handoff — 2026-04-14

> Передача смены между сессиями Claude Code на проекте Simply.
> Читать с холодного старта, перед любым действием.
> Этот файл перезаписывается каждую сессию — если видишь его существующим и
> датой отличающейся от текущей, значит предыдущая сессия оставила состояние,
> которое нужно разобрать ДО старта новой работы.

---

## ⚡ TL;DR

**Версия после сессии:** 3.87.3
**Ветка:** `feature/simply-kitt`
**Статус:** 2 ТЗ закрыты за сессию + git hygiene, working tree clean, НЕ запушено, dev-сервер остановлен
**Session predecessor:** 2026-04-13 (v3.86.1 → v3.87.1, 3 ТЗ)

**Критичное для следующей сессии:**
1. `git push` НЕ сделан — **5 релизных коммитов + 3 новых tag** (v3.87.1, v3.87.2, v3.87.3) ждут push по команде владельца
2. Dev-сервер остановлен, не требует действий
3. Backlog сжался до **1 medium + 1 low** — см. блок «Backlog»
4. Auto-memory пополнена новым lesson про `npm run build` auto-migrations — см. `feedback_build_pipeline_auto_migration.md`

---

## Что сделано в этой сессии (2 ТЗ + инфра)

### Pre-work: git hygiene (commits 709041d, 004c520, 52e0c14)

Пользователь попросил очистить untracked файлы и настроить git для возможности отката. Сделано тремя отдельными коммитами:
- `709041d chore(gitignore)` — .claude/, .vscode/, .mcp.json в .gitignore, .DS_Store untracked
- `004c520 docs(archive)` — перенос 2 закрытых ТЗ (BriefingAuthorMinimax, MinimaxCleanup) в _archive
- `52e0c14 docs(specs)` — фиксация замороженных ТЗ (MindArtifacts, SaveFactV2 — gate на Grok) + concept файлы

### ТЗ-StreamObservability (v3.87.2 — commit 28f28fb)

Finding #5 из TZ_LegacyChatCleanup. Два стейджа работы:

**Stage 1 — Server observability:**
- `onError` в обоих chat routes (`app/(chat)/api/chat/route.ts`, `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts`) заменён с `() => "Oops, an error occurred!"` на полноценный handler: `console.error` + `emitDebugError` через closure-captured `UIMessageStreamWriter` + локализованная строка «Произошла ошибка при генерации ответа. Попробуйте повторить.»
- Closure capture паттерн: `let dataStreamRef: UIMessageStreamWriter | null = null` перед `createUIMessageStream`, `dataStreamRef = dataStream` первой строкой в `execute`
- Task expert route: добавлен `emitDebugError` в существующий import block

**Stage 2b — Recovery UX (расширенный скоуп после smoke test'а):**
- Владелец указал на UX баг: после ошибки useChat переходит в status `"error"`, а `MultimodalInput.onSubmit` блокировал всё что `!== "ready"` → пользователь застревал до reload страницы
- AI SDK v6 docs: `clearError()` — отдельный обязательный метод, не очищается через `sendMessage`
- `clearError` прокинут из `useChat` через `chat.tsx` и `task-chat.tsx` в `MultimodalInput` как новый prop
- Submit guard переписан: block только на `submitted`/`streaming`, при `error` — `clearError?.()` + `submitForm()`
- `disabled` на voice + attachments buttons переведены с `status !== "ready"` на `status === "submitted" || status === "streaming"` — в error state UI полностью интерактивен

**Smoke tests (оба user-confirmed):**
1. Temporary throw → server logs + Session Errors popup + localized UI string
2. Throw повторён → отправка двух сообщений без reload → обе улетели, никакой блокировки

### ТЗ-CreateSnapshotAudit (v3.87.3 — commit b5d48fd)

Finding #8 из TZ_LegacyChatCleanup. Полное удаление мёртвой фичи createSnapshot + ADR 052.

**SQL audit:**
```
2 all-time calls createSnapshot (оба через Sonnet «Думать», 2026-04-08)
0 calls из project task expert (ожидавшегося context)
1 из 2 failed (JSON parse error at position 328)
Chat.snapshots: 1 запись на 11 чатов
Chat.contextState: 0 записей
```

**Multi-provider resilience discussion:**
Владелец (обосновано) поднял вопрос: «MiniMax главный, RAG 70%, архитектура multi-provider, как мы будем сжимать контекст если завтра провайдер сменится без Compaction?». Это был важный архитектурный concern. Ответ: createSnapshot не был правильным решением (0 calls из MiniMax), правильное — server-side compression middleware как паттерн в будущем. Компромисс: delete + ADR с планом L4.

**Что удалено:**
- 4 файла: `create-snapshot.ts`, `snapshot-creator.ts`, `snapshot-creator.md`, `snapshot-card.tsx`
- 4 DB queries: `addChatSnapshot`, `resetChatContextState`, `getChatWithSnapshotState`, `updateChatContextState`
- 2 schema columns: `Chat.snapshots`, `Chat.contextState` (migration 0054)
- Dead references в 10+ файлах (routes, 3 UI компонента, chat-tools, debug-events, dev-panel, task-chat, page.tsx, 4 docs)

**Что добавлено:**
- `docs/decisions/052-context-management-strategy-per-provider.md` — ADR с 4-уровневой стратегией (L1 Extract-on-compression, L2 Anthropic Compaction, L3 Sliding window 180K, L4 Server-side middleware planned). Таблица защит × провайдеров. Паттерн реализации L4 когда/если понадобится (образец — `meeting-pipeline.ts`).
- Migration `0054_drop-snapshot-columns.sql` — применён к Neon (SQL verified)

**Smoke test:** user-confirmed «после перезагрузки страницы сообщения ушло» (первоначальная ошибка — Neon transient flake на page load, не связана с изменениями).

---

## Git state

### Last 10 commits
```
b5d48fd release(v3.87.3): ТЗ-CreateSnapshotAudit — delete dead createSnapshot + ADR 052
28f28fb release(v3.87.2): ТЗ-StreamObservability — observable stream errors + recovery UX
52e0c14 docs(specs): зафиксировать замороженные ТЗ + вспомогательные материалы
004c520 docs(archive): перенос закрытых ТЗ BriefingAuthorMinimax + MinimaxCleanup в _archive
709041d chore(gitignore): untrack .DS_Store + ignore local IDE/tooling config
ff3b22d docs(handoff): сессия 2026-04-13 — 3 релиза закрыты, передача смены
435e917 release(v3.87.1): ТЗ-OpenRouterCostTracking — walk-back suffix-tolerant getModelEntry
2c8aeae release(v3.87.0): финализация ТЗ-CachePipelineMetrics + ADR 051 + _archive
98727c1 refactor(tz-cachepipe): откат cache breakpoints в briefing
6c8dbf6 release(v3.86.1): ТЗ-UnfreezePipelines
```

### Tags (recovery points — новейшие первыми)
- `v3.87.3` → `b5d48fd` — CreateSnapshotAudit (если что-то сломает следующий ТЗ, сюда безопасно откатить)
- `v3.87.2` → `28f28fb` — StreamObservability
- `v3.87.1` → `435e917` — OpenRouterCostTracking (предыдущая сессия)
- `v3.87.0` → `2c8aeae` — CachePipelineMetrics
- `v3.86.1` → `6c8dbf6` — UnfreezePipelines

### Working tree state
```
git status → clean
git status --short → пустой вывод
```

**Единственное что не stage'нуто:** `.DS_Store` иногда появляется из Finder, в .gitignore но может показываться в git status как untracked на некоторых macOS окружениях. Игнорировать.

### NOT pushed

Последний push был до сессии **2026-04-13** (предыдущей сессии). **Сейчас ждут push:**
```bash
# По команде владельца:
git push origin feature/simply-kitt
git push origin v3.87.1 v3.87.2 v3.87.3
```

**Всего 11 коммитов + 3 новых tags не в remote.** Хронология:
- 2026-04-13 сессия: v3.86.1 (UnfreezePipelines) → v3.87.0 (CachePipelineMetrics) → v3.87.1 (OpenRouterCostTracking) + handoff commit
- 2026-04-14 сессия (текущая): 3 хозяйственных коммита + v3.87.2 (StreamObservability) + v3.87.3 (CreateSnapshotAudit)

**НЕ пушить без явного запроса владельца.**

---

## Фоновые процессы

### Dev-сервер
- **Остановлен.** Task `b0zfv2lvc` завершён при закрытии сессии.
- Если нужно в новой сессии: `npm run dev` (port 3000). Проверить что `b0zfv2lvc` не жив через `/tasks` — если жив, TaskStop.

### Мониторы / background tasks
- Никаких живых фоновых процессов.

---

## Backlog ТЗ (сжался за сессию)

Проверено в `specs/_backlog/README.md`. **2 открытых долга** (было 4 в начале сессии):

| ТЗ | Impact | Оценка | Приоритет |
|---|---|---|---|
| **TZ_DeadModelSelectors** | medium | 1-2 сессии | **Next (рекомендую)** — крупнейший оставшийся долг, `lib/ai/models.ts` + 5 dead импортёров, покрывает Findings #4, #6, #7 |
| **TZ_GrokContextWindowAudit** | low | 0.5 сессии | Опционально — эмпирический binary search xAI API для реального контекста Grok 4.20 (каталог: 256K, docs.x.ai: 2M) |

**Закрытые за сессию:**
- TZ_StreamObservability (v3.87.2)
- TZ_CreateSnapshotAudit (v3.87.3)

**Рекомендация следующей сессии:** `TZ_DeadModelSelectors` — пока свежая память о том как чистили `createSnapshot` (похожий multi-file cleanup паттерн), можно переиспользовать подход. Plan: SQL check если нужен, read SPEC, dependency-ordered deletion (components → routes → registry → files), migration если есть schema changes, smoke test.

---

## Известные проблемы / watchouts

### 1. NeonDB transient flake (повторяется из прошлой сессии)

Как и 2026-04-13, сегодня снова ловил `TypeError: fetch failed` / `UND_ERR_SOCKET` при первом обращении к Neon после auto-suspend. Лечится reload страницы. Не код — особенность Neon serverless.

**Митигация:** подождать 5 секунд, повторить запрос. Если долго — проверить VPN (финский блокирует Voyage 403, переключить на US).

### 2. Drizzle meta history broken

`lib/db/migrations/meta/` имеет **pre-existing gap 0029-0053** (нет snapshot.json для этих migrations). Это означает что `npm run db:generate` в normal mode попадает на interactive TTY prompt и падает в non-interactive терминалах.

**Workaround:** `npx drizzle-kit generate --custom --name <name>` → создаёт пустой `.sql` файл, ты заполняешь SQL вручную. Используется pattern предыдущих manual migrations типа `0053_ai_usage_log_provider.sql`.

**Backlog candidate:** восстановить meta history когда будет время (не срочно — миграции применяются через `migrate()` API который читает journal + .sql файлы, meta snapshots не задействованы).

### 3. OpenRouter version suffix (из предыдущей сессии)

OpenRouter pin'ит `response.modelId` с dated snapshot suffix (`qwen/qwen3.6-plus-04-02`). Catalog lookup в `getModelEntry` стал tolerant через walk-back loop (v3.87.1). Если появляется новый провайдер с экзотическим modelId форматом — **сначала empirical log**, потом pattern-matching fix.

### 4. `npm run build` auto-runs migrations ⚠️ (новый lesson этой сессии)

**ВАЖНО:** в `package.json`:
```json
"build": "tsx lib/db/migrate && next build"
```

Любая команда `npm run build` **автоматически применяет все pending migrations к production Neon DB** перед Next.js build. Это настроено для Vercel deploy, но применяется и локально.

**Инцидент сегодня (не катастрофа, но lesson):** Я обещал владельцу ждать явного разрешения перед применением миграции `0054_drop-snapshot-columns.sql` (drop 2 JSONB columns), потом запустил `npm run build` для «обычной валидации». Pipeline автоматически применил миграцию до получения OK. Данные были не нужны, владелец был спокоен, но **протокольное обещание нарушено**.

**Правило на будущее:** перед ЛЮБЫМ `npm run build` при наличии pending `lib/db/migrations/*.sql` — **явно сказать владельцу** «сейчас запускаю build, он сначала накатит миграцию X». Если только tsc нужен — использовать `npx tsc --noEmit` отдельно, он DB не трогает.

Memory: `feedback_build_pipeline_auto_migration.md`

---

## Критичные lessons learned за сессию

### 1. Расширение скоупа ТЗ в рантайме оправдано когда blocks оригинальную цель

**Контекст:** в ТЗ-StreamObservability исходный SPEC просил только server-side logging. Smoke test показал UX баг (useChat застревает в error state). Без его фикса observability была бесполезна — пользователь видел ошибку в DevPanel, но не мог продолжить работу без reload.

**Rule:** если обнаружен блокер **цели** исходного ТЗ — расширить скоуп в том же ТЗ (добавить Stage 2b), а не откладывать в follow-up. Владелец прямо сказал «без этого UX бесполезен» — это был сигнал что ТЗ не закрыт.

### 2. SQL audit > theoretical reasoning для dead code detection

**Контекст:** в ТЗ-CreateSnapshotAudit SPEC предполагал что tool может быть «жив в project task expert». SQL показал обратное — **0 calls** за всю историю из project context, 2 из Simply Chat через Sonnet. Без эмпирических данных мы бы сохранили feature «на всякий случай» или потратили время на документирование несуществующего use case.

**Rule:** **любое cleanup решение где возможен SQL audit — начинать с SQL audit**, не с кода. 5 минут SQL экономят часы неправильных предположений.

### 3. Multi-provider resilience — валидная концерна, но решение должно быть on-demand

**Контекст:** владелец правильно спросил «а что если завтра провайдер без Compaction?». Первая тенденция — «оставить feature на всякий случай». Это было бы неправильно, потому что feature не работала даже для сегодняшних провайдеров (0 calls из MiniMax).

**Rule:** **insurance-code без доказанной работоспособности = мёртвый вес.** Правильный ответ — ADR с планом что делать когда понадобится. В нашем случае: L4 server-side compression middleware, паттерн из `meeting-pipeline.ts`, реализуем **on-demand**, не **upfront**.

### 4. Dependency-ordered deletion минимизирует tsc cascades

**Контекст:** в TZ-CreateSnapshotAudit 6 stages в порядке: routes → UI components → chat-tools → file deletions → queries → schema. После каждого stage — `tsc --noEmit`. Только stage 5-6 требовали «сквозных» фиксов (удаление типов в schema cascade'нул через queries), что ожидаемо.

**Rule:** при многофайловом удалении — **удалять call-sites ДО определений**. Тогда на каждом промежуточном tsc нет orphan references, и цикл validation сжимается.

### 5. `npm run build` — это deployment action, не validation

См. выше блок про auto-migrations. Memory: `feedback_build_pipeline_auto_migration.md`.

---

## Пользователь — контекст

- **Vladimir (Владимир Анатольевич)** — владелец продукта, **НЕ программист**
- Объяснять технические вещи простыми словами, без жаргона. Если нужно — таблицы и примеры
- Принимать архитектурные решения **с ним**, не за него
- Давать рекомендации как senior dev, но финальное слово — его
- Не делать заплатки, предпочитать cardinal решения даже если дольше
- Не ставить `[x]` в ROADMAP без `npx tsc --noEmit`
- Не переходить к следующему этапу без мануального теста от него
- **Hard-to-reverse действия** (DB migrations, push, deploy, `rm -rf`) требуют **явного предварительного разрешения**, даже если скрыты внутри «обычных» команд типа `npm run build`

---

## Что СРАЗУ делать в следующей сессии

1. **Прочитать этот файл полностью** (ты уже читаешь — good)
2. `git status` + `git log --oneline -10` + `git tag -l | tail -5` — синхронизация состояния
3. Решить с владельцем:
   - Push предыдущих изменений? (`git push origin feature/simply-kitt --tags`) — **НЕ делать без явного OK**
   - Следующее ТЗ? Рекомендация: `TZ_DeadModelSelectors`
4. Если владелец выбрал ТЗ — следовать WORKFLOW.md:
   - Правило 1: официальная документация ДО любого кода
   - Правило 8: FINDINGS в файл
   - Dependency-ordered deletion pattern (если это снова cleanup ТЗ)
5. **Если планируется `npm run build` с pending migration** — явно предупредить владельца ДО запуска

---

## Файлы для чтения в новой сессии (в порядке приоритета)

1. **Этот файл** (SESSION_HANDOFF.md) — свежий handoff 2026-04-14
2. **`CLAUDE.md`** — обновлён версией 3.87.3, список Завершены содержит CreateSnapshotAudit и StreamObservability первыми
3. **`SIMPLY_STATUS.md`** — версия 3.87.3, свежие секции ТЗ-CreateSnapshotAudit и ТЗ-StreamObservability
4. **`CHANGELOG.md`** — полные разделы `[3.87.3]` и `[3.87.2]`
5. **`specs/_backlog/README.md`** — 2 открытых долга (TZ_DeadModelSelectors + TZ_GrokContextWindowAudit) + закрытые за сессию
6. **`docs/decisions/052-context-management-strategy-per-provider.md`** — свежий ADR с 4-уровневой стратегией context management (важно если следующий ТЗ трогает context/memory)

**Не читать:** `_archive/TZ_CreateSnapshotAudit/`, `_archive/TZ_StreamObservability/` — детали в CHANGELOG и SIMPLY_STATUS достаточно.

---

## Final state check

```bash
cd "/Users/mactm/Projects/NegotiateAI Chatbot"
git log --oneline -6
git tag -l | tail -6
git status --short  # должно быть пусто
```

**Всё зелёное:**
- ✅ tsc 0 ошибок (верифицировано после каждой правки)
- ✅ build exit 0 (верифицировано в финале каждого ТЗ)
- ✅ SQL verify migration 0054 применена (Chat.snapshots и Chat.contextState отсутствуют)
- ✅ Smoke tests (4 прохода) — все user-confirmed
- ✅ Working tree clean
- ✅ 5 релизных коммитов, 3 новых tags, 2 архивированных ТЗ
- ✅ Backlog сжался до 1 medium + 1 low
- ✅ Memory пополнена 1 новым lesson

---

**Создано:** 2026-04-14
**Автор:** Claude Opus 4.6
**Причина создания:** плановое закрытие сессии после 2 закрытых ТЗ + git hygiene prework, предотвращение fatigue-induced ошибок в продолжении
