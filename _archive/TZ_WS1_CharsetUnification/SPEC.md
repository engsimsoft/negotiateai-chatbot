# ТЗ-WS1: Charset Detection + Унификация Web Fetcher

**Приоритет:** Высокий  
**Оценка:** 1 сессия  
**Затрагивает:** `lib/ai/tools/fetch-page.ts`, `lib/briefing/source-fetchers/web-fetcher.ts`

---

## Цель

`fetchPage()` становится единственным shared utility для извлечения веб-контента. Русские сайты на windows-1251/koi8-r читаются без кракозябр. Дублирование логики между fetch-page.ts и web-fetcher.ts устранено.

## Зачем

Сейчас ~80% русскоязычных источников возвращают мусор или пустоту. Это ломает:
- Briefing pipeline (утренний брифинг)
- fetchUrl tool (чтение страниц по запросу пользователя)
- Онбординг (агент проверяет источники)
- Будущие сценарии экспертизы (анализ сайтов конкурентов)

---

## Что сделать

### 1. Установить зависимости

```bash
npm install chardet iconv-lite
```

- `chardet` — определение кодировки из binary buffer (поддерживает windows-1251, koi8-r, ISO-8859-5)
- `iconv-lite` — конвертация кодировок в UTF-8

### 2. Charset detection в fetch-page.ts

В функции `fetchPage()` изменить порядок получения HTML:

**Было:** `const html = await response.text()` (предполагает UTF-8)

**Стало:**
1. Получить response как `ArrayBuffer`: `const buffer = Buffer.from(await response.arrayBuffer())`
2. Определить charset из HTTP-заголовка `Content-Type` (парсить `charset=...`)
3. Если не найден — искать `<meta charset="...">` или `<meta http-equiv="Content-Type" content="...; charset=...">` в первых 2048 байтах (достаточно ASCII-safe парсинга, meta-теги всегда в ASCII)
4. Если не найден — `chardet.detect(buffer)` для автоопределения
5. Если кодировка не UTF-8 — `iconv.decode(buffer, detectedEncoding)`
6. Если UTF-8 или не определено — `buffer.toString('utf-8')`
7. Полученный HTML передать в JSDOM как раньше

### 3. Улучшить fallback при неудаче Readability

Если Readability вернул пустоту или <200 символов — вместо простого strip-all-tags:
- Извлечь текст из `<p>`, `<h1>`-`<h6>`, `<li>` тегов (cheerio уже в проекте)
- Склеить с переносами строк
- Если и это <200 символов — вернуть как есть (Level 2 Jina подхватит в следующем ТЗ)

### 4. Унифицировать web-fetcher.ts

`lib/briefing/source-fetchers/web-fetcher.ts` должен использовать `fetchPage()` из `lib/ai/tools/fetch-page.ts` вместо собственной реализации.

Посмотри текущий `web-fetcher.ts` — он дублирует логику Readability + JSDOM. Замени на вызов `fetchPage()`, сохранив возвращаемый формат `RawContent[]` который ожидает briefing pipeline.

**Важно:** в fetch-page.ts уже есть комментарий что это "shared utility" — это подтверждает замысел.

---

## Ключевые ограничения

- **Не трогать** rss-fetcher.ts и telegram-fetcher.ts — они работают нормально
- **Не трогать** интерфейс `fetchPage()` (вход: URL, выход: объект с title, content, etc.) — только внутреннюю реализацию
- **cheerio** уже есть в проекте (используется в telegram-fetcher) — новая зависимость не нужна
- Если fetchPage экспортирует тип результата — убедись что web-fetcher корректно маппит его в RawContent

---

## Как проверить

Запустить fetchUrl на нескольких русских сайтах:
- https://rbc.ru (новостной, может быть windows-1251)
- https://vc.ru (SPA, но контент часто в SSR)
- https://habr.com (UTF-8, должен работать как раньше)
- https://kommersant.ru

До: посмотреть сколько возвращают >200 символов осмысленного текста.
После: сравнить.
