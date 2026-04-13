# Changelog ТЗ_UnfreezePipelines

> Локальный changelog ТЗ.

---

## Сессия 0 — 2026-04-13 (создание ТЗ)

### Создано
- `SPEC.md` — постановка задачи, scope, ограничения, критерий готовности
- `ROADMAP.md` — 4 этапа (Pre-flight, Аудит, Применение решений, Валидация + Финализация)
- `ANALYSIS.md` — природа проблемы, подход к классификации, альтернативы, FAQ
- `HANDOFF.md` — мост для следующей сессии

### Контекст создания
- ТЗ-CacheAudit (v3.85.0) завершён. Обнаружил блокер: 12 uncommitted файлов от замороженных TZ_MindArtifacts/TZ_SaveFactV2 блокируют любую работу над pipeline-кодом
- Кэширование MiniMax в pipelines не реализовано (см. ANALYSIS_MIND_ARTIFACTS_SAVEFACT.md раздел 9)
- Решение владельца — создать дисциплинарный ТЗ для очистки working tree перед началом TZ_CachePipelineMetrics
- Senior dev recommendation (Вариант А) — аудит + классификация + commit/stash/rollback

---

## Сессия 1 — 2026-04-13 (выполнение)

### Этап 0: Pre-flight ✅

Baseline snapshot после `a65e4b0 docs(workflow): правило 9 — backlog долгов`:

- **13 modified** (SPEC ожидал 15): отсутствуют уже чистые `lib/db/queries.ts`, `lib/briefing/research-engine.ts`, `components/multimodal-input.tsx`
- **2 untracked в scope**: `lib/db/migrations/0051_memory-metadata.sql`, `scripts/debug-orphan-tool-use.ts`
- **6 deletions**: `specs/TZ_SlidingWindow/*` — папка удалена без commit, без переноса в `_archive/`. Проверено: в `_archive/` копии нет
- **Stashes**: пусто
- **TS**: 0 ошибок (clean baseline)

### Этап 1: Аудит и классификация ✅

Пересмотрено 13 modified + 2 untracked + 6 deletions. Таблица решений:

| Файл | Категория | Решение | Обоснование |
|---|---|---|---|
| `lib/ai/memory/types.ts` | (a) Infra | COMMIT | TaskMetadata/CalendarMetadata/FactMetadata + metadata на NewMemoryEntry. SaveFactV2 infra, самодостаточна |
| `lib/ai/memory/voyage-client.ts` | (a) Infra | COMMIT | VOYAGE_PRICING_USD_PER_MTOK + calcVoyageCostUsd() — убирает хардкод $0.06, pricing SSOT |
| `lib/ai/memory/extract.ts` | (a) Infra | COMMIT | Использует calcVoyageCostUsd(). Кластер с voyage-client.ts |
| `lib/ai/retry-with-logging.ts` | (a) Infra | COMMIT | Required `provider` field для ai_usage_log. Кластер с 3 briefing-файлами |
| `lib/briefing/briefing-author.ts` | (a) Infra | COMMIT | Передаёт provider: getProviderForTask(...). Зависит от retry-with-logging |
| `lib/briefing/briefing-filter.ts` | (a) Infra | COMMIT | То же |
| `lib/briefing/briefing-section-author.ts` | (a) Infra | COMMIT | То же |
| `lib/ai/tools/update-document.ts` | (a) Infra | COMMIT | z.uuid() валидация id + внятная ошибка — фикс галлюцинаций UUID моделью, self-contained |
| `components/artifact-actions.tsx` | (a) Infra | COMMIT | console.error при fail action (observability) |
| `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` | (a) Infra | COMMIT | Улучшение error handling parseBody — foreign hunk из ТЗ-CacheAudit, нейтрально |
| `lib/db/migrations/0051_memory-metadata.sql` | (a) Infra | COMMIT | ALTER TABLE memory_entry ADD COLUMN metadata JSONB (SaveFactV2 infra) |
| `lib/podcast/index.ts` | (b) Orphaned | ROLLBACK | +124 chunking. **Комментарий содержит ошибочный диагноз** — proclaiming "Gemini 32K budget". Владелец подтвердил: socket drop был у **MiniMax TTS**, ушли на Gemini именно из-за этого. Фикс написан под несуществующую проблему Gemini → не нужен |
| `lib/podcast/script-generator.ts` | (b) Orphaned | ROLLBACK | Удаление MIN_SCRIPT_LINES retry loop + перенос константы. Делалось под старую нестабильную интеграцию MiniMax (до перехода на Anthropic-compat). Текущая интеграция стабильна — страховку восстанавливаем |
| `scripts/debug-orphan-tool-use.ts` | — | LEAVE untracked | Dev-скрипт одноразового расследования, разрешено SPEC'ом |
| `specs/TZ_SlidingWindow/*` (6 файлов) | (a) Process fix | RESTORE + ARCHIVE | ТЗ v3.76.0 завершено, но папка удалена мимо процесса. Восстанавливаем через `git checkout` → переносим в `_archive/` через `git mv` |

