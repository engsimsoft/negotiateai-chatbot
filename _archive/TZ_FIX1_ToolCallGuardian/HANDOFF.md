# Передача сессии ТЗ-FIX1: Tool Call Guardian

**Дата:** 2026-02-26
**Сессия:** 2

## Статус этапов
- [x] Этап 1: Детектор галлюцинаций ✅ (commit 7c331da)
- [x] Этап 2: Интеграция в routes ✅ (tsc + build OK, ожидает мануальный тест)
- [ ] Этап 3: Миграция БД + запись в ai_usage_log
- [ ] Этап 4: Финализация

## Что сделано в сессии 2

### Chat route (`app/(chat)/api/chat/route.ts`)
- Уже был готов с сессии 1 (не закоммичен)
- Guardian интегрирован в instrumentedStream: step-start/text-delta/tool-input-start/step-finish
- `guardianFlags` собирается на done для передачи в ai_usage_log (Этап 3)

### Service-chat route (`app/(chat)/api/service-chat/route.ts`)
- **Рефакторинг:** `result.toUIMessageStreamResponse()` → `createUIMessageStream` + writer + instrumentedStream + `JsonToSseTransformStream`
- Добавлен `result.consumeStream()` для надёжного resolve `result.text` (project-manager persistence)
- Guardian tracker: step-start/text-delta/tool-input-start/step-finish (аналогично chat route)
- Project-manager `result.text.then(...)` persistence сохранена без изменений

### Валидация
- `npx tsc --noEmit` — 0 ошибок ✅
- `npm run build` — успешен ✅
- Мануальный тест — **ОЖИДАЕТ** подтверждения пользователя

## Следующая сессия: начни с

1. **ДОЖДАТЬСЯ** подтверждения мануального теста Этапа 2
2. После подтверждения — git commit обоих routes
3. Перейти к Этапу 3: миграция БД + guardianFlags в ai_usage_log
4. Read ROADMAP.md → Этап 3 для деталей

## Блокеры / Вопросы
- ⚠️ ПРАВИЛО: ожидаем мануальный тест перед коммитом Этапа 2
- ⚠️ ПРАВИЛО: после завершения Этапа 3 — СТОП, запросить мануальный тест
