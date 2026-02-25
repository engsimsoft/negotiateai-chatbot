# Анализ ТЗ-OPT1: Usage Logging + Миграция Sonnet 4.6

## Резюме

Две независимые задачи:
- **Часть A:** Создать таблицу `ai_usage_log`, функцию записи, интегрировать в 3 эндпоинта (chat, task-chat, professor-pipeline)
- **Часть B:** Заменить 3 ссылки на `claude-sonnet-4-5-20250929` → `claude-sonnet-4-6` в providers.ts, обновить документацию

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.
> Все рекомендации согласованы с архитектором (2026-02-25).

### ✅ Согласен с ТЗ

- Таблица `ai_usage_log` — схема корректна, поля доступны в scope
- Индексы `(userId, createdAt)` и `(chatMode, createdAt)` — разумны для аналитики
- Fire-and-forget интеграция в onFinish — правильный подход
- Professor pipeline: 3 записи на запрос — верно (3 фазы, разные модели)
- Миграция: 3 замены в providers.ts — проверено, корректно
- Не трогать haiku, opus, title-model, ключ `"claude-sonnet-4-6"` — верно
- Prefilling не используется — миграция безопасна

### ⚠️ Изменения (согласованы)

| # | Было (ТЗ) | Решение | Обоснование |
|---|-----------|---------|-------------|
| 1 | `costUsd real` | `numeric(10,6)` | Float теряет точность при агрегации тысяч записей. Для аналитической базы нужна точность |
| 2 | Scope: chat/route + professor | + task-chat route | `api/projects/[id]/tasks/[taskId]/chat/route.ts` — полноценный streaming chat с onFinish и usage. 5 строк кода, закрывает дыру в данных проектных чатов (Opus — самые дорогие) |
| 3 | `chatId uuid FK NOT NULL` | `chatId uuid FK NULLABLE` | Нулевая доп. работа. Не придётся менять миграцию когда дойдём до логирования briefing/clerks (у них нет chatId) |
| 4 | Обновить только `docs/ai-providers.md` | + `docs/ai-agents.md`, `docs/ai-chats-map.md`, `SIMPLY_STATUS.md` | Рассинхронизированные доки хуже отсутствующих. 2 минуты работы |

## Потенциальные риски

1. **TokenLens может не знать модель `claude-sonnet-4-6`** — если каталог не обновлён, `getUsage()` вернёт ошибку → catch block → costUsd будет null. Это допустимо (мы логируем токены даже без стоимости), но стоит проверить после деплоя
2. **Professor pipeline: нужно расширить `ProfessorPipelineOptions`** — добавить `chatId`, `userId` для передачи в saveAiUsageLog. Минимальное изменение интерфейса

## Зависимости

- Drizzle ORM миграция (`npm run db:migrate`)
- TokenLens каталог (уже кеширован через `getTokenlensCatalog()`)

## Оценка сложности

- [x] Простое (1 сессия)
