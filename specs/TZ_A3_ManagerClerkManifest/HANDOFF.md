# Передача сессии ТЗ-A3: Manager + Clerk + Manifest

**Последнее обновление:** 2026-02-08
**Сессия:** 4 (следующая — Этап 4: Frontend связка)

---

## Статус этапов

- [x] Этап 1: Фундамент (БД + промпты) ✅
- [x] Этап 2: Клерк-анализатор (backend) ✅ протестирован
- [x] Этап 3: Менеджер в drawer (ServiceChat) ✅ протестирован
- [ ] Этап 4: Frontend связка (auto-analyze + UI) ← СЛЕДУЮЩИЙ
- [ ] Этап 5: Финализация

---

## Следующая сессия: начни с

1. Прочитай этот файл (HANDOFF.md)
2. Прочитай ROADMAP.md — Этап 4 (подробный план задач и валидации)
3. **Изучи файлы перед изменением:**
   - `components/projects/project-files-card.tsx` — добавить fire-and-forget вызов analyze-file после upload
   - `components/projects/phase-states/welcome-state.tsx` — адаптивная кнопка «Начать планирование»
   - `components/projects/project-pulse.tsx` — показ описаний файлов (опционально)
   - `app/(chat)/api/projects/[id]/analyze-file/route.ts` — уже готовый endpoint Клерка (Этап 2)
4. **Ключевые задачи Этапа 4:**
   - После upload файла: fire-and-forget `POST /api/projects/${projectId}/analyze-file` с `{ fileId }`
   - UI индикатор анализа (spinner/пульсация → описание)
   - Обновить файл в локальном state после ответа (новая папка, описание)
   - Адаптивная кнопка «Начать планирование» / «Начать планирование без документов»
   - onClick → PATCH phase: `documents → planning`
5. **ВАЖНО:** Следуй ROADMAP.md пошагово — коммит после этапа, валидация, CHANGELOG, HANDOFF

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
  - Desktop: lazy mount (hasOpened), Mobile: re-mount через vaul
  - `ManagerChatContent` — fetch messages → ServiceChatCore
- `service-chat-core.tsx` — `loadedMessages` prop, greeting + server messages как initialMessages
- `types.ts` — `loadedMessages` prop
- `project-page-layout.tsx` + `projects/[id]/page.tsx` — projectId проброс
- Фильтрация `__service:*` в 3 функциях: getChatsByProjectId, getProjectChatsWithStats, getProjectChatsCount
- **Валидация:** tsc 0 ошибок, build успешен
- **Мануальный тест пройден:**
  - Менеджер приветствует, знает проект (passport), видит manifest
  - Streaming ответы работают
  - Закрытие/открытие drawer — сообщения сохранены
  - Перезагрузка страницы — сообщения загружаются с сервера
  - Quick actions работают

---

## Что сделано в сессии 2

### Этап 1: Фундамент
- `Project.manifestJson` (jsonb) добавлен в schema.ts
- `ProjectFile.metadata.analysis` — типизация расширена
- Миграция 0024 создана и применена (колонка в БД)
- `lib/prompts/clerks/file-analyzer.md` — промпт Клерка из CLERK_FILE_ANALYZER.md
- `lib/prompts/service-chats/project-manager.md` — базовый промпт Менеджера + `{{MODE_INJECTION}}`
- Валидация: tsc 0 ошибок, build успешен, SQL подтверждает колонку

### Этап 2: Клерк-анализатор
- `app/(chat)/api/projects/[id]/analyze-file/route.ts` — полный endpoint
- 3 новые DB-функции в queries.ts: getProjectFileById, updateProjectFileMetadata, rebuildProjectManifest
- Логика: Gemini Flash → JSON parse → auto-folder → move-to-folder → rebuild manifest
- Валидация: tsc 0 ошибок, build успешен
- **Интеграционный тест пройден:**
  - Excel с контентом (Shortcut_DKRacing_Sponsorship_Data.xlsx) → relevance: core, folder: "DK Racing"
  - Изображение без preview (Снимок экрана.jpeg) → relevance: unclear, folder: "Скриншоты"
  - JSON парсинг работает (strip markdown code blocks)
  - Все required fields present, relevance valid

---

## Что сделано в сессии 1

- Создана папка `specs/TZ_A3_ManagerClerkManifest/` со всеми файлами
- Проведено исследование кодовой базы (все затронутые компоненты)
- Написан ANALYSIS.md с 6 вопросами — все ответы получены
- Написан ROADMAP.md — 5 этапов, план одобрён пользователем

---

## Файлы в папке ТЗ

| Файл | Назначение |
|------|------------|
| `TZ_A3_Manager_Clerk_Manifest.md` | Само ТЗ (спецификация) |
| `ANALYSIS.md` | Анализ + ответы на вопросы |
| `ROADMAP.md` | План — 5 этапов (одобрен) |
| `CHANGELOG.md` | Лог изменений (Этапы 1-3) |
| `MANAGER_PROMPT.md` | Промпт Менеджера от PE (базовый + 3 режима) |
| `CLERK_FILE_ANALYZER.md` | Промпт Клерка-анализатора от PE |
| `CLERK_SUMMARIZER.md` | Промпт Клерка-суммаризатора (НЕ для A3, для контекста) |
| `MVP_ROLES_AND_CONTRACTS.md` | Контракты всех ролей |
| `SIMPLY_ORCHESTRATION_BLUEPRINT.md` | Архитектура оркестрации |

---

## Ключевые решения (из ANALYSIS.md)

1. **Trigger анализа:** Frontend fire-and-forget (upload быстрый, анализ параллельно)
2. **Хранение анализа:** `ProjectFile.metadata.analysis` (jsonb, manifest строится агрегацией)
3. **История Менеджера:** Серверная персистенция (Chat в БД, привязка к проекту)
4. **Кнопка планирования:** Всегда видна, адаптивный текст (есть файлы / нет файлов)
5. **CLERK_SUMMARIZER:** Не в A3 (это C2)
6. **Модель Клерка:** Gemini Flash (дешёвая, быстрая, большой контекст)
7. **Модель Менеджера:** Gemini Flash (dev) / Claude Sonnet (prod)

---

## Что уже есть в коде

- **ManagerDrawer** (`components/projects/manager-drawer.tsx`) — ✅ живой AI-диалог через ServiceChatCore (Этап 3)
- **ServiceChat система** — полностью работает (core, drawer, floating, configs)
- **project-manager config** (`components/service-chat/configs/project-manager.ts`) — есть, shell: drawer
- **ServiceChat API** (`app/(chat)/api/service-chat/route.ts`) — ✅ GET + POST, persistence, full prompt builder (Этап 3)
- **Серверная персистенция Менеджера** — ✅ `getOrCreateManagerChat`, title convention `__service:*` (Этап 3)
- **Context injection Менеджера** — ✅ passport, manifest, phase, mode injection (Этап 3)
- **Загрузка файлов** — работает, content extraction
- **ProjectFile/Folder** — таблицы в БД, CRUD, UI
- **project-files-card** — upload handler (после upload добавить trigger analyze-file)
- **welcome-state** — кнопка «Начать работу» (заменить на «Начать планирование»)
- **analyze-file endpoint** — ✅ готов (Этап 2)
- **manifestJson в БД** — ✅ готов (Этап 1)
- **Промпты Клерка и Менеджера** — ✅ готовы (Этап 1)

## Чего НЕТ в коде (надо создать в Этапе 4)

- Frontend trigger analyze-file после upload — не реализован
- UI индикатор анализа (spinner → описание) — не реализован
- Адаптивная кнопка «Начать планирование» — не реализована

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
