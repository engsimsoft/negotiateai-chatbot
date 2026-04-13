# Session Handoff — 2026-04-13

> Передача смены между сессиями Claude Code на проекте Simply.
> Читать с холодного старта, перед любым действием.
> Этот файл перезаписывается каждую сессию — если видишь его существующим и
> датой отличающейся от текущей, значит предыдущая сессия оставила состояние,
> которое нужно разобрать ДО старта новой работы.

---

## ⚡ TL;DR

**Версия после сессии:** 3.87.1
**Ветка:** `feature/simply-kitt`
**Статус:** 3 ТЗ закрыты, working tree clean, НЕ запушено в remote, ждём решения пользователя

**Критичное для следующей сессии:**
1. `git push` НЕ сделан — спросить пользователя перед push
2. Dev-сервер **всё ещё крутится** в фоне (bash task `b9qydpvhs`, localhost:3000) — нужно либо остановить, либо использовать
3. 4 backlog ТЗ готовы к старту — пользователь выбирает приоритет

---

## Что сделано в этой сессии (3 релиза)

### v3.86.1 — ТЗ-UnfreezePipelines (дисциплинарная git hygiene)

- Аудит 21 uncommitted элемента от замороженных ТЗ
- 11 файлов infra prep → атомарный commit `803102e`
- 2 файла rollback (podcast WIP на ошибочном диагнозе)
- TZ_SlidingWindow v3.76.0 восстановлен и перенесён в `_archive/` (commit `47f84c4`)
- Закрыт gap LegacyChatCleanup (предыдущий ТЗ отметил себя v3.86.0 в SIMPLY_STATUS, но не бампал package.json)
- Слияние backlog/TZ_UsageLoggingCoverage → TZ_CachePipelineMetrics
- Release commit `6c8dbf6`

### v3.87.0 — ТЗ-CachePipelineMetrics (pipeline observability + targeted caching)

- Валидирован через SQL pipeline cache: podcast:script ~30% экономии на 2-м topic
- briefing cache **откачен** после empirical validation (daily frequency >> 5min TTL)
- 363 строки мёртвого Map-Reduce кода удалены из briefing-author
- Disjoint usage accumulator в podcast/script-generator (убран `as any` cast)
- `logUsage` в request-suggestions (был единственный непокрытый getModel() call-site)
- JSDoc над `ai_usage_log.inputTokens` с warning о gross semantics
- **ADR 051** — `docs/decisions/051-pipeline-observability-and-targeted-caching.md` с 3 lessons learned
- Release commit `2c8aeae`

### v3.87.1 — ТЗ-OpenRouterCostTracking (patch fix)

- Одно-файловый fix: `lib/ai/model-catalog.ts:getModelEntry()` теперь tolerant к versioned model IDs
- **Архитектурный pivot:** первоначальная гипотеза (namespace prefix `openrouter:...`) опровергнута empirical тестом. Реальная проблема — OpenRouter pins bare name → dated snapshot (`qwen/qwen3.6-plus-04-02`), catalog имел bare id → mismatch
- Walk-back loop: exact match первым, fallback стрипит trailing `-segment` до нахождения catalog match
- DevPanel показывает реальную цену для qwen/glm (было ₽0.00)
- SQL валидация: 2 qwen запроса с non-zero costUsd ($0.0051, $0.0063)
- Release commit `435e917`

---

## Git state

### Last 8 commits
```
435e917 release(v3.87.1): ТЗ-OpenRouterCostTracking walk-back suffix-tolerant getModelEntry
fd7e7ca docs(tz-openrouter): promote backlog → active TZ + ANALYSIS root cause found
2c8aeae release(v3.87.0): финализация ТЗ-CachePipelineMetrics + ADR 051 + _archive
98727c1 refactor(tz-cachepipe): откат cache breakpoints в briefing (architectural correction)
b00fe56 feat(tz-cachepipe): этапы 3+4 request-suggestions + JSDoc
eb13153 refactor(tz-cachepipe): этап 2 dead code + disjoint accumulator
6f1c238 feat(tz-cachepipe): этап 1 cache breakpoints (позже частично откачено)
c089842 docs(tz-cachepipe): сессия 1
```

### Tags (recovery points)
- `v3.87.1` → `435e917` — OpenRouter fix release
- `v3.87.0` → `2c8aeae` — Pipeline observability release (если что-то сломает следующий ТЗ, откат сюда)

