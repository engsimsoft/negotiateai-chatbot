# ТЗ: MIGRATE-ARTIFACT-PROMPTS-TO-SKILLS

**Серия:** Simply_Migration
**Дата:** 2026-04-27
**Версия проекта на момент старта:** см. `package.json`

## Цель

Перенести inline промпты артефактов (5 типов: text/markdown/excel/pptx/reveal, операции create + update) из TypeScript-кода в файловую систему по стандарту Anthropic Agent Skills. Промпты остаются неизменными по содержанию — меняется только место хранения и механизм загрузки. Подготовка к Шагу 7 (A/B Sonnet vs Kimi K2.6 vs Grok 4.20).

## Ключевое требование — провайдер-агностичность

Все 10 файлов (5× SKILL.md + 5× references/update.md) пишутся без привязки к Sonnet или любой другой модели. Никаких `<thinking>`-XML, никаких model-specific конструкций. Цель — чтобы тот же файл работал одинаково при подаче в любую модель из A/B-теста Шага 7.

## Что мигрируем

| Артефакт | Откуда (create) | Откуда (update) |
|---|---|---|
| text | `artifacts/text/server.ts` inline | `lib/ai/artifact-prompts.ts` (общий с markdown) |
| markdown | `artifacts/markdown/server.ts` inline | `lib/ai/artifact-prompts.ts` (общий с text) |
| excel | `artifacts/excel/server.ts` inline (`EXCEL_SYSTEM_PROMPT`) | `artifacts/excel/server.ts` inline (отдельный, использует `${EXCEL_SYSTEM_PROMPT}` + delta) |
| pptx | `artifacts/presentation-pptx/server.ts` inline (`PPTX_SYSTEM_PROMPT`) | `artifacts/presentation-pptx/server.ts` inline (отдельный, использует `${PPTX_SYSTEM_PROMPT}` + delta) |
| reveal | `artifacts/presentation-reveal/server.ts` inline (`PRESENTATION_SYSTEM_PROMPT`) | `artifacts/presentation-reveal/server.ts` inline (отдельный, использует `${PRESENTATION_SYSTEM_PROMPT}` + delta) |

`image` тип — пропускаем (server-нет, только `client.tsx` — мёртвая запись для отдельного backlog `TZ_RemoveImageArtifactDeadCode`).

## Куда мигрируем

```
lib/prompts/skills/artifact-generation/
├── loader.ts                     ← новый файл, loadArtifactSkill()
├── text/
│   ├── SKILL.md
│   └── references/update.md
├── markdown/
│   ├── SKILL.md
│   └── references/update.md
├── excel/
│   ├── SKILL.md
│   └── references/update.md
├── pptx/
│   ├── SKILL.md
│   └── references/update.md
└── reveal/
    ├── SKILL.md
    └── references/update.md
```

10 markdown-файлов + 1 loader. Для text и markdown — физическое дублирование общего update-промпта в обе update.md (не shared/, не симлинк). Когда `TZ_PerTypeUpdatePrompts` поедет — разойдутся независимо.

## Контракт SKILL.md

```yaml
---
name: artifact-<kind>
description: Generates <kind> artifact content. Loaded deterministically via taskId artifact:<kind>.
---

# Artifact: <Kind Title>

[create-промпт без изменений; плейсхолдеры через {{var}} где нужно]

For update operations, see references/update.md.
```

**Frontmatter:**
- `name` — глобально уникальный (префикс `artifact-` обязателен — иначе коллизия с существующим `document/create-text-document` в registry)
- `description` — third person, что + когда (Anthropic best practice). Поясняет что детерминированный, не model-invocation
- Других полей не добавлять (`tools`, `allowed-tools` — model-invocation features, нам не нужны)

**Тело:**
- Императивная форма ("Generate...", не "You should generate...")
- Содержимое create-промпта переносится **как есть, без правок**
- В конце — markdown-ссылка на `references/update.md`

## Контракт references/update.md

```markdown
# Artifact: <Kind Title> — Update

[update-промпт без изменений; плейсхолдеры через {{var}}]
```

Без frontmatter (это reference-файл, не самостоятельный skill). Содержимое update-промпта переносится **как есть**.

## Плейсхолдеры (зафиксированный список)

| kind | SKILL.md (create) | references/update.md |
|---|---|---|
| text | — | `{{currentContent}}` |
| markdown | — | `{{currentContent}}` |
| excel | `{{templatesList}}` | `{{templatesList}}`, `{{currentExcelData}}` |
| pptx | — | `{{currentSlides}}`, `{{description}}` |
| reveal | — | `{{currentSlides}}`, `{{description}}` |

Notes:
- `{{description}}` для pptx/reveal — потому что в текущем коде `description` идёт **и** в system, **и** в `prompt: description`. Это особенность текущего кода (дублирование), не миграционный вопрос — сохраняем поведение, в Шаге 7 PE может переосмыслить.
- Для excel `{{templatesList}}` есть и в create, и в update (потому что update переиспользует `EXCEL_SYSTEM_PROMPT` целиком).
- Для excel/pptx/reveal `references/update.md` содержит **полный** update system prompt (включая копию create-секции). Физическое дублирование — приемлемо при условии integrity-теста.
- **Caller форматирует данные перед передачей**: `templatesList` — уже строка (`templatesList.map(...).join('\n')`); `currentExcelData` — уже `JSON.stringify(..., null, 2)`. Loader не делает форматирование.

