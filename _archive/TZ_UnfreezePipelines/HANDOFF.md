# HANDOFF — ТЗ_UnfreezePipelines

**Создано:** 2026-04-13
**Для следующей сессии:** старт работы

---

## ⚡ Critical first read

**Прочитать в этом порядке:**

1. **`SPEC.md`** — что и зачем делаем
2. **`ROADMAP.md`** — пошаговый план по 4 этапам
3. **`ANALYSIS.md`** — природа проблемы, классификация, FAQ
4. **`CHANGELOG.md`** — пустой шаблон, заполняется по ходу
5. **`ANALYSIS_MIND_ARTIFACTS_SAVEFACT.md`** (в корне проекта) — раздел 9 «Кэширование MiniMax в pipelines» — это контекст блокера который мы снимаем

**Не читать в первую очередь:**
- `_archive/TZ_CacheAudit/*` — это завершённый ТЗ. Контекст уже в SPEC/ANALYSIS этого ТЗ
- `specs/TZ_MindArtifacts/`, `specs/TZ_SaveFactV2/` — frozen ТЗ, сами они вне scope. Их содержимое не нужно для аудита

---

## 🎯 Старт следующей сессии — НАЧНИ С ЭТОГО

### Шаг 1: Pre-flight (Этап 0)

```bash
cd "/Users/mactm/Projects/NegotiateAI Chatbot"

# Снимок состояния
git status
git stash list
git log --oneline -10

# Проверка валидности базы
npx tsc --noEmit  # ожидание: 0 ошибок (после ТЗ-CacheAudit)
```

Сохранить вывод `git status` в `CHANGELOG.md` → секция «Этап 0».

**Сравнить со списком в SPEC.md** — если файлов больше или меньше, обновить SPEC перед началом аудита. Возможно владелец что-то добавил/удалил между сессиями.

### Шаг 2: Аудит файлов (Этап 1)

Идти по списку в `ROADMAP.md` Этап 1 → задачи, **по одному файлу за раз**.

Для каждого:

```bash
git diff <file>
# Или для большого файла:
git log -p <file> --since="2 weeks ago"  # понять контекст последних коммитов
```

Принять решение по 3 категориям (см. `ANALYSIS.md` секция «Подход к классификации»):

- (a) Infrastructure prep → COMMIT
- (b) Orphaned WIP → ROLLBACK
- (c) Frozen TZ exploration → STASH

**При сомнении → STASH.** Это правило написано большими буквами в SPEC и ANALYSIS — соблюдать без исключений.

Записать решение в `CHANGELOG.md` → таблица в секции «Этап 1».

### Шаг 3: Применение решений (Этап 2)

Только после полного аудита всех файлов. Не применять решения частично.

Порядок:

1. **Сначала stashes** (не теряет работу):
   ```bash
   git stash push -m "WIP: TZ_<name> <description>" -- file1 file2 ...
   git stash list  # подтвердить
   ```

2. **Потом rollbacks** (теряет работу — действовать только если уверен):
   ```bash
   git checkout -- file1 file2 ...
   ```

3. **В конце commit** (фиксирует infra prep):
   ```bash
   git add file1 file2 ...  # явные пути, не -A
   git commit -m "chore(unfreeze): infrastructure prep for frozen TZ_<name>"
   ```

После каждого шага → `git status` для проверки.

### Шаг 4: Валидация (Этап 3)

```bash
git status                # должно быть пусто или только согласованные исключения
npx tsc --noEmit          # 0 ошибок
npm run build             # успех
npm run dev               # smoke check главных страниц
```

Обновить `ANALYSIS_MIND_ARTIFACTS_SAVEFACT.md` → раздел 9 → секция «Блокер и путь решения» → пометить как «Снят TZ_UnfreezePipelines, дата 2026-04-XX».

### Шаг 5: Финализация (Этап 4)

См. ROADMAP.md Этап 4. Включает:

- Прочитать `DOCUMENTATION_GUIDE.md`
- Обновить главный `CHANGELOG.md` → раздел [3.85.1]
- Обновить `SIMPLY_STATUS.md` (короткая запись — это disciplinary, не feature)
- `package.json` 3.85.0 → 3.85.1
- Запросить мануальный smoke у пользователя (зайти в /dashboard, /simply, проверить что не сломалось)
- `git mv specs/TZ_UnfreezePipelines _archive/TZ_UnfreezePipelines`
- Финальный коммит

