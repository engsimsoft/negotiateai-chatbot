# ТЗ-ATTACH-1 — PDF text extraction при upload — ANALYSIS

**Дата:** 2026-04-16
**Источник задачи:** [SIMPLY_ATTACHMENT_ARCHITECTURE.md — Слой 0](../Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md) + [backlog stub](../_backlog/TZ_ATTACH_PdfExtractionAtUpload.md)
**Статус:** Фаза 1 — Анализ завершён, ждём ответы Владимира на 4 открытых вопроса

---

## 1. Изученная документация (правило №0)

### pdf-parse v2 (mehmet-kozan)
- **Источник:** `node_modules/pdf-parse/README.md` (installed v2.4.5) + `dist/pdf-parse/cjs/index.d.cts`
- **Позиционирование:** "Pure TypeScript, cross-platform module for extracting text, images, and tables from PDFs. Run directly in your browser or in Node!"
- **Заявленная поддержка:** "Next.js + Vercel, Netlify, AWS Lambda, Cloudflare Workers" (прямое упоминание в README + live demo-репо `mehmet-kozan/vercel-next-app-demo`)
- **API v2 (breaking change от v1):**
  ```ts
  import { PDFParse } from "pdf-parse";
  const parser = new PDFParse({ data: Buffer });       // or { url: string }
  const textResult = await parser.getText();            // → { text, pages, ... }
  const infoResult = await parser.getInfo({ parsePageInfo: true }); // → { total, pages, info, ... }
  await parser.destroy();                               // cleanup
  ```
- **Нативные зависимости:** внутри — `pdfjs-dist` (legacy build `pdfjs-dist/legacy/build/pdf.mjs`, serverless-safe). **Нет** `canvas`, нет node-gyp, нет C++ build tools.

### unpdf (альтернатива)
- **Источник:** WebFetch GitHub `unjs/unpdf`
- **Позиционирование:** "PDF extraction and rendering across all JavaScript runtimes" (UnJS ecosystem)
- **Zero native deps**, serverless-optimized PDF.js build built-in
- **API:**
  ```ts
  import { extractText, getDocumentProxy } from "unpdf";
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  ```
- **Рекомендация 2026 сообщества:** несколько свежих гайдов (`dev.to`, `buildwithmatija.com`, `pkgpulse.com`) рекомендуют unpdf как default для Vercel serverless

### DEV-статья «Why pdf-parse fails on Vercel»
- **Источник:** WebFetch dev.to/chudi_nnorukam/serverless-pdf-processing-why-unpdf-beats-pdf-parse
- **Ключевой факт:** статья описывает **classic pdf-parse v1** (UniBe fork) — он тянет `pdfjs-dist` с опциональной `canvas` зависимостью → falls на Vercel с `Cannot find module 'canvas'` или segfault runtime
- **Важная оговорка:** статья **не проверяет явно** `pdf-parse@2` (mehmet-kozan pure TS rewrite). Её критика адресована legacy v1, не v2

### Вывод по выбору библиотеки
Обе библиотеки **технически подходят**. Реальная разница:

| Критерий | pdf-parse v2 | unpdf |
|---|---|---|
| Уже установлена в проекте | ✅ `^2.4.5` в package.json | ❌ новая dependency |
| Pure JS/TS | ✅ | ✅ |
| Vercel-safe | ✅ (README + live demo) | ✅ (built-in serverless PDF.js) |
| API | `new PDFParse({data}).getText()` | `extractText(proxy, {mergePages})` |
| Bundle size | средний (legacy pdfjs-dist) | меньше (serverless-optimized build) |
| Активность развития | активен (mehmet-kozan, 2025 rewrite) | активен (UnJS) |
| Community default 2026 для Vercel | слабее позиция | сильнее позиция |

**Моя рекомендация — Q1 для Владимира (см. ниже).** Склоняюсь к **pdf-parse v2** потому что «уже в проекте, уже типы установлены, не плодить deps», но unpdf — тоже нормальный выбор если хочется идти по 2026 community best practice.

---

## 2. Текущее состояние кода

### Точка интеграции — [app/(chat)/api/files/upload/route.ts](../../app/(chat)/api/files/upload/route.ts)

Структура:
- **L11:** File size limit 20 MiB
- **L38-47:** Dynamic imports паттерн (`getMammoth`, `getXLSX`) — серверное, fast-refresh friendly
- **L84:** Regex `fileExt` для расширения, **pdf не в списке** → нужно добавить
- **L86-172:** `isExcelFile` / `isDocumentFile` branches (каждый заканчивается своим `return NextResponse.json(...)`)
- **L174-180:** Fall-through — «For images and PDFs, upload as-is» → `put(originalFilename, ...)` с оригинальным contentType
- **Валидация MIME:** L16-34 список разрешённых типов, `application/pdf` уже разрешён

