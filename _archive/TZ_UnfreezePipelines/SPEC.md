# ТЗ-UnfreezePipelines: Дисциплинарный аудит uncommitted changes от замороженных ТЗ

**Версия ТЗ:** 1.0
**Дата:** 2026-04-13
**Автор:** Vladimir Sharandin (по рекомендации senior dev review)
**Тип:** Disciplinary git hygiene (НЕ feature work)
**Целевая версия:** 3.85.1 (patch — disciplinary cleanup, без новых фич)

---

## TL;DR

В рабочем дереве проекта **12 файлов** находятся в uncommitted состоянии от замороженных ТЗ_MindArtifacts и ТЗ_SaveFactV2. Эти uncommitted changes блокируют любую работу над pipeline-кодом — в первую очередь следующее ТЗ `TZ_CachePipelineMetrics`. Цель этого ТЗ — **аудит, классификация и приведение working tree в чистое состояние БЕЗ написания нового продуктового кода.**

---

## Цель

Привести working tree проекта в чистое состояние, чтобы:

1. Разблокировать работу над `TZ_CachePipelineMetrics` (cache breakpoints в pipelines)
2. Не потерять полезные правки от замороженных ТЗ
3. Не оставлять «висящий код» неделями (самый опасный вид технического долга)
4. Создать чистую базу для последующих рефакторингов pipeline-кода

---

## Требования

### Функциональные

1. **Аудит каждого uncommitted файла** — понять что конкретно изменено и зачем
2. **Классификация изменений** на 3 категории:
   - (a) **Infrastructure prep** — полезные нейтральные правки, безопасны для коммита независимо от разморозки замороженных ТЗ (новые типы, вспомогательные функции, миграции БД)
   - (b) **Orphaned WIP** — заброшенные/устаревшие правки, не нужны
   - (c) **Frozen TZ exploration** — содержательные WIP-наработки, которые ждут разморозки
3. **Приведение working tree в чистое состояние** через три действия:
   - Категория (a) → **commit** в feature branch (`chore(unfreeze): infra prep ...`)
   - Категория (b) → **rollback** через `git checkout <file>`
   - Категория (c) → **stash** в named stash (`git stash push -m "WIP: TZ_<name> ..."`)
4. **Документация решения** по каждому файлу в `CHANGELOG.md` локального ТЗ (что было, как классифицировано, что сделано)

### Нефункциональные

- **Никакого нового кода.** Только аудит, классификация, перемещение существующего
- **Никаких рефакторингов.** Если в файле смесь правки и рефакторинга — рефакторинг откатывается, правка сохраняется как есть
- **Никаких изменений семантики.** Если sumarized intent неясен — действие = stash, не commit и не rollback
- **Никакого `git add -A`.** Только явное стейджирование по путям

---

## Файлы в scope

### Modified (по `git status -M`)

| Файл | Изменений | Предполагаемая принадлежность |
|---|---|---|
| `lib/db/queries.ts` | +6 -6 | TZ_SaveFactV2 (memory queries) |
| `lib/ai/memory/extract.ts` | +2 -1 | TZ_MindArtifacts/SaveFactV2 |
| `lib/ai/memory/types.ts` | +21 | **Точно TZ_SaveFactV2** (TaskMetadata, CalendarMetadata, FactMetadata) |
| `lib/ai/memory/voyage-client.ts` | +15 | Неизвестно |
| `lib/ai/retry-with-logging.ts` | +9 -1 | Неизвестно |
| `lib/ai/tools/update-document.ts` | +8 -1 | Неизвестно |
| `lib/briefing/briefing-author.ts` | +15 -2 | Неизвестно (затрагивает pipeline) |
| `lib/briefing/briefing-section-author.ts` | +8 -1 | Неизвестно (pipeline) |
| `lib/briefing/briefing-filter.ts` | +8 -1 | Неизвестно (pipeline) |
| `lib/podcast/script-generator.ts` | +5 -16 | Неизвестно (pipeline) |
| `lib/podcast/index.ts` | **+124 -8** | **Большой блок — требует особого внимания** |
| `lib/briefing/research-engine.ts` | +1 +1 | Минимальные |
| `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` | +7 -2 | Error handling от другого ТЗ (часть уже видели в ТЗ-CacheAudit) |
| `components/artifact-actions.tsx` | TBD | Неизвестно |
| `components/multimodal-input.tsx` | TBD | Неизвестно |

### Untracked (по `git status`)

