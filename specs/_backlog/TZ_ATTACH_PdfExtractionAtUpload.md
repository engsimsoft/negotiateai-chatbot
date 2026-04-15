# ТЗ-ATTACH-1 — PDF text extraction при upload

**Статус:** Backlog, высокий приоритет
**Создано:** 2026-04-15 (после утверждения SIMPLY_ATTACHMENT_ARCHITECTURE.md)
**Источник:** [specs/Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md — Слой 0](../Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md)
**Блокирует:** снижение Haiku overhead для обычных текстовых PDF в Simply Chat

---

## Главный принцип (из архитектурного документа)

> **«Максимум работы при загрузке файла, минимум при разговоре.»**
> Чем больше извлечено из файла до начала чата — тем проще всей системе. Любая модель умеет работать с текстом. Не каждая модель умеет работать с файлами.

Эта задача — реализация **Слоя 0** документа для PDF. DOCX/XLSX/TXT/MD/CSV уже обрабатываются на upload в [app/(chat)/api/files/upload/route.ts](../../app/(chat)/api/files/upload/route.ts). PDF — пока нет, идёт как `application/pdf` file part → маршрут на Haiku. Нужно добавить PDF в ту же pipeline.

---

## Текущее vs целевое

| Сценарий | Сейчас | Целевое |
|---|---|---|
| Текстовый PDF (GDI-руководство, контракт, отчёт) | Upload → `application/pdf` → Haiku нативный PDF → ответ | Upload → pdf-parse извлекает текст → `text/plain` → Grok inline → ответ |
| Сканированный PDF (фото документа, отсканированный контракт) | Upload → `application/pdf` → Haiku → OCR via vision | Upload → pdf-parse возвращает мало текста → эвристика определяет скан → оставить как `application/pdf` → Haiku (как сейчас) |
| Большой PDF (>N страниц/символов) | Нет ограничений | KITT предлагает Экспертизу/Библиотеку (отдельная задача, возможно другой ТЗ) |

---

## Задачи

### 1. Выбор библиотеки

Проверить что уже есть в `node_modules/`:
- `pdfjs-dist` — полный PDF.js stack (большой)
- `pdf-parse` — обёртка над pdfjs-dist (простая, популярная, но может быть abandoned)
- `unpdf` — lightweight modern alternative

Проверить что Simply использует для Claude Vision OCR ([lib/ai/vision-ocr.ts](../../lib/ai/vision-ocr.ts) — extractTextFromPDF). Возможно там уже есть подходящая библиотека.

**Критерии выбора:**
- Работает на Vercel serverless (edge/node runtime)
- Не требует нативных зависимостей (poppler, etc)
- Корректно извлекает кириллицу (русские документы)
- Приемлемая производительность на 50-100 страничных PDF

### 2. Эвристика scan detection

**Принцип документа:**
> Извлечь текст библиотекой. Если количество символов на страницу ниже порога (~30 символов/страницу) — это скан или графика. Точный порог подобрать эмпирически.

Реализация:
```ts
const result = await extractPdfText(buffer);  // { text, pageCount }
const avgCharsPerPage = result.pageCount > 0 ? result.text.length / result.pageCount : 0;
const isScan = avgCharsPerPage < SCAN_THRESHOLD_CHARS_PER_PAGE;
```

Порог — эмпирически подобрать на реальных файлах Владимира. Стартовое значение: 30 chars/page.

### 3. Интеграция в upload route

[app/(chat)/api/files/upload/route.ts](../../app/(chat)/api/files/upload/route.ts) — добавить PDF branch после DOCX/XLSX логики:

