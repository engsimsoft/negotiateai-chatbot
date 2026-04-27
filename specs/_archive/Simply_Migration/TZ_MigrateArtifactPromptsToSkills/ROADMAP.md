# Roadmap ТЗ-MigrateArtifactPromptsToSkills

## Этапы

### Этап 1: Бекап оригиналов
**Статус:** ✅ Завершён
**Цель:** Зафиксировать текущие промпты текстом для возможности отката
**Задачи:**
- [x] Создать `original-prompts.md` с дословными копиями всех 5 inline create-промптов (text, markdown, excel, pptx, reveal) и текущих update-конструкций (text/markdown через `updateDocumentPrompt`, excel/pptx/reveal — inline в `onUpdateDocument`)

**Файлы:**
- Создаётся: `specs/Simply_Migration/TZ_MigrateArtifactPromptsToSkills/original-prompts.md`

**Валидация:**
- Файл существует, содержит все 5 create + 5 update промптов с пометками `kind` и `op`

**Критерий готовности:** Файл создан, содержит дословные копии без правок.

---

### Этап 2: SKILL.md и references/update.md (10 файлов)
**Статус:** ✅ Завершён
**Цель:** Создать markdown-файлы со скопированными промптами + плейсхолдерами `{{var}}` где нужно
**Задачи:**
- [x] `lib/prompts/skills/artifact-generation/text/SKILL.md` (frontmatter + create promp без плейсхолдеров)
- [x] `lib/prompts/skills/artifact-generation/text/references/update.md` (`{{currentContent}}`)
- [x] `lib/prompts/skills/artifact-generation/markdown/SKILL.md`
- [x] `lib/prompts/skills/artifact-generation/markdown/references/update.md` (`{{currentContent}}`)
- [x] `lib/prompts/skills/artifact-generation/excel/SKILL.md` (`{{templatesList}}`)
- [x] `lib/prompts/skills/artifact-generation/excel/references/update.md` (полный create + delta; `{{templatesList}}` + `{{currentExcelData}}`)
- [x] `lib/prompts/skills/artifact-generation/pptx/SKILL.md` (без плейсхолдеров)
- [x] `lib/prompts/skills/artifact-generation/pptx/references/update.md` (полный create + delta; `{{currentSlides}}` + `{{description}}`)
- [x] `lib/prompts/skills/artifact-generation/reveal/SKILL.md` (без плейсхолдеров)
- [x] `lib/prompts/skills/artifact-generation/reveal/references/update.md` (полный create + delta; `{{currentSlides}}` + `{{description}}`)

**Файлы:**
- Создаются: 10 файлов в `lib/prompts/skills/artifact-generation/<kind>/`

**Валидация:**
- Все 10 файлов существуют
- Frontmatter корректен (`name: artifact-<kind>`, `description: ...`)
- Плейсхолдеры соответствуют таблице из SPEC.md
- Содержимое промптов **дословно** совпадает с original-prompts.md (с заменой `${js_expression}` на `{{var}}`)

**Критерий готовности:** `pnpm exec tsc --noEmit` зелёный (TS не зависит от .md, но для гигиены), файлы пишутся.

---

### Этап 3: Loader
**Статус:** ✅ Завершён
**Цель:** Реализовать `loadArtifactSkill(kind, op, vars?)` с кэшем и render
**Задачи:**
- [x] Создать `lib/prompts/skills/artifact-generation/loader.ts`
- [x] Реализовать `loadArtifactSkill(kind: ArtifactSkillKind, op: 'create'|'update', vars?: Record<string,string>): string` (узкий alias `ArtifactSkillKind = 'text'|'markdown'|'excel'|'pptx'|'reveal'` — соответствует именам папок)
- [x] Использовать `gray-matter` для парсинга frontmatter в SKILL.md (возвращаем `body`)
- [x] Использовать `render()` из `lib/prompts/template.ts` для подстановки `{{var}}`
- [x] Кэш сырого template gated на `process.env.NODE_ENV === 'production'`
- [x] Корректная обработка не-найденного файла (throw с понятным сообщением)
- [x] Strip trailing footer `"For update operations, see [references/update.md]..."` для CREATE (footer — навигация для разработчика, не должен попадать в system prompt модели)
- [x] Smoke-проверка через `tsx -e`: footer убирается, плейсхолдеры подставляются (text/create, text/update, excel/create, pptx/update, reveal/create) — все ✅

