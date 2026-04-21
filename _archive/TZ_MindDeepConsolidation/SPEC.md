# TZ_MindDeepConsolidation — глубокая ночная консолидация на reasoning-модели

**Тип:** долг (заготовка ТЗ)
**Impact:** Medium
**Сложность:** 0.5-1 сессия
**Зависимости:** ТЗ-MindOnVisit (3.96.0) должен быть закрыт.
**Создано:** 2026-04-21

---

## Контекст

После ТЗ-MindOnVisit (3.96.0) все 4 операции памяти работают на одной модели — **Grok 4.1 Fast non-reasoning** (`memory:extract-batch`, `memory:dedup-verify`, `memory:consolidate`, `memory:profile`). Это правильно для скорости и стоимости в hot path (extract срабатывает много раз в день при активной работе).

Но **consolidation на дешёвой модели может пропускать тонкие смысловые повторы**: переформулированные дубли, противоречия с выводом, факты с временным контекстом. Это та же причина, по которой Mem0 OSS v3, Letta sleep-time compute и Zep background graph processing используют **tiered approach**:
- **Hot path** (live): дешёвая быстрая модель, ADD-only
- **Background** (idle period / nightly): более мощная модель, deep UPDATE/DELETE/SUPERSEDE

## Идея

Добавить **отдельный ночной cron `/api/cron/memory-deep-consolidate`** с новым taskId `memory:deep-consolidate`, привязанным к **reasoning-модели** (Grok 4.2 reasoning, либо Sonnet 4.6, либо Opus — на A/B-тест через `/dev/models`).

Существующий `memory:consolidate` (Grok 4.1 Fast) — остаётся для in-flight триггеров (≥10 stored ИЛИ ≥15 cumulative). Hot path не трогаем.

Новый ночной проход:
1. Проходит по всем пользователям с `memoryEnabled=true` (либо подмножество — например, только активные за неделю)
2. Берёт всю память пользователя (или последние 200-300 фактов)
3. Вызывает `memory:deep-consolidate` LLM с расширенным промптом:
   - Найди тонкие повторы (одна и та же мысль разными словами)
   - Найди противоречия (старый факт vs новый, время-зависимые → supersede)
   - Найди устаревшие факты (например «использует Python 3.10» — если есть более свежий `3.12`)
   - Сожми группы родственных фактов в более точные единичные
   - Удали мусор (низкая confidence + не подтвердился)
4. Применить действия (merge / supersede / remove) — переиспользуется существующая инфраструктура `consolidateUserMemory`

## Best practices 2026 (для research-фазы будущего ТЗ)

- **Mem0 OSS v3 migration** ([docs](https://docs.mem0.ai/migration/oss-v2-to-v3)) — single-pass ADD-only в hot path, UPDATE/DELETE в periodic consolidation
- **Letta sleep-time compute** ([letta.com/blog/memory-blocks](https://www.letta.com/blog/memory-blocks)) — agents process information during idle periods, более мощная модель в фоне
- **Zep background graph processing** — temporal facts с validity window, инвалидация старых при появлении противоречия
- **Mem0 Dream gate v1.0.4** — automatic memory consolidation during idle periods for higher-quality long-term recall

## Scope (примерный)

### Что делаем
1. Новый taskId `memory:deep-consolidate` в `task-assignments.ts` (default: на A/B тест выбрать одну из reasoning-моделей)
2. Новый промпт `lib/prompts/memory/deep-consolidate.md` — более вдумчивый, многошаговый
3. Новая функция `deepConsolidateUserMemory(userId)` в `lib/ai/memory/consolidate.ts` — переиспользует action-applier, отличается только промптом и моделью
4. Новый cron `app/api/cron/memory-deep-consolidate/route.ts` (или встроить в существующий `memory-profile` после extract — тогда без нового cron-эндпоинта)
5. Решить: запускать для всех или только активных (фильтр последней активности)
6. Schedule: 02:00 МСК (за час до текущего `memory-profile` в 03:00, чтобы хвосты с on-visit/cron уже были в базе)

### Что НЕ делаем
- Не меняем существующий `memory:consolidate` (hot path остаётся быстрым)
- Не меняем `memory:extract-batch` / `memory:dedup-verify` / `memory:profile`

## Acceptance Criteria

1. Новый taskId доступен в `/dev/models` для A/B-тестирования модели
2. Отдельный лог `[cron/memory-deep-consolidate] user=... model=... actions={merged:N, superseded:M, removed:K}`
3. Метрика «доля изменений в памяти за ночь» — для оценки полезности (если deep-consolidate стабильно ничего не меняет — возможно, hot path consolidate уже всё ловит)
4. Затраты (RUB) фиксируются в `ai_usage_log` — оценить ROI

## Оценка

0.5-1 сессия Claude Code. Без миграции БД. Использует существующую инфраструктуру `consolidateUserMemory`.

## Источник идеи

Обсуждение с владельцем в сессии Claude Code 2026-04-21 при работе над ТЗ-MindOnVisit. Цитата владельца: «дешёвая модель берет все факты создают их, а почему бы нам не доверить продуманной модели умной до Grok 4.2 ночью из этого мусора который собрала дешёвую модель все это причесать».
