# Roadmap ТЗ-ExpertiseCreateVisionRouting

**Создан:** 2026-04-21
**Версия проекта:** 3.97.0 → 3.98.0
**Статус:** 🔄 В работе (ожидает утверждения плана владельцем)

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 4 |
| Текущий этап | 1 |
| Сессий (оценка) | 1 |

**Краткая цель:** Унифицировать обработку вложений во всех chat modes (simply / expertise / create / project) через **capability-driven routing**. Единый fallback на Haiku 4.5 срабатывает только когда default-модель режима не тянет тип вложения. Закрывает падение `AI_UnsupportedFunctionalityError` на сканированных PDF в expertise/create.

---

## Этапы

### Этап 1: SSOT rename + unified routing module

**Статус:** ⬜ Не начат

**Цель:** Переименовать `simply-chat-vision` → `chat-vision` во всех активных call-site'ах; создать модуль `lib/ai/routing.ts` с `resolveActiveTaskId(...)` и `needsVisionFallback(...)` на базе capability из SSOT каталога.

**Задачи:**
- [ ] 1.1 `lib/ai/task-assignments.ts` — переименование `simply-chat-vision` → `chat-vision` в 4 местах: `TaskId` union, `DEFAULT_TASK_MODELS`, `DEFAULT_MAX_OUTPUT_TOKENS`, `TASK_DESCRIPTIONS`. Обновить комментарии-конвенции (раздел `// Simply Chat` → `// Chat vision fallback`).
- [ ] 1.2 Grep-аудит: `grep -rn "simply-chat-vision" lib/ app/` — починить все references в активных файлах (не трогать `_archive/` и `specs/Simply_xAI/SIMPLY_XAI_*`). Ожидаемые: `chat-mode-config.ts`, `tools/chat-tools.ts`, `scripts/debug-orphan-tool-use.ts`, composer/prompts.
- [ ] 1.3 Создать `lib/ai/routing.ts`:
  - `needsVisionFallback(parts, defaultTaskId): boolean` — проверяет capability default-модели против типов attachments
  - `resolveActiveTaskId(ctx): TaskId` — единая точка резолва: `{ chatMode, think, isProjectChat, tier, parts } → TaskId`
  - Unit-ready pure-function без I/O.
- [ ] 1.4 Удалить `hasAttachments()` из `chat/route.ts` — избыточен.
- [ ] 1.5 Проверить composer/prompts на hardcoded `simply-chat-vision` string references.

**Файлы:**
- `lib/ai/task-assignments.ts` — rename taskId
- `lib/ai/routing.ts` — **новый** модуль
- `lib/ai/chat-mode-config.ts` — если есть reference
- `lib/ai/tools/chat-tools.ts` — если есть reference
- `scripts/debug-orphan-tool-use.ts` — debug-скрипт
- `lib/prompts/builder/composer.ts` — проверить

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок (`Record<TaskId,...>` ловит все точки)
- [ ] `grep -rn "simply-chat-vision" lib/ app/ scripts/` — 0 вхождений в активных файлах
- [ ] `npm run build` — успешен (без запуска миграций: `next build` часть отработает)

**Критерий готовности:** Переименование полное; новый модуль `routing.ts` экспортирует две чистые функции; `chat/route.ts` пока не изменён (его обновим в Этапе 2).

---

### Этап 2: Wire unified routing в chat/route.ts + снятие gate'ов

**Статус:** ⬜ Не начат

**Цель:** Подключить `resolveActiveTaskId()` в основной chat handler; снять gate `chatMode === "simply"` с `adaptHistoryToCapabilities` и `convertTextFilesInAllMessages` — единый pipeline на все chat modes.

**Задачи:**
- [ ] 2.1 В `app/(chat)/api/chat/route.ts` (строки ~617-631): заменить if/else блок резолва `activeTaskId` на один вызов `resolveActiveTaskId({ chatMode, think, isProjectChat, tier, parts: message.parts })`.
- [ ] 2.2 Удалить `hasAttachments()` import + call site (больше не используется).
- [ ] 2.3 Строки ~988-998: снять gate `chatMode === "simply"` для `convertTextFilesInAllMessages` — применять ко всем chat modes.
- [ ] 2.4 Строки ~988-998: снять gate `chatMode === "simply"` для `adaptHistoryToCapabilities` — применять ко всем chat modes.
- [ ] 2.5 Проверить что `effectiveCatalogEntry?.capabilities` корректно резолвится для всех chat modes (не только simply) — сейчас уже так, но подтвердить после snятия gate.

**Файлы:**
- `app/(chat)/api/chat/route.ts` — routing block + pipeline gates

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — ⚠ накатит pending migrations, предупредить владельца ДО запуска
- [ ] 🧪 **Мануальный тест владельцем (smoke, 5 сценариев):**
  1. **expertise + сканированный PDF** (например CAD-чертёж без извлекаемого текста) → запрос проходит без `AI_UnsupportedFunctionalityError`, Haiku даёт анализ.
  2. **create + сканированный PDF** → то же.
  3. **simply + JPG/PNG** (например скриншот) → запрос идёт на **Grok 4.1 Fast** (не Haiku) — проверить в `ai_usage_log` последнюю запись: `taskId="simply-chat"`, модель Grok. Качество ответа — приемлемое.
  4. **expertise + JPG/PNG** → Grok 4.20 обрабатывает сам, `taskId="expertise"` в логе.
  5. **expertise без вложений** (простой текстовый запрос) → Grok 4.20 reasoning как раньше, регрессии нет.

