# ТЗ-BR3: Интеграция промпта аналитика от PE

**Версия:** 1.0 | **Дата:** 2026-02-19
**Зависимости:** ТЗ-BR1 (backend), файл промпта от PE
**Результат:** Промпт аналитика загружается из .md файла, tier передаётся, topicId "top" поддержан

---

## Суть

PE подготовил промпт аналитика брифинга (`briefing-analyst.md`). Нужно: подключить .md файл вместо inline-промпта, протянуть tier в данные, поддержать блок "Главное" с topicId "top".

---

## 1. Подключить .md промпт

### Файл

PE кладёт промпт в: `lib/prompts/briefing/briefing-analyst.md`

### Изменения в `lib/briefing/briefing-analyzer.ts`

Заменить функцию `buildAnalyzerPrompt()` на загрузку из файла:

```typescript
import fs from "fs";
import path from "path";

const PROMPT_PATH = path.join(process.cwd(), "lib", "prompts", "briefing", "briefing-analyst.md");
const PROMPT_TEMPLATE = fs.readFileSync(PROMPT_PATH, "utf-8");

function buildAnalyzerPrompt(...): string {
  return PROMPT_TEMPLATE
    .replace("{{LANGUAGE}}", language === "ru" ? "Russian" : language)
    .replace("{{MAX_ITEMS}}", String(maxItems))
    .replace("{{TOPIC_REFERENCE}}", topicRef)
    .replace("{{DATE}}", today)
    .replace("{{TOTAL_SOURCES_CHECKED}}", String(totalSourcesChecked))
    .replace("{{TOTAL_CANDIDATES}}", String(totalCandidates));
}
```

Паттерн тот же что в `project-manager.md` и `project-creation.md` — уже используется в проекте (см. `service-chat/route.ts`).

---

## 2. Протянуть tier

### В `briefing-filter.ts`

FilteredItem уже содержит `sourceName`. Добавить поле `tier`:

```typescript
// В filteredItemSchema добавить:
tier: z.string().optional(),
```

### В `briefing-analyzer.ts`

При формировании текста кандидатов — добавить tier в строку:

Было:
```
[1] SourceName (language)
```

Стало:
```
[1] SourceName (language) [Tier: original]
```

Tier берётся из `briefing_sources.tier`. Если неизвестен — `[Tier: unknown]`.

### В source-fetchers

Добавить `tier` в `RawContent` тип и передавать из `briefing_sources` через цепочку:
- `route.ts` → добавить `tier` в `sourcesToFetch`
- `fetchSource()` → прокидывать `tier` в возвращаемые `RawContent`
- Или проще: в `route.ts` создать Map<sourceName, tier> и подставлять в analyzer напрямую

Выбрать проще — Map в route.ts, не трогая фетчеры.

---

## 3. Поддержать topicId "top"

### В Zod-схеме (`briefing-analyzer.ts`)

topicId уже string — дополнительная валидация не нужна. Но если есть enum — добавить "top".

### В UI (BR2)

При рендере блоков: если `topicId === "top"` — рендерить как выделенный блок «Главное» (🔴 emoji, bg-primary/5). Это уже заложено в ТЗ-BR2.

**Важно:** Items с importance "high" в блоке "top" НЕ дублируются в тематических блоках. Аналитик сам распределяет — что в "top", что в тематический блок.

---

## 4. Что НЕ менять

- Zod-схему выходных данных — формат BriefingJSON тот же
- Двухэтапный пайплайн (Flash → Pro) — без изменений
- Fallback на gemini-2.5-pro — сохранить
- Логику route.ts — минимальные правки (только tier Map)

---

## 5. Проверка

1. `POST /api/briefing/generate` — работает как раньше
2. В выходном JSON есть блок с `topicId: "top"` первым
3. Summary написаны в стиле PE (живой русский, без канцелярита)
4. Tier передаётся в данных аналитика
5. При fallback на gemini-2.5-pro — тоже работает

---

**Версия релиза:** patch к 3.27.0 (или 3.27.1)