### Этап 2: Применение решений ✅

#### Rollback (категория b)

```bash
git checkout -- lib/podcast/index.ts lib/podcast/script-generator.ts
```

Обоснование владельца: (index.ts) комментарий про Gemini 32K был ошибочным диагнозом — реальный socket drop был у MiniMax TTS, перешли на Gemini для решения; (script-generator) MIN_SCRIPT_LINES removal делалось на старой интеграции MiniMax, сейчас она стабильна.

#### Commit кластер (категория a) — `803102e`

```
chore(tz-unfreeze): infrastructure prep — metadata types, voyage pricing, provider field, error handling
```

11 файлов, +96/-10. Инфраструктурный кластер для frozen ТЗ без их разморозки.

#### Коммит архивации SlidingWindow — `47f84c4`

```
chore(tz-unfreeze): archive TZ_SlidingWindow (v3.76.0) в _archive/
```

Восстановлены 6 файлов через `git checkout`, перенесены в `_archive/TZ_SlidingWindow/` через `git mv`.

#### Stashes

Нет. Рассматривали (podcast файлы) — оба отклонены в пользу ROLLBACK после анализа с владельцем.

### Этап 3: Валидация чистоты

- [x] TS clean после rollback: `npx tsc --noEmit` — 0 ошибок
- [ ] Build clean — запущен, ожидание
- [x] ANALYSIS_MIND_ARTIFACTS_SAVEFACT.md раздел 9 — отметка «Блокер СНЯТ ТЗ-UnfreezePipelines 2026-04-13»
- [x] Working tree: только разрешённые untracked (.claude/, .mcp.json, .vscode/, _archive/TZ_BriefingAuthorMinimax/, _archive/TZ_MinimaxCleanup/, scripts/debug-orphan-tool-use.ts, specs/TZ_MindArtifacts/, specs/TZ_SaveFactV2/, concept file)

### Этап 4: Финализация

[в процессе]

- [ ] Главный CHANGELOG.md [3.85.1]
- [ ] SIMPLY_STATUS.md — короткая запись
- [ ] package.json 3.85.0 → 3.85.1
- [ ] Слияние backlog/TZ_UsageLoggingCoverage → TZ_CachePipelineMetrics (решение владельца)
- [ ] Мануальный smoke test
- [ ] `git mv specs/TZ_UnfreezePipelines _archive/TZ_UnfreezePipelines`
- [ ] Финальный release commit

### Финальная сводка

- Всего файлов аудитировано: **21** (13 modified + 2 untracked + 6 deletions)
- Категория (a) Commit: **11** файлов (один кластер `803102e`) + SlidingWindow archive move (`47f84c4`)
- Категория (b) Rollback: **2** файла (podcast/index.ts, podcast/script-generator.ts)
- Категория (c) Stash: **0** (рассмотрены, все переклассифицированы в rollback после владельческого review)
- LEAVE untracked: **1** (scripts/debug-orphan-tool-use.ts)
- Создано stashes: **0**
- Коммитов: **2** + финальный release