**Критерий готовности:** Все 5 сценариев пройдены, владелец подтвердил OK.

---

### Этап 3: ADR + обновление документации

**Статус:** ⬜ Не начат

**Цель:** Зафиксировать capability-driven attachment routing как архитектурный принцип; обновить docs по Правилу 6.

**Задачи:**
- [ ] 3.1 Создать `docs/decisions/NNN-capability-driven-attachment-routing.md` (номер следующий по порядку в `docs/decisions/`). Контекст, альтернативы (дубли taskId / hardcoded hasAttachments), решение, следствия.
- [ ] 3.2 `docs/ai-chats-map.md` — обновить таблицу: `simply-chat-vision` → `chat-vision`, добавить строку что fallback работает для всех chat modes capability-driven.
- [ ] 3.3 `specs/Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md` — обновить блок «Слой 1 — KITT» про routing (теперь capability-driven, не хардкод на simply).

**Файлы:**
- `docs/decisions/NNN-*.md` — **новый** ADR
- `docs/ai-chats-map.md`
- `specs/Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md`

**Валидация этапа:**
- [ ] ADR читается связно, содержит «Почему не дубли taskId»
- [ ] grep-тест: `grep -oE '\b[a-z][a-z0-9-]+\b' docs/ai-chats-map.md | grep chat-vision` → 1+ вхождение; 0 вхождений `simply-chat-vision` (кроме history-раздела)

**Критерий готовности:** Три документа обновлены, ADR зафиксирован.

---

### Этап 4: Финализация

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../../DOCUMENTATION_GUIDE.md) — пройти чеклист.

**Статус:** ⬜ Не начат

**Задачи:**

**SQL-проверка БД (Claude):**
- [ ] `SELECT DISTINCT task_id FROM ai_usage_log WHERE created_at > NOW() - INTERVAL '1 day'` — подтвердить что `chat-vision` пишется в новых записях, `simply-chat-vision` — только в старых (pre-deploy).
- [ ] Проверить `/dev/models` overrides на `simply-chat-vision` ключ — если есть, миграция ключа (1 UPDATE) + записать в FINDINGS если что.

**Документация (обязательная):**
- [ ] Главный `CHANGELOG.md` — запись о ТЗ
- [ ] `SIMPLY_STATUS.md` — snapshot (не история)
- [ ] `package.json` — `3.97.0` → `3.98.0`
- [ ] ⛔ `CLAUDE.md` — НЕ трогать. `wc -l CLAUDE.md` ≤ 220.

**Документация (Правило 6 таблицы):**
- [ ] `docs/ai-chats-map.md` — триггер `lib/ai/task-assignments.ts`
- [ ] `docs/architecture.md` — триггер новый модуль `lib/ai/routing.ts`

**Backlog:**
- [ ] Удалить `specs/_backlog/TZ_ExpertiseCreateVisionRouting.md`
- [ ] Обновить `specs/_backlog/README.md` (убрать строку из High impact)
- [ ] Добавить запись в `_archive/BACKLOG_CLOSED.md` (исторический журнал)

**Git (единый коммит ТЗ — Правило 7):**
```bash
git status
git add [файлы всего ТЗ — без git add -A]
git commit -m "feat(tz-vision-routing): унификация capability-driven роутинга вложений"
```

**Архивация:**
- [ ] `mv specs/TZ_ExpertiseCreateVisionRouting/ _archive/`

**Финальная валидация:**
- [ ] Production-deploy (Vercel) — sanity-check через `/dev/models` что `chat-vision` есть в списке
- [ ] Ещё один smoke-тест на prod: скан-PDF в expertise → без ошибок

**Критерий готовности:** Один коммит создан, папка в архиве, долг удалён из `specs/_backlog/README.md`, CHANGELOG обновлён.

---

## Риски и Mitigation

| Риск | Mitigation |
|---|---|
| Переименование taskId ломает dev-overrides в БД (`model_overrides` table) | Этап 4 SQL-проверка + UPDATE при необходимости |
| Grep пропустит reference в prompts/composer | TS compiler поймает через strict Record<TaskId,...>; финальный `grep -rn` нулевой gate |
| Качество JPG на Grok 4.1 Fast хуже Haiku (ранее все картинки шли на Haiku в simply) | Этап 2 мануальный тест сценарий 3 — если не OK, не коммитим, возвращаемся в ANALYSIS с опцией «always-Haiku на simply» |
| adaptHistoryToCapabilities после снятия gate вырезает PDF из истории project chat | Claude tiers `documentSupport.supported=true` → PDF не вырезается. Проверено в ANALYSIS. |

---

## Gate-keeping

⛔ **Не начинать Этап N+1 без:**
- Все задачи текущего этапа `[x]` с реальной валидацией (tsc/build/браузер)
- Мануальный тест пройден там где требуется
- CHANGELOG + HANDOFF обновлены в конце сессии

⛔ **Не делать промежуточных коммитов** — Правило 7 WORKFLOW, один коммит в Этапе 4.
