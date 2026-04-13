# Roadmap ТЗ-UnfreezePipelines

**Создан:** 2026-04-13
**Версия проекта:** 3.85.0 → 3.85.1 (patch)
**Статус:** ⬜ Не начат

---

## Обзор

| Метрика | Значение |
|---|---|
| Этапов | 4 |
| Текущий этап | — |
| Сессий (оценка) | 1 |
| Тип | Disciplinary git hygiene (НЕ feature work) |

**Главное правило:** этот ТЗ **не пишет нового кода**. Только аудит, классификация, перемещение существующих uncommitted changes.

---

## Этапы

### Этап 0: Pre-flight

**Статус:** ⬜ Не начат

**Цель:** Зафиксировать стартовое состояние working tree, убедиться что нет неожиданных изменений с момента создания ТЗ.

**Задачи:**
- [ ] `git status` — снимок текущего состояния, сохранить вывод
- [ ] `git stash list` — посмотреть существующие stashes (вдруг есть полезные)
- [ ] `git log --oneline -10` — последние коммиты для контекста
- [ ] Сравнить список uncommitted файлов с SPEC.md → если расхождения, обновить SPEC
- [ ] `npx tsc --noEmit` — текущее состояние TS (должно быть 0 ошибок ПОСЛЕ ТЗ-CacheAudit)
- [ ] `npm run build` — текущая сборка работает

**Валидация этапа:**
- [ ] Снимок git status сохранён в локальном CHANGELOG.md как baseline
- [ ] TS компилируется

**Git:** не нужен, только наблюдение.

---

### Этап 1: Аудит и классификация

**Статус:** ⬜ Не начат

**Цель:** Для каждого из 12-15 файлов из `SPEC.md` выполнить `git diff <file>` и принять решение по категории (a/b/c).

**Подход:**

Для **каждого** файла:

1. `git diff <file>` — посмотреть конкретные изменения
2. Если файл небольшой (<20 строк) — прочитать full context через Read tool
3. Применить классификационный фильтр:

```
ВОПРОС 1: Может ли это работать стабильно прямо сейчас, не зависит ли от другой uncommitted работы?
   ДА → переходим к Q2
   НЕТ → категория (c) Frozen TZ exploration → STASH

ВОПРОС 2: Имеет ли это самостоятельную ценность как infrastructure (типы, helpers, миграции, mostly nominal)?
   ДА → категория (a) Infrastructure prep → COMMIT
   НЕТ → переходим к Q3

ВОПРОС 3: Это явно заброшенный/устаревший код (не упоминается в недавних коммитах, нет назначения)?
   ДА → категория (b) Orphaned WIP → ROLLBACK
   НЕТ → категория (c) Frozen TZ exploration → STASH (по умолчанию когда сомневаешься)
```

**ВАЖНОЕ ПРАВИЛО:** При сомнении → всегда stash, никогда не commit и не rollback. Stash восстановим, commit нужно revert'ить, rollback теряет работу безвозвратно.

**Задачи:**
- [ ] `git diff lib/db/queries.ts` → классификация
- [ ] `git diff lib/ai/memory/extract.ts` → классификация
- [ ] `git diff lib/ai/memory/types.ts` → **ожидается (a)** (TaskMetadata/CalendarMetadata/FactMetadata типы)
- [ ] `git diff lib/ai/memory/voyage-client.ts` → классификация
- [ ] `git diff lib/ai/retry-with-logging.ts` → классификация
- [ ] `git diff lib/ai/tools/update-document.ts` → классификация
- [ ] `git diff lib/briefing/briefing-author.ts` → классификация
- [ ] `git diff lib/briefing/briefing-section-author.ts` → классификация
- [ ] `git diff lib/briefing/briefing-filter.ts` → классификация
- [ ] `git diff lib/podcast/script-generator.ts` → классификация
- [ ] `git diff lib/podcast/index.ts` → **критично, +124 строки, требует особого внимания**
- [ ] `git diff lib/briefing/research-engine.ts` → классификация (минимальные изменения)
- [ ] `git diff "app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts"` → ожидается error handling foreign hunk (категория (a) если безопасно)
- [ ] `git diff components/artifact-actions.tsx` → классификация
- [ ] `git diff components/multimodal-input.tsx` → классификация
- [ ] `cat lib/db/migrations/0051_memory-metadata.sql` → **ожидается (a)** (DB migration для metadata)
- [ ] `cat scripts/debug-orphan-tool-use.ts` → классификация (если orphaned dev script — оставить как dev tool, untracked)

