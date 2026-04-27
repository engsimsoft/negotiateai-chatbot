# Анализ ТЗ-MigrateArtifactPromptsToSkills

## Изученная документация

Чисто-внутренний рефакторинг файловой структуры: ни один внешний API/SDK не вызывается по-новому. Перепроверены **внутренние** контракты:

| Технология | Файл-источник | Что подтверждено |
|---|---|---|
| Vercel AI SDK v6 `streamText({ system, prompt })` | `artifacts/*/server.ts` | Сигнатура не меняется. Меняется только источник строки `system`. |
| `gray-matter` (frontmatter parser) | `lib/prompts/builder/registry.ts:12`, `skill-loader.ts:10` | Уже используется. Парсит YAML frontmatter из `SKILL.md`. |
| `lib/prompts/template.ts` `render()` | `lib/prompts/template.ts:23` | Regex-based `\{\{(\w+)\}\}` подстановка. `undefined`/`null` → `''`. Есть `extractVariables()` — пригодится для теста полноты vars. |
| `lib/prompts/builder/skill-loader.ts` `loadSkill()`, `loadSkillReference()` | `skill-loader.ts:44-96` | Существует. Использует `getSkillMetadata()` из registry, парсит frontmatter. **Не делает** `render()`. **Не имеет** NODE_ENV-gated кэша. |
| `registry.ts` `getSkillsRegistry()` | `lib/prompts/builder/registry.ts:54-96` | Сканит автоматически все `lib/prompts/skills/<cat>/<name>/SKILL.md`. Категории с префиксом `_` пропускаются. |
| Anthropic Agent Skills (формат convention) | публичный announcement Anthropic | `name + description` frontmatter, опциональная папка `references/`. Используем как convention, не как API-интеграцию. |

**Замечание по правилу 1:** ТЗ не вызывает новые внешние API, только реструктурирует файлы и переиспользует существующие функции (`render()`, `gray-matter`). Поэтому глубокий WebFetch актуальной документации не требуется. Внутренние SSOT-контракты выше — реальный источник истины для этого ТЗ.

## Резюме

Перенос 5 inline create + 5 inline update промптов из TS-кода в `.md` по convention Anthropic Agent Skills. Главная сложность — runtime интерполяция (`${templatesList}`, `${currentContent}`, `${excelData}`, etc.) — решается через placeholder-подстановку `{{var}}` через существующий `render()`. Для excel/pptx/reveal `references/update.md` физически дублирует create-часть (защита integrity-тестом).

## Рекомендации разработчика (Код-ревью)

### ✅ Согласен с ТЗ

- Использование существующего `render()` из `lib/prompts/template.ts` вместо своего `replace`
- Префикс `artifact-` в `name` frontmatter — избегает коллизии с `document/create-text-document`
- Кэш сырого template (до render), gated на `NODE_ENV === 'production'`
- Удаление `lib/ai/artifact-prompts.ts` целиком
- Integrity-тест для excel/pptx/reveal как защита от тихого расхождения create/update
- Caller форматирует данные перед передачей в loader (уже строка, уже JSON.stringify)
- Бекап оригинальных промптов

### ⚠️ Уточнения / расхождения с ТЗ архитектора

