# Roadmap ТЗ-SlidingWindow: Скользящее окно Simply

**Создан:** 2026-04-07
**Версия проекта:** 3.75.0 → 3.76.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 2 |
| Текущий этап | 1 |
| Сессий (оценка) | 1 |

---

## Этап 1: Скользящее окно для Simply

**Статус:** ✅ Завершён

**Цель:** При chatMode=simply отправлять в API максимум 20 сообщений, стабилизировав стоимость.

**Задачи:**
- [x] Добавить константу `SIMPLY_SLIDING_WINDOW_SIZE = 20` в `lib/ai/context-limits.ts`
- [x] В `app/(chat)/api/chat/route.ts` — для chatMode=simply передать `maxMessages: SIMPLY_SLIDING_WINDOW_SIZE` в `getMessagesByChatId()`
- [x] Добавить утилиту `trimToUserStart()` — если после обрезки первое сообщение не user, сдвинуть окно
- [x] Применить `trimToUserStart()` к результату `getMessagesByChatId()` для Simply

**Файлы:**
- `lib/ai/context-limits.ts` — константа `SIMPLY_SLIDING_WINDOW_SIZE`
- `app/(chat)/api/chat/route.ts` — условие для chatMode=simply при вызове getMessagesByChatId + trimToUserStart

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: Simply Chat — стоимость стабильна после 20+ сообщений (DevPanel) ✅ ~₽2.90, контекст ~1300 tok
- [x] Браузер: скролл вверх показывает все сообщения
- [ ] ~~Браузер: Экспертиза — стоимость растёт как обычно~~ (пропущен — код не тронут, дорогой тест)
- [x] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add lib/ai/context-limits.ts app/(chat)/api/chat/route.ts
git commit -m "feat(tz-sliding-window): sliding window 20 messages for Simply chat"
```

**Критерий готовности:** Стоимость сообщения №5 и №25 в Simply примерно одинаковая (±10%)

---

⛔ НЕ НАЧИНАТЬ Этап 2 без подтверждения Этапа 1

---

## Этап 2: Финализация

**Статус:** ✅ Завершён

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../DOCUMENTATION_GUIDE.md) — пройти чеклист.

**Документация (обязательная):**
- [x] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти "✅ Чек-лист при изменениях"
- [x] Обновить главный CHANGELOG.md
- [x] Обновить SIMPLY_STATUS.md
- [x] Обновить CLAUDE.md (секция Context Window Management + Завершены)
- [x] Обновить package.json (версия 3.76.0)

**Документация (по чеклисту — оценить каждый пункт):**
- [x] ADR нужен? → Нет (паттерн sliding window тривиальный, не архитектурное решение)
- [x] docs/architecture.md нужно обновить? → Нет
- [x] docs/ai-tools.md нужно обновить? → Нет
- [x] docs/ai-chats-map.md нужно обновить? → Нет
- [x] docs/ai-agents.md нужно обновить? → Нет
- [x] docs/design-system.md нужно обновить? → Нет

**Завершение:**
- [x] Финальное мануальное тестирование (пользователь)
- [ ] Переместить папку в _archive/

**Валидация:**
- [x] `npm run build` — успешен
- [x] Документация актуальна