**Результат этапа:**

Локальный CHANGELOG.md должен содержать таблицу:

```markdown
| Файл | Категория | Решение | Обоснование |
|---|---|---|---|
| lib/ai/memory/types.ts | (a) Infra prep | COMMIT | TaskMetadata/CalendarMetadata типы — самостоятельны, нужны и Path A и Path B |
| lib/podcast/index.ts | (c) Frozen WIP | STASH "WIP: TZ_MindArtifacts podcast pipeline" | Большой блок, неясно что делает, ждёт разморозки |
| ... |
```

**Валидация этапа:**
- [ ] Все 12-15 файлов классифицированы
- [ ] Таблица решений в CHANGELOG.md заполнена
- [ ] Каждое решение имеет обоснование

**Git:** не нужен — только аудит.

---

### Этап 2: Применение решений

**Статус:** ⬜ Не начат

**Цель:** Применить классификационные решения из Этапа 1.

**Порядок действий (важен!):**

**Шаг 2.1: Stashes для категории (c)**

Для каждого файла категории (c):
```bash
git stash push -m "WIP: TZ_<name> <краткое описание>" -- <file>
```

Если несколько файлов одной TZ → один stash:
```bash
git stash push -m "WIP: TZ_MindArtifacts pipeline exploration" -- \
  lib/podcast/index.ts \
  lib/briefing/briefing-author.ts \
  ...
```

После каждого stash → `git stash list` чтобы убедиться что stash создан с правильным именем.

**Шаг 2.2: Rollback для категории (b)**

Для каждого файла категории (b):
```bash
git checkout -- <file>
```

После каждого checkout → `git diff <file>` должен быть пустым.

**Шаг 2.3: Commit для категории (a)**

Стейджинг по конкретным путям (НЕ git add -A!):
```bash
git add lib/ai/memory/types.ts lib/db/migrations/0051_memory-metadata.sql ...
git commit -m "chore(unfreeze): infrastructure prep for frozen TZ_MindArtifacts/TZ_SaveFactV2

Закоммичены infrastructure-only правки от замороженных ТЗ как
самостоятельный задел без зависимости от их разморозки.

См. specs/TZ_UnfreezePipelines/CHANGELOG.md для полного списка решений
по каждому файлу.

ТЗ_UnfreezePipelines Этап 2 → COMMIT cluster"
```

**Задачи:**
- [ ] Создать все stashes (Шаг 2.1)
- [ ] Применить все rollbacks (Шаг 2.2)
- [ ] Создать infra prep commit (Шаг 2.3)

**Валидация этапа:**
- [ ] `git stash list` — все stashes на месте с явными именами
- [ ] `git status` — только согласованные «оставить uncommitted» файлы (по идее ничего)
- [ ] `git log -1` — infra prep commit виден
- [ ] `npx tsc --noEmit` — 0 ошибок (критично! orphaned rollback мог сломать компиляцию)
- [ ] `npm run build` — успех

---

### Этап 3: Валидация чистоты

**Статус:** ⬜ Не начат

**Цель:** Убедиться что working tree приведено в стабильное чистое состояние, документация обновлена.

**Задачи:**
- [ ] `git status` — должен показывать только оставленные untracked dev configs (.claude/, .vscode/, .DS_Store)
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успех
- [ ] `npm run dev` → smoke check главных страниц (/dashboard, /simply, /briefing, /projects)
  - Не нужны мануальные тесты — просто что приложение запускается и страницы рендерятся