## Изменения в коде

### Новый loader: `lib/prompts/skills/artifact-generation/loader.ts`

```ts
import type { ArtifactKind } from "@/components/artifact";

export type ArtifactSkillOp = "create" | "update";

export function loadArtifactSkill(
  kind: ArtifactKind,
  op: ArtifactSkillOp,
  vars?: Record<string, string>,
): string;
```

- Для `create` — читает `lib/prompts/skills/artifact-generation/<kind>/SKILL.md`, парсит frontmatter через `gray-matter`, возвращает body
- Для `update` — читает `lib/prompts/skills/artifact-generation/<kind>/references/update.md`, возвращает содержимое
- Использует существующий `render()` из `lib/prompts/template.ts` для подстановки `{{var}}`
- Кэш **сырого template** (после чтения файла, до render) — гейт `process.env.NODE_ENV === 'production'`. В dev кэш отключен → HMR работает, правки `.md` применяются сразу

### Замена в call-sites (5 файлов)

В каждом из `artifacts/<kind>/server.ts`: заменить inline create-промпт и inline update-промпт на вызов `loadArtifactSkill()`. Сигнатура `streamText({ system, prompt })` не меняется — только источник `system`-строки.

Пример (excel):
```ts
// onCreateDocument
const system = loadArtifactSkill("excel", "create", {
  templatesList: templatesList.map((t) => `- ${t.name}: ${t.description}`).join("\n"),
});

// onUpdateDocument
const system = loadArtifactSkill("excel", "update", {
  templatesList: templatesList.map((t) => `- ${t.name}: ${t.description}`).join("\n"),
  currentExcelData: JSON.stringify(excelData, null, 2),
});
```

### Удаление

- `lib/ai/artifact-prompts.ts` — удалить файл целиком (после замены импортов на loader в text/markdown server.ts)
- Inline промпты-константы из 5 server.ts (`EXCEL_SYSTEM_PROMPT`, `PPTX_SYSTEM_PROMPT`, `PRESENTATION_SYSTEM_PROMPT`, inline в text/markdown create) — удалить
- Mortvy import `updateDocumentPrompt` из `artifacts/presentation-reveal/server.ts:2` — удалить (он импортируется но не вызывается; обнаружено в ANALYSIS)
- Любые временные re-exports после миграции (если возникнут — должны исчезнуть в этом же ТЗ)

## Что НЕ делаем (граничные условия)

- Не оптимизируем промпты под конкретную модель (это Шаг 7)
- Не разделяем общий update text+markdown на два разных промпта (это `TZ_PerTypeUpdatePrompts`)
- Не трогаем image тип артефакта
- Не меняем сигнатуру `streamText({ system, prompt })` в call-sites — только источник system-строки
- Не трогаем `getModel(taskId)` и attachment к `artifact:*` taskId
- Не интегрируем skills в `/dev/models` (это для Шага 7, когда будет смысл превью)

## Верификация

1. **TypeScript:** `pnpm exec tsc --noEmit` зелёный после каждой задачи
2. **Integrity-тест** (новый): для excel/pptx/reveal — body `SKILL.md` (без frontmatter и без последней ссылки на references) содержится как substring в `references/update.md`. Защита от тихого расхождения create/update в будущем.
3. **Production smoke** для каждого из 5 типов:
   - Открыть Simply Chat → попросить создать артефакт каждого типа → артефакт генерится корректно (как до миграции)
   - Открыть существующий артефакт → попросить отредактировать → update работает
4. **Поиск зомби-кода:** `grep -r "createDocumentSystemPrompt\|updateDocumentPrompt\|EXCEL_SYSTEM_PROMPT\|PPTX_SYSTEM_PROMPT\|PRESENTATION_SYSTEM_PROMPT"` по `lib/` + `artifacts/` ничего лишнего не находит
5. **Размеры файлов:** каждый `SKILL.md` ≤ 500 строк, каждый `references/update.md` ≤ 200 строк (текущие промпты гораздо меньше — должно сойтись с запасом)

## Бекап

До миграции — копия текущих промптов в `specs/Simply_Migration/TZ_MigrateArtifactPromptsToSkills/original-prompts.md` (одним файлом, для возможности отката текстом). Файл переедет в `_archive/` вместе с папкой ТЗ при финализации — итоговое местоположение совпадёт с архитектурным требованием (`_archive/Simply_Migration/TZ_MigrateArtifactPromptsToSkills/original-prompts.md`).

## Ожидаемый результат

- 10 новых .md файлов в `lib/prompts/skills/artifact-generation/<kind>/`
- 1 новый файл `lib/prompts/skills/artifact-generation/loader.ts`
- 5 server.ts с inline-промптами заменены на вызов загрузчика
- `lib/ai/artifact-prompts.ts` — удалён
- A/B-тест в Шаге 7 разблокирован: можно подменить модель в `DEFAULT_TASK_MODELS` без правки промптов

---

**Источник ТЗ:** Архитектор (финальная версия после уточнения placeholder-механики и integrity-теста). См. `ANALYSIS.md` для деталей кода.
