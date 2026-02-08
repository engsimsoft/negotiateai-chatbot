# Roadmap ТЗ-A3: Manager + Clerk + Manifest

**Создан:** 2026-02-08
**Версия проекта:** 3.12.0 → 3.13.0
**Статус:** Ожидает одобрения

> **Инструкция:** [specs/ROADMAP_GUIDE.md](../ROADMAP_GUIDE.md)

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Всего этапов | 5 (4 рабочих + финализация) |
| Текущий этап | — |
| Оценка сессий | 3-4 |

**Три компонента:**
1. Клерк-анализатор файлов (backend endpoint + промпт)
2. Менеджер проекта в drawer (ServiceChat интеграция + серверная персистенция)
3. Manifest проекта (миграция БД + логика обновления + auto-folder)

---

## Этапы

### Этап 1: Фундамент (БД + промпты)

**Статус:** ⬜ Не начат

**Цель:** Подготовить инфраструктуру — миграция БД, файлы промптов, директории.

**Задачи:**
- [ ] Изучить затронутые файлы (schema.ts, service-chat route, manager-drawer, project-files-card)
- [ ] Проверить текущее состояние: `npm run build` проходит
- [ ] Обновить `lib/db/schema.ts` — добавить поле `manifestJson`
- [ ] Миграция: добавить `manifestJson` (jsonb) в таблицу Project
- [ ] Запустить миграцию `npm run db:migrate`
- [ ] Создать директорию `lib/prompts/clerks/`
- [ ] Создать `lib/prompts/clerks/file-analyzer.md` (из CLERK_FILE_ANALYZER.md — секция System Prompt)
- [ ] Создать `lib/prompts/service-chats/project-manager.md` (из MANAGER_PROMPT.md — базовый промпт + режимы)

**Файлы:**
- `lib/db/schema.ts` — добавить manifestJson в Project
- `lib/db/migrations/XXXX_add_manifest.sql` — миграция
- `lib/prompts/clerks/file-analyzer.md` — новый файл
- `lib/prompts/service-chats/project-manager.md` — новый файл

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок TypeScript
- [ ] `npm run build` — сборка успешна
- [ ] `npm run dev` — сервер запускается без ошибок
- [ ] SQL: `SELECT column_name FROM information_schema.columns WHERE table_name = 'Project' AND column_name = 'manifestJson'` — колонка существует
- [ ] Файлы промптов читаемы: `lib/prompts/clerks/file-analyzer.md`, `lib/prompts/service-chats/project-manager.md`

**Git (после валидации):**
```bash
git add lib/db/schema.ts lib/db/migrations/ lib/prompts/clerks/ lib/prompts/service-chats/project-manager.md
git commit -m "feat(tz-a3): database migration + prompt files"
```

**Критерий готовности:** manifestJson в БД, оба промпта на месте.

---

### Этап 2: Клерк-анализатор (backend)

**Статус:** ⬜ Не начат

> ⛔ **НЕ НАЧИНАТЬ** без подтверждения валидации Этапа 1

**Цель:** Endpoint который принимает fileId, вызывает Gemini Flash с промптом Клерка, сохраняет результат в metadata.analysis, создаёт папку при необходимости, обновляет manifest.

**Задачи:**
- [ ] Создать `app/(chat)/api/projects/[id]/analyze-file/route.ts`
  - POST принимает `{ fileId }`
  - Загружает ProjectFile из БД (name, mimeType, size, metadata.extractedContent)
  - Загружает existingFolders проекта
  - Формирует запрос к Gemini Flash (system prompt из file-analyzer.md, user message с XML-блоками)
  - Парсит JSON ответ (с fallback при невалидном JSON)
  - Сохраняет в `ProjectFile.metadata.analysis`
- [ ] Логика auto-folder: если `suggestedFolder` не существует → создать ProjectFolder
- [ ] Логика move-to-folder: переместить файл в suggestedFolder (обновить `folderId`)
- [ ] Функция `rebuildManifest(projectId)`: агрегировать все файлы с `metadata.analysis` → обновить `Project.manifestJson`
- [ ] Добавить helper `loadClerkPrompt()` для чтения промпта из .md файла