| # | Пункт | Уточнение | Обоснование из кода |
|---|---|---|---|
| 1 | Бекап в `specs/_archive/Simply_Migration/...` | Положить в **активную** папку ТЗ (`specs/Simply_Migration/TZ_MigrateArtifactPromptsToSkills/original-prompts.md`). При финализации папка целиком уезжает в `_archive/`, итоговое местоположение совпадёт. | Convention `_archive/` — для **завершённых** ТЗ. Класть туда файлы во время активной работы — нарушение convention. |
| 2 | `loadArtifactSkill()` через `loadSkill()` | Loader **не использует** registry/`loadSkill()`. Читает напрямую через `fs.readFileSync` + `gray-matter`. | (а) `loadSkill()` лезет в registry, который кэширует metadata permanent (без NODE_ENV-гейта) — несовместимо с требованием dev-перезагрузки. (б) `loadSkill()` возвращает `Skill` объект с frontmatter, не строку — нужна доп. распаковка. (в) Эти 5 skills *не* предназначены для AI-invocation, не должны загрязнять общий пул `getSkillsRegistry()`. Однако registry **автоматически** их подхватит при сканировании папки. Это OK: `description` явно говорит "Loaded deterministically via taskId" — отпугнёт AI от вызова руками. |
| 3 | Mortvy import в `artifacts/presentation-reveal/server.ts:2` | `import { updateDocumentPrompt } from "@/lib/ai/artifact-prompts"` — **импортирован, но не вызывается** (line 194 инлайнит `${PRESENTATION_SYSTEM_PROMPT}`, а не зовёт функцию). При удалении `artifact-prompts.ts` этот import всё равно нужно удалить. Записал в scope ТЗ (раздел "Удаление" SPEC.md), не выношу в FINDINGS — это явный side-effect миграции. | reveal/server.ts:2 — `import { updateDocumentPrompt }`; reveal/server.ts:194 — `system: \`${PRESENTATION_SYSTEM_PROMPT}\\n\\nCurrent slides:...\\``. |
| 4 | `_template/SKILL.md` как образец | Игнорировать — он использует поле `tools: []` и пишет на русском. Наши skills должны иметь только `name + description`, провайдер-агностичны. | `lib/prompts/skills/_template/SKILL.md:7` содержит `tools: []` — отсутствует в нашем контракте. |
| 5 | Структура папок | ТЗ указал `lib/prompts/skills/artifact-generation/<kind>/` — соответствует convention `<category>/<skill-name>/SKILL.md` из registry. Категория `artifact-generation` будет автоматически зарегистрирована в `getSkillsRegistry()`. ОК. | `registry.ts:64-66` сканит все non-`_`-prefix категории. |
| 6 | Тест-фреймворк | В проекте может не быть jest/vitest. Integrity-проверка — реализуется как standalone Node script `scripts/integrity-artifact-skills.ts` (если фреймворка нет) или регулярный test файл (если есть). Уточняю в Этапе 6. | Проверю `package.json` test scripts. |

### ❓ Требует уточнения

Нет — все вопросы закрыты в обмене с архитектором (placeholder-механика согласована, integrity-тест согласован, размещение бекапа — мелкое уточнение в моей зоне).

## Потенциальные риски

1. **Тихое расхождение create/update** в excel/pptx/reveal при будущем редактировании SKILL.md без обновления update.md. **Митигация:** integrity-тест.
2. **HMR не подхватит правки .md в dev** если кэш не gated. **Митигация:** `NODE_ENV === 'production'` гейт в loader.
3. **Registry автоматически подхватит artifact-generation/ skills** — они появятся в `getSkillsRegistry()`. **Митигация:** description говорит "Loaded deterministically via taskId" — отпугивает AI-invocation. Если в будущем понадобится явно скрыть — переименовать категорию в `_artifact-generation/` (registry скипает `_`-prefix).
4. **Дублирование `description`** в pptx/reveal (в `prompt:` и в `system:` через `{{description}}`) сохраняется. **Митигация:** это поведение текущего кода, переосмысление — задача Шага 7.
5. **Build pipeline auto-migration:** `npm run build` запускает `tsx lib/db/migrate && next build` (правило памяти). Это ТЗ не трогает БД, миграций нет — `build` безопасен.

## Зависимости

**До начала:** ничего (изолированный рефакторинг).

**Затронутые компоненты:**
- `artifacts/text/server.ts`, `artifacts/markdown/server.ts`, `artifacts/excel/server.ts`, `artifacts/presentation-pptx/server.ts`, `artifacts/presentation-reveal/server.ts`
- `lib/ai/artifact-prompts.ts` (удаляется)
- `lib/prompts/skills/artifact-generation/` (новая папка)
- `tests/` или `scripts/` (новый integrity-тест)

**Не затрагивается:**
- `getModel()`, `task-assignments.ts`, `model-catalog.ts`
- `streamText` API, `dataStream` протокол
- `createDocumentHandler()` фабрика
- UI: `components/artifact-*.tsx`
- БД: схема, миграции, queries

## Оценка сложности

- [x] **Простое (1-2 сессии)** — изолированный рефакторинг, нет внешних API, нет UI, нет БД
- [ ] Среднее (3-5 сессий)
- [ ] Сложное (5+ сессий)

Реалистично — 1 сессия на разработку + мануальный смок + финализация.
