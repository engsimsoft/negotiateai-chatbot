# Передача сессии ТЗ-FIX2: Research Progress Mode

**Дата:** 2026-02-26
**Сессия:** 4 (Hotfix клиентской ошибки — блокер решён)

## Статус этапов
- [x] Этап 1: Perplexity Client + Research Engine Core ✅
- [x] Этап 2: Tool Integration + Progress Mechanism ✅ (hotfix: 3 бага клиента)
- [ ] Этап 3: Client Progress UI
- [ ] Этап 4: DEV Mode + data-model-info
- [ ] Этап 5: Финализация

## Что сделано в сессии 4

### Блокер решён: клиентская ошибка при startResearch

Архитектор проанализировал код и нашёл **3 бага** (один симптом — "Произошла ошибка"):

1. **БАГ 1 (корневая причина):** `type: "research-progress"` → `type: "data-research-progress"`
   - AI SDK v5 UIMessage Stream Protocol требует `data-` префикс для кастомных типов
   - Без префикса SSE-парсер useChat бросал ошибку парсинга → onError
   - Добавлен `transient: true` — progress events не сохраняются в историю (GitHub #7450)

2. **БАГ 2 (race condition):** `result.consumeStream()` перенесён внутрь `createUIMessageStream execute`
   - Был снаружи → race condition: стрим консьюмился до настройки reader
   - Для коротких стримов (1-2 POST) — незаметно, для длинных (60 сек) — потеря данных
   - Приведён к паттерну chat/route.ts

3. **БАГ 3 (типизация):** progressRef типизирован как `{ type: \`data-${string}\`; data: unknown; transient?: boolean }`
   - Убран `as any` с `dataStream.write(event)`
   - TypeScript теперь ловит неправильный формат событий на этапе компиляции

### Мануальный тест — PASSED
- Полный create mode онбординг: интервью → startResearch → результаты → saveBriefingProfile → "Брифинг настроен!"
- Ни одной ошибки на клиенте
- Server logs: все POST 200, все стримы completed normally

### Известная проблема (не блокер)
`saveBriefingProfile` rejected 5 источников как "unverified" — модель передаёт домены (habr.com/ru/), а verified set содержит полные URL статей (habr.com/ru/articles/990736/). Профиль всё равно сохранился. Можно починить матчинг (domain-level matching) позже.

## Следующая сессия: Этап 3 (Client Progress UI)

1. Read ROADMAP.md → Этап 3
2. Реализовать consumption `data-research-progress` events в briefing-setup-client.tsx
3. Создать ResearchProgressCard компонент
4. Интегрировать в BriefingChatPanel
5. Мануальный тест: онбординг с видимым прогрессом

## Ключевые файлы (изменены в сессии 4)

| Файл | Что изменено |
|------|-------------|
| `app/(chat)/api/service-chat/route.ts` | 3 hotfix: data- prefix, consumeStream внутрь execute, типизация progressRef |

## Ключевой урок сессии
**Архитектор** (внешний анализ кода без запуска) за 5 минут нашёл 3 бага, которые отлаживались 2 сессии. В сложных ситуациях (клиент/сервер рассинхрон, протокольные ошибки) — сначала показать код архитектору, потом чинить.

## Блокеры
- Нет блокеров. Готов к Этапу 3.
