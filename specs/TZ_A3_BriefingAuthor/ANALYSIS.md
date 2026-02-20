# Анализ ТЗ-А3: Briefing Author

## Резюме

Заменить Stage 2 пайплайна генерации брифинга: вместо JSON-карточек (Analyzer) — связная статья с источниками (Author). Один вызов Gemini 3 Pro → `BriefingArticle` (текст + sources).

## Рекомендации разработчика (Код-ревью)

> Все рекомендации согласованы с архитектором 2026-02-20.

### ✅ Согласен с ТЗ
- Новый модуль `briefing-author.ts` — ОК, паттерн из `briefing-analyzer.ts`
- Типы `BriefingArticle/Section/Source/Meta` — ОК, чёткая структура
- Замена вызова в `route.ts` — ОК, минимальные изменения
- `maxDuration` 60 → 90 — ОК, статья генерируется дольше
- Промпт в `lib/prompts/briefing/briefing-author.md` — ОК

### ⚠️ Рекомендации (согласованы)

| # | Было (ТЗ) | Рекомендация | Обоснование |
|---|-----------|--------------|-------------|
| 1 | "Старые типы удалить — ничего не использует" | Адаптировать `briefing-active-page.tsx` и `briefing-card.tsx` под новые типы | Оба компонента созданы в ТЗ-А2, активно используют `BriefingJSON/BriefingBlock`. Без адаптации `/briefing` и дашборд сломаются |
| 2 | Tier передаётся "as is" | Маппить старые tier из `topics-catalog.ts` → новые (`original→flagship`, `analytics→respected`, `derivative→niche`) | В БД уже mix обоих наборов. Промпт работает с `flagship/respected/niche/community` |
| 3 | Промпт с плейсхолдерами (паттерн analyst) | System prompt = файл as-is, user message = данные (candidates + settings + date) | Промпт длинный (250 строк), без `{{PLACEHOLDERS}}`. Чище разделить: персона/правила vs данные |

### ❓ Нет неразрешённых вопросов

Все вопросы уточнены. Поле `sources` уже добавлено в промпт архитектором.

## Потенциальные риски

- **Риск 1 (средний):** Gemini 3 Pro может не соблюдать Markdown-ограничения (bullet points, таблицы). Zod-схема валидирует структуру, но не содержимое `content`. Решение: промпт чётко описывает допустимый Markdown.
- **Риск 2 (низкий):** Переключение формата `briefingJson` в БД. Старые записи в `BriefingHistory` — в формате `BriefingJSON` (blocks/items). Новые — в формате `BriefingArticle`. UI должен обрабатывать оба, или показывать только новые.

## Зависимости

- ТЗ-А2 (завершён) — briefing-active-page.tsx, briefing-card.tsx
- ТЗ-BR1 (завершён) — briefing pipeline, route.ts
- ТЗ-BR3 (завершён) — промпт из .md файла

## Оценка сложности
- [x] Простое (1-2 сессии)