**Куда вставить PDF branch:** между `isDocumentFile` (L172) и «upload as-is» (L174). Симметрично DOCX/XLSX.

### Контракт upload API — клиент [components/multimodal-input.tsx:238-252](../../components/multimodal-input.tsx#L238)
```ts
const { url, pathname, contentType, originalFilename } = data;
return { url, name: originalFilename ?? pathname, contentType };
```
Клиент **игнорирует** любые кастомные поля response (`processed`, `fileType`, `pageCount`). Значит:
- **Контракт менять не нужно** — достаточно чтобы `contentType` в response был `text/plain` для текстового PDF
- `originalFilename` удобно переименовать в `.txt` (как DOCX/XLSX уже делают) — bonus: тогда история чата показывает корректное расширение

### Adapter в истории — [app/(chat)/api/chat/route.ts:252-344](../../app/(chat)/api/chat/route.ts#L252)
Функция `adaptHistoryToCapabilities` (новая в v3.90.2, SSOT через model-catalog capabilities) имеет branch для `application/pdf` на L311-316. **Этот branch нужно оставить** — он всё ещё покрывает edge case когда сканированный PDF был в истории через Haiku и затем follow-up пошёл на Grok (без documentSupport).

**Изменения в chat/route.ts — НЕ требуются.** Логика работает через SSOT model-catalog и не знает про upload pipeline.

### Skill — [lib/prompts/skills/document/analyze-document/SKILL.md](../../lib/prompts/skills/document/analyze-document/SKILL.md)
L18-20 — таблица типов файлов. После ТЗ-ATTACH-1 нужно обновить строку для `.pdf` — теперь текстовый PDF приходит как inline text (как DOCX), только сканированный — через vision-модель.

---

## 3. Side-effect finding (НЕ скоуп ТЗ, но зафиксировать)

**🚨 project files PDF extraction сломан.**

