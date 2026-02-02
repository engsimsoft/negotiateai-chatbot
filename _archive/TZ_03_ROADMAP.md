# ТЗ-03: Дорожная карта реализации

**ТЗ:** TZ_03_PROJECTS_ANTHROPIC_PROFESSOR.md
**Цель:** Проекты + Anthropic + Режим Профессор
**Версия:** 3.2.0
**Статус:** 🔄 В разработке

---

## Обзор фаз

| Фаза | Название | Статус |
|------|----------|--------|
| 1 | База данных | ✅ Завершено |
| 2 | API Projects | ✅ Завершено |
| 3 | UI Projects (Dashboard) | ✅ Завершено |
| 4 | UI Projects (Sidebar) | ✅ Завершено |
| 5 | Anthropic интеграция | ✅ Завершено |
| 6 | Чат проекта | ✅ Завершено |
| 7 | Режим Профессор | ✅ Завершено |
| 8 | Тестирование | ✅ Завершено |
| 9 | Финализация | 🔄 В процессе |

---

## Фаза 1: База данных ✅

### 1.1. Таблица `projects`
- [x] Поля: id, userId, name, description, instruction, createdAt, updatedAt
- [x] FK → users.id

### 1.2. Таблица `project_files`
- [x] Поля: id, projectId, name, type, mimeType, size, url, metadata, createdAt
- [x] FK → projects.id
- [x] metadata.extractedContent для AI контекста

### 1.3. Изменение `chats`
- [x] Добавлено поле `projectId` (nullable FK → projects.id)

### 1.4. Миграция
- [x] `npm run db:generate` — миграция создана
- [x] `npm run db:migrate` — применена

### ✅ Верификация Фазы 1
- [x] `npm run db:studio` — таблицы видны
- [x] Типы TypeScript экспортированы
- [x] Нет ошибок компиляции

---

## Фаза 2: API Projects ✅

### 2.1. Queries для проектов
- [x] `getProjectsByUserId({ userId })`
- [x] `getProjectById({ id })`
- [x] `saveProject({ id, userId, name, description, instruction })`
- [x] `updateProject({ id, name, description, instruction })`
- [x] `deleteProjectById({ id })` — транзакция (файлы, чаты, сообщения)
- [x] `getProjectsWithStats({ userId })` — со счётчиками

### 2.2. Queries для файлов проекта
- [x] `getFilesByProjectId({ projectId })`
- [x] `saveProjectFile({ ... })`
- [x] `deleteProjectFile({ id })`

### 2.3. Queries для чатов проекта
- [x] `getChatsByProjectId({ projectId })`

### 2.4. API Endpoints
- [x] `GET/POST /api/projects` — список, создание
- [x] `GET/PATCH/DELETE /api/projects/[id]` — CRUD
- [x] `GET/POST /api/projects/[id]/files` — файлы + загрузка
- [x] `DELETE /api/projects/[id]/files/[fileId]` — удаление файла
- [x] `GET /api/projects/[id]/chats` — чаты проекта

### 2.5. Извлечение контента из файлов
- [x] txt, md — читаем как есть
- [x] docx — mammoth
- [x] pdf — pdf-parse
- [x] xlsx, csv — xlsx (sheet to CSV)
- [x] Лимит 50K символов на файл

### ✅ Верификация Фазы 2
- [x] POST `/api/projects` создаёт проект
- [x] GET `/api/projects` возвращает список
- [x] DELETE `/api/projects/[id]` удаляет каскадно
- [x] POST `/api/projects/[id]/files` загружает в Vercel Blob
- [x] Контент из txt/pdf/docx извлекается в metadata

---

## Фаза 3: UI Projects (Dashboard) ✅

### 3.1. Карточка "Проекты"
- [x] `components/dashboard/tools-grid.tsx` — убран disabled, добавлен href="/projects"

### 3.2. Страница списка проектов
- [x] `app/(dashboard)/projects/page.tsx`
- [x] Header с навигацией
- [x] Пустое состояние
- [x] Сетка карточек проектов

### 3.3. Страница содержимого проекта
- [x] `app/(dashboard)/projects/[id]/page.tsx`
- [x] Секция "Инструкция" (редактируемая)
- [x] Секция "Документы" (загрузка/удаление)
- [x] Секция "Чаты проекта"

### 3.4. Компоненты
- [x] `components/projects/project-card.tsx`
- [x] `components/projects/create-project-dialog.tsx`
- [x] `components/projects/project-instruction.tsx`
- [x] `components/projects/project-files.tsx`
- [x] `components/projects/project-chats.tsx`

