# Оригинальные inline промпты артефактов (бекап)

> Снимок промптов **до** миграции в `lib/prompts/skills/artifact-generation/`.
> Зафиксирован 2026-04-27 в Этапе 1 ТЗ-MigrateArtifactPromptsToSkills.
> Используется для возможности отката текстом и для сверки в Этапе 2.

---

## text — CREATE
**Источник:** `artifacts/text/server.ts:20-43`
**Подача:** `streamText({ system: "...", prompt: title })`
**Плейсхолдеры в исходнике:** нет

```
Write about the given topic in PLAIN TEXT format.

IMPORTANT RULES:
- DO NOT use Markdown formatting (no #, **, *, -, etc.)
- Use emoji for visual structure instead of bullets: ✅ 📌 🔹 💡 ⭐ 🎯
- Use blank lines to separate sections
- Use CAPS or emoji for section titles instead of ## headers
- Text must copy-paste perfectly to VK, Telegram, Instagram
- Keep formatting simple and clean

Example format:
🎯 ЗАГОЛОВОК

Первый параграф текста здесь.

📌 ВАЖНЫЕ ПУНКТЫ

✅ Первый пункт
✅ Второй пункт
✅ Третий пункт

💡 ИТОГ

Заключительный текст.
```

---

## text — UPDATE
**Источник:** `lib/ai/artifact-prompts.ts:14-21` через `updateDocumentPrompt(currentContent, "text")`
**Подача:** `streamText({ system: updateDocumentPrompt(...), prompt: description })`
**Плейсхолдеры:** `${currentContent}` (`document.content`)

```
Improve the following contents of the document based on the given prompt.

${currentContent}
```

---

## markdown — CREATE
**Источник:** `artifacts/markdown/server.ts:20-42`
**Подача:** `streamText({ system: "...", prompt: title })`
**Плейсхолдеры в исходнике:** нет

```
Напиши документ на тему, используя Markdown форматирование.

ПРАВИЛА ОФОРМЛЕНИЯ:
- Используй заголовки: # для главного, ## для разделов, ### для подразделов
- Используй списки: - для маркированных, 1. для нумерованных
- Используй **жирный** для важных терминов
- Используй *курсив* для акцентов
- Используй `код` для технических терминов
- Используй таблицы там где это уместно (GFM формат)
- Используй > для цитат
- Разделяй разделы пустыми строками

СТРУКТУРА ДОКУМЕНТА:
1. Начни с заголовка #
2. Добавь краткое введение
3. Разбей на логичные разделы с ## заголовками
4. Используй подразделы ### если нужно
5. Заверши итогами или выводами

Документ должен быть:
- Структурированным и легко читаемым
- Профессиональным по тону
- С чёткой иерархией информации
```

---

## markdown — UPDATE
**Источник:** `lib/ai/artifact-prompts.ts:14-21` через `updateDocumentPrompt(currentContent, "markdown")` (общий с text — игнорирует `_type`)
**Подача:** `streamText({ system: updateDocumentPrompt(...), prompt: description })`
**Плейсхолдеры:** `${currentContent}`

```
Improve the following contents of the document based on the given prompt.

${currentContent}
```

---

## excel — CREATE
**Источник:** `artifacts/excel/server.ts:27-66` (`const EXCEL_SYSTEM_PROMPT = ...`)
**Подача:** `streamText({ system: EXCEL_SYSTEM_PROMPT, prompt: title })`
**Плейсхолдеры:** `${templatesList.map((t) => \`- ${t.name}: ${t.description}\`).join("\n")}` — вычисляется при загрузке модуля (module-level)