[app/(chat)/api/projects/[id]/files/route.ts:86-96](../../app/(chat)/api/projects/[id]/files/route.ts#L86) — использует **v1 legacy API**:
```ts
const pdfParse = require("pdf-parse");
const data = await pdfParse(Buffer.from(fileBuffer));  // ← v1 signature
return data.text;
```

Но установлен `pdf-parse@^2.4.5`, который — breaking change. v2 требует `new PDFParse({ data: buffer }).getText()` классовый API. Вызов `pdfParse(buffer)` как функции в v2 выкидывает ошибку → catch блок на L92 тихо возвращает `undefined` → `extractedContent` никогда не попадает в metadata → AI контекст проектов **не содержит содержимого загруженных PDF**.

**Рекомендация:** отдельным коммитом (в рамках этого же ТЗ-ATTACH-1 — связанный scope, «capability-agnostic PDF upload») или отдельный backlog stub — починить этот call site на v2 API. Нужен ответ Владимира в Q5 (см. ниже).

---

## 4. Открытые вопросы для Владимира

### Q1 — Какую PDF library использовать?
Моя рекомендация — **pdf-parse v2** (уже установлена, уже типы в devDeps, прецедент в проекте хотя и сломанный). Минусы: API более verbose, community momentum 2026 на unpdf.

Альтернатива — **unpdf**. Плюсы: чище API, серверлес-first design, лучше комьюнити-рекомендация 2026. Минусы: новая dependency, нужно добавлять отдельно.

**Я за pdf-parse v2** — но это вкусовой выбор, не critical. Если Владимир предпочитает unpdf — не сопротивляюсь.

### Q2 — Порог scan detection (avg chars per page)?
Backlog stub говорит «стартовое 30 chars/page, уточнить эмпирически». Согласен как старт. **Уточнение:** на старте без тестовой выборки трудно калибровать. Предлагаю **30 chars/page** как стартовое значение + **логирование** `[PDF Upload] avgCharsPerPage=N` при каждом upload → через неделю эмпирических данных решим поднимать/опускать.

Дополнительно: **минимум страниц** для применения эвристики. На 1-страничном PDF статистика ненадёжна. Предлагаю — при `pageCount === 1` использовать **absolute char threshold** (`text.length >= 100`) вместо avg. Согласен?

### Q3 — Ограничение на размер текстового PDF?
Архитектурный документ говорит «большие документы → KITT предлагает Экспертизу/Библиотеку, пороги эмпирически». Это — отдельный паттерн (KITT через системный промпт), **не входит в scope ТЗ-ATTACH-1**.

**Для ТЗ-ATTACH-1 нужен только технический cap** — защита от бесконечного потока символов в одном сообщении. Варианты:

| Cap | Pro | Con |
|---|---|---|
| Нет cap | Максимум инфы | Risk context overflow при 1000-страничном PDF |
| **200 KB text (~50K chars)** — симметрично project files [app/(chat)/api/projects/[id]/files/route.ts:250](../../app/(chat)/api/projects/[id]/files/route.ts#L250) | Проверенный порог | Может быть тесно для отчётов |
| 500 KB text (~125K chars) | Комфортно для больших докладов | Половина sliding window ~140K tokens |

**Моя рекомендация — 200 KB (~50K chars)** симметрично project files. Если Владимир хочет другой порог — ок.

**Также:** если PDF извлёкся, но превышает cap — truncate с маркером `\n...[содержимое обрезано, N страниц из M]` или fail и использовать Haiku fallback? Первое проще и уже паттерн у project files; второе сложнее но даёт полный контент. **Предлагаю truncate.**

### Q4 — Handling encrypted PDF / extraction errors?
Стандартный fallback — **catch → оставить как `application/pdf` → Haiku обработает через vision**. Симметрично как сейчас работает фейловер на DOCX (catch → throw 500). Но для PDF лучше graceful: encrypted PDF **может** читаться Haiku нативно, Vladimir не должен получать ошибку.

**Предлагаю:** wrapping `extractPdfText` в try/catch → при любой ошибке (corrupt / encrypted / scanned / недостаточно текста) **fall-through на стандартный PDF upload** (L174-180). Пользователь не видит ошибки, и Haiku всё ещё может помочь. Согласен?

### Q5 — Чинить сломанный project files PDF extractor в этом же ТЗ?
[Раздел 3](#3-side-effect-finding-не-скоуп-тз-но-зафиксировать) — project files PDF extraction сломан из-за v1→v2 breaking change, catch block swallow'ит ошибку.

Варианты:
- **A.** Чинить в рамках ТЗ-ATTACH-1 — связанный scope («capability-agnostic PDF upload»), один коммит
- **B.** Отдельный backlog stub `TZ_ProjectFilesPdfExtractFix` — минимальный 1-файловый фикс, отдельный commit
- **C.** Игнорировать (текущая v1-API-call тихо возвращает `undefined`, никакого красного флажка в UX)

**Моя рекомендация — A** (связанный scope, один проход), но это выбор Владимира. Если A — нужно решить уже сейчас (влияет на ROADMAP).

---

## 5. Что НЕ входит в scope ТЗ-ATTACH-1 (явная граница)

- **KITT «большие документы → Экспертиза/Библиотека»** — отдельный паттерн через системный промпт, не эта задача
- **Изображения (jpg/png)** — уже работает через Haiku routing
- **Сканированный PDF через OCR** — уже работает через Haiku native PDF
- **Batch extraction / queue** — не нужно, инлайн-extraction на upload достаточно
- **Индексация в MIND/Collections** — Слой 3, отдельные ТЗ
- **Поддержка DOCX-to-PDF auto-convert** — нет такого требования

---

## 6. После ответов Владимира — ROADMAP

Этапы (ориентировочно):
1. **Этап 1 (небольшой):** Интеграция в upload route — PDF branch, эвристика scan detection, логирование, cap — **1 файл**
2. **Этап 2 (если Q5=A):** Починить project files PDF extractor — **1 файл**
3. **Этап 3 (документация):** Обновить SKILL.md, CHANGELOG, версия в package.json
4. **Этап 4 (тест):** Мануальный тест — 3 кейса (текстовый PDF, сканированный PDF, encrypted/corrupt PDF)

**Эстимейт:** 1 сессия при быстрых ответах Владимира.

---

## 7. Ссылки

- [SIMPLY_ATTACHMENT_ARCHITECTURE.md — Слой 0](../Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md)
- [TZ_ATTACH_PdfExtractionAtUpload.md — backlog stub](../_backlog/TZ_ATTACH_PdfExtractionAtUpload.md)
- [app/(chat)/api/files/upload/route.ts](../../app/(chat)/api/files/upload/route.ts) — точка интеграции
- [app/(chat)/api/projects/[id]/files/route.ts](../../app/(chat)/api/projects/[id]/files/route.ts) — сломанный прецедент (Q5)
- [app/(chat)/api/chat/route.ts:252-344](../../app/(chat)/api/chat/route.ts#L252) — `adaptHistoryToCapabilities` (не трогать)
- [components/multimodal-input.tsx:238-252](../../components/multimodal-input.tsx#L238) — клиент upload (контракт)
- [lib/prompts/skills/document/analyze-document/SKILL.md](../../lib/prompts/skills/document/analyze-document/SKILL.md) — SKILL для обновления
