# Roadmap ТЗ-CACHE1: Prompt Caching

**Создан:** 2026-03-01
**Версия проекта:** 3.59.0 → 3.60.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 2 |
| Текущий этап | 1 |
| Сессий (оценка) | 1 |

---

## Этап 1: Добавить cacheControl в 3 streaming routes

**Статус:** ✅ Готов

**Цель:** Все `streamText()` вызовы к Anthropic получают `providerOptions.anthropic.cacheControl: { type: 'ephemeral' }`, что включает 5-минутный prompt caching.

**Задачи:**
- [x] Добавить `providerOptions` с `cacheControl` в `chat/route.ts` (standard streaming, ~строка 628)
- [x] Добавить `cacheControl` в `service-chat/route.ts` — рефакторинг spread-конструкции: `cacheControl` для всех контекстов + мерж с `thinking`/`effort` для briefing-onboarding (~строка 780)
- [x] Добавить `providerOptions` с `cacheControl` в task expert `chat/route.ts` (~строка 314)

**Важное уточнение (найдено при отладке):** Top-level `providerOptions.anthropic.cacheControl` в `streamText()` НЕ маркирует сообщения — SDK читает `cacheControl` из `providerOptions` каждого отдельного сообщения. Поэтому system prompt передаётся как message в массиве `messages[]` с `providerOptions`, а не через параметр `system:`.

**Файлы:**
- `app/(chat)/api/chat/route.ts` — system → message с cacheControl
- `app/(chat)/api/service-chat/route.ts` — system → message с cacheControl + thinking/effort через spread
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — system → message с cacheControl

**НЕ трогать:**
- `lib/ai/professor-pipeline.ts` — одноразовые вызовы, cache write без read = перерасход
- `lib/ai/providers.ts` — `calculateCostRub()` уже обрабатывает cachedInputTokens
- Gemini endpoints, UI, generateText/generateObject вызовы

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] 🧪 Мануальный тест: отправить 2+ сообщения в чате → в DevPanel Footer `cachedTokens` > 0 на втором сообщении (Cached: 13 304)

**Git (после валидации):**
```bash
git add app/(chat)/api/chat/route.ts app/(chat)/api/service-chat/route.ts "app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts"
git commit -m "feat(tz-cache1): enable Anthropic prompt caching — v3.60.0"
```

**Критерий готовности:** Все 3 routes имеют `cacheControl: { type: 'ephemeral' }`, build проходит, cached tokens видны в DevPanel.

---

⛔ НЕ НАЧИНАТЬ Этап 2 без подтверждения Этапа 1

---

## Этап 2: Финализация

**Статус:** ✅ Готов

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../DOCUMENTATION_GUIDE.md) — пройти чеклист.

**Документация (обязательная):**
- [x] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти "✅ Чек-лист при изменениях"
- [x] Обновить главный CHANGELOG.md
- [x] Обновить SIMPLY_STATUS.md
- [x] Обновить CLAUDE.md (версия 3.60.0, ТЗ-CACHE1 в завершённые)
- [x] Обновить package.json: 3.60.0

**Документация (по чеклисту — оценить каждый пункт):**
- [x] ADR нужен? → Нет: тривиальное включение SDK-фичи, без архитектурных решений
- [x] docs/architecture.md нужно обновить? → Нет: структура не менялась
- [x] docs/ai-tools.md нужно обновить? → Нет: tools не менялись
- [x] docs/ai-chats-map.md нужно обновить? → Нет: модели/routes не менялись
- [x] docs/ai-providers.md нужно обновить? → Да: добавлен `cacheControl: ephemeral` в реестр (¹ сноска + ² для professor pipeline)
- [x] docs/ai-agents.md нужно обновить? → Нет
- [x] docs/design-system.md нужно обновить? → Нет

**⛔ Верификация docs против кода (Правило 5):**
- [x] `docs/ai-providers.md` → Реестр конфигураций: providerOptions обновлены для всех 3 streaming routes + professor pipeline помечен «без кэша»
- [x] `CLAUDE.md` → пути файлов актуальны (новых файлов не создавалось)

**Завершение:**
- [ ] Финальное мануальное тестирование (пользователь)
- [ ] Переместить папку в `_archive/`

**Валидация:**
- [x] `npm run build` — успешен
- [x] Документация актуальна (проверено по чеклисту выше)
