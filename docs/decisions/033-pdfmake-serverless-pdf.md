# ADR 033: pdfmake для серверной генерации PDF

**Дата:** 2026-03-02
**Статус:** Принято
**Версия:** 3.62.0

## Контекст

Meeting Recorder (ТЗ-MR2) требует экспорт документов в PDF с поддержкой кириллицы и markdown-форматирования. PDF генерируется на сервере (API route) в serverless-окружении Vercel.

Требования:
- Кириллица (русский язык) без артефактов
- Markdown → PDF: заголовки, списки, таблицы, blockquotes, bold/italic
- Работа в serverless (без headless Chrome)
- A4, header/footer на каждой странице

## Решение

**pdfmake** (v0.3.5) + **unified/remark** для парсинга markdown.

Конвейер: `Markdown → remark-parse → mdast AST → pdfmake Content[] → PDF buffer`

### Ключевые решения

1. **pdfmake/js/Printer** — серверный импорт (не `src/printer`, который ESM-only)
2. **Roboto** из `node_modules/pdfmake/fonts/` — встроенный шрифт с кириллицей, не нужно бандлить .ttf
3. **async createPdfKitDocument** — в v0.3.5 метод стал Promise-based
4. **remark-gfm** — поддержка GFM-таблиц в markdown

## Причины

1. **Serverless-friendly** — чистый Node.js, без headless Chrome (Puppeteer/Playwright требуют >50MB runtime)
2. **Кириллица из коробки** — Roboto уже в пакете, не нужен font bundling
3. **Markdown AST** — remark уже в проекте (briefing), повторное использование зависимостей
4. **Стабильность** — pdfmake проверен годами, 25K+ stars

## Альтернативы

| Вариант | Почему отклонён |
|---------|----------------|
| **Puppeteer/Playwright** | 50-100MB runtime, cold start 5-10s, не подходит для serverless |
| **@react-pdf/renderer** | React-based, сложнее для markdown конверсии, ограниченные GFM-таблицы |
| **pdf-lib** | Low-level API, нет markdown layout engine, пришлось бы писать layouter |
| **jsPDF** | Слабая поддержка кириллицы, browser-ориентирован |

## Последствия

**Плюсы:**
- Быстрая генерация (< 1s для типичного документа)
- Нулевой cold start overhead
- Полная кириллица без настройки
- Поддержка сложного форматирования (таблицы, blockquotes, вложенные списки)

**Минусы:**
- Roboto вместо Source Sans 3 (основной шрифт проекта) — визуальное расхождение с веб-версией
- pdfmake API не типизирован полностью (нужен `@ts-expect-error` для импорта)
- v0.3.5 breaking changes: async API, новый путь импорта (`js/Printer` вместо `src/printer`)

## Файлы

- `lib/meeting/pdf-generator.ts` — конвертер markdown → pdfmake → PDF
- `app/(chat)/api/meeting/export-pdf/route.ts` — API endpoint
- `package.json` — +pdfmake, +@types/pdfmake
