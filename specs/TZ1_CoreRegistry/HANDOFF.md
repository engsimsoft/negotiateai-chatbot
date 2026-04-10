# Передача сессии ТЗ-1: Core Registry

**Дата:** 2026-04-10
**Сессия:** 2 (Этап 1 + hotfix + Этап 2 завершены)

---

## Статус этапов

- [x] Фаза Анализ
- [x] Фаза Планирование
- [x] **Этап 1: Core Registry + Catalog + Task-assignments + миграция БД** — commit `836842a`
- [x] **HOTFIX: sanitizer + scrollbar** — commit `b4bce63`
- [x] **Этап 2: Миграция chat routes + service-chat + utils** — готов к коммиту
- [ ] Этап 3: Миграция projects (tasks + plan + clerks + professors) ← **СЛЕДУЮЩИЙ**
- [ ] Этап 4: Миграция pipelines (briefing, podcast, memory, meeting)
- [ ] Этап 5: Очистка legacy wrappers + удаление TokenLens
- [ ] Этап 6: Финализация

---

## Что сделано в Этапе 2

### Мигрированные call-sites на getModel(taskId) — 7 файлов

- [app/(chat)/actions.ts](../../app/(chat)/actions.ts) — `util:title`
- [app/(chat)/api/chat/[id]/generate-title/route.ts](../../app/(chat)/api/chat/[id]/generate-title/route.ts) — `util:title`
- [lib/ai/tools/request-suggestions.ts](../../lib/ai/tools/request-suggestions.ts) — `util:artifact-suggestions`
- [app/(chat)/api/assistant/ben/route.ts](../../app/(chat)/api/assistant/ben/route.ts) — `service-chat:ben` (Бен deprecated, но мигрирован)
- [app/(chat)/api/service-chat/route.ts](../../app/(chat)/api/service-chat/route.ts) — 4 контекста через `getTaskIdForContext()` → `getModel(taskId)`. Локальный `getModelId()` удалён
- [lib/ai/chat-mode-config.ts](../../lib/ai/chat-mode-config.ts) — превратился в тонкую обёртку: `CHAT_MODE_CONFIG` без `modelId`, добавлен `getTaskIdForChatMode()`, `getModelForChatMode()` перевеошён через catalog
- [app/(chat)/api/chat/route.ts](../../app/(chat)/api/chat/route.ts) — **главное:** 3 места:
  - L128 auto-naming → `getModel("util:title")`
  - L584-598 simply branch → `simply-chat-think` / `simply-chat-vision` / `simply-chat` (вместо захардкоженных имён моделей)
  - L998-1010 resolvedModelId для DevPanel → `getModelIdForTask(getTaskIdForChatMode(chatMode))`
  - Локальный `minimaxModel()` helper + `createMinimaxOpenAI` import удалены

### Бонус — инфраструктурный фикс

- [lib/ai/getModel.ts](../../lib/ai/getModel.ts) — `getModel()` теперь мутирует `config.includeUsage = true` для всех `minimax:*` / `minimaxLong:*` моделей. Нужно для эмита usage events при streaming — иначе DevPanel показывает пустую стоимость. Раньше эта мутация была в локальном `minimaxModel()` хелпере chat/route.ts — теперь централизована
- [lib/ai/task-assignments.ts](../../lib/ai/task-assignments.ts) — `service-chat:project-manager` исправлен на `claude-haiku-4-5-20251001` (было Sonnet — ошибка, в реальном коде всегда был Haiku)

### Валидация

- `npx tsc --noEmit` → 0 ошибок
- `npm run build` → успешен
- `grep -rn "myProvider|claudeHaiku|claudeSonnet|claudeOpus|minimaxM27" <7 мигрированных файлов>` → **0 матчей**
- **Логи dev-сервера подтверждают все taskId:**
  - `task=simply-chat-think, model=claude-sonnet-4-6` ✅
  - `task=simply-chat-vision, model=claude-haiku-4-5-20251001` ✅
  - `task=simply-chat, model=MiniMax-M2.7` ✅
  - `POST /api/service-chat 200` (project-creation) ✅
- Мануальный тест пользователем: Simply text/think/vision + Экспертиза + Создание + создание проекта через service-chat — все прошли

### Что НЕ удалено (будет в Этапе 5)

Legacy exports в [lib/ai/providers.ts](../../lib/ai/providers.ts):
- `myProvider` (customProvider)
- `claudeHaiku`, `claudeSonnet`, `claudeOpus`
- `minimaxM27`, `minimaxM27Long`
- `getClaudeModel()`

Они нужны Этапам 3-4 (projects, clerks, professors, pipelines). Grep по проекту:
```
grep -rn "myProvider\|claudeHaiku\|claudeSonnet\|claudeOpus\|minimaxM27" lib/ app/
```
Оставшиеся матчи — кандидаты для Этапов 3-4.

---

## Следующая сессия: начни с

1. **Прочитать ROADMAP.md** → Этап 3
2. **Migrate projects:**
   - [app/(chat)/api/projects/[id]/plan/route.ts](../../app/(chat)/api/projects/[id]/plan/route.ts) → `professor:planning`, удалить env `PROFESSOR_MODEL`
   - [lib/ai/professors/task-reviewer.ts](../../lib/ai/professors/task-reviewer.ts) → `professor:review`, удалить env
   - [lib/ai/clerks/task-summarizer.ts](../../lib/ai/clerks/task-summarizer.ts) → `clerk:task-summary`, удалить env `SUMMARIZER_MODEL`
   - [lib/ai/clerks/snapshot-creator.ts](../../lib/ai/clerks/snapshot-creator.ts) → `clerk:snapshot`, удалить env `SNAPSHOT_CLERK_MODEL`
   - [app/(chat)/api/projects/[id]/analyze-file/route.ts](../../app/(chat)/api/projects/[id]/analyze-file/route.ts) → `clerk:file-analyzer`
   - [app/(chat)/api/projects/[id]/generate-summary/route.ts](../../app/(chat)/api/projects/[id]/generate-summary/route.ts) → `util:project-summary`
   - [app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts](../../app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts) — через обёртку `model-tiers.ts`
   - [lib/ai/model-tiers.ts](../../lib/ai/model-tiers.ts) — тонкая обёртка (аналог chat-mode-config)
   - [lib/ai/professor-pipeline.ts](../../lib/ai/professor-pipeline.ts) → `professor:pipeline-analyze` + `pipeline-execute` + `pipeline-synthesize`
3. tsc/build, мануальный тест пользователем, commit
4. СТОП → ждём подтверждения перед Этапом 4

---

## Блокеры / Вопросы

Нет. Всё валидировано.

---

## Known issues (не относятся к ТЗ-1, из логов)

- `[MemoryRetrieve] Failed (graceful degradation): Voyage AI API error (403)` — Voyage API ключ возвращает 403, RAG retrieval падает с graceful degradation. Не связан с ТЗ-1, существующий background issue. Нужно проверить VOYAGE_API_KEY в .env.local.
- DevPanel не показывает модель для service-chat (Бен, project-creation). В route.ts есть emit debug events при `isSimplyDevMode`, но клиентский ServiceChatCore не подписан на DevPanelProvider. Отдельный таск вне ТЗ-1.