### Working tree state (`git status`)
```
Modified only: .DS_Store (ignore)
Untracked (expected): .claude/, .mcp.json, .vscode/, _archive/TZ_BriefingAuthorMinimax/,
  _archive/TZ_MinimaxCleanup/, scripts/debug-orphan-tool-use.ts,
  specs/TZ_MindArtifacts/ (frozen),
  specs/TZ_SaveFactV2/ (frozen),
  specs/TZ_RAG_SimplyRAG/SIMPLY_ETERNAL_CHAT_CONCEPT.md (concept doc),
  "Техзадание /mcp-tools-integration-guide.md" (legacy doc с cyrillic)
```

**Ничего не требует внимания** в working tree — всё согласованные исключения.

### NOT pushed

Последний push был до этой сессии. **5 коммитов + 2 новых tags** ждут push:
```bash
# По команде пользователя:
git push origin feature/simply-kitt
git push origin v3.87.0 v3.87.1
```

**НЕ пушить без явного запроса пользователя.**

---

## Фоновые процессы

### Dev-сервер (bash task `b9qydpvhs`)

- `npm run dev` — **всё ещё запущен** на `localhost:3000`
- Output file: `/private/tmp/claude-501/-Users-mactm-Projects-NegotiateAI-Chatbot/ef2d02a0-4a45-47d1-bc70-dd54f2e15dd5/tasks/b9qydpvhs.output`
- Если НЕ нужен следующей сессии: `TaskStop task_id=b9qydpvhs`
- Если нужен: использовать как есть или перезапустить если возник vendor chunks issue (было 1 раз в этой сессии, лечилось `rm -rf .next && npm run dev`)

### Монитор b450a0jaz

Если ещё активен — можно остановить через TaskStop. Все релевантные события поймали, ничего не ждём.

---

## Backlog ТЗ (готовые к старту)

Проверено в `specs/_backlog/README.md`. 4 открытых долга:

| ТЗ | Impact | Оценка | Приоритет для следующей сессии |
|---|---|---|---|
| **TZ_DeadModelSelectors** | medium | 1-2 сессии | Рекомендую — самый крупный оставшийся backlog |
| **TZ_StreamObservability** | medium | 0.5 сессии | Быстрый win, observability |
| **TZ_CreateSnapshotAudit** | medium | 0.5 сессии | Может удалить весь createSnapshot tool если 0 использований |
| **TZ_GrokContextWindowAudit** | low | 0.5 сессии | Low priority, factual verification |

**Моя рекомендация следующей сессии:** TZ_StreamObservability (быстро, чисто) → TZ_CreateSnapshotAudit (быстро) → TZ_DeadModelSelectors (более крупно). Но выбор за пользователем.

---

## Известные проблемы / watchouts

### 1. NeonDB transient flake

В этой сессии NeonDB трижды давала `TypeError: fetch failed` во время запросов к dev. Auto-suspend wake-up неравномерный. Не моя проблема, известно в memory.

**Митигация если повторится:** подождать 30 секунд, повторить запрос. Иногда связано с VPN (memory note: финский VPN блокирует Voyage).

### 2. Next.js .next vendor chunks ENOENT

После моего Edit на `chat/route.ts` (Этап 0 ТЗ_OpenRouter, диагностический console.log) dev-сервер словил `ENOENT: .next/server/vendor-chunks/zod@3.25.76.js`. Лечится полностью:
```bash
TaskStop <dev_task_id>
rm -rf .next
npm run dev
```

Это не код — это Next.js dev-mode hot-reload flake. Знать и не бояться.

### 3. OpenRouter version suffix (lesson from this session)

OpenRouter возвращает `response.modelId` с dated snapshot suffix (`qwen/qwen3.6-plus-04-02`), а не bare name (`qwen/qwen3.6-plus`). Это поведение самого OpenRouter, не AI SDK. Наш catalog lookup теперь tolerant к этому (v3.87.1). Но:

**Если в будущем появится новый провайдер с нестандартным modelId форматом** — walk-back loop в `getModelEntry` должен покрыть большинство случаев. Если провайдер возвращает что-то совсем экзотическое — empirical log первым, только потом pattern-matching фикс.

### 4. MCP Postgres query tool

Использовался в этой сессии для диагностики `ai_usage_log`. Работает, доступ read-only. Пример queries в archived TZ CHANGELOGs.

---

## Критичные lessons learned (актуальны для любого ТЗ)

### 1. Empirical confirmation перед pattern-matching фиксом

**Контекст:** в ТЗ_OpenRouterCostTracking первоначальная гипотеза была "namespace prefix `openrouter:qwen/...`". ANALYSIS v1 был написан под эту гипотезу, ROADMAP готовил prefix-stripping фикс.

**Что сработало:** добавили 1 строку `console.log("[debug]", response?.modelId)` → empirical test → реальный формат оказался совершенно другим (version suffix, не prefix). Час работы над неправильным фиксом сэкономлен.