**Файлы:**
- `app/(chat)/api/projects/[id]/analyze-file/route.ts` — новый endpoint
- `lib/db/queries.ts` — новые query: getProjectFiles, updateFileMetadata, rebuildManifest
- `lib/prompts/server.ts` — экспорт loadClerkPrompt (или inline в route)

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] `npm run dev` — сервер запускается без ошибок
- [ ] 🧪 **Мануальный тест:** Вызвать endpoint напрямую (curl/Postman) с реальным fileId → проверить:
  - Ответ 200 с результатом анализа
  - `ProjectFile.metadata.analysis` содержит description, documentType, suggestedFolder, relevance, keyTopics, language
  - Папка создана (если новая)
  - Файл перемещён в папку
  - `Project.manifestJson` обновлён

**Git:**
```bash
git add app/(chat)/api/projects/[id]/analyze-file/ lib/db/queries.ts
git commit -m "feat(tz-a3): clerk file analyzer endpoint + manifest logic"
```

**Критерий готовности:** Endpoint работает, файл анализируется, папка создаётся, manifest обновляется.

---

### Этап 3: Менеджер в drawer (ServiceChat)

**Статус:** ⬜ Не начат

> ⛔ **НЕ НАЧИНАТЬ** без подтверждения валидации Этапа 2

**Цель:** Заменить заглушку в ManagerDrawer на живой AI-диалог через ServiceChat. Серверная персистенция чата. Conditional prompt injection по phase.

**Задачи:**
- [ ] Серверная персистенция: при первом открытии drawer создать Chat запись в БД (type: 'service-chat', projectId)
- [ ] Заменить заглушку в `manager-drawer.tsx` на `<ServiceChatCore>` с конфигом project-manager
- [ ] Передавать `projectId` из ManagerDrawer в ServiceChat контекст
- [ ] Расширить `app/(chat)/api/service-chat/route.ts`:
  - При `context === "project-manager"` и `projectId` — загрузить проект из БД
  - Собрать system prompt: базовый промпт + mode injection по phase
  - Передать passport (name, description, context), manifest, phase, professorEnabled
  - Загрузить/создать Chat для персистенции сообщений
- [ ] Реализовать `buildManagerPrompt(project)` — сборка промпта по MANAGER_PROMPT.md:
  - Base prompt (role + personality + constraints)
  - Mode 1: first_contact (phase = setup/documents)
  - Mode 2: plan_presentation (phase = approved) — заготовка, полная реализация в B1
  - Mode 3: navigation (phase = execution) — заготовка, полная реализация в C1
- [ ] Серверное сохранение/загрузка сообщений (не localStorage)

**Файлы:**
- `components/projects/manager-drawer.tsx` — интеграция ServiceChatCore
- `app/(chat)/api/service-chat/route.ts` — расширение prompt builder + DB fetch + persistence
- `lib/prompts/server.ts` — buildManagerPrompt() function
- `lib/db/queries.ts` — getOrCreateManagerChat, saveServiceChatMessages, loadServiceChatMessages

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] `npm run dev` — сервер запускается без ошибок
- [ ] 🧪 **Мануальный тест:**
  - Открыть проект → открыть drawer → Менеджер приветствует с деталями из паспорта
  - Написать сообщение → получить осмысленный ответ (streaming)
  - Закрыть и открыть drawer → сообщения сохранены
  - Перезагрузить страницу → сообщения на месте (серверная персистенция)
  - Загрузить файлы → открыть drawer → Менеджер видит manifest в контексте

**Git:**
```bash
git add components/projects/manager-drawer.tsx app/(chat)/api/service-chat/ lib/prompts/ lib/db/queries.ts
git commit -m "feat(tz-a3): live manager in drawer with server persistence"
```

**Критерий готовности:** Менеджер ведёт живой диалог, знает проект, видит файлы, история сохраняется на сервере.

---

### Этап 4: Frontend связка (auto-analyze + UI)

**Статус:** ⬜ Не начат

> ⛔ **НЕ НАЧИНАТЬ** без подтверждения валидации Этапа 3

**Цель:** Автоматический анализ при загрузке файлов, UI обратная связь, кнопка перехода к планированию.

