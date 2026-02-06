# ТЗ-09: ServiceChat — HANDOFF

**Последнее обновление:** 2026-02-06
**Статус:** Сессия 1 завершена, готов к Сессии 2

---

## Краткое резюме

**ТЗ-09** — унификация сервисных чатов (Бен, создание проекта, менеджер) в единую архитектуру.

**Сессия 1 (завершена):**
- Удалён Prompt-Agent
- Создана новая система `components/service-chat/`
- Создан унифицированный API `/api/service-chat`
- Компоненты готовы, но **не подключены к UI**

**Сессия 2 (предстоит):**
- Миграция Бена, создания проекта, менеджера на новые компоненты
- Удаление старого кода
- Мануальное тестирование

---

## Что сделано (Сессия 1)

### Созданные файлы

```
components/service-chat/
├── index.ts                    # Экспорты
├── types.ts                    # ServiceChatConfig, etc.
├── service-chat-core.tsx       # Ядро (messages, input, streaming, quickActions)
├── service-chat-floating.tsx   # Floating modal (center/bottom-right)
├── service-chat-drawer.tsx     # Drawer справа
├── service-chat-trigger.tsx    # Универсальная кнопка
└── configs/
    ├── index.ts
    ├── ben.ts                  # Бен: floating bottom-right, 380×500
    ├── project-creation.ts     # Создание: floating center, 440×540
    └── project-manager.ts      # Менеджер: drawer, 420px

app/(chat)/api/service-chat/route.ts   # Унифицированный API

_archive/prompts/prompt-agent-skill.md # Архив промпта
```

### Удалённые файлы

```
components/modal-assistants/prompt-agent/   # 3 файла
app/(chat)/api/assistant/prompt-agent/      # API
lib/prompts/skills/utility/                 # Skill
```

### Валидация

- [x] `npx tsc --noEmit` → 0 ошибок
- [x] `npm run build` → успешен

---

## Сессия 2: План

### Этап 6: Миграция Бена

```
Файлы:
- components/chat-header.tsx
- components/glavnaya/glavnaya-header.tsx

Изменения:
- Заменить BenDrawer → ServiceChatFloating с BEN_CONFIG
- Оставить BenIntroBubble (работает отдельно)
- Использовать старый API /api/assistant/ben (конфиг уже настроен)
```

### Этап 7: Миграция создания проекта

```
Файл:
- app/(dashboard)/projects/new/page.tsx

Изменения:
- Заменить UniversalDialog → ServiceChatFloating с PROJECT_CREATION_CONFIG
- Использовать новый API /api/service-chat?context=project-creation
- Проверить tool createProject работает
```

### Этап 8: Миграция Менеджера

```
Файл:
- components/projects/project-actions.tsx

Изменения:
- Заменить ManagerDialog → ServiceChatDrawer с PROJECT_MANAGER_CONFIG
- Удалить components/projects/manager-dialog.tsx
```

### Этап 9: Очистка

```
Удалить:
- components/modal-assistants/ben/
- components/modal-assistants/assistant-*.tsx
- components/modal-assistants/
- components/universal-dialog/
```

### Этап 10: Финализация

```
- npm run build
- Мануальный тест: Бен, создание проекта, менеджер
- Обновить CLAUDE.md, SIMPLY_STATUS.md, CHANGELOG.md
```

---

## Пример использования

```tsx
import {
  ServiceChatFloating,
  ServiceChatDrawer,
  BEN_CONFIG,
  PROJECT_CREATION_CONFIG,
  PROJECT_MANAGER_CONFIG,
} from "@/components/service-chat";

// Бен
<ServiceChatFloating
  config={BEN_CONFIG}
  open={benOpen}
  onOpenChange={setBenOpen}
/>

// Создание проекта
<ServiceChatFloating
  config={PROJECT_CREATION_CONFIG}
  open={createOpen}
  onOpenChange={setCreateOpen}
/>

// Менеджер
<ServiceChatDrawer
  config={PROJECT_MANAGER_CONFIG}
  open={managerOpen}
  onOpenChange={setManagerOpen}
  context={{ projectId }}
/>
```

---

## Важные детали

1. **BEN_CONFIG использует старый API** (`/api/assistant/ben`) — это ОК
2. **PROJECT_CREATION_CONFIG** нужно переключить на новый API в конфиге
3. **PROJECT_MANAGER_CONFIG** — заглушка (tools не реализованы, это отдельное ТЗ)
4. **BenIntroBubble** — оставить как есть, работает независимо

---

## Документы

- [TZ_09_SERVICE_CHAT.md](TZ_09_SERVICE_CHAT.md) — ТЗ
- [ANALYSIS.md](ANALYSIS.md) — Анализ
- [ROADMAP.md](ROADMAP.md) — Дорожная карта с отметками ✅
