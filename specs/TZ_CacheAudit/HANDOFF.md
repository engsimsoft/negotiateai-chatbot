# Передача сессии ТЗ-CacheAudit

**Дата:** 2026-04-12
**Сессия:** 1

---

## Статус этапов

- [x] Phase 1: Анализ (официальная документация изучена, находки зафиксированы в ANALYSIS.md)
- [x] Phase 2: Планирование (план одобрен пользователем, расширен в ходе сессии на 7 этапов)
- [x] Этап 0: Pre-flight проверки (2026-04-12) — все 4 теста PASS, переход безопасен
- [x] Этап 1: Переключение фабрики (commit `5fdfcd6`) — валидировано через UI 2026-04-13
- [x] Этап 2: Code Health Cleanup (commit `ca56256`) — валидировано через smoke 2026-04-13
- [x] Этап 3: Cache breakpoints + MIND transplant — валидировано через UI 2026-04-13, 54-58% экономии подтверждены
- [🔄] Этап 4: Cache breakpoints в task-expert route ← **ТЕКУЩЕЕ СОСТОЯНИЕ**
- [ ] Этап 5: Валидация эффективности (SQL за 24ч real traffic)
- [ ] Этап 6: Финализация (ADR 049/050, docs, CHANGELOG, package.json 3.85.0)

## Следующая сессия: начни с

1. Прочитать ROADMAP → Этап 2 (Code Health Cleanup)
2. Удалить untracked мусорные скрипты (`test-minimax.ts`, `test-minimax-generate-object.ts`, `test-think-models.ts`) — они не в git
3. Прочитать полностью `app/(chat)/api/chat/route.ts` — найти всю MiniMax-специфичную логику (`isSimplyNonAnthropicModel`, `stripMiniMaxToolParts`, `stripMediaPartsForTextModel`)
4. Определить, какие условия избыточны после переключения на Anthropic-compat, какие остаются (vision всё ещё недоступна → `stripMediaPartsForTextModel` валиден)
5. Переписать `docs/ai-minimax.md` полностью, убрав ложные утверждения
6. Обновить `docs/ai-providers.md` секцию MiniMax
7. `npx tsc --noEmit` + `npm run build`
8. Git commit Этапа 2
9. Запрос мануального теста (короткий — Simply Chat ещё раз, убедиться что очистка условий не сломала)

## Ключевые находки к текущему моменту

### Этап 0 (pre-flight)
- Предыдущий агент выдумал проблемы Anthropic-compat режима — опровергнуто независимым тестом на версии 0.0.2
- Anthropic-compat в пакете — прокси через `AnthropicMessagesLanguageModel` из `@ai-sdk/anthropic/internal`
- MiniMax cache частично работает до переключения (cacheRead avg 2282), cacheWrite всегда 0

### Этап 1 (переключение фабрики)
- Валидация через UI показала: regression-free, passive cache работает (96.8% hit), экономия 4× на 2-м сообщении
- Simply «Думать» резолвится в **Haiku**, НЕ Sonnet как заявлено в `docs/ai-minimax.md:97-105` — ещё один слой лжи, исправится в Этапе 2
- Briefing pipeline через `minimaxLong` работает, 153с в пределах 180с timeout
- `cacheWriteTokens` всё ещё 0 у MiniMax — ожидаемо, появится только после Этапа 3 (explicit `providerOptions.anthropic.cacheControl`)

### Scope update (2026-04-13)
- service-chat исключён из всех последующих этапов ТЗ — система deprecated

## Блокеры / Вопросы
- Нет

## Ключевые файлы контекста
- `SPEC.md` — ТЗ
- `ANALYSIS.md` — feature matrix, изученная документация, риски
- `ROADMAP.md` — чеклист задач с валидацией
- `~/.claude/plans/purring-stirring-naur.md` — оригинальный план из plan mode (референс)
