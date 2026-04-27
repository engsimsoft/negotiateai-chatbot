# TZ_DocumentTruncationSilent

**Impact:** 🟥 high
**Найдено:** 2026-04-27 при обсуждении виджета контекста (после ТЗ-FixSimplyMemory v3.100.1)
**Источник:** прямой вопрос владельца «что произойдёт при загрузке большого PDF на границе сжатия»

## Проблема

При загрузке больших документов в Simply chat происходит **молчаливое обрезание содержимого**, без UI-предупреждения пользователю. Пользователь не знает что часть документа не дошла до модели и думает что Simply «глупый» когда модель не находит данные из обрезанной части.

### Конкретные точки обрезания

**1. PDF — обрезание на 50K символов** ([app/(chat)/api/files/upload/route.ts:8,186-189](../../app/(chat)/api/files/upload/route.ts#L186-L189))

```ts
const PDF_TEXT_MAX_CHARS = 50_000;
// ...
const wasTruncated = pdfResult.text.length > PDF_TEXT_MAX_CHARS;
const extractedText = wasTruncated
  ? `${pdfResult.text.slice(0, PDF_TEXT_MAX_CHARS)}\n...[содержимое обрезано, показаны первые ${PDF_TEXT_MAX_CHARS} символов из ${pdfResult.text.length}, всего страниц: ${pdfResult.pageCount}]`
  : pdfResult.text;
```

- Берутся **первые 50K символов**, конец отбрасывается
- В текст добавляется маркер «...содержимое обрезано»
- Файл сохраняется в blob storage в обрезанном виде
- **UI о факте обрезания не уведомляет** — пользователь видит только превью успешной загрузки

**2. DOCX/TXT/CSV/Excel — нет лимита на извлечённый текст** ([app/(chat)/api/files/upload/route.ts:145-175](../../app/(chat)/api/files/upload/route.ts#L145-L175))

- Размер файла ограничен 20 MB на upload
- Текст извлекается **целиком** (mammoth для DOCX, xlsx.sheet_to_csv для Excel, raw decode для TXT/CSV)
- Огромный извлечённый текст попадает в новое сообщение чата
- Дальше при Compaction срабатывает Edge case B ([lib/ai/compaction/prepare-messages.ts:319-327](../../lib/ai/compaction/prepare-messages.ts#L319-L327)) — обрезается сверху до hard cap (80K токенов) с маркером `TRUNCATION_MARKER`
- Тоже без UI-уведомления

### Несогласованность правил

- PDF (текстовый): жёсткий лимит 50K char, обрезается **снизу** (хвост)
- PDF (скан): **нет лимита**, файл идёт целиком в Haiku через chat-vision routing (ADR 055). Один скан высокого разрешения = ~190K токенов реально (замер 2026-04-27)
- DOCX/CSV/TXT/Excel: нет лимита на upload, может обрезаться **сверху** в Compaction (другое поведение, другой маркер)
- Все режимы: без UI-предупреждения

**PDF-сканы — отдельная боль:** один большой скан занимает почти всё окно модели (195K из 200K), Compaction не помогает (estimator его не видит, см. [TZ_EstimatorIgnoresAttachments](TZ_EstimatorIgnoresAttachments.md)). Стоит ₽24+ за один запрос на Haiku и проедает почти весь бюджет.

### Почему «испорченный документ» хуже отсутствия

Цитата владельца: «зачем нам испорченный документ?». Если пользователь хочет работать с большим документом — у Simply есть отдельный канал **Библиотека** (xAI Collections, без ограничений на размер, ADR 056). Но сейчас:
- Молчаливое обрезание подталкивает пользователя думать что Simply работает с документом целиком
- Модель цитирует обрезанную версию как полную → ложная уверенность в результатах
- Решение через Библиотеку существует, но пользователь о нём не знает в момент upload

## Предложение решения

### 1. Унифицированный лимит на upload

Один порог `MAX_INLINE_DOCUMENT_CHARS = 50_000` (или другое согласованное число) для **всех** типов документов: PDF, DOCX, Excel, TXT, CSV.

### 2. Отказ вместо молчаливого обрезания

Если извлечённый текст > лимита — **отказывать на upload**:

```ts
return NextResponse.json({
  error: "DOCUMENT_TOO_LARGE",
  message: "Документ слишком большой для чата (NN страниц / NN символов). Загрузите его в Библиотеку — там нет ограничений и можно работать с любым размером.",
  hint: "library",
}, { status: 413 });
```

### 3. UI-обработка ошибки

В `multimodal-input.tsx` показать toast с понятным текстом + кнопкой «Открыть Библиотеку» (deep link `/library/upload`).

### 4. Edge case B в Compaction — оставить как safety net

Compaction `truncateMessageTopText` ([prepare-messages.ts:348](../../lib/ai/compaction/prepare-messages.ts#L348)) остаётся для исторических сообщений с уже-обрезанными вложениями (legacy чаты). Новые сообщения с large documents до Compaction не должны доходить — отказ на upload.

## Что НЕ делаем

- Не меняем поведение Library (xAI Collections) — там лимиты другие, документы обрабатываются полностью.
- Не меняем `truncateMessageTopText` в Compaction (safety net для legacy кейсов).
- Не меняем размер лимита blob upload (20 MB) — это про размер файла, не про размер извлечённого текста.

## Оценка

- Правка `app/(chat)/api/files/upload/route.ts`: добавить unified lim + 413 ответ для DOCX/CSV/TXT/Excel/PDF когда extracted text > limit
- Правка `multimodal-input.tsx`: специальная toast-обработка `DOCUMENT_TOO_LARGE` с deep link на `/library/upload`
- Тесты: PDF 100K char, DOCX 100K char, отказ + ссылка на Library

**Время:** 0.5-1 сессия.

## Источник

Обсуждение в финале фикса виджета контекста, 2026-04-27. Владелец заметил что я ответил неточно про «обрезание PDF на upload» — попросил объяснить, что обнаружило молчаливое обрезание и для PDF и для других форматов.
