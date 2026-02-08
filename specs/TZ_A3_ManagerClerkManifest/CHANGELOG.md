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
