# Передача сессии ТЗ-C1: ExpertTaskChat

**Последнее обновление:** 2026-02-10
**Сессия:** 5 (Разработка — Этап 4 завершён)
**Фаза:** Разработка (Этап 4 ✅ → Этап 5 следующий)

---

## Статус этапов

- [x] Этап 1: Инфраструктура (Route Group + Shared Tools + Prompt Builder + DB Queries)
- [x] Этап 2: API Route + TaskSidebar + Page
- [x] Этап 3: TaskChat + Полноценный чат
- [x] Этап 4: Навигация из страницы проекта + Phase Transitions
- [ ] Этап 5: Финализация

**Git:**
- `6140746` feat(tz-c1): infrastructure — route group, shared tools, prompt builder, DB queries
- `7b87468` feat(tz-c1): API route + TaskSidebar + task page
- `63d5216` feat(tz-c1): TaskChat — full chat with expert, auto-trigger, artifacts
- `pending` feat(tz-c1): navigation from project page + phase transitions + locked dialog

---

## Следующая сессия: начни с

1. Прочитай этот файл (HANDOFF.md)
2. Прочитай ROADMAP.md → **Этап 5** (финализация)
3. **Сначала:** Мануальный тест Этапа 4 (навигация из проекта)
4. **Потом:** Комит Этапа 4 → Этап 5 (финализация)

**Порядок Этапа 5:**
1. Финальное мануальное тестирование (полный flow)
2. SQL-проверка БД (таблицы, связи)
3. Перенести CHANGELOG.md → главный CHANGELOG.md
4. Обновить SIMPLY_STATUS.md
5. Обновить CLAUDE.md (добавить TaskChat в структуру кода)
6. Обновить package.json (3.15.0 → 3.16.0)
7. Переместить папку `specs/TZ_C1_ExpertTaskChat/` → `_archive/TZ_C1_ExpertTaskChat/`

---

## Что сделано в сессии 5

**Этап 4 — завершён:**
- `lib/db/queries.ts` — добавлена функция `unlockTask({ taskId })` (status: locked → pending)
- `app/(chat)/api/projects/[id]/tasks/[taskId]/unlock/route.ts` — новый POST endpoint (auth + guards + unlock)
- `components/projects/project-pulse.tsx` — карточки ProjectTask кликабельные: pending/in_progress/done/review/issues → navigate, locked → AlertDialog с предупреждением + разблокировка + navigate
- `components/projects/phase-states/approved-state.tsx` — кнопка «Начать первую задачу» → navigate к первой pending задаче (или AlertDialog для locked); карточки задач кликабельные с той же логикой
- `components/projects/project-work-area.tsx` — передан `projectId` в ApprovedState

**Валидация:**
- `tsc --noEmit` — 0 ошибок ✅
- `npm run build` — успешен ✅
- Мануальный тест — ожидает ✏️

---

## Ключевые решения

1. **Route group:** `app/(task)/` — отдельная от `(chat)`, layout без AppSidebar но с SidebarProvider
2. **Эксперт первым:** Auto-trigger `sendMessage()` при `initialMessages.length === 0` — `[SYSTEM: Задача открыта. Начни работу.]`
3. **createTaskSnapshot:** Пропускаем (C1.5)
4. **Tools:** `lib/ai/tools/chat-tools.ts` — `getStandardTools({ session, dataStream, isProjectChat: true })`
5. **Модель:** `process.env.EXPERT_MODEL || 'gemini-3-pro'`
6. **Transport:** `DefaultChatTransport` с custom API path `/api/projects/${projectId}/tasks/${taskId}/chat`
7. **Artifact:** Работает через SidebarProvider в layout + SWR-based useArtifact hook
8. **Unlock API:** POST `/api/projects/[id]/tasks/[taskId]/unlock` — auth + guards + unlockTask()
9. **AlertDialog:** Controlled state в ProjectPulse и ApprovedState для locked задач

---

## Файлы в работе (Этап 5 — финализация)

Нет новых файлов. Только документация:
- CHANGELOG.md (локальный → главный)
- SIMPLY_STATUS.md
- CLAUDE.md
- package.json

---

## Блокеры / Вопросы

Нет блокеров. Ожидает мануальный тест Этапа 4, затем Этап 5.

---

## Команды

```bash
npm run dev          # Dev сервер
npm run build        # Проверка сборки
npx tsc --noEmit     # Проверка TypeScript
```
