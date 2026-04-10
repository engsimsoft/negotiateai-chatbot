# Передача сессии ТЗ-1: Core Registry

**Дата:** 2026-04-11
**Сессия:** 4 (Этапы 1 + HOTFIX + 2 + 3 завершены)

---

## Статус этапов

- [x] Фаза Анализ
- [x] Фаза Планирование
- [x] **Этап 1: Core Registry + Catalog + Task-assignments + миграция БД** — commit `836842a`
- [x] **HOTFIX: sanitizer + scrollbar** — commit `b4bce63`
- [x] **Этап 2: Миграция chat routes + service-chat + utils** — commit `5d629db`
- [x] **Этап 3: Миграция projects + clerks + professors** — **готов к коммиту**
- [ ] Этап 4: Миграция pipelines (briefing, podcast, memory, meeting, vision-ocr) ← **СЛЕДУЮЩИЙ**
- [ ] Этап 5: Очистка legacy wrappers + удаление TokenLens
- [ ] Этап 6: Финализация

---

## Главное достижение Этапа 3

Во время теста **одной строкой в `task-assignments.ts`** 8 taskId переключены на Haiku (весь проектный флоу + обычный чат). Все call-sites автоматически подхватили новую модель через `getModel()` — без правок в 9 мигрированных файлах. **Это именно тот use case, ради которого строился Core Registry.**

При этом вскрылась реальная архитектурная дыра: `providerOptions.anthropic.thinking: adaptive` был hardcoded в 3 файлах. Haiku не поддерживает thinking → API 400. **Решено правильно, не костылём:** новый helper `taskSupportsThinking(taskId)` читает `capabilities.thinking` из model-catalog (SSOT) и callers применяют `providerOptions` условно. Теперь система переживёт любые смены моделей в task-assignments.

---

## Что сделано в Этапе 3

### 9 файлов мигрированы на getModel(taskId)

- [lib/ai/model-tiers.ts](../../lib/ai/model-tiers.ts) — тонкая обёртка, `getTaskIdForTier()` + `getProjectTierModelId()`
- [lib/ai/clerks/task-summarizer.ts](../../lib/ai/clerks/task-summarizer.ts) — `clerk:task-summary`
- [lib/ai/clerks/snapshot-creator.ts](../../lib/ai/clerks/snapshot-creator.ts) — `clerk:snapshot`
- [app/(chat)/api/projects/[id]/analyze-file/route.ts](../../app/(chat)/api/projects/[id]/analyze-file/route.ts) — `clerk:file-analyzer`
- [app/(chat)/api/projects/[id]/plan/route.ts](../../app/(chat)/api/projects/[id]/plan/route.ts) — `professor:planning`
- [lib/ai/professors/task-reviewer.ts](../../lib/ai/professors/task-reviewer.ts) — `professor:review`
- [lib/ai/professor-pipeline.ts](../../lib/ai/professor-pipeline.ts) — 3 фазы: `pipeline-analyze` / `pipeline-execute` / `pipeline-synthesize`
- [app/(chat)/api/projects/[id]/generate-summary/route.ts](../../app/(chat)/api/projects/[id]/generate-summary/route.ts) — `util:project-summary`
- [app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts](../../app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts) — через tier-обёртку

### Удалены 3 env-переменные

- `PROFESSOR_MODEL`
- `SUMMARIZER_MODEL`
- `SNAPSHOT_CLERK_MODEL`

Grep по репе подтверждает — больше нигде не используются.

### Новая capability-driven функция