---

## Контекст из предыдущей работы (важен для понимания)

### Что произошло в ТЗ-CacheAudit

ТЗ-CacheAudit (v3.85.0) обнаружил что:

1. **MiniMax кэширование в Simply Chat решено** (54% экономии валидировано)
2. **Cache в task-expert решено** (74% экономии валидировано)
3. **Cache в pipelines НЕ решено** — там нет ни `cacheControl`, ни корректного usage logging
4. **Блокер для решения (3) — uncommitted changes от frozen ТЗ** в тех же pipeline-файлах

Этот ТЗ_UnfreezePipelines — **снимает блокер**, чтобы следующий ТЗ_CachePipelineMetrics мог реализовать pipeline кэширование на чистой базе.

### Зачем дисциплинарный, а не сразу feature

Причина 1: **Working tree был грязный неделями.** Это самая опасная форма технического долга — растёт со временем, контекст теряется, восстановление становится невозможным.

Причина 2: **При сомнении → stash.** Если попытаться сразу делать feature в грязной базе — высокий риск случайно затронуть orphaned WIP и сломать что-то непредсказуемо.

Причина 3: **Каждое действие изолировано.** Один файл — одно решение — одно действие. Это даёт возможность в любой момент остановиться без частичного состояния.

### Чего не было сделано в ТЗ-CacheAudit

- **Не трогали pipeline файлы** — намеренно, чтобы не создать merge-конфликт с frozen работой
- **Не трогали uncommitted changes** — кроме одного hunk error handling в task-expert/route.ts, который мы временно убирали через Edit и возвращали

### Метрики ТЗ-CacheAudit (для контекста)

| Provider / chatMode | Msg 1 (cold) | Msg 2 (hot) | Экономия |
|---|---|---|---|
| MiniMax M2.7 (Simply Chat) | ~8.4K write | ~8.1K read | 54% |
| Claude Haiku (Simply «Думать») | ~19.1K write | ~19.1K read | 58% |
| Claude Haiku (task-expert) | 11.8K write | 11.8K read | 74% |

После TZ_UnfreezePipelines + TZ_CachePipelineMetrics ожидается такой же диапазон экономии для pipelines (briefing/podcast).

---

## Известные сложности

### `lib/podcast/index.ts` — большой блок (+124 строки)

Это **самый сложный файл для аудита**. Вероятно содержит реализацию какой-то части podcast feature от TZ_MindArtifacts. Действия:

1. `git diff lib/podcast/index.ts` — внимательно прочитать
2. Если разделение infra/feature очевидно по hunk'ам — попробовать selective stash
3. Если неочевидно — STASH целиком с пометкой `WIP: TZ_<name> podcast feature exploration`

### Components (artifact-actions, multimodal-input)

Эти файлы не имеют явной связи с frozen ТЗ. Возможно orphaned WIP. Действия:

1. `git diff <file>` — посмотреть
2. `git log -p <file> --since="2 weeks ago"` — понять последний контекст
3. Если непонятно происхождение → STASH с пометкой `WIP: components orphaned exploration`

### Foreign hunk в task-expert/route.ts

В ТЗ-CacheAudit мы видели error handling foreign hunk (зона 88-97). После Этапа 4 hotfix мы восстановили этот hunk. **Этот файл должен иметь только этот hunk.** Если diff больше — расследовать.

---

## Запреты и предупреждения

- ❌ **НЕ использовать** `git add -A` или `git add .`
- ❌ **НЕ удалять** TZ folders из `specs/` (они frozen, ждут разморозки)
- ❌ **НЕ трогать** `chat/route.ts` — он чистый после ТЗ-CacheAudit финализации
- ❌ **НЕ писать** новый код. Этот ТЗ — только перемещение существующего
- ❌ **НЕ делать** revert чужих коммитов — только rollback uncommitted
- ❌ **НЕ оставлять** unnamed stashes — всегда `-m "WIP: ..."`
- ⚠️ При любом сомнении → STASH, не commit и не rollback

---

## Целевая версия

3.85.0 → **3.85.1** (patch — disciplinary cleanup, не feature)

---

## Estimated effort

**1 сессия (1.5-2 часа)** на аудит 12-15 файлов + применение решений + валидация + финализация.

Дисциплинарная работа имеет предсказуемый объём. Если за 2 часа не закончили — что-то пошло не так, остановиться и пересмотреть scope.