```ts
if (fileType === "application/pdf" || fileExt === "pdf") {
  const pdfResult = await extractPdfText(buffer);
  const avgCharsPerPage = pdfResult.pageCount > 0
    ? pdfResult.text.length / pdfResult.pageCount
    : 0;

  if (avgCharsPerPage >= SCAN_THRESHOLD) {
    // Текстовый PDF → конвертируем в text/plain
    const textFilename = originalFilename.replace(/\.pdf$/i, ".txt");
    const data = await put(textFilename, Buffer.from(pdfResult.text, 'utf-8'), {
      access: "public",
      contentType: "text/plain",
    });
    return NextResponse.json({
      ...data,
      originalFilename,
      originalContentType: "application/pdf",
      processed: true,
      fileType: "pdf-text",
      pageCount: pdfResult.pageCount,
    });
  }
  // Сканированный PDF → оставляем как есть, Haiku обработает через vision
  // (fall-through на общий upload блок)
}
```

### 4. Обновление analyze-document SKILL

[lib/prompts/skills/document/analyze-document/SKILL.md](../../lib/prompts/skills/document/analyze-document/SKILL.md) — обновить таблицу типов файлов:

**Сейчас (после v3.90.2):**
```
| .txt, .md, .docx, .csv | Содержимое уже inline в промпте |
| .pdf, .jpg, .png | Файл-аттачмент, маршрутизируется в vision-модель |
```

**После ТЗ-ATTACH-1:**
```
| .txt, .md, .docx, .csv, .pdf (текстовый) | Содержимое уже inline в промпте |
| .pdf (сканированный), .jpg, .png | Файл-аттачмент, маршрутизируется в vision-модель |
```

### 5. Чистка adaptHistoryToCapabilities

Функция `adaptHistoryToCapabilities` в [chat/route.ts](../../app/(chat)/api/chat/route.ts) содержит branch для `application/pdf` → placeholder. После ТЗ-ATTACH-1 этот branch срабатывает только для scan-PDF которые ушли на Haiku и потом в follow-up оказались в истории на Grok. Branch **нужно оставить** — это всё ещё валидный edge case для сканированных PDF.

---

## Definition of Done

- [ ] Выбрана PDF library, интегрирована в upload route (рядом с DOCX/XLSX)
- [ ] Эвристика scan detection работает на реальных файлах Владимира (тестировать на `GDI_Калибровка_впрыска_руководство.md.pdf` как positive и на отсканированном документе как negative)
- [ ] Текстовый PDF → `text/plain` → Grok читает inline → в `ai_usage_log` виден один вызов на `simply-chat` (не `simply-chat-vision`)
- [ ] Сканированный PDF → остаётся `application/pdf` → Haiku обрабатывает нативно → как раньше
- [ ] Follow-up вопрос о текстовом PDF → Grok отвечает из inline-содержимого в том же persistent чате
- [ ] analyze-document SKILL.md обновлён
- [ ] `npm run build` успешен
- [ ] Мануальный тест — положительный случай + отрицательный случай
- [ ] CHANGELOG запись
- [ ] ADR (опционально) — обоснование выбора библиотеки и порога эвристики

---

## Риски и открытые вопросы

- **Vercel serverless cold start** — PDF библиотеки могут увеличить bundle размер upload route
- **Кириллица в PDF** — нужна проверка что extraction корректно работает на русских документах
- **Большие PDF (>100 страниц)** — возможно нужно ограничение на размер или streaming extraction
- **Encrypted PDF** — graceful fallback на Haiku при ошибке extraction
- **Порог эвристики** — 30 chars/page это стартовое значение, нужно эмпирическое уточнение

---

## Ссылки

- [SIMPLY_ATTACHMENT_ARCHITECTURE.md — Слой 0](../Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md)
- [app/(chat)/api/files/upload/route.ts](../../app/(chat)/api/files/upload/route.ts) — точка интеграции
- [lib/ai/vision-ocr.ts](../../lib/ai/vision-ocr.ts) — существующая PDF обработка для Claude Vision (свериться)
- [lib/prompts/skills/document/analyze-document/SKILL.md](../../lib/prompts/skills/document/analyze-document/SKILL.md) — обновление после
