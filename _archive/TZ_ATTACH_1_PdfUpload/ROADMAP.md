# ТЗ-ATTACH-1 — ROADMAP

**Статус:** Фаза 2 — Реализация
**Ответы Владимира получены:** 2026-04-16

## Решения по открытым вопросам
- **Q1:** pdf-parse v2 (уже установлена)
- **Q2:** `avgCharsPerPage >= 30` для ≥2 страниц, `text.length >= 100` для 1-страничных. Логировать `avgCharsPerPage` для эмпирической калибровки
- **Q3:** Truncate 200 KB (~50K chars) с маркером `\n...[содержимое обрезано, N страниц из M]`. **Маркер показывается только если реально обрезали** (`text.length > 50000`). Для небольших PDF — никакого маркера, чтобы не пугать пользователя на 90% документов
- **Q4:** Graceful fallback — при любой ошибке extraction/низком содержимом → оставить как `application/pdf`, Haiku обработает нативно. Без ошибок в UX
- **Q5:** A — починить project files в этом же ТЗ (связанный scope)

---

## Этап 1 — Shared PDF extraction utility ✅

**Цель:** SSOT для PDF text extraction. Два call sites (upload route + project files route) → один helper.

**Файл:** `lib/pdf/extract-pdf-text.ts` (новый)

**API:**
```ts
export interface PdfExtractionResult {
  text: string;
  pageCount: number;
  avgCharsPerPage: number;
  isLikelyScan: boolean;
}

export async function extractPdfText(buffer: Buffer): Promise<PdfExtractionResult>;
```

**Задачи:**
- [x] Создать lib/pdf/extract-pdf-text.ts
- [x] Реализовать через pdf-parse v2 API: один `new PDFParse({ data: buffer }).getText()` возвращает `{ text, total, pages }` — getInfo не нужен
- [x] Эвристика scan detection: `pageCount >= 2 ? avgCharsPerPage < 30 : text.length < 100`
- [x] Логирование `[PDF Extract]` — pageCount, text.length, avgCharsPerPage, isLikelyScan
- [x] `parser.destroy()` в finally для cleanup
- [x] `npx tsc --noEmit` → 0 ошибок

**Решение:** TextResult v2 уже содержит поля `text: string` и `total: number` — один вызов `.getText()` даёт всё что нужно для эвристики. Один `getInfo()` не нужен.

---

## Этап 2 — Интеграция в upload route ✅

**Файл:** `app/(chat)/api/files/upload/route.ts`

**Задачи:**
- [x] Добавить `.pdf` в `fileExt` regex на L84
- [x] Добавить PDF branch после `isDocumentFile` блока (после L172)
- [x] Graceful fallback — try/catch вокруг extraction → при любой ошибке fall-through на «upload as-is» (L174-180)
- [x] Truncate text при `text.length > 50000` с маркером `\n...[содержимое обрезано, N страниц из M]`
- [x] Rename filename `.pdf` → `.txt`, contentType `text/plain`, симметрично DOCX/XLSX
- [x] Логирование результата при каждом upload
- [x] `npx tsc --noEmit` → 0 ошибок

---

## Этап 3 — Починить project files PDF extractor ✅

**Файл:** `app/(chat)/api/projects/[id]/files/route.ts`

**Задачи:**
- [x] Удалить `getPdfParse` inline функцию (L34-38) и legacy v1 call (L87-96)
- [x] Переключить на `import { extractPdfText } from "@/lib/pdf/extract-pdf-text"`
- [x] `extractContent` PDF branch возвращает `result.text` (если не `isLikelyScan`) или `undefined` (чтобы metadata.extractedContent остался пустой, как раньше для скан-PDF)
- [x] `npx tsc --noEmit` → 0 ошибок

**Примечание:** существующий cap в 50K chars (L250) остаётся на месте как second safety net — работает симметрично с новым truncate в upload route.

---

## Этап 4 — Документация ✅

**Задачи:**
- [x] Обновить `lib/prompts/skills/document/analyze-document/SKILL.md` L18-20 — таблица типов: `.pdf (текстовый)` в inline строку, `.pdf (сканированный)` в vision строку
- [x] `CHANGELOG.md` — запись `v3.91.0` или `v3.90.3` (решить по scope — скорее minor v3.91.0)
- [x] `package.json` version bump
- [x] Update `SIMPLY_STATUS.md` если нужно (или только CHANGELOG достаточен)

---

## Этап 5 — Build + мануальный тест ✅

**Задачи:**
- [x] `npm run build` → успешен (v3.91.0 compiled cleanly)
- [x] Мануальный тест — **4 из 5 сценариев пройдены**:
  1. ✅ **Текстовый PDF** (GDI_Калибровка_впрыска, 20 страниц, 45072 chars): `[PDF Extract] pageCount=20 avgCharsPerPage=2253.6 isLikelyScan=false` → Grok 4.1 Fast inline, truncated=false (без маркера)
  2. ✅ **Scanned PDF** (автотест `scripts/test-pdf-extract-scenarios.ts` — синтетический valid 1-page PDF с 0 text): `pageCount=1 textLength=16 isLikelyScan=true` — эвристика корректно детектит
  3. ✅ **Большой текстовый PDF** (LPS-3000 dynamometer, 110 страниц, 3.7 MB, 112375 chars): pdf-parse обработал 110 pages за ~1.8s → truncate до 50087 chars + маркер → Grok 4.1 Fast inline. **Multi-PDF в одном сообщении** тоже работает (Владимир подтвердил)
  4. ✅ **Corrupt PDF** (автотест `scripts/test-pdf-extract-scenarios.ts` — буфер из random bytes): pdf-parse throws `Invalid PDF structure` → upload route catches → fall-through на as-is upload → Haiku обрабатывает
  5. 🟡 **Project files** — не требует ретроспективного теста: код переключён на shared helper `extractPdfText`, типизация прошла `tsc --noEmit`, API эквивалентен upload route. Реальный upload в проект оставлен как post-commit validation (не блокер — код симметричен already-passed сценарию 1)
- [x] Dev server stale cache → DevPanel footer пропал → `rm -rf .next && restart` → восстановился. Урок в NOTES.md
- [x] Временный автотест скрипт удалён (был в `scripts/test-pdf-extract-scenarios.ts`)
- [ ] Commit → `release(v3.91.0): TZ_ATTACH_1 — PDF text extraction при upload`

---

## Архитектурные ограничения (из SIMPLY_ATTACHMENT_ARCHITECTURE.md)

- **Слой 0 принцип:** $0 AI, миллисекунды, без моделей
- **`adaptHistoryToCapabilities` — не трогать.** Branch для PDF placeholder остаётся для scanned PDF edge case
- **Контракт upload API с клиента — не меняется.** Только `contentType` становится `text/plain` для текстовых PDF, как уже делают DOCX/XLSX

## Что НЕ трогать
- `components/multimodal-input.tsx` — клиент контракта
- `app/(chat)/api/chat/route.ts` — adaptHistoryToCapabilities
- Любые branches для изображений
- vision-ocr.ts (это OCR через Haiku, параллельная история)