| Файл | Тип | Принадлежность |
|---|---|---|
| `lib/db/migrations/0051_memory-metadata.sql` | DB migration | **TZ_SaveFactV2 — точно категория (a)** |
| `scripts/debug-orphan-tool-use.ts` | Dev tool | Неизвестно |
| `specs/TZ_LegacyChatCleanup/` | New TZ folder | Не аудитировать — отдельная папка ТЗ |
| `specs/TZ_MindArtifacts/` | TZ folder | Не аудитировать — это сам frozen ТЗ |
| `specs/TZ_SaveFactV2/` | TZ folder | Не аудитировать — это сам frozen ТЗ |
| `specs/TZ_RAG_SimplyRAG/SIMPLY_ETERNAL_CHAT_CONCEPT.md` | Doc | Concept doc, оставить как есть |

### Deletions (по `git status -D`)

| Файл | Действие |
|---|---|
| `specs/TZ_SlidingWindow/*.md` (6 файлов) | Это завершённое ТЗ. Нужно проверить — есть ли копия в `_archive/`. Если да — удаление зафиксировать. Если нет — восстановить или удалить с подтверждением |

### Не трогать

- `.DS_Store` (macOS junk)
- `CLAUDE.md` (модификации этого файла — это предыдущая работа, не аудит)
- `specs/WORKFLOW.md` (отдельная work)
- `.claude/`, `.mcp.json`, `.vscode/` (untracked dev configs)
- `_archive/TZ_BriefingAuthorMinimax/`, `_archive/TZ_MinimaxCleanup/` (новые архивные ТЗ)

---

## Ограничения

### Жёсткие правила

1. **Никаких изменений в логике.** Если для классификации файла нужно понять «работает ли это» — ответ всегда **stash**, не commit
2. **Каждая категория = отдельный коммит.** Не смешивать infra prep с rollback в одном коммите
3. **Named stashes только.** `git stash push -m "WIP: <ясное название>"` — никаких безымянных stashes
4. **Не трогать chat/route.ts.** Этот файл затронут ТЗ-CacheAudit финализацией, любые остатки uncommitted уже учтены
5. **Frozen TZ folders не аудитировать.** `specs/TZ_MindArtifacts/`, `specs/TZ_SaveFactV2/` — это сами frozen specs, они должны остаться как есть до разморозки
6. **Использовать stash, не branch.** Branch для каждого WIP создаст беспорядок. Stash + ясное имя достаточно для восстановления

### Что НЕ делает это ТЗ

- НЕ реализует cache breakpoints в pipelines (это следующее ТЗ — `TZ_CachePipelineMetrics`)
- НЕ размораживает TZ_MindArtifacts / TZ_SaveFactV2 (ждут теста Grok)
- НЕ меняет `task-assignments.ts` или `model-catalog.ts` (это сфера TZ-1/TZ-2 уже завершённых)
- НЕ удаляет код, кроме случаев когда он явно orphaned WIP без следов в git history
- НЕ создаёт новые SPEC/ANALYSIS файлы для frozen ТЗ

---

## Критерий готовности

1. ✅ `git status` показывает только то что было заранее согласовано как «оставить uncommitted»
2. ✅ Названный stash созданы с явными именами (можно восстановить через `git stash apply stash@{<name>}`)
3. ✅ Infra prep коммит создан с ясным сообщением `chore(unfreeze): infra prep for TZ_<name>`
4. ✅ Локальный CHANGELOG.md содержит таблицу «файл → категория → действие → коммит/stash»
5. ✅ `npx tsc --noEmit` → 0 ошибок (working tree должен компилироваться даже после удаления orphaned WIP)
6. ✅ `npm run build` → успех
7. ✅ Обновлён `ANALYSIS_MIND_ARTIFACTS_SAVEFACT.md` — секция «Блокер для frozen ТЗ» помечена как «снят»

---

## Связанные ТЗ

- **ТЗ-CacheAudit (v3.85.0, завершён):** обнаружил блокер, создал необходимость этого ТЗ
- **TZ_MindArtifacts / TZ_SaveFactV2 (заморожены):** ждут теста Grok. Этот ТЗ освобождает working tree чтобы их разморозка прошла без конфликтов
- **TZ_CachePipelineMetrics (следующее, будет создано после этого):** реализация cache breakpoints в pipelines. Возможно только после успешного завершения данного ТЗ

---

## Estimated effort

- **1 сессия (1.5-2 часа)** — аудит 12-15 файлов через `git diff`, классификация, перемещение
- Без рефакторинга или нового кода — это чисто дисциплинарная работа