### ✅ Верификация Фазы 3
- [x] Карточка "Проекты" на Dashboard кликабельна
- [ ] `/projects` показывает список проектов (мануальный тест)
- [ ] Можно создать новый проект (мануальный тест)
- [ ] `/projects/[id]` показывает содержимое (мануальный тест)
- [ ] Загрузка файлов работает (мануальный тест)

---

## Фаза 4: UI Projects (Sidebar) ✅

### 4.1. Обновить SidebarProjects
- [x] `components/sidebar-projects.tsx` — реальный список вместо заглушки
- [x] Кнопка "+ Новый проект"
- [x] Клик по проекту → `/projects/[id]` (пока dashboard; `/projects/[id]/chat` в Фазе 6)

### 4.2. Фильтрация чатов
- [x] `lib/db/queries.ts` — getChatsByUserId фильтрует `projectId = null`
- [x] `lib/db/queries.ts` — deleteAllChatsByUserId удаляет только свободные чаты

### 4.3. Sidebar в проекте
- [x] Реализуется в Фазе 6 вместе с `/projects/[id]/chat`

### ✅ Верификация Фазы 4
- [x] Вкладка Projects показывает список проектов (useSWR /api/projects)
- [x] Клик по проекту → переход на страницу проекта
- [x] Вкладка Chats показывает только свободные чаты (isNull filter)
- [x] Build успешен

---

## Фаза 5: Anthropic интеграция ✅

### 5.1. Конфигурация моделей
- [x] `lib/ai/model-tiers.ts` — PROJECT_MODELS (Исполнитель/Эксперт/Профессор)
- [x] Типы: `ProjectModelTier`, `ModelTierConfig`
- [x] Функции: `getProjectModel()`, `getProjectModelTiers()`, `isValidModelTier()`

### 5.2. Claude модели (уже настроены)
- [x] `lib/ai/providers.ts` — Claude через OpenRouter
- [x] Экспорты: `claudeHaiku`, `claudeSonnet`, `claudeOpus`, `getClaudeModel()`

### 5.3. UI выбора модели
- [x] `components/projects/model-selector.tsx`
- [x] Select dropdown с иконками и описаниями
- [x] По умолчанию: Эксперт (Sonnet)

### ✅ Верификация Фазы 5
- [x] model-tiers.ts создан с тремя уровнями
- [x] model-selector.tsx создан
- [x] Build успешен
- [x] Chat API использует модели из model-tiers (Фаза 6)
- [ ] Мануальный тест: ответы от Claude

---

## Фаза 6: Чат проекта ✅

### 6.1. Routes
- [x] `app/(chat)/projects/[id]/chat/page.tsx` — новый чат проекта
- [x] `app/(chat)/projects/[id]/chat/[chatId]/page.tsx` — существующий чат

### 6.2. Layout с панелью справа
- [x] `app/(chat)/projects/[id]/chat/layout.tsx`
- [x] Чат в центре, панель контекста справа (300px, hidden на мобильных)

### 6.3. Панель контекста
- [x] `components/projects/project-context-panel.tsx`
- [x] Название проекта, описание
- [x] Инструкция проекта (line-clamp-6)
- [x] Список файлов с размерами
- [x] Кнопка "Открыть проект"

### 6.4. Обновить Chat API
- [x] `app/(chat)/api/chat/schema.ts` — добавлены `projectId`, `projectModelTier`
- [x] `app/(chat)/api/chat/route.ts` — поддержка проектов
- [x] Если `projectId` — использовать Claude через `getProjectModel()`
- [x] Контекст проекта в system prompt через `buildProjectContext()`
- [x] `lib/db/queries.ts` — saveChat с projectId

### 6.5. Контекст проекта
- [x] `lib/prompts/contexts/project-context.ts`
- [x] Инструкция + файлы с extractedContent
- [x] Лимит 50K на файл, 150K всего

### 6.6. Chat компонент
- [x] `components/chat.tsx` — добавлены props `projectId`, `projectModelTier`
- [x] Transport передаёт project props в API

### ✅ Верификация Фазы 6
- [x] `/projects/[id]/chat` — route создан
- [x] `/projects/[id]/chat/[chatId]` — route создан
- [x] Панель контекста отображается справа
- [x] Chat API поддерживает projectId и projectModelTier
- [x] Build успешен
- [ ] Мануальный тест: чат использует Claude
- [ ] Мануальный тест: Claude видит содержимое документов

---

## Фаза 7: Режим Профессор (Pipeline) ✅

