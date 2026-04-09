# Анализ ТЗ-MapReduce: Briefing Author → Map-Reduce

## Резюме

Замена монолитного `generateArticle()` на Map-Reduce pipeline используя существующий `generateSection()`. Новая функция `generateIntroOutro()` для reduce-шага.

## Рекомендации разработчика (Код-ревью)

### ✅ Согласен с подходом

- Map-Reduce на M2.7 без Anthropic fallback — правильное решение
- `generateSection()` из `briefing-section-author.ts` — production-ready, обрабатывает все per-section concerns
- pLimit(1) — стабильность важнее скорости для ежедневного брифинга
- `Promise.allSettled` для partial failure — правильный подход

### ⚠️ Технические нюансы

1. **previousBriefing → per-topic headlines**: Текущий `buildPreviousHeadlines()` в author форматирует ВСЕ темы. Для Map-Reduce нужно фильтровать headlines по topicId при передаче в каждый `generateSection()`. Функция `buildPreviousHeadlines()` уже exported — нужна helper для extraction по topicId.

2. **Trace aggregation**: Каждый `generateSection()` возвращает свой trace. Нужно агрегировать в один composite trace для DevPanel. Предложение: новый stage `"author-map-reduce"` с массивом sub-traces.

3. **simply_news injection**: Сейчас вставляется ПОСЛЕ Author в pipeline (строка 299). Это не меняется — Map-Reduce возвращает BriefingArticle, simply_news добавляется после.

4. **Удаление старого `generateArticle()`**: После миграции старая функция не нужна. Но section-refresh (`briefing-section-author.ts`) остаётся как есть — он уже работает через `generateSection()`.

## Оценка сложности

- [x] Простое (1-2 сессии)