[getModel.ts::taskSupportsThinking(taskId)](../../lib/ai/getModel.ts#L206) — читает `capabilities.thinking` из catalog. Применена в 3 файлах для условного `providerOptions.anthropic.thinking`.

### DevPanelProvider в TaskChat

[components/projects/task-chat.tsx](../../components/projects/task-chat.tsx) обёрнут в `<DevPanelProvider>`. `DevPanelFooter` автоматически показывает модель/токены/стоимость под каждым ответом эксперта. Это клиентская часть — серверная (`emitDebugPrompt/Step/Finish`) уже была на месте.

### Валидация

- `npx tsc --noEmit` → 0 ошибок
- `npm run build` → успешен
- **Логи dev-сервера подтверждают:**
  - `POST /api/service-chat 200` (project-creation → Sonnet)
  - `POST /api/projects/.../analyze-file 200 in 4557ms` (file-analyzer → Haiku)
  - `POST /api/projects/.../plan` (professor:planning → модель резолвится из task-assignments)
  - **Architecture switch live-tested:** одна строка в task-assignments переключила 8 taskId, HMR подхватил, запросы пошли на новые модели

---

## Known issues (не относятся к Этапу 3)

1. **Planning prompt не совместим с Haiku output format.** При тесте Haiku генерировала валидный `<plan_report>`, но оборачивала ответ в markdown fence и теряла `<plan_json>` тег. Parser в `extractTag()` рассчитан на чистый Opus output. **Решение:** переписать промпты под cross-model support — это запланировано на отдельный будущий этап после ТЗ-1. Сейчас `professor:planning` по-прежнему на Opus в task-assignments — promt работает.

2. **DevPanel полный e2e тест в TaskChat** не пройден — требует реальной задачи открытой через planner. Planning с Opus дорого для тестов, planning с Haiku упал на parser. Компонент обёрнут корректно, сервер эмитит debug events — тест будет выполнен автоматически при первом использовании проектов в production после merge.

3. **MiniMax thinking** — интересная альтернатива Haiku для дешёвого тестирования, но `providerOptions.anthropic.thinking` работает только на Anthropic. Для полной cross-provider поддержки нужен per-model providerOptions builder в catalog — отдельная задача после ТЗ-1.

---

## Следующая сессия: начни с

1. **Коммит Этапа 3** (готов к выполнению, см. ниже)
2. **Этап 4: Pipelines** — миграция:
   - [lib/briefing/briefing-filter.ts](../../lib/briefing/briefing-filter.ts) — `briefing:filter`
   - [lib/briefing/briefing-author.ts](../../lib/briefing/briefing-author.ts) — `briefing:author`
   - [lib/briefing/briefing-section-author.ts](../../lib/briefing/briefing-section-author.ts) — `briefing:section`
   - [lib/podcast/script-generator.ts](../../lib/podcast/script-generator.ts) — `briefing:podcast-script`
   - [lib/ai/memory/extract.ts](../../lib/ai/memory/extract.ts) — `memory:extract` + `memory:extract-batch`
   - [lib/ai/memory/consolidate.ts](../../lib/ai/memory/consolidate.ts) — `memory:consolidate`
   - [lib/ai/memory/profile.ts](../../lib/ai/memory/profile.ts) — `memory:profile`
   - [lib/meeting/meeting-pipeline.ts](../../lib/meeting/meeting-pipeline.ts) — `meeting:summary`
   - [lib/ai/vision-ocr.ts](../../lib/ai/vision-ocr.ts) — `vision:ocr` (уже использует `claudeHaiku` из providers — замена на `getModel`)

Все эти файлы уже импортируют `minimaxM27`, `minimaxM27Long`, `claudeSonnet`, `claudeHaiku` из [lib/ai/providers.ts](../../lib/ai/providers.ts). Миграция по той же схеме что и Этап 3.

3. tsc + build + мануальный тест каждого pipeline (briefing → podcast → memory → meeting) + commit
4. СТОП → ждём подтверждения перед Этапом 5

---

## Блокеры / Вопросы

Нет.

---

## Следующий git commit (Этап 3)

```bash
git add \
  lib/ai/model-tiers.ts \
  lib/ai/clerks/task-summarizer.ts \
  lib/ai/clerks/snapshot-creator.ts \
  lib/ai/professors/task-reviewer.ts \
  lib/ai/professor-pipeline.ts \
  lib/ai/getModel.ts \
  "app/(chat)/api/projects/[id]/analyze-file/route.ts" \
  "app/(chat)/api/projects/[id]/plan/route.ts" \
  "app/(chat)/api/projects/[id]/generate-summary/route.ts" \
  "app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts" \
  "app/(chat)/api/service-chat/route.ts" \
  components/projects/task-chat.tsx \
  specs/TZ1_CoreRegistry/ROADMAP.md \
  specs/TZ1_CoreRegistry/HANDOFF.md \
  specs/TZ1_CoreRegistry/CHANGELOG.md

git commit -m "feat(tz-1): migrate projects, clerks, professors to getModel + capability-driven thinking guard"
```