**Файлы:**
- Создаётся: `lib/prompts/skills/artifact-generation/loader.ts`

**Валидация:**
- `pnpm exec tsc --noEmit` — 0 ошибок
- Импорты `gray-matter`, `render`, `fs`, `path` корректны
- Тип `ArtifactKind` импортируется из `@/components/artifact`

**Критерий готовности:** Loader типизирован, читает все 10 файлов без ошибок при вызове.

---

### Этап 4: Замена call-sites (5 файлов)
**Статус:** ✅ Завершён
**Цель:** Заменить inline промпты на вызов loader
**Задачи:**
- [ ] `artifacts/text/server.ts`: убрать inline create system, заменить на `loadArtifactSkill('text', 'create')`. Заменить `updateDocumentPrompt(...)` на `loadArtifactSkill('text', 'update', { currentContent: document.content ?? '' })`. Убрать импорт `updateDocumentPrompt`. tsc check.
- [ ] `artifacts/markdown/server.ts`: то же самое, kind='markdown'. tsc check.
- [ ] `artifacts/excel/server.ts`: убрать `EXCEL_SYSTEM_PROMPT` константу, в onCreateDocument — `loadArtifactSkill('excel', 'create', { templatesList: ... })`, в onUpdateDocument — `loadArtifactSkill('excel', 'update', { templatesList: ..., currentExcelData: JSON.stringify(excelData, null, 2) })`. tsc check.
- [ ] `artifacts/presentation-pptx/server.ts`: убрать `PPTX_SYSTEM_PROMPT`, заменить create/update на loader (kind='pptx', vars: `currentSlides`, `description`). tsc check.
- [ ] `artifacts/presentation-reveal/server.ts`: убрать `PRESENTATION_SYSTEM_PROMPT`, убрать **mortvy import** `updateDocumentPrompt`. Заменить create/update на loader (kind='reveal'). tsc check.

**Файлы:**
- Изменяются: `artifacts/text/server.ts`, `artifacts/markdown/server.ts`, `artifacts/excel/server.ts`, `artifacts/presentation-pptx/server.ts`, `artifacts/presentation-reveal/server.ts`

**Валидация:**
- `pnpm exec tsc --noEmit` — 0 ошибок после каждого файла
- `grep -rn "EXCEL_SYSTEM_PROMPT\|PPTX_SYSTEM_PROMPT\|PRESENTATION_SYSTEM_PROMPT" artifacts/ lib/` — ничего не находит
- `grep -rn "updateDocumentPrompt" artifacts/ lib/` — ничего не находит (кроме самого `lib/ai/artifact-prompts.ts`, который удалится в Этапе 5)

**Критерий готовности:** Все 5 server.ts используют loader, inline промптов нет.

---

### Этап 5: Удаление artifact-prompts.ts
**Статус:** ✅ Завершён
**Цель:** Удалить мёртвый файл и ссылки
**Задачи:**
- [ ] `grep -rn "artifact-prompts" --include="*.ts" --include="*.tsx" .` — убедиться что после Этапа 4 нет импортов
- [ ] Удалить файл `lib/ai/artifact-prompts.ts`
- [ ] tsc check

**Файлы:**
- Удаляется: `lib/ai/artifact-prompts.ts`

**Валидация:**
- `pnpm exec tsc --noEmit` — 0 ошибок
- `grep -rn "artifact-prompts"` — пусто

**Критерий готовности:** Файл удалён, проект собирается.

---

