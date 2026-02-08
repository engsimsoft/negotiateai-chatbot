# Changelog ТЗ-A3: Manager Clerk Manifest

> История изменений в рамках этого ТЗ.
> После завершения — переносится в главный CHANGELOG.md

---

## Этап 1: Фундамент (БД + промпты)

**Дата:** 2026-02-08

### Добавлено
- `Project.manifestJson` (jsonb) — агрегированные данные о файлах от Клерка
- `ProjectFile.metadata.analysis` — типизация результатов анализа
- Миграция `0024_wet_rawhide_kid.sql` — ALTER TABLE Project ADD manifestJson
- `lib/prompts/clerks/file-analyzer.md` — промпт Клерка-архивариуса (из CLERK_FILE_ANALYZER.md)
- `lib/prompts/service-chats/project-manager.md` — базовый промпт Менеджера с `{{MODE_INJECTION}}`

---

## Этап 2: Клерк-анализатор (backend)

**Дата:** 2026-02-08

### Добавлено
- `POST /api/projects/[id]/analyze-file` — endpoint Клерка-анализатора
  - Вызывает Gemini Flash с промптом из file-analyzer.md
  - Парсит JSON-ответ с fallback (strip markdown code blocks)
  - Сохраняет анализ в `ProjectFile.metadata.analysis`
  - Auto-folder: создаёт папку если suggestedFolder новая
  - Move-to-folder: перемещает файл в рекомендованную папку
  - Rebuild manifest: агрегирует все анализы в `Project.manifestJson`
- `getProjectFileById()` — получение файла по ID
- `updateProjectFileMetadata()` — обновление metadata файла
- `rebuildProjectManifest()` — сборка manifest из всех проанализированных файлов

---

## Этап 3: Менеджер в drawer (ServiceChat)

**Дата:** 2026-02-08

### Добавлено
- Серверная персистенция сообщений Менеджера:
  - `getOrCreateManagerChat()` — найти/создать Chat с title `__service:project-manager`
  - `findManagerChat()` — поиск без создания
  - Сохранение user-сообщений до стриминга, assistant-сообщений после `result.text`
- `GET /api/service-chat` — загрузка персистированных сообщений при открытии drawer
- Полный prompt builder для Менеджера:
  - Загрузка базового промпта из `project-manager.md`
  - `buildFullManagerPrompt()` — async сборка с данными проекта
  - Conditional mode injection по `project.phase` (first_contact / stubs для plan_presentation и navigation)
  - Context injection: passport (name, description, context), manifest, files_status, professor_enabled
- `ManagerChatContent` — компонент с fetch загрузкой сообщений и `ServiceChatCore`
- Desktop lazy mount: render на первом открытии, далее keep mounted
- Mobile: re-mount через vaul при каждом открытии

### Изменено
- `manager-drawer.tsx` — полная замена заглушки на живой AI-диалог
- `service-chat-core.tsx` — поддержка `loadedMessages` (greeting + server messages)
- `types.ts` — добавлен `loadedMessages` prop в `ServiceChatCoreProps`
- `project-page-layout.tsx` — передача `projectId` в ManagerDrawer
- `projects/[id]/page.tsx` — передача `projectId` в layout
- `service-chat/route.ts` — async `buildSystemPrompt`, temperature 0.5 для manager

### Фильтрация service-чатов
- `getChatsByProjectId` — фильтрация `__service:*` из списка чатов проекта
- `getProjectChatsWithStats` — аналогичная фильтрация
- `getProjectChatsCount` — аналогичная фильтрация
