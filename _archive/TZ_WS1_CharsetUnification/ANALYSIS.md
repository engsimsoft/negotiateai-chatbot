# Анализ ТЗ-WS1: Charset Detection + Унификация Web Fetcher

## Резюме

Три задачи в одном ТЗ:
1. **Charset detection** — добавить определение кодировки в `fetchPage()` (windows-1251, koi8-r и пр.)
2. **Улучшить fallback** — если Readability не справился, извлекать текст из семантических тегов
3. **Унифицировать web-fetcher** — заменить дублирующую логику в `web-fetcher.ts` на вызов `fetchPage()`

---

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.
> Каждая рекомендация требует согласования с архитектором.

### ✅ Согласен с ТЗ

- **Шаг 1 (зависимости)** — `chardet` + `iconv-lite` — ОК, нужны оба. В проекте их нет, `chardet` покрывает windows-1251/koi8-r/ISO-8859-5, `iconv-lite` — конвертация. Альтернативы (TextDecoder API) не поддерживают windows-1251 в Node.js стабильно.
- **Шаг 2 (charset detection pipeline)** — Алгоритм из 6 шагов (HTTP header → meta tag → chardet → decode) — ОК, это стандартный подход. Порядок приоритетов правильный.
- **Шаг 4 (унификация web-fetcher)** — ОК, дублирование очевидное. `web-fetcher.ts:21-46` почти дословно повторяет `fetch-page.ts:38-83`: fetch → response.text() → JSDOM → Readability → textContent cleanup.

### ⚠️ Рекомендую изменить

| # | Было (ТЗ) | Рекомендация | Обоснование из кода |
|---|-----------|--------------|-------------------|
| 1 | Шаг 3: "cheerio уже в проекте — использовать для fallback" | **Использовать JSDOM DOM API вместо cheerio** для fallback-извлечения | В `fetch-page.ts:51` мы уже создаём `new JSDOM(html)` — документ уже распаршен. Можно вызвать `dom.window.document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li')` без дополнительного импорта cheerio. Это: (a) не добавляет импорт в `fetch-page.ts`, (b) не парсит HTML дважды, (c) чище архитектурно. Cheerio остаётся в `telegram-fetcher.ts` где JSDOM не используется. |
| 2 | Шаг 4: "Унифицировать web-fetcher → использовать fetchPage()" | **Согласен, но нужно учесть разницу параметров** | `web-fetcher.ts` использует `MAX_CONTENT_LENGTH = 1000` символов (briefing-config.ts:16), а `fetchPage()` по умолчанию 10000. При вызове из web-fetcher нужно передавать `MAX_CONTENT_LENGTH` явно. Также timeout: web-fetcher использует `FETCH_TIMEOUT_MS = 10000` (briefing-config.ts:4), а fetchPage — 15000. Оба параметра уже принимаются fetchPage() как аргументы — просто нужно не забыть передать. |

### ❓ Требует уточнения

- **meta tag парсинг (шаг 2.3)**: ТЗ предлагает "ASCII-safe парсинг первых 2048 байт". Планирую использовать простой regex на `buffer.toString('ascii')` для первых 2048 байт — этого достаточно для `<meta charset="windows-1251">` и `<meta http-equiv="Content-Type" content="text/html; charset=windows-1251">`. Не вижу причин тянуть cheerio для этого. **Согласен ли архитектор?**

---

## Детальный анализ кода

### fetch-page.ts (целевой файл)
- **Строка 50**: `const html = await response.text()` — корень проблемы. Вызывает TextDecoder с UTF-8, для windows-1251 возвращает мусор.
- **Строки 55-73**: Fallback при неудаче Readability — regex strip всех тегов. Работает, но теряет структуру (заголовки, списки слипаются в кашу).
- **Интерфейс `FetchPageResult`** (строки 12-17): title, content, url, originalLength — менять НЕ нужно.
- **Сигнатура `fetchPage()`** (строки 33-36): pageUrl, maxLength, timeoutMs — менять НЕ нужно.

### web-fetcher.ts (файл на унификацию)
- **Строки 21-46**: Дублирует fetch + JSDOM + Readability из fetch-page.ts
- **Разница**: возвращает `FetchResult { items: RawContent[], errors: string[] }` вместо `FetchPageResult`
- **Маппинг** `FetchPageResult → RawContent`: прямолинейный — добавить `sourceName`, `sourceLanguage`, убрать `originalLength`
- **Error handling**: web-fetcher ловит ошибки и возвращает `{ items: [], errors: [...] }`, а fetchPage — throws. Нужна обёртка try/catch.

### Потребители
- **fetchUrl tool** (`fetch-url.ts`): вызывает `fetchPage()` напрямую — изменения прозрачны
- **Briefing pipeline** (`source-fetchers/index.ts:39`): вызывает `fetchWeb()` — после унификации всё продолжит работать через тот же интерфейс

---

## Потенциальные риски

1. **Edge case: chardet может ошибиться** — если буфер слишком короткий или контент смешанный. Mitigation: приоритет HTTP header > meta > chardet, и fallback на UTF-8 если ничего не определилось.
2. **iconv-lite bundle size** — содержит таблицы всех кодировок. На сервере (Next.js API routes) это не проблема, в клиентский бандл не попадёт.
3. **SPA-сайты (vc.ru)** — Readability может не справиться если контент загружается через JS. Это существующая проблема, charset detection её не решает. В ТЗ упомянуто "Level 2 Jina подхватит в следующем ТЗ".

---

## Зависимости

- Установка: `chardet`, `iconv-lite` (+ `@types/chardet` если нужно)
- Существующие: `@mozilla/readability`, `jsdom`, `cheerio` — уже в проекте
- Затронутые файлы: `fetch-page.ts`, `web-fetcher.ts`
- Не затронуты: `rss-fetcher.ts`, `telegram-fetcher.ts`, `fetch-url.ts` (потребитель, но интерфейс не меняется)

---

## Оценка сложности

- [x] Простое (1 сессия)
- [ ] Среднее (3-5 сессий)
- [ ] Сложное (5+ сессий)

Все изменения в 2 файлах, интерфейсы не меняются, новых UI-компонентов нет.
