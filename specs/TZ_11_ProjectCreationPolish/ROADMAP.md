# Roadmap ТЗ-11: Project Creation Polish

## Этапы

### Этап 1: Фикс скролла чата ✅
**Файлы:** `project-chat-panel.tsx`
**Коммит:** `f81ebbe`

---

### Этап 2: Placeholder-подсказки
**Цель:** Пустые поля показывают полезные подсказки
**Файлы:**
- `app/(dashboard)/projects/new/components/project-draft-preview.tsx`
**Задачи:**
- [ ] Заменить "Ожидание..." на подсказки из ТЗ
- [ ] Лейбл "Инструкция для AI" → "Контекст проекта"
- [ ] CSS transition для плавной замены placeholder → контент

---

### Этап 3: Добавить колонку `context` в БД
**Цель:** Новая колонка для хранения контекста проекта (отдельно от instruction)
**Файлы:**
- `lib/db/schema.ts` — добавить колонку `context`
- Миграция Drizzle
**Задачи:**
- [ ] Добавить `context: text("context")` в таблицу Project
- [ ] Создать и применить миграцию

---

### Этап 4: Секретарь пишет в `context`
**Цель:** tool updateProjectDraft передаёт context вместо instruction
**Файлы:**
- `app/(chat)/api/service-chat/route.ts` — tool параметр instruction → context
- `app/(dashboard)/projects/new/project-creation-client.tsx` — draft type, extractDraftUpdate
- `app/(dashboard)/projects/new/components/project-draft-preview.tsx` — ProjectDraft type
- `app/(chat)/api/projects/route.ts` — POST сохраняет в context
**Задачи:**
- [ ] Tool: параметр `instruction` → `context`
- [ ] Draft type: `instruction` → `context`
- [ ] extractDraftUpdate: читает `context`
- [ ] API POST /api/projects: сохраняет в `context`

---

### Этап 5: UI страницы проекта — КОНТЕКСТ из БД
**Цель:** Вкладка "Паспорт" читает context из БД, убрать заглушку
**Файлы:**
- `app/(dashboard)/projects/[id]/page.tsx` — передать project.context
- `components/projects/project-passport.tsx` — показать context, убрать TODO
**Задачи:**
- [ ] Передать `context` prop в ProjectPassport
- [ ] Показать project.context вместо заглушки "Контекст проекта не задан"

---

### Этап 6: Проверка финального flow
**Цель:** Полный flow работает end-to-end
**Задачи:**
- [ ] Проверить: создание → context заполняется → страница проекта показывает context
- [ ] Вкладка "Инструкция" — пустая, это ок
