# Передача сессии ТЗ-C3

**Последнее обновление:** 2026-02-15
**Сессия:** 1

---

## Статус этапов

- [ ] Этап 1: Подготовка — адаптация инфраструктуры (клерк, tools factory)
- [ ] Этап 2: Wiring в chat/route.ts — snapshot-aware context management
- [ ] Этап 3: UI — ContextIndicator + ChatSidebar секция "Итоги"
- [ ] Этап 4: E2E тест — полный цикл snapshot
- [ ] Этап 5: Финализация

---

## Следующая сессия: начни с

1. Прочитай этот файл
2. Прочитай ROADMAP.md → Этап 1
3. `git checkout feature/chat-context`
4. `npm run dev`
5. **Первая задача:** 1.1 — адаптация `snapshot-creator.ts` (сделать taskTitle/taskGoal optional)

---

## Что сделано в последней сессии

- Фаза 1 (Анализ): глубокий анализ 4 областей кодовой базы
- Фаза 2 (Планирование): ROADMAP с 5 этапами, 20+ задач
- Создана ветка `feature/chat-context`
- Все вопросы из ANALYSIS.md получили ответы архитектора

---

## Файлы в работе

| Файл | Статус | Примечание |
|------|--------|------------|
| `specs/TZ_C3_ChatContext/SPEC.md` | Готов | Спецификация |
| `specs/TZ_C3_ChatContext/ANALYSIS.md` | Готов | Анализ + ответы |
| `specs/TZ_C3_ChatContext/ROADMAP.md` | Готов | 5 этапов, рабочий чеклист |
| `lib/ai/clerks/snapshot-creator.ts` | Ожидает | Этап 1.1 |
| `lib/prompts/clerks/snapshot-creator.md` | Ожидает | Этап 1.2 |
| `lib/ai/tools/chat-tools.ts` | Ожидает | Этап 1.3 |
| `app/(chat)/api/chat/route.ts` | Ожидает | Этап 2 (основная работа) |
| `components/chat.tsx` | Ожидает | Этап 3 |
| `components/chat-sidebar.tsx` | Ожидает | Этап 3 |

---

## Блокеры / Вопросы

Нет блокеров. Все вопросы закрыты.

---

## Команды

```bash
git checkout feature/chat-context
npm run dev          # Dev сервер
npm run build        # Проверка сборки
npx tsc --noEmit     # Проверка TypeScript
```

---

## Ключевые решения

1. **Номер ТЗ: C3** — продолжение C-серии
2. **Версия: 3.22.0** — следующий minor после 3.21.0
3. **Один клерк** — universal `snapshot-creator.ts`, taskTitle/taskGoal optional
4. **Один промпт** — universal `snapshot-creator.md`, убрать "Эксперт"
5. **Git ветка** — `feature/chat-context` (отдельная от design-system)
6. **onFinish filter** — КРИТИЧНО добавить `tool-createSnapshot` в whitelist
7. **UI компоненты** — message.tsx, messages.tsx, SnapshotCard, ContextIndicator — НЕ ТРОГАТЬ (уже generic)
