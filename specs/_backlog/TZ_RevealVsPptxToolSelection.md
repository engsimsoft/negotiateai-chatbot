# TZ_RevealVsPptxToolSelection

**Impact:** 🟧 medium
**Найдено:** Этап 7 ТЗ-MigrateArtifactPromptsToSkills (2026-04-27)
**Источник:** FINDINGS #2 ТЗ-MigrateArtifactPromptsToSkills

## Проблема

AI стабильно выбирает `kind: "presentation-pptx"` когда пользователь просит `reveal`. Reveal-артефакт практически недоступен через AI-канал в Simply Chat.

## Воспроизведение

Промпт владельца: `Сделай интерактивную Reveal.js презентацию про переговоры, 5 слайдов`
→ AI вызывает `createDocument({ kind: "presentation-pptx", title: "..." })`
→ Создаётся pptx-артефакт, не reveal

Повторно с явными словами «Reveal», «HTML-презентация», «interactive web» — тот же результат.

## Где код

- Tool definition `createDocument` — в [lib/ai/tools/create-document.ts](lib/ai/tools/create-document.ts) (или соседнем). Описание `kind` enum даёт модели слабые сигналы для разделения pptx/reveal.

## Гипотезы решения

1. **Уточнить tool description** для kind enum:
   ```ts
   kind: z.enum(["text", "markdown", "excel", "presentation-pptx", "presentation-reveal"])
     .describe(`...
       - presentation-pptx: PowerPoint .pptx файл (для скачивания, корпоратив, офис)
       - presentation-reveal: интерактивная HTML/web-презентация Reveal.js (для просмотра в браузере, fullscreen)
     `)
   ```

2. **Системный промпт:** «Если пользователь упоминает Reveal.js, HTML-презентацию, интерактивную, web-презентацию → выбирай presentation-reveal. Если PowerPoint, .pptx, корпоративная → presentation-pptx».

3. **Альтернатива: deprecate reveal.** Если reveal используется редко, возможно стоит схлопнуть в один тип презентации (pptx). Спросить владельца — сколько reveal-артефактов в БД, востребованы ли они.

## Воспроизведение через БД

```sql
SELECT text AS kind, COUNT(*) FROM "Document"
WHERE text LIKE 'presentation%' GROUP BY text;
```

## Влияние

medium — одна фича недоступна через AI; если reveal всё равно мало используется — можно deprecate без починки.

## Оценка

0.2 сессии (правка description) или 1 сессия (deprecate с UI cleanup)