- [ ] Обновить `ANALYSIS_MIND_ARTIFACTS_SAVEFACT.md`:
  - Секция «Блокер и путь решения» в разделе 9 → пометить как «**Снят** ТЗ_UnfreezePipelines, дата YYYY-MM-DD»
  - Добавить ссылку на этот ТЗ
- [ ] Обновить локальный CHANGELOG.md ТЗ — финальная сводка по категориям (сколько коммитов / сколько stashes / сколько rollback)

**Валидация этапа:**
- [ ] Working tree — clean (или содержит только заранее согласованные исключения)
- [ ] TS clean
- [ ] Build clean
- [ ] Dev server стартует без crashes
- [ ] Документация обновлена

**Git:** commit обновления документации:
```bash
git add specs/TZ_UnfreezePipelines/ ANALYSIS_MIND_ARTIFACTS_SAVEFACT.md
git commit -m "docs(unfreeze): финальная сводка ТЗ_UnfreezePipelines + блокер MIND снят"
```

---

### Этап 4: Финализация

**Статус:** ⬜ Не начат

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать `DOCUMENTATION_GUIDE.md` → пройти чек-лист.

**Задачи:**

**Документация (обязательная):**
- [ ] ⛔ Прочитать `DOCUMENTATION_GUIDE.md` → пройти "✅ Чек-лист при изменениях"
- [ ] Обновить главный `CHANGELOG.md` — раздел [3.85.1] с описанием disciplinary cleanup
- [ ] Обновить `SIMPLY_STATUS.md` — короткий раздел про этот ТЗ (это disciplinary, не feature)
- [ ] `package.json` версия 3.85.0 → 3.85.1

**Документация (по чеклисту):**
- [ ] ADR не нужен — это disciplinary cleanup, не архитектурное решение
- [ ] `docs/architecture.md` не меняется
- [ ] `docs/ai-tools.md` не меняется
- [ ] `docs/ai-chats-map.md` не меняется

**Завершение:**
- [ ] Финальный мануальный smoke (пользователь): зайти на /dashboard, /simply, проверить что ничего не сломалось
- [ ] Переместить `specs/TZ_UnfreezePipelines/` → `_archive/TZ_UnfreezePipelines/` через `git mv`

**Валидация:**
- [ ] `npm run build` — успешен
- [ ] Документация актуальна

**Git:** финальный коммит:
```bash
git mv specs/TZ_UnfreezePipelines _archive/TZ_UnfreezePipelines
git add CHANGELOG.md SIMPLY_STATUS.md package.json _archive/TZ_UnfreezePipelines/
git commit -m "release(v3.85.1): финализация ТЗ_UnfreezePipelines + перенос в _archive"
```

---

## Принципы выполнения

### Правило сомнения

**При любом сомнении → stash, не commit и не rollback.**

Stash восстанавливается команды `git stash apply stash@{<name>}`. Commit нужно revert'ить (риск merge conflicts). Rollback теряет работу безвозвратно.

### Правило разделения

**Каждая категория = отдельный коммит.**

Не смешивать infra prep с rollback в одном коммите. Это упрощает revert если какая-то категория окажется ошибочной.

### Правило явных имён

**Все stashes должны иметь ясное имя через `-m`.**

Безымянный stash через несколько недель невозможно идентифицировать → потерянная работа.

### Правило `git add` по путям

**Никаких `git add -A`, `git add .`.**

Только `git add <конкретный путь>`. Это защита от случайного вытаскивания stash'нутого файла обратно.

---

## Готово к следующему ТЗ?

После завершения ТЗ_UnfreezePipelines working tree должно быть чистым. Это разблокирует:

1. **TZ_CachePipelineMetrics** (следующий ТЗ) — расстановка cache breakpoints в pipelines + фикс хардкода `cacheReadTokens: 0`
2. **Любые рефакторинги pipeline-кода** — теперь без блокера uncommitted
3. **Будущая разморозка TZ_MindArtifacts / TZ_SaveFactV2** — на чистой базе через stash apply
