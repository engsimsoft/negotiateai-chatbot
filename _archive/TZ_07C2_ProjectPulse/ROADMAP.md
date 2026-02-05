# Roadmap ТЗ-07C2 (Project Pulse)

**Оценка:** 3-4 сессии
**Версия:** 3.5.1

---

## Этап 1: База данных

**Цель:** Добавить новые поля в схему и применить миграции

**Задачи:**
- [ ] 1.1 Добавить `Chat.taskStatus` (varchar, default 'not_started')
- [ ] 1.2 Добавить `Project.summary` (text, nullable)
- [ ] 1.3 Добавить `Project.summaryUpdatedAt` (timestamp, nullable)
- [ ] 1.4 Создать и применить миграцию
- [ ] 1.5 Обновить типы в queries.ts

**Файлы:**
- `lib/db/schema.ts`
- `lib/db/queries.ts`
- `lib/db/migrations/00XX_*.sql`

**Критерий готовности:**
- `npm run db:migrate` успешно
- `npx tsc --noEmit` = 0 ошибок
- SQL проверка: колонки существуют

---

## Этап 2: API endpoints

**Цель:** Создать/обновить API для работы со статусами и итогом

**Задачи:**
- [ ] 2.1 PATCH `/api/chat/[id]` — поддержка `taskStatus`
- [ ] 2.2 POST `/api/projects/[id]/generate-summary` — генерация итога
- [ ] 2.3 Автопереход `not_started` → `in_progress` в `/api/chat/route.ts`
- [ ] 2.4 Добавить query `getProjectTasksWithStatus` в queries.ts

**Файлы:**
- `app/(chat)/api/chat/[id]/route.ts`
- `app/(chat)/api/chat/route.ts`
- `app/(chat)/api/projects/[id]/generate-summary/route.ts` (новый)
- `lib/db/queries.ts`

**Критерий готовности:**
- `npx tsc --noEmit` = 0 ошибок
- API тесты через curl/Postman

---

## Этап 3: UI — TaskDetailPanel + статусы

**Цель:** Добавить управление статусом задачи на странице /tasks

**Задачи:**
- [ ] 3.1 Кнопка "✓ Отметить готово" / "↩ Вернуть в работу" в TaskDetailPanel
- [ ] 3.2 Визуальный статус в TaskListItem (✓ для done, 🔄 для in_progress)
- [ ] 3.3 Статус в sidebar-history-item.tsx (✓ для done)
- [ ] 3.4 Интеграция с API (PATCH taskStatus)
- [ ] 3.5 Toast при смене статуса + фоновое обновление итога

**Файлы:**
- `components/tasks/task-detail-panel.tsx`
- `components/tasks/task-list-item.tsx`
- `components/sidebar-history-item.tsx`

**Критерий готовности:**
- `npm run build` успешен
- Кнопка "Готово" работает
- Статус отображается в обоих местах
- Toast при смене + итог обновляется фоном

---

## Этап 4: UI — ProjectPulse

**Цель:** Создать компонент "Пульс проекта" для правой колонки

**Задачи:**
- [ ] 4.1 Компонент `ProjectPulse` со структурой из ТЗ
- [ ] 4.2 Секция статусов: ✅ done · 🔄 in_progress · ○ not_started
- [ ] 4.3 Секция "Где мы сейчас" (итог проекта + дата + 🔄)
- [ ] 4.4 Секция "Активные задачи" (до 5 штук, клик → переход)
- [ ] 4.5 Секция "Последняя задача" (карточка с summary)
- [ ] 4.6 Пустое состояние (нет задач)
- [ ] 4.7 Заменить placeholder на странице проекта

**Файлы:**
- `components/projects/project-pulse.tsx` (новый)
- `app/(dashboard)/projects/[id]/page.tsx`

**Критерий готовности:**
- `npm run build` успешен
- Панель отображается в правой колонке
- Все секции работают
- Кнопка 🔄 обновляет итог

---

## Этап 5: Финализация

**Цель:** Тестирование, документация, архивация

**Задачи:**
- [ ] 5.1 SQL-проверка БД (таблицы, колонки, FK)
- [ ] 5.2 Мануальное тестирование всех сценариев
- [ ] 5.3 Обновить CHANGELOG.md (главный)
- [ ] 5.4 Обновить SIMPLY_STATUS.md
- [ ] 5.5 Обновить CLAUDE.md
- [ ] 5.6 Обновить package.json (версия 3.5.1)
- [ ] 5.7 Переместить папку в _archive/

**Критерий готовности:**
- Все тесты пройдены
- Документация актуальна
- ТЗ в архиве

---

## Тест-кейсы для мануального тестирования

1. **Создать задачу** → статус `not_started`
2. **Отправить сообщение** → статус автоматически `in_progress`
3. **Нажать "Готово"** → статус `done`, toast, итог обновляется
4. **Нажать "Вернуть в работу"** → статус обратно `in_progress`
5. **Пульс проекта** — все секции отображаются корректно
6. **Кнопка 🔄** — итог обновляется вручную
7. **Пустой проект** — показывается пустое состояние