### Этап 6: Integrity-скрипт
**Статус:** ✅ Завершён
**Цель:** Защита от тихого расхождения create/update в excel/pptx/reveal
**Задачи:**
- [ ] Создать `scripts/integrity-artifact-skills.ts` — для excel/pptx/reveal: читает SKILL.md (без frontmatter и без последней trailing-ссылки на references), читает references/update.md, проверяет substring containment
- [ ] Прогнать `pnpm exec tsx scripts/integrity-artifact-skills.ts` — должен пройти зелёным
- [ ] Добавить запись о скрипте в `scripts/README.md`

**Файлы:**
- Создаётся: `scripts/integrity-artifact-skills.ts`
- Изменяется: `scripts/README.md`

**Валидация:**
- Скрипт зелёный
- При искусственной правке SKILL.md (не отражённой в update.md) — скрипт падает с понятным сообщением (мини-проверка)

**Критерий готовности:** Скрипт работает, документирован.

---

### Этап 7: Production smoke (мануальный тест)
**Статус:** ✅ Завершён
**Цель:** Реальная проверка генерации артефактов в браузере
**Задачи:**
- [ ] `pnpm build` — успешен
- [ ] Запросить мануальный тест у владельца (см. список ниже)

**Мануальный тест-план:**
| # | Действие | Ожидание |
|---|---|---|
| 1 | Simply Chat → "напиши пост в Telegram про X" | Создаётся text-артефакт с emoji-форматированием (как до миграции) |
| 2 | Simply Chat → "напиши документ в Markdown про X" | Создаётся markdown-артефакт с заголовками |
| 3 | Simply Chat → "сделай таблицу бюджета" | Создаётся excel-артефакт со структурой |
| 4 | Simply Chat → "сделай презентацию про Y" | Создаётся pptx или reveal (в зависимости от настроек проекта) |
| 5 | Открыть text/markdown артефакт → "переделай в более формальный стиль" | Update работает, текст переписан |
| 6 | Открыть excel → "добавь столбец с НДС" | Update работает, столбец добавлен |
| 7 | Открыть pptx/reveal → "добавь слайд с выводами" | Update работает, слайд добавлен |

**Валидация:**
- Все 7 проверок ✅
- Логи в `/dev/models` (или DevPanel) показывают `taskId: artifact:<kind>` без ошибок

**Критерий готовности:** Владелец подтвердил OK.

---

### Этап 8: Финализация
**Статус:** ✅ Завершён
**Цель:** Документация, коммит, архивация
**Задачи:**
- [ ] Прочитать `DOCUMENTATION_GUIDE.md`
- [ ] Обновить `docs/ai-artifacts.md` (триггер `artifacts/*`) — упомянуть что промпты теперь в `lib/prompts/skills/artifact-generation/`
- [ ] Обновить `docs/architecture.md` (триггер новая папка `lib/prompts/skills/artifact-generation/`) — добавить ссылку
- [ ] Обновить `docs/ai-agents.md` (триггер `lib/prompts/skills/*`) — упомянуть новую категорию
- [ ] Обновить главный `CHANGELOG.md`
- [ ] Обновить `SIMPLY_STATUS.md` — отметить что A/B на Шаге 7 разблокирован
- [ ] `wc -l CLAUDE.md` ≤ 220 — НЕ редактировать (если архитектурный слой не появился; здесь только подкатегория `artifact-generation/`, не новый слой)
- [ ] Bump `package.json` (patch)
- [ ] Один коммит: `feat(tz-artifact-skills): миграция inline промптов артефактов в Anthropic Skills формат`
- [ ] `mv specs/Simply_Migration/TZ_MigrateArtifactPromptsToSkills _archive/Simply_Migration/`

**Файлы:**
- Изменяются: `docs/ai-artifacts.md`, `docs/architecture.md`, `docs/ai-agents.md`, `CHANGELOG.md`, `SIMPLY_STATUS.md`, `package.json`

**Валидация:**
- `pnpm exec tsc --noEmit` — 0 ошибок
- `pnpm build` — успешен
- `git log -1` — один коммит ТЗ создан

**Критерий готовности:** Папка ТЗ в архиве, документация обновлена, коммит создан.