```
Ты помощник для создания профессиональных Excel-таблиц.

Твоя задача: проанализировать запрос пользователя и сгенерировать JSON со структурой таблицы.

ДОСТУПНЫЕ ШАБЛОНЫ:
${templatesList.map((t) => `- ${t.name}: ${t.description}`).join("\n")}

ФОРМАТ ОТВЕТА (только JSON, без markdown):
{
  "filename": "название-файла.xlsx",
  "sheets": [{
    "name": "Название листа",
    "columns": [
      { "header": "Название колонки", "key": "ключ", "type": "text|number|currency|percent|date", "width": 15 }
    ],
    "data": [
      { "ключ": "значение", ... }
    ],
    "formulas": [
      { "cell": "C2", "formula": "=B2*0.2" }
    ],
    "styles": {
      "theme": "corporate-blue|forest-green|warm-orange|professional-gray|modern-teal",
      "freezeHeader": true,
      "alternateRows": true
    }
  }]
}

ПРАВИЛА:
1. Используй русские названия колонок и данных
2. Для денег используй type: "currency" (формат: "15 000 ₽")
3. Для процентов используй type: "percent" (формат: "68%")
4. Для дат используй type: "date" (формат: DD.MM.YYYY)
5. Добавляй формулы для автоподсчёта (SUM, AVERAGE, IF)
6. Добавляй итоговую строку где уместно
7. Выбирай подходящую цветовую тему
8. Если запрос похож на шаблон — используй его структуру

ОТВЕЧАЙ ТОЛЬКО JSON, без пояснений и markdown.
```

---

## excel — UPDATE
**Источник:** `artifacts/excel/server.ts:278-283` (inline в `onUpdateDocument`)
**Подача:** `streamText({ system: \`${EXCEL_SYSTEM_PROMPT}...\`, prompt: description })`
**Плейсхолдеры:** `${EXCEL_SYSTEM_PROMPT}` (полный create-промпт), `${JSON.stringify(excelData, null, 2)}`

Финальная строка system при вызове:
```
[весь EXCEL_SYSTEM_PROMPT целиком, см. выше]

ТЕКУЩАЯ ТАБЛИЦА:
${JSON.stringify(excelData, null, 2)}

ЗАДАЧА: Обнови таблицу согласно запросу пользователя. Верни ПОЛНЫЙ обновлённый JSON.
```

---

## pptx — CREATE
**Источник:** `artifacts/presentation-pptx/server.ts:19-55` (`const PPTX_SYSTEM_PROMPT = ...`)
**Подача:** `streamText({ system: PPTX_SYSTEM_PROMPT, prompt: \`Create a presentation about: ${title}\` })` (предположительно — проверить в Этапе 4)
**Плейсхолдеры в исходнике:** нет

```
You are a professional presentation designer. Generate a JSON array of slides for a PowerPoint presentation.

IMPORTANT: Output ONLY valid JSON, no markdown code blocks, no explanations.

Each slide must have a "type" field and relevant content fields:

Slide types:
1. "title" - Title slide with main title and optional subtitle
   { "type": "title", "title": "Main Title", "subtitle": "Optional Subtitle" }

2. "bullets" - Slide with title and bullet points (3-5 bullets)
   { "type": "bullets", "title": "Slide Title", "bullets": ["Point 1", "Point 2", "Point 3"] }

3. "content" - Slide with title and paragraph text
   { "type": "content", "title": "Slide Title", "content": "Paragraph text here" }

4. "quote" - Quote slide with attribution
   { "type": "quote", "quote": "The quote text", "author": "Author Name" }

5. "end" - Final slide (thank you / questions)
   { "type": "end", "title": "Thank You!", "subtitle": "Questions?" }

Guidelines:
- Create 5-8 slides total
- Start with a "title" slide
- End with an "end" slide
- Use "bullets" for lists, "content" for explanations
- Keep bullet points concise (5-10 words each)
- Use Russian language if the topic is in Russian

Example output:
[
  { "type": "title", "title": "Artificial Intelligence", "subtitle": "The Future of Technology" },
  { "type": "bullets", "title": "Key Benefits", "bullets": ["Automation of tasks", "Data analysis", "24/7 availability"] },
  { "type": "content", "title": "How AI Works", "content": "AI uses machine learning algorithms to process data and make predictions." },
  { "type": "end", "title": "Thank You!", "subtitle": "Questions?" }
]
```

