# Roadmap ТЗ-WS1: Charset Detection + Унификация Web Fetcher

**Создан:** 2026-02-20
**Версия проекта:** 3.33.1 → 3.34.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 3 |
| Текущий этап | 1 |
| Сессий (оценка) | 1 |

---

## Этап 1: Charset Detection в fetchPage()

**Статус:** ✅ Завершён

**Цель:** `fetchPage()` корректно читает windows-1251, koi8-r и другие не-UTF-8 кодировки. Fallback при неудаче Readability извлекает текст из семантических тегов через JSDOM DOM API.

**Задачи:**
- [x] Установить `chardet` и `iconv-lite` (`pnpm add chardet iconv-lite`)
- [x] Типы не нужны — оба пакета поставляются с собственными .d.ts
- [x] В `fetchPage()`: заменить `response.text()` на `Buffer.from(await response.arrayBuffer())`
- [x] Добавить helper `detectCharset(buffer, contentType)`: HTTP header → meta regex → chardet → fallback utf-8
- [x] Добавить helper `decodeBuffer(buffer, charset)`: iconv-lite для не-UTF-8, buffer.toString для UTF-8
- [x] Улучшить fallback: при неудаче Readability или результате <200 символов — `dom.window.document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li')` → склеить текст с переносами
- [x] Если и семантический fallback <200 символов — вернуть как есть (для будущего Jina)

**Файлы:**
- `lib/ai/tools/fetch-page.ts` — основные изменения
- `package.json` — новые зависимости

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] 🧪 Тест: rbc.ru, habr.com, kommersant.ru, vc.ru, lib.ru (windows-1251), anekdot.ru, lenta.ru — все читаемы

**Git (после валидации):**
```bash
git add lib/ai/tools/fetch-page.ts package.json pnpm-lock.yaml
git commit -m "feat(tz-ws1): charset detection in fetchPage"
```

**Критерий готовности:** fetchPage() возвращает читаемый русский текст для windows-1251 сайтов, UTF-8 сайты работают как прежде.

---

⛔ НЕ НАЧИНАТЬ Этап 2 без подтверждения Этапа 1

---

## Этап 2: Унификация web-fetcher.ts

**Статус:** ✅ Завершён

**Цель:** `web-fetcher.ts` использует `fetchPage()` вместо собственной дублирующей реализации. Briefing pipeline продолжает работать через тот же интерфейс `FetchResult`.

**Задачи:**
- [x] В `web-fetcher.ts`: убрать импорты `Readability`, `JSDOM`
- [x] Импортировать `fetchPage` из `lib/ai/tools/fetch-page`
- [x] Заменить тело `fetchWeb()`: вызов `fetchPage(pageUrl, MAX_CONTENT_LENGTH, FETCH_TIMEOUT_MS)` + маппинг `FetchPageResult → RawContent` (добавить sourceName, sourceLanguage)
- [x] Обернуть в try/catch: при ошибке — `{ items: [], errors: [...] }` (существующий паттерн)

**Файлы:**
- `lib/briefing/source-fetchers/web-fetcher.ts` — рефакторинг

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] 🧪 Мануальный тест: 6/7 источников загружены, 0 кракозябр, pipeline рабочий

**Git (после валидации):**
```bash
git add lib/briefing/source-fetchers/web-fetcher.ts
git commit -m "refactor(tz-ws1): unify web-fetcher via fetchPage"
```

**Критерий готовности:** web-fetcher.ts не содержит собственной Readability/JSDOM логики, использует shared fetchPage().

---

⛔ НЕ НАЧИНАТЬ Этап 3 без подтверждения Этапа 2

---

## Этап 3: Финализация

**Статус:** ✅ Завершён

**Задачи:**
- [x] Финальное мануальное тестирование (пользователь): fetchUrl + briefing generation
- [x] Обновить главный CHANGELOG.md
- [x] Обновить SIMPLY_STATUS.md
- [x] Обновить CLAUDE.md (добавить chardet/iconv-lite в описание fetch-page.ts)
- [x] Обновить package.json (версия → 3.34.0)
- [x] Обновить docs/ai-tools.md — описание fetchUrl + charset detection
- [ ] Переместить папку в _archive/

**Валидация:**
- [x] `npm run build` — успешен
- [x] Документация актуальна