**Rule for future:** при любом mismatch в формате данных от внешнего провайдера — **сначала print actual value, потом pattern-match и fix**. 2-3 минуты pre-fix логирования спасают час plumbing неправильного решения.

### 2. Frequency audit перед cache optimization

**Контекст:** в ТЗ_CachePipelineMetrics первоначальный SPEC предлагал "расставить cache breakpoints во всех pipelines" как blanket optimization. В процессе empirical тестов оказалось что briefing cache **не имеет смысла** (daily frequency vs 5min Anthropic cache TTL). Откачен после архитектурного review.

**Rule for future:** cache optimization применять ТОЛЬКО там где есть доказанная frequency (N вызовов за сессию в пределах TTL). Гипотеза "кэш всегда хорош" — неверна.

### 3. SQL диагностика vs empirical log

Два разных tools для двух разных вопросов:
- **SQL** хорошо показывает **где ломается** (DB path vs DevPanel path, какие записи создаются, что в них)
- **Empirical log** нужен для **формата данных** (что именно приходит в поле X)

SQL + grep часто дают 80% диагностики. Последние 20% — empirical log.

### 4. Respectful rollback как normal часть процесса

**Контекст:** в этой сессии оба ТЗ (CachePipelineMetrics и OpenRouterCostTracking) потребовали rollback / pivot. В обоих случаях не было "провала" — был **правильный процесс**: гипотеза → данные → коррекция.

**Rule for future:** владелец (не программист) задал правильный вопрос про частоту кэширования — это был важный сигнал. Правильная реакция: переоценить и откатить если нужно. Rollback — не неудача.

---

## Пользователь — контекст

- **Vladimir (Владимир Анатольевич)** — владелец продукта, **НЕ программист**
- Объяснять технические вещи простыми словами, без жаргона. Если нужно — таблицы и примеры
- Принимать архитектурные решения **с ним**, не за него
- Давать рекомендации как senior dev, но финальное слово — его
- Не делать заплатки, предпочитать cardinal решения даже если дольше
- Не ставить `[x]` в ROADMAP без `npx tsc --noEmit`
- Не переходить к следующему этапу без мануального теста от него

---

## Что СРАЗУ делать в следующей сессии

1. **Прочитать этот файл полностью** (ты уже читаешь — good)
2. `git status` + `git log --oneline -10` + `git tag -l` — синхронизация состояния
3. Решить с пользователем:
   - Push предыдущих изменений? (`git push origin feature/simply-kitt --tags`)
   - Следующее ТЗ? (мои рекомендации выше)
   - Остановить dev-сервер если не нужен? (`TaskStop b9qydpvhs`)
4. Если пользователь выбрал ТЗ — следовать WORKFLOW.md (правило 1 — official docs first, правило 8 — FINDINGS в файл)

---

## Файлы для чтения в новой сессии (в порядке приоритета)

1. **Этот файл** (SESSION_HANDOFF.md)
2. **`CLAUDE.md`** — обновлён версией 3.87.1, список завершённых ТЗ свежий
3. **`SIMPLY_STATUS.md`** — обновлён секциями всех трёх ТЗ
4. **`CHANGELOG.md`** — свежий [3.87.1], [3.87.0], [3.86.1] разделы
5. **`specs/_backlog/README.md`** — открытые backlog items с приоритетами
6. **`docs/decisions/051-pipeline-observability-and-targeted-caching.md`** — свежий ADR с архитектурной честностью (для контекста cache strategy)

**Не читать:** `_archive/TZ_UnfreezePipelines/`, `_archive/TZ_CachePipelineMetrics/`, `_archive/TZ_OpenRouterCostTracking/` — детали в CHANGELOG и SIMPLY_STATUS достаточно.

---

## Final state check

```bash
cd "/Users/mactm/Projects/NegotiateAI Chatbot"
git log --oneline -5
git tag -l | tail -5
git status --short  # только .DS_Store + untracked dev configs
```

**Всё зелёное:**
- ✅ tsc 0 ошибок (верифицировано после каждой правки)
- ✅ build exit 0 (верифицировано 2-3 раза за сессию)
- ✅ Все тесты прошли (briefing, podcast, qwen, MiniMax, Grok) user-confirmed
- ✅ Working tree чистое
- ✅ 3 release commits, 2 tags, 3 архивированных ТЗ
- ✅ Backlog пополнен и актуализирован

---

**Создано:** 2026-04-13
**Автор:** Claude Opus 4.6
**Причина создания:** контекстное окно переполнилось, нужна chain-of-work через сессии
