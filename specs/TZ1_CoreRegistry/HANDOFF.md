# Передача сессии ТЗ-1: Core Registry

**Дата:** 2026-04-10
**Сессия:** 2 (Этап 1 завершён кодом, ждём мануальный тест)

---

## Статус этапов

- [x] Фаза Анализ — ANALYSIS.md + 12 вопросов + ответы архитектора
- [x] Фаза Планирование — ROADMAP.md (6 этапов)
- [x] **Этап 1: Core Registry + Catalog + Task-assignments + миграция БД** — код готов, валидация пройдена. Ждём мануальный тест пользователя.
- [ ] Этап 2: Миграция chat routes + service-chat + utils ← **СЛЕДУЮЩИЙ**
- [ ] Этап 3: Миграция projects (tasks + plan + clerks + professors)
- [ ] Этап 4: Миграция pipelines (briefing, podcast, memory, meeting)
- [ ] Этап 5: Очистка legacy wrappers + удаление TokenLens
- [ ] Этап 6: Финализация

---

## Ключевое решение Этапа 1

**TokenLens удаление перенесено в Этап 5.** Причина: 8+ файлов (podcast, briefing, memory, professor-pipeline, pipeline-trace) импортируют `calcCostUsd` / `calcStepCostRub` / `ModelCatalog` type. Эти файлы мигрируют в Этапах 3-4 на `getModel`, и только после этого имеет смысл полностью выкинуть `tokenlens-catalog.ts` и пакет. Окончательная очистка — в Этапе 5. ROADMAP и CHANGELOG отражают решение.

---

## Что сделано в Этапе 1

### Новые файлы
- `lib/ai/model-catalog.ts` — SSOT всех моделей, pricing USD/1M, 28 записей
- `lib/ai/registry.ts` — `createProviderRegistry`, 5 namespaces (anthropic, minimax, minimaxLong, xai, openrouter)
- `lib/ai/task-assignments.ts` — 34 taskId → catalog id
- `lib/ai/getModel.ts` — единая точка входа + overrides stub + test mocks
- `lib/db/migrations/0053_ai_usage_log_provider.sql` — +колонка `provider` + SQL backfill

### Изменённые
- `lib/ai/providers.ts` — legacy wrappers над registry; pricing читается из catalog; public API калькуляций сохранён
- `lib/ai/usage-utils.ts` — +`provider` поле + `inferProviderFromModelId()` fallback
- `lib/db/schema.ts` + `lib/db/queries.ts` — `provider` колонка в `aiUsageLog`
- `lib/db/migrations/meta/_journal.json` — запись о 0053
- `.env.example` — +`XAI_API_KEY` секция
- `package.json` — +`@ai-sdk/xai@3.0.82`

### Валидация
- `npx tsc --noEmit` → 0 ошибок
- `npm run build` → успешен, миграция применена
- SQL проверка БД: колонка `provider varchar(32)` есть
- SQL backfill: 288 записей получили provider (107 anthropic, 64 minimax, 55 voyage, 25 deepgram, 14 perplexity, 10 google, 13 NULL legacy)

---

## Следующая сессия: начни с

1. **Дождаться подтверждения мануального теста** от пользователя по Этапу 1
2. Git commit Этапа 1 (ждёт)
3. **Перейти к Этапу 2: Миграция chat routes + service-chat + utils**
   - `app/(chat)/api/chat/route.ts` — основная маршрутизация simply / chat / expertise / create
   - `chat-mode-config.ts` — тонкая обёртка
   - `generate-title/route.ts`, `actions.ts`
   - `service-chat/route.ts`, `assistant/ben/route.ts`
   - `request-suggestions.ts`

---

## Блокеры / Вопросы

Нет. Код готов, ждём мануальный тест.

---

## Следующий git commit

Этап 1 commit готов к выполнению после мануального теста:

```bash
git add lib/ai/model-catalog.ts lib/ai/registry.ts lib/ai/task-assignments.ts \
        lib/ai/getModel.ts lib/ai/providers.ts lib/ai/usage-utils.ts \
        lib/db/schema.ts lib/db/queries.ts \
        lib/db/migrations/0053_ai_usage_log_provider.sql \
        lib/db/migrations/meta/_journal.json \
        .env.example package.json pnpm-lock.yaml \
        specs/TZ1_CoreRegistry/

git commit -m "feat(tz-1): core registry, model catalog, task assignments, getModel + ai_usage_log provider column"
```
