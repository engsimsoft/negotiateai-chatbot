# Передача сессии ТЗ-WS1

**Дата:** 2026-02-20
**Сессия:** 1

## Статус этапов
- [ ] Этап 1: Charset Detection в fetchPage() ← ТЕКУЩИЙ
- [ ] Этап 2: Унификация web-fetcher.ts
- [ ] Этап 3: Финализация

## Следующая сессия: начни с
1. Прочитать ROADMAP.md — Этап 1
2. `npm install chardet iconv-lite`
3. Реализовать charset detection в fetch-page.ts

## Контекст
- Архитектор одобрил все 3 рекомендации из ANALYSIS.md
- Fallback: JSDOM DOM API (не cheerio)
- Meta charset: regex (не cheerio)
- web-fetcher: передавать MAX_CONTENT_LENGTH и FETCH_TIMEOUT_MS явно в fetchPage()
