# Roadmap ТЗ-WS2: Jina Reader API + Каскадный Fallback

**Создан:** 2026-02-21
**Версия проекта:** 3.34.0 → 3.35.0
**Статус:** ✅ Завершён

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 3 |
| Текущий этап | 3 (завершён) |
| Сессий | 1 |

---

## Этап 1: Jina Reader утилита + конфиг

**Статус:** ✅ Завершён

**Цель:** Создать утилиту Jina Reader и добавить конфигурацию.

**Задачи:**
- [x] Добавить `JINA_API_KEY` в `.env.local`
- [x] Добавить `JINA_READER_TIMEOUT = 10_000` в `lib/briefing/briefing-config.ts`
- [x] Создать `lib/ai/tools/jina-reader.ts` — утилита Jina Reader API

**Файлы:**
- `.env.local` — добавить JINA_API_KEY
- `lib/briefing/briefing-config.ts` — добавить константу
- `lib/ai/tools/jina-reader.ts` — **новый файл**

**Детали jina-reader.ts:**
- GET `https://r.jina.ai/{raw_url}` (БЕЗ encodeURIComponent)
- Headers: Accept, X-Return-Format, X-Remove-Selector, Authorization (если ключ есть)
- Timeout: 10s (из JINA_READER_TIMEOUT)
- При ошибке → return null (не throw)
- Логирование: URL, status, content length
- HTTP 429 → `[Jina Reader] RATE LIMIT: url=... status=429`
- HTTP 402 → `[Jina Reader] QUOTA EXCEEDED`
- Lazy warning при отсутствии ключа (флаг `warned`)

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок

**Критерий готовности:** jina-reader.ts создан, конфиг добавлен, tsc проходит.

---

## Этап 2: Интеграция в каскад fetchPage + обновление потребителей

**Статус:** ✅ Завершён

**Цель:** Встроить Jina в каскад fetchPage(), обновить потребителей, подключить forceJina в диспетчере briefing.

**Задачи:**
- [x] Рефакторинг `fetchPage()` — options object (`FetchPageOptions`), добавить `source` в `FetchPageResult`
- [x] Интегрировать Jina fallback в каскад: Readability (8s) → semantic → Jina (10s) → graceful degradation
- [x] Обновить `fetch-url.ts` — новая сигнатура + timeout 30s
- [x] Обновить `web-fetcher.ts` — новая сигнатура
- [x] Обновить `index.ts` (briefing dispatcher) — case "jina" → fetchPage с `forceJina: true`

**Файлы:**
- `lib/ai/tools/fetch-page.ts` — рефакторинг сигнатуры + Jina каскад + source tracking
- `lib/ai/tools/fetch-url.ts` — обновить вызов fetchPage + timeout 30s
- `lib/briefing/source-fetchers/web-fetcher.ts` — обновить вызов fetchPage
- `lib/briefing/source-fetchers/index.ts` — case "jina" → forceJina

**Каскад (новый):**
```
1. forceJina? → сразу Jina Reader → return
2. Readability (timeout 8s) → если content >= 200 → return (source: 'readability')
3. Semantic fallback (JSDOM) → если content >= 200 → return (source: 'semantic')
4. Jina Reader (timeout 10s) → если контент есть → return (source: 'jina')
5. Вернуть лучшее что есть (graceful degradation)
```

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] 🧪 Тест: Direct Jina Reader (vc.ru → 36K chars, status=200)
- [x] 🧪 Тест: Cascade (habr→readability, vc.ru→readability, lenta→readability)
- [x] 🧪 Тест: forceJina (lenta.ru → source=jina, 42K chars)

**Git (после валидации):**
```bash
git add lib/ai/tools/jina-reader.ts lib/ai/tools/fetch-page.ts lib/ai/tools/fetch-url.ts lib/briefing/source-fetchers/web-fetcher.ts lib/briefing/source-fetchers/index.ts lib/briefing/briefing-config.ts
git commit -m "feat(tz-ws2): Jina Reader API + cascading fallback in fetchPage"
```

**Критерий готовности:** Каскад Readability → semantic → Jina работает, briefing dispatcher подключен, build проходит.

---

## Этап 3: Финализация

**Статус:** ✅ Завершён

**Задачи:**
- [x] Финальное мануальное тестирование (пользователь)
- [x] Обновить главный CHANGELOG.md
- [x] Обновить SIMPLY_STATUS.md
- [x] Обновить CLAUDE.md (fetch-page.ts описание)
- [x] Обновить package.json (версия 3.35.0)
- [ ] Переместить папку в _archive/

**Валидация:**
- [x] `npm run build` — успешен
- [x] Документация актуальна
