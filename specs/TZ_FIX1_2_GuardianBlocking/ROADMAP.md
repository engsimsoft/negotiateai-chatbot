# Roadmap ТЗ-FIX1.2: Guardian Phase 2 — Буферизация и блокировка

**Создан:** 2026-02-26
**Версия проекта:** 3.50.0 → 3.51.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 3 |
| Текущий этап | 1 |
| Сессий (оценка) | 1-2 |

---

## Этап 1: Подготовка + export findToolMentions + fix Phase 1 bug

**Статус:** ✅ Завершён

**Цель:** Экспортировать findToolMentions из guardian, починить баг Phase 1 в service-chat (getAllDetections не собирается), добавить Guardian Phase 1 в tasks/chat.

**Задачи:**
- [x] Экспортировать `findToolMentions()` из `tool-call-guardian.ts`
- [x] service-chat/route.ts: добавить `getAllDetections()` на EOF (fix Phase 1 bug)
- [x] tasks/chat/route.ts: добавить Guardian Phase 1 (tracker + 4 events + getAllDetections + guardianFlags в usage log)

**Файлы:**
- `lib/ai/tool-call-guardian.ts` — добавить export к findToolMentions
- `app/(chat)/api/service-chat/route.ts` — fix getAllDetections на EOF
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — добавить Guardian Phase 1

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] Проверка: существующая функциональность не сломана
- [ ] 🧪 Мануальный тест: обычный чат стримится нормально

**Git (после валидации):**
```bash
git add lib/ai/tool-call-guardian.ts app/(chat)/api/service-chat/route.ts app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts
git commit -m "fix(tz-fix1.2): export findToolMentions, fix service-chat guardian flags, add guardian to tasks/chat"
```

**Критерий готовности:** findToolMentions экспортирована, service-chat собирает guardianFlags, tasks/chat имеет полный Guardian Phase 1.

---

## Этап 2: Буферизация и блокировка (3 routes)

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 1

**Статус:** ✅ Завершён

**Цель:** Внедрить буферизацию text-delta с блокировкой галлюцинаций во всех трёх routes.

**Примечание:** По результату теста — streaming в chat не виден пользователю (текст приходит сразу). Полная буферизация используется во всех routes (smart buffering не нужен).

**Задачи:**
- [x] service-chat/route.ts: полная буферизация text-delta + блокировка + consecutiveHallucinations + error message через controller.enqueue
- [x] chat/route.ts: полная буферизация + блокировка + consecutiveHallucinations + error message
- [x] tasks/chat/route.ts: полная буферизация + блокировка + consecutiveHallucinations + error message
- [x] BUGFIX: Исправлены event types во всех 3 routes (start-step/finish-step вместо step-start/step-finish, .delta вместо .textDelta, буферизация всех text-related events)

**Файлы:**
- `app/(chat)/api/service-chat/route.ts` — полная буферизация в instrumentedStream
- `app/(chat)/api/chat/route.ts` — полная буферизация в instrumentedStream
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — полная буферизация в instrumentedStream

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] 🧪 Мануальный тест: обычный чат → POST /api/chat 200, сообщения приходят нормально
- [x] 🧪 Мануальный тест: briefing-onboarding → POST /api/service-chat 200, реальные tool calls работают, Guardian не блокирует (правильно)
- [x] Логи: Guardian молчит при реальных tool calls — корректное поведение (блокировка при галлюцинации не тестируема без провокации)

**Git (после валидации):**
```bash
git add app/(chat)/api/service-chat/route.ts app/(chat)/api/chat/route.ts app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts
git commit -m "feat(tz-fix1.2): guardian blocking — buffering + hallucination blocking in all routes"
```

**Критерий готовности:** Галлюцинированный текст не доходит до пользователя. Нормальный текст стримится без заметной задержки. При 2+ подряд блокировках — сообщение об ошибке.

---

## Этап 3: Финализация

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 2

**Статус:** ✅ Завершён

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../../DOCUMENTATION_GUIDE.md) — пройти чеклист.

**Документация (обязательная):**
- [x] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти "✅ Чек-лист при изменениях"
- [x] Обновить главный CHANGELOG.md
- [x] Обновить SIMPLY_STATUS.md
- [x] Обновить CLAUDE.md (секция Tool Call Guardian + версия 3.51.0)
- [x] Обновить package.json (версия 3.51.0)

**Документация (по чеклисту — оценить каждый пункт):**
- [x] ADR нужен? → Да: docs/decisions/023-guardian-blocking-strategy.md
- [x] docs/architecture.md нужно обновить? → Да: Guardian Phase 2 описание
- [x] docs/ai-tools.md нужно обновить? → Нет (tools не менялись)
- [x] docs/ai-chats-map.md нужно обновить? → Нет (routes не менялись по назначению)
- [x] docs/ai-agents.md нужно обновить? → Нет
- [x] docs/design-system.md нужно обновить? → Нет (UI не менялся)

**Завершение:**
- [x] Финальное мануальное тестирование (пользователь) — chat 200, service-chat 200
- [ ] Переместить папку в _archive/

**Валидация:**
- [x] `npm run build` — успешен
- [ ] Production URL работает (после деплоя)
- [x] Документация актуальна (проверено по чеклисту выше)
