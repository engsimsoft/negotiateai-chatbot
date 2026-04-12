# Передача сессии ТЗ-CacheAudit

**Дата:** 2026-04-12
**Сессия:** 1

---

## Статус этапов

- [x] Phase 1: Анализ (официальная документация изучена, находки зафиксированы в ANALYSIS.md)
- [x] Phase 2: Планирование (план одобрен пользователем, решения приняты)
- [x] Этап 0: Pre-flight проверки (2026-04-12) — **все 4 теста PASS, переход безопасен**
- [ ] Этап 1: Переключение MiniMax namespace на Anthropic-compat ← **СЛЕДУЮЩИЙ**
- [ ] Этап 2: Cache breakpoints в основном chat route + MIND transplant
- [ ] Этап 3: Cache breakpoints в service-chat и task-expert
- [ ] Этап 4: Валидация эффективности
- [ ] Этап 5: Финализация

## Следующая сессия: начни с

1. **Ждать разрешение пользователя** на Этап 1 (переключение фабрики)
2. Прочитать `ROADMAP.md` → Этап 1
3. Заменить `createMinimaxOpenAI` → `createMinimax` в `lib/ai/registry.ts` (2 места: minimax, minimaxLong)
4. `npx tsc --noEmit` → 0 ошибок
5. Smoke-тесты всех 5 MiniMax точек через UI
6. SQL-проверка ai_usage_log после тестов — ожидается ненулевой cacheWriteTokens
7. Git commit + запрос мануального теста у пользователя

## В процессе
- Этап 0 завершён полностью. Независимый тест `scripts/test-minimax-anthropic-compat.ts` создан и работает.

## Ключевые находки Этапа 0
1. Предыдущий агент выдумал проблемы Anthropic-compat режима — подтверждено собственным тестом на версии 0.0.2
2. Anthropic-compat в пакете — прокси через `AnthropicMessagesLanguageModel` из `@ai-sdk/anthropic/internal` (не кастомная реализация)
3. MiniMax cache частично работает сейчас (cacheRead avg 2282), но cacheWrite всегда 0 — измерительная дыра
4. После переключения: cacheWriteTokens начнут приходить, cacheRead вырастет с ~25% до 60-90% через explicit breakpoints

## Блокеры / Вопросы
- Нет

## Ключевые файлы контекста
- `SPEC.md` — ТЗ
- `ANALYSIS.md` — feature matrix, изученная документация, риски
- `ROADMAP.md` — чеклист задач с валидацией
- `~/.claude/plans/purring-stirring-naur.md` — оригинальный план из plan mode (референс)
