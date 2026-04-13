# Changelog ТЗ_UnfreezePipelines

> Локальный changelog ТЗ. Заполняется по мере работы.

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

### Не сделано
- Этап 0 (Pre-flight) — стартует в следующей сессии
- Этап 1 (Аудит) — стартует в следующей сессии
- Этап 2 (Применение решений) — стартует в следующей сессии
- Этап 3 (Валидация чистоты) — стартует в следующей сессии
- Этап 4 (Финализация + перенос в _archive) — стартует в следующей сессии

---

## Сессия 1 — TBD

[Заполняется в процессе работы]

### Этап 0: Pre-flight

[ ] git status snapshot
[ ] git stash list
[ ] git log baseline
[ ] tsc clean check
[ ] build clean check

### Этап 1: Аудит и классификация

[Здесь будет таблица решений по 12-15 файлам]

| Файл | Категория | Решение | Обоснование |
|---|---|---|---|
| (заполняется) | | | |

### Этап 2: Применение решений

#### Stashes (категория c)
- (заполняется)

#### Rollbacks (категория b)
- (заполняется)

#### Infra prep commit (категория a)
- (заполняется, hash коммита)

### Этап 3: Валидация чистоты

[ ] git status clean
[ ] tsc clean
[ ] build clean
[ ] dev server smoke
[ ] ANALYSIS_MIND_ARTIFACTS_SAVEFACT.md обновлён

### Этап 4: Финализация

[ ] CHANGELOG.md (главный) обновлён [3.85.1]
[ ] SIMPLY_STATUS.md обновлён
[ ] package.json 3.85.0 → 3.85.1
[ ] Финальный smoke test пользователем
[ ] specs/TZ_UnfreezePipelines/ → _archive/

### Финальная сводка (заполняется в конце)

- Всего файлов аудитировано: TBD
- Категория (a) Commit: TBD
- Категория (b) Rollback: TBD
- Категория (c) Stash: TBD
- Создано stashes: TBD
- Финальный коммит финализации: TBD
