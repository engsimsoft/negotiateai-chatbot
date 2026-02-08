# Передача сессии ТЗ-A3: Manager + Clerk + Manifest

**Последнее обновление:** 2026-02-08
**Сессия:** 5 (следующая — Этап 5: Финализация)

---

## Статус этапов

- [x] Этап 1: Фундамент (БД + промпты) ✅
- [x] Этап 2: Клерк-анализатор (backend) ✅ протестирован
- [x] Этап 3: Менеджер в drawer (ServiceChat) ✅ протестирован
- [x] Этап 4: Frontend связка (auto-analyze + UI) ✅ протестирован
- [ ] Этап 5: Финализация ← СЛЕДУЮЩИЙ

---

## Следующая сессия: начни с

1. Прочитай этот файл (HANDOFF.md)
2. Прочитай ROADMAP.md — Этап 5 (финализация)
3. **Задачи Этапа 5:**
   - Финальное мануальное тестирование (полный flow от начала до конца)
   - Edge cases: проект без файлов, 10+ файлов одновременно, большие файлы, бинарные файлы
   - SQL-проверка БД (manifestJson, metadata.analysis)
   - Перенести CHANGELOG.md → главный CHANGELOG.md
   - Обновить SIMPLY_STATUS.md
   - Обновить CLAUDE.md (если менялась структура)
   - Обновить package.json (версия 3.13.0)
   - Переместить папку `specs/TZ_A3_ManagerClerkManifest/` → `_archive/TZ_A3_ManagerClerkManifest/`

---

## Что сделано в сессии 4

### Этап 4: Frontend связка (auto-analyze + UI)
- **Fire-and-forget analyze:** после upload файла — вызов `POST /api/projects/${projectId}/analyze-file` с `{ fileId }`
- `analyzingFileIds` state — отслеживает файлы в процессе анализа
- **UI индикатор:** пульсирующая синяя точка + "Анализ..." во время работы Клерка
- **documentType** под именем файла (короткий тег: "стратегия", "документ", "таблица данных")
- **Tooltip** (shadcn/ui) при наведении — полное `description` от Клерка
- **Автоматическое обновление state:** новая папка добавляется, файл перемещается, metadata обновляется — всё без перезагрузки
- **Адаптивная кнопка планирования** в welcome-state:
  - Есть файлы → «Начать планирование»
  - Нет файлов → «Начать планирование без документов» + подсказка
  - onClick → PATCH phase: `documents → planning` → router.refresh()
- **PATCH /api/projects/[id]** — добавлена поддержка `{ phase }` через `updateProjectPhase()`
- **analyze-file API** — расширен: возвращает `folder` объект при создании новой папки
- **Валидация:** tsc 0 ошибок, build успешен
- **Мануальный тест пройден:**
  - Загрузка файла → пульсация "Анализ..." → через 2-3 сек documentType появляется, файл в папке
  - Tooltip при наведении показывает полное описание
  - Кнопка «Начать планирование» работает, phase меняется

---

## Что сделано в сессии 3

### Этап 3: Менеджер в drawer (ServiceChat)
- **Серверная персистенция:** `getOrCreateManagerChat()`, `findManagerChat()` в queries.ts
- Конвенция title: `__service:project-manager` — фильтрация из обычных чатов проекта
- **GET /api/service-chat** — загрузка сохранённых сообщений при открытии drawer
- **POST /api/service-chat** — расширен: загрузка промпта из .md, async `buildSystemPrompt`, сохранение сообщений
- `buildFullManagerPrompt()` — сборка промпта с passport, manifest, files_status, mode injection по phase
- 3 mode injection: `buildFirstContactMode()` (полный), `buildPlanPresentationStub()`, `buildNavigationStub()`
- `manager-drawer.tsx` — полная замена заглушки на `ServiceChatCore`
- `service-chat-core.tsx` — `loadedMessages` prop
- Фильтрация `__service:*` в 3 функциях

---

## Файлы в папке ТЗ

| Файл | Назначение |
|------|------------|
| `TZ_A3_Manager_Clerk_Manifest.md` | Само ТЗ (спецификация) |
| `ANALYSIS.md` | Анализ + ответы на вопросы |
| `ROADMAP.md` | План — 5 этапов (одобрен) |
| `CHANGELOG.md` | Лог изменений (Этапы 1-4) |
| `MANAGER_PROMPT.md` | Промпт Менеджера от PE |
| `CLERK_FILE_ANALYZER.md` | Промпт Клерка-анализатора от PE |
| `CLERK_SUMMARIZER.md` | Промпт Клерка-суммаризатора (НЕ для A3) |
| `MVP_ROLES_AND_CONTRACTS.md` | Контракты всех ролей |
| `SIMPLY_ORCHESTRATION_BLUEPRINT.md` | Архитектура оркестрации |

---

## Ключевые решения

1. **Trigger анализа:** Frontend fire-and-forget (upload быстрый, анализ параллельно)
2. **Хранение анализа:** `ProjectFile.metadata.analysis` (jsonb, manifest строится агрегацией)
3. **История Менеджера:** Серверная персистенция (Chat в БД, привязка к проекту)
4. **Кнопка планирования:** Всегда видна, адаптивный текст (есть файлы / нет файлов)
5. **Описание файлов:** documentType (короткий тег) + tooltip с полным description
6. **Модель Клерка:** Gemini Flash | **Модель Менеджера:** Gemini Flash (dev) / Claude Sonnet (prod)

---

## Блокеры / Вопросы

Нет блокеров.

---

## Команды

```bash
npm run dev          # Dev сервер
npm run build        # Проверка сборки
npx tsc --noEmit     # Проверка TypeScript
npm run db:migrate   # Применить миграции
npm run db:studio    # Drizzle Studio (просмотр БД)
```