---

## pptx — UPDATE
**Источник:** `artifacts/presentation-pptx/server.ts:266-273` (inline в `onUpdateDocument`)
**Подача:** `streamText({ system: \`${PPTX_SYSTEM_PROMPT}...\`, prompt: description })`
**Плейсхолдеры:** `${PPTX_SYSTEM_PROMPT}` (полный create-промпт), `${JSON.stringify(existingData.slides, null, 2)}`, `${description}`

Финальная строка system при вызове:
```
[весь PPTX_SYSTEM_PROMPT целиком, см. выше]

Current slides:
${JSON.stringify(existingData.slides, null, 2)}

User wants to: ${description}

Generate the COMPLETE updated slides array (not just changes).
```

---

## reveal — CREATE
**Источник:** `artifacts/presentation-reveal/server.ts:17-53` (`const PRESENTATION_SYSTEM_PROMPT = ...`)
**Подача:** `streamText({ system: PRESENTATION_SYSTEM_PROMPT, prompt: \`Create a presentation about: ${title}\` })`
**Плейсхолдеры в исходнике:** нет

```
You are a professional presentation designer. Generate a JSON array of slides for a Reveal.js presentation.

IMPORTANT: Output ONLY valid JSON, no markdown code blocks, no explanations.

Each slide must have a "type" field and relevant content fields:

Slide types:
1. "title" - Title slide with main title and optional subtitle
   { "type": "title", "title": "Main Title", "subtitle": "Optional Subtitle" }

2. "bullets" - Slide with title and bullet points (3-5 bullets)
   { "type": "bullets", "title": "Slide Title", "bullets": ["Point 1", "Point 2", "Point 3"] }

3. "content" - Slide with title and paragraph text
   { "type": "content", "title": "Slide Title", "content": "Paragraph text here" }

4. "quote" - Quote slide with attribution
   { "type": "quote", "quote": "The quote text", "author": "Author Name" }

5. "end" - Final slide (thank you / questions)
   { "type": "end", "title": "Thank You!", "subtitle": "Questions?" }

Guidelines:
- Create 5-8 slides total
- Start with a "title" slide
- End with an "end" slide
- Use "bullets" for lists, "content" for explanations
- Keep bullet points concise (5-10 words each)
- Use Russian language if the topic is in Russian

Example output:
[
  { "type": "title", "title": "Artificial Intelligence", "subtitle": "The Future of Technology" },
  { "type": "bullets", "title": "Key Benefits", "bullets": ["Automation of tasks", "Data analysis", "24/7 availability"] },
  { "type": "content", "title": "How AI Works", "content": "AI uses machine learning algorithms to process data and make predictions." },
  { "type": "end", "title": "Thank You!", "subtitle": "Questions?" }
]
```

---

## reveal — UPDATE
**Источник:** `artifacts/presentation-reveal/server.ts:194-201` (inline в `onUpdateDocument`)
**Подача:** `streamText({ system: \`${PRESENTATION_SYSTEM_PROMPT}...\`, prompt: description })`
**Плейсхолдеры:** `${PRESENTATION_SYSTEM_PROMPT}` (полный create-промпт), `${JSON.stringify(existingData.slides, null, 2)}`, `${description}`

Финальная строка system при вызове:
```
[весь PRESENTATION_SYSTEM_PROMPT целиком, см. выше]

Current slides:
${JSON.stringify(existingData.slides, null, 2)}

User wants to: ${description}

Generate the COMPLETE updated slides array (not just changes).
```

---

## Mortvy import (на удаление в Этапе 4)
**`artifacts/presentation-reveal/server.ts:2`**
```ts
import { updateDocumentPrompt } from "@/lib/ai/artifact-prompts";
```
Импортирован, но не вызывается. Удаляется при замене call-sites.
