# Передача сессии ТЗ-A3: Manager + Clerk + Manifest

**Последнее обновление:** 2026-02-08
**Сессия:** 2 (разработка — Этапы 1-2)

---

## Статус этапов

- [x] Этап 1: Фундамент (БД + промпты) ✅
- [x] Этап 2: Клерк-анализатор (backend) ✅ протестирован
- [ ] Этап 3: Менеджер в drawer (ServiceChat) ← СЛЕДУЮЩИЙ
- [ ] Этап 4: Frontend связка (auto-analyze + UI)
- [ ] Этап 5: Финализация

---

## Следующая сессия: начни с

1. Прочитай этот файл (HANDOFF.md)
2. Прочитай ROADMAP.md — Этап 3 (подробный план задач и валидации)
3. Прочитай MANAGER_PROMPT.md — промпт Менеджера (3 режима: first_contact, plan_presentation, navigation)
4. **Изучи файлы перед изменением:**
   - `components/projects/manager-drawer.tsx` — заглушка на строках ~47-68 (заменить на ServiceChatCore)
   - `app/(chat)/api/service-chat/route.ts` — текущий buildProjectManagerPrompt() — inline заглушка, заменить на полноценный
   - `components/service-chat/service-chat-core.tsx` — как ServiceChatCore принимает конфиг
   - `components/service-chat/configs/project-manager.ts` — существующий конфиг
5. **Ключевые задачи Этапа 3:**
   - Серверная персистенция: Chat запись в БД (type: service-chat, привязка к проекту)
   - Заменить заглушку в manager-drawer на ServiceChatCore
   - buildManagerPrompt(): загрузить .md из файла + conditional mode injection по phase
   - Context injection: passport (name, description, context), manifest, phase, professorEnabled
   - Загрузить/создать Chat для персистенции сообщений
6. **ВАЖНО:** Следуй ROADMAP.md пошагово — коммит после этапа, валидация, CHANGELOG, HANDOFF

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
| `CHANGELOG.md` | Лог изменений (Этапы 1-2) |
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

- **ManagerDrawer** (`components/projects/manager-drawer.tsx`) — UI каркас, заглушка внутри (заменить на ServiceChatCore)
- **ServiceChat система** — полностью работает (core, drawer, floating, configs)
- **project-manager config** (`components/service-chat/configs/project-manager.ts`) — есть, shell: drawer
- **ServiceChat API** (`app/(chat)/api/service-chat/route.ts`) — работает, context routing, нужно расширить
- **Загрузка файлов** — работает, content extraction
- **ProjectFile/Folder** — таблицы в БД, CRUD, UI
- **project-files-card** — upload handler (после upload добавить trigger analyze-file)
- **welcome-state** — кнопка «Начать работу» (заменить на «Начать планирование»)
- **analyze-file endpoint** — ✅ готов (Этап 2)
- **manifestJson в БД** — ✅ готов (Этап 1)
- **Промпты Клерка и Менеджера** — ✅ готовы (Этап 1)

## Чего НЕТ в коде (надо создать в Этапе 3+)

- Context injection для Менеджера (passport, manifest, phase) — не реализовано
- Серверная персистенция для service-chat Менеджера — не реализована
- buildManagerPrompt() в server.ts — не реализован
- Frontend trigger analyze-file после upload — не реализован
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
