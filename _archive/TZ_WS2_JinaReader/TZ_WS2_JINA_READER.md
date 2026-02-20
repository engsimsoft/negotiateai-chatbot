# ТЗ-WS2: Jina Reader API + Каскадный Fallback

**Приоритет:** Высокий  
**Оценка:** 1 сессия  
**Зависимость:** Выполнить после ТЗ-WS1  
**Затрагивает:** `lib/ai/tools/fetch-page.ts`, `lib/briefing/source-fetchers/index.ts`

---

## Цель

Если Readability не справился (результат <200 символов) — автоматически подключается Jina Reader API. Покрытие русскоязычных источников вырастает с ~40-50% до ~70-80%.

## Зачем

Jina Reader запускает headless Chrome на своей стороне, рендерит JS, обрабатывает сложные layouts и возвращает clean markdown. Это закрывает две оставшиеся проблемы: JS-рендеренные SPA и нестатейные страницы.

---

## Что сделать

### 1. Создать утилиту Jina Reader

Новый файл: `lib/ai/tools/jina-reader.ts`

```
GET https://r.jina.ai/{encoded_url}
Headers:
  Accept: text/markdown
  X-Return-Format: markdown
  X-Remove-Selector: nav, footer, .sidebar, .ads, .cookie-banner
  Authorization: Bearer ${JINA_API_KEY}  // опционально

Response: plain text в формате markdown
```

Функция должна:
- Принимать URL
- Вызвать Jina Reader API
- Таймаут: 10 секунд
- При ошибке или пустом ответе — вернуть null (не бросать exception)
- Логировать результат: `[Jina Reader] URL: ... Status: ... Content length: ...`

**Экономика:** С бесплатным ключом — 10M токенов + 100 RPM. Для нашего объёма хватит надолго.

**Обработка ошибок — ВАЖНО:**
- HTTP 429 (rate limit) → логировать явно: `[Jina Reader] RATE LIMIT: url=... status=429` — не маскировать под "content unavailable"
- HTTP 402 (токены кончились) → логировать: `[Jina Reader] QUOTA EXCEEDED` 
- Любая другая ошибка → логировать статус и причину
- Это критично для диагностики: без явных логов будем искать "битые ссылки" там где проблема в лимитах

### 2. Интегрировать в каскад fetchPage()

В `lib/ai/tools/fetch-page.ts` после текущей логики Readability + fallback:

```
1. Readability → результат
2. Если результат.content.length < 200 → вызвать jinaReader(url)
3. Если Jina вернул контент → использовать его
4. Иначе → вернуть то что есть (graceful degradation)
```

Добавить опциональный параметр `forceJina?: boolean` в fetchPage. Если true — пропустить Readability и сразу вызвать Jina.

### 3. Обновить диспетчер briefing source-fetchers

В `lib/briefing/source-fetchers/index.ts`:
- `case "jina"` — при fetchMethod === "jina" вызвать fetchPage с `forceJina: true`
- Сейчас "jina" маппится на обычный web-fetcher (Readability) — это placeholder, нужно подключить реальный Jina

### 4. Добавить JINA_API_KEY в конфиг

- `.env.local`: `JINA_API_KEY=jina_xxxxx` **(обязательно — зарегистрировать на jina.ai)**
- `lib/briefing/briefing-config.ts`: добавить константу `JINA_READER_TIMEOUT = 10_000`
- При старте: если `JINA_API_KEY` отсутствует — `console.warn('[Jina Reader] WARNING: JINA_API_KEY not set, using free tier (20 RPM limit)')`

---

## Ключевые ограничения

- **Jina вызывается только как fallback** (или при forceJina) — не для каждого URL
- **Не устанавливать Playwright** — Jina заменяет потребность в headless browser
- Интерфейс fetchPage() не меняется для внешних потребителей
- При отсутствии JINA_API_KEY — работать без заголовка Authorization (free tier) но логировать warning при старте

---

## Как проверить

Те же 20 русскоязычных сайтов что и в WS1. Ожидание:
- WS1 alone: ~40-50% покрытие
- WS1 + WS2: ~70-80% покрытие

Дополнительно проверить JS-heavy сайты:
- SPA на React/Vue (vc.ru)
- Сайты с динамической загрузкой контента