**Задачи:**
- [ ] В `project-files-card.tsx`: после успешного upload — fire-and-forget вызов `POST /api/projects/${projectId}/analyze-file` с `{ fileId: newFile.id }`
- [ ] UI индикатор анализа на файле (spinner/пульсация пока идёт анализ, описание когда готов)
- [ ] После ответа analyze-file: обновить файл в локальном state (новая папка, описание)
- [ ] Обновить `welcome-state.tsx`:
  - Адаптивная кнопка «Начать планирование» / «Начать планирование без документов»
  - Подсказка: «Загрузите файлы для лучшего результата» (если нет файлов)
  - onClick → PATCH phase: `documents → planning`
- [ ] Показать описание файлов в Pulse (tooltip или subtitle под именем файла)
- [ ] Обработка ошибок: если analyze-file упал — файл остаётся без описания, лог в console, без ошибки для пользователя

**Файлы:**
- `components/projects/project-files-card.tsx` — trigger + UI feedback
- `components/projects/phase-states/welcome-state.tsx` — адаптивная кнопка
- `components/projects/project-pulse.tsx` — показ описаний (опционально)

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] `npm run dev` — сервер запускается без ошибок
- [ ] 🧪 **Мануальный тест (полный flow):**
  1. Открыть проект → открыть drawer → Менеджер приветствует
  2. Загрузить PDF → файл появляется сразу → через 2-3 сек файл в нужной папке с описанием
  3. Загрузить ещё файлы → папки создаются автоматически
  4. Открыть drawer → Менеджер видит manifest, показывает сводку
  5. Нажать «Начать планирование» → phase переключается (UI обновляется)
  6. Загрузить файл без контента (doc1.pdf) → relevance: unclear, папка «Документы»
  7. Ошибка анализа → файл остаётся без описания, UI не ломается

**Git:**
```bash
git add components/projects/project-files-card.tsx components/projects/phase-states/ components/projects/project-pulse.tsx
git commit -m "feat(tz-a3): auto-analyze on upload + adaptive planning button"
```

**Критерий готовности:** Полный flow работает: загрузка → авто-анализ → папки → manifest → Менеджер видит → кнопка планирования.

---

### Этап 5: Финализация

**Статус:** ⬜ Не начат

> ⛔ **НЕ НАЧИНАТЬ** без подтверждения всех предыдущих этапов

**Цель:** Завершить ТЗ, обновить документацию, архивировать.

**Задачи:**
- [ ] Финальное мануальное тестирование (полный flow от начала до конца)
- [ ] Edge cases: проект без файлов, 10+ файлов одновременно, большие файлы, бинарные файлы
- [ ] SQL-проверка БД (manifestJson, metadata.analysis)
- [ ] Перенести CHANGELOG.md → главный CHANGELOG.md
- [ ] Обновить SIMPLY_STATUS.md
- [ ] Обновить CLAUDE.md (если менялась структура)
- [ ] Обновить package.json (версия 3.13.0)
- [ ] Переместить папку `specs/TZ_A3_ManagerClerkManifest/` → `_archive/TZ_A3_ManagerClerkManifest/`

**Валидация финальная:**
- [ ] `npm run build` — успешен
- [ ] Все функции работают в браузере
- [ ] Документация актуальна
- [ ] Версия обновлена везде (package.json, STATUS, CHANGELOG)

**Критерий готовности:** Документация актуальна, папка в архиве.

---

## Правила валидации

### После каждой задачи
```bash
npx tsc --noEmit  # Должен быть 0 ошибок
```

### После каждого этапа
```bash
npm run build     # Должен пройти
npm run dev       # Проверить в браузере
```

### Мануальные тесты
Запрашивать у пользователя после:
- Завершения этапа
- Значительных изменений UI
- Изменений API
- Изменений в БД

---

## Чек-лист перехода между этапами

Прежде чем начать следующий этап:
- [ ] Все задачи текущего этапа отмечены [x]
- [ ] Валидация этапа пройдена (все пункты)
- [ ] **Git commit сделан** (фиксация этапа)
- [ ] Пользователь подтвердил мануальный тест
- [ ] CHANGELOG.md обновлён
- [ ] HANDOFF.md обновлён