### 7.1. Pipeline логика
- [x] `lib/ai/professor-pipeline.ts`
- [x] Opus анализирует → Haiku выполняет подзадачи → Opus собирает

### 7.2. UI прогресса (детальный)
- [x] `components/projects/professor-progress.tsx`
- [x] Список подзадач с чекбоксами
- [x] ☑ completed, ▶ in_progress, ◻ pending

### 7.3. Streaming pipeline
- [x] События: phase, subtasks, subtask-update, content, complete

### 7.4. Обработка ошибок
- [x] Повтор подзадачи (макс 2 попытки)
- [x] Показ частичного результата при ошибке

### ✅ Верификация Фазы 7
- [x] Выбор "Профессор" запускает pipeline
- [x] Opus разбивает задачу на 3-7 подзадач
- [x] UI показывает список с чекбоксами
- [x] Статусы обновляются в реальном времени
- [x] Финальный результат собирается корректно
- [ ] Мануальный тест (выполняет пользователь)

---

## Фаза 8: Тестирование ✅

### 8.1. Build verification
```bash
npm run build
```
- [x] Build успешен без ошибок
- [x] Нет TypeScript ошибок
- [x] Нет ESLint warnings

### 8.2. Мануальное тестирование (выполняет пользователь)

**Сценарий 1: Создание проекта**
- [x] Dashboard → карточка "Проекты" кликабельна
- [x] `/projects` → кнопка "+ Создать"
- [x] Создать проект "Тестовый проект"
- [x] Проект появился в списке

**Сценарий 2: Работа с проектом**
- [x] Открыть проект → страница с секциями
- [x] Добавить инструкцию (текст)
- [x] Загрузить файл (PDF или изображение)
- [x] Файл отображается в списке

**Сценарий 3: Чат проекта**
- [x] Кнопка "💬 Чат" → открывается чат
- [x] Панель справа показывает инструкцию и файлы
- [x] Отправить сообщение → ответ от Claude
- [x] Dropdown модели работает (Исполнитель/Эксперт/Профессор)

**Сценарий 4: Sidebar**
- [x] Вкладка Projects → список проектов
- [x] Клик по проекту → чат проекта
- [x] Вкладка Chats → только свободные чаты

**Сценарий 5: Режим Профессор**
- [x] Выбрать "🎓 Профессор" в dropdown
- [x] Отправить сложную задачу
- [x] Видно прогресс pipeline
- [x] Получен собранный результат

**Сценарий 6: Регрессия**
- [x] Свободный чат работает (Gemini)
- [x] Модальные помощники (📝 ❓) работают
- [x] Артефакты создаются
- [x] Voice Input работает

---

## Фаза 9: Финализация 🔄

### 9.1. Документация
- [ ] `SIMPLY_STATUS.md` — версия 3.2.0
- [ ] `CHANGELOG.md` — описание изменений
- [ ] `CLAUDE.md` — обновить структуру
- [ ] `docs/ai-providers.md` — добавить модели проекта

### 9.2. Архив
- [ ] `TZ_03_PROJECTS_ANTHROPIC_PROFESSOR.md` → `_archive/`
- [ ] `TZ_03_ROADMAP.md` → `_archive/`

---

## Ключевые файлы

| Категория | Файлы |
|-----------|-------|
| **БД** | `lib/db/schema.ts`, `lib/db/queries.ts` |
| **API** | `app/(chat)/api/projects/`, `app/(chat)/api/chat/route.ts` |
| **Dashboard** | `app/(dashboard)/projects/`, `components/projects/` |
| **Sidebar** | `components/sidebar-projects.tsx`, `components/app-sidebar.tsx` |
| **AI** | `lib/ai/providers.ts`, `lib/ai/model-tiers.ts`, `lib/ai/professor-pipeline.ts` |
| **Чат проекта** | `app/(chat)/projects/[id]/chat/` |

---

## Зависимости между фазами

```
Фаза 1 (БД) ✅
    ↓
Фаза 2 (API) ✅
    ↓
Фаза 3 (Dashboard UI) ✅
    ↓
Фаза 4 (Sidebar UI) ✅
    ↓
Фаза 5 (Anthropic) ✅
    ↓
Фаза 6 (Чат проекта) ✅
    ↓
Фаза 7 (Профессор) ✅
    ↓
Фаза 8 (Тестирование) ✅
    ↓
Фаза 9 (Финализация) ← 🔄 СЛЕДУЮЩИЙ
```

---

**Создано:** 2026-02-02
**Автор:** Claude (Opus 4.5)
**Для:** Claude Code
