# ТЗ-A3: Менеджер + Клерк-анализатор + Manifest

**Версия:** 1.0  
**Дата:** 2026-02-08  
**Приоритет:** 🔴 Высокий  
**Зависимости:** ТЗ-A1 ✅ (layout + drawer), файловая система ✅ (ProjectFile + ProjectFolder)

---

## Цель

Оживить первую фазу проекта: пользователь открывает проект → Менеджер встречает в drawer → пользователь загружает файлы → система анализирует каждый файл → формируется manifest (каталог файлов проекта).

**Вертикальный срез:** закрывает Фазу 1 (Подготовка) целиком — UI + backend + промпты.

---

## Результат

После реализации:
1. Менеджер в drawer — живой диалог (не заглушка), встречает пользователя, предлагает загрузить файлы
2. При загрузке файлов — автоматический анализ Клерком (backend)
3. Manifest проекта генерируется и обновляется автоматически
4. Менеджер видит manifest в контексте и может обсуждать файлы с пользователем

---

## Три компонента

### 1. Менеджер проекта (drawer → ServiceChat)

**Что:** Подключить существующий ManagerDrawer к системе ServiceChat. Drawer из A1 — каркас. Теперь в нём живой AI.

**Как:**
- Новый промпт Менеджера — .md файл от PE, положить в `lib/prompts/service-chats/project-manager.md`
- Новый конфиг ServiceChat: `PROJECT_MANAGER_CONFIG` (если не создан в A1)
- API: использовать существующий `/api/service-chat` с context = 'project-manager'
- Streaming в drawer через ServiceChat систему

**Контекст для Менеджера (system prompt injection):**

```
passport: { name, description, context }     // из Project
manifest: { files: [...] }                    // из Project.manifestJson
phase: string                                 // из Project.phase
professorEnabled: boolean                     // из Project (default true)
```

На этом этапе Менеджер работает в **режиме «первый контакт»**:
- Получает passport + manifest + phase
- Приветствует, показывает что понял проект
- Предлагает загрузить файлы
- После загрузки — обсуждает что в файлах (видит manifest)

Режимы «представление плана» и «навигация» — в B1 и C1 соответственно (добавление контекста planJson и taskStatuses в system prompt).

**Менеджер БЕЗ tools** — только диалог. Все действия (загрузка файлов, начало планирования) — через UI-кнопки в drawer или рабочей области.

### 2. Клерк-анализатор файлов (backend)

**Что:** Backend endpoint, который получает файл и возвращает структурированное описание. Вызывается автоматически при загрузке.

**Промпт:** .md файл от PE, положить в `lib/prompts/clerks/file-analyzer.md`

**Модель:** Gemini Flash или Claude Haiku — дешёвая, быстрая. Выбор на усмотрение Claude Code (рекомендация: Gemini Flash, он уже подключён и у него большой контекст для файлов).

**Endpoint:** `POST /api/projects/[id]/analyze-file`

**Вход:**
```json
{
  "fileId": "uuid"
}
```

Endpoint берёт из ProjectFile: name, mimeType, size, metadata.extractedContent (уже есть — контент-экстракция при загрузке). Также передаёт existingFolders (список папок проекта).

**Выход (structured JSON от модели):**
```json
{
  "description": "Договор поставки оборудования на 2025 год",
  "documentType": "договор",
  "suggestedFolder": "Юридические",
  "relevance": "core",
  "keyTopics": ["поставка", "оборудование", "условия оплаты"],
  "language": "ru"
}
```

**Контракт промпта:** см. MVP_ROLES_AND_CONTRACTS.md, секция 2.5 (Клерк-анализатор).

### 3. Manifest проекта

**Что:** JSON-каталог всех файлов проекта с описаниями от Клерка. Хранится в Project, передаётся Менеджеру и Профессору как контекст.

**Миграция БД:**
```sql
ALTER TABLE "Project" ADD COLUMN "manifestJson" jsonb;
```

**Формат manifestJson:**
```json
{
  "files": [
    {
      "id": "uuid",
      "name": "договор_поставки_2025.pdf",
      "folder": "Юридические",
      "mimeType": "application/pdf",
      "size": 245000,
      "description": "Договор поставки оборудования на 2025 год",
      "documentType": "договор",
      "relevance": "core",
      "keyTopics": ["поставка", "оборудование", "условия оплаты"],
      "language": "ru"
    }
  ],
  "updatedAt": "2026-02-08T12:00:00Z"
}
```

**Когда обновляется:**
- После анализа нового файла Клерком → добавить запись в manifest
- При удалении файла → убрать из manifest
- При перемещении файла в другую папку → обновить folder

---

## Flow загрузки файла (обновлённый)

```
Пользователь загружает файл (существующий UI в Пульсе)
  ↓
POST /api/projects/[id]/files (существующий endpoint)
  → Vercel Blob upload
  → Content extraction (PDF/DOCX/XLSX → extractedContent)
  → Сохранение ProjectFile
  ↓
POST /api/projects/[id]/analyze-file (НОВЫЙ — вызывается автоматически)
  → Клерк получает: name, mimeType, size, extractedContent, existingFolders
  → Клерк возвращает: description, documentType, suggestedFolder, relevance, keyTopics, language
  ↓
Backend:
  → Обновляет ProjectFile (description, если нужно доп. поле)
  → Если suggestedFolder не существует — создаёт ProjectFolder
  → Перемещает файл в suggestedFolder
  → Обновляет Project.manifestJson
  ↓
UI обновляется:
  → Файл появляется в нужной папке в Пульсе
  → Менеджер видит обновлённый manifest в контексте
```

**Важно:** Анализ — автоматический. Пользователь не нажимает «Анализировать». Загрузил файл → через несколько секунд файл в нужной папке с описанием. WOW-эффект.

---

## Переход фазы

Переход `documents → planning`:
- В рабочей области (WelcomeState / DocumentsState) — кнопка «Начать планирование»
- Кнопка активна когда есть хотя бы 1 файл в manifest (или пользователь подтвердил что файлов не будет)
- При нажатии — `phase` обновляется на `planning`
- Фактический вызов Профессора — в ТЗ-B1

---

## Что НЕ входит

- Профессор (планирование) — ТЗ-B1
- ProjectTask — ТЗ-B2
- Эксперт (чат задачи) — ТЗ-C1
- Авто-итог — ТЗ-C1
- Клерк-суммаризатор — ТЗ-C2
- Режимы Менеджера «план» и «навигация» — расширяются в B1 и C1

---

## Промпты от PE

Два промпта нужны для этого ТЗ:

1. **Менеджер проекта** → `lib/prompts/service-chats/project-manager.md`
2. **Клерк-анализатор файлов** → `lib/prompts/clerks/file-analyzer.md`

Владимир предоставляет .md файлы из проекта Prompt Engineering. Claude Code размещает в указанных путях и подключает к соответствующим endpoints.

---

## Контекст для Claude Code

- **ManagerDrawer:** `components/projects/manager-drawer.tsx` (каркас из A1)
- **ServiceChat система:** `components/service-chat/` (ServiceChatDrawer — базовый компонент)
- **ServiceChat API:** `app/(chat)/api/service-chat/route.ts` (уже обрабатывает context)
- **Файловый API:** `app/(chat)/api/projects/[id]/files/` (загрузка, CRUD)
- **Файловый компонент:** `components/projects/project-files-card.tsx` (Пульс)
- **Blueprint:** SIMPLY_ORCHESTRATION_BLUEPRINT.md (секции 3, 5.4, 5.6)
- **Контракты ролей:** MVP_ROLES_AND_CONTRACTS.md (секции 2.1, 2.5)
