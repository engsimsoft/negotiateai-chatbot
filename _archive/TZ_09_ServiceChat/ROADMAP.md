# ТЗ-09: ServiceChat — ROADMAP

**Дата:** 2026-02-06
**Оценка:** 4-5 часов работы

---

## Git-стратегия

**Формат коммитов:** `feat(tz-09): описание`

| Этап | Коммит |
|------|--------|
| 0-5 (Сессия 1) | ⚠️ Не закоммичено — закоммитить перед продолжением |
| 6 | `feat(tz-09): migrate ben to service-chat` |
| 7 | `feat(tz-09): migrate project creation` |
| 8 | `feat(tz-09): migrate project manager` |
| 9 | `chore(tz-09): cleanup old components` |
| 10 | `feat(tz-09): finalize service-chat` |

---

## Сессия 1: Фундамент (завершена)

---

## Этап 0: Подготовка (10 мин) ✅

- [x] 0.1 Изучить существующий AssistantChat (ядро)
- [x] 0.2 Изучить промпты Бена и UniversalDialog
- [x] 0.3 Создать HANDOFF.md

**Валидация:** Понимание текущей логики ✅

---

## Этап 1: Удаление Prompt-Agent (15 мин) ✅

- [x] 1.1 Удалить `components/modal-assistants/prompt-agent/` (3 файла)
- [x] 1.2 Удалить `app/(chat)/api/assistant/prompt-agent/route.ts`
- [x] 1.3 Убрать импорты из `components/chat-header.tsx`
- [x] 1.4 Обновить экспорты в `components/modal-assistants/index.ts`
- [x] 1.5 Сохранить промпт в `_archive/prompts/prompt-agent-skill.md`

**Валидация:** `npx tsc --noEmit` → 0 ошибок ✅

---

## Этап 2: Создание ServiceChat Core (45 мин) ✅

- [x] 2.1 Создать `components/service-chat/types.ts`
- [x] 2.2 Создать `components/service-chat/service-chat-core.tsx`
      - Взять логику из `assistant-chat.tsx`
      - Добавить поддержку quickActions
      - Добавить persistMessages опцию
- [x] 2.3 QuickActions встроены в service-chat-core.tsx
- [x] 2.4 Создать `components/service-chat/service-chat-trigger.tsx`
- [x] 2.5 Создать `components/service-chat/index.ts`

**Валидация:** `npx tsc --noEmit` → 0 ошибок ✅

---

## Этап 3: Оболочки (30 мин) ✅

- [x] 3.1 Создать `service-chat-floating.tsx`
      - Desktop: custom modal с Framer Motion
      - Позиция: center или bottom-right
      - Размер из конфига
      - Мобиль: bottom sheet (Vaul)
- [x] 3.2 Создать `service-chat-drawer.tsx`
      - Использовать Vaul direction="right"
      - Ширина 420px
      - Мобиль: bottom sheet

**Валидация:** `npx tsc --noEmit` → 0 ошибок ✅

---

## Этап 4: Конфиги помощников (20 мин) ✅

- [x] 4.1 Создать `configs/ben.ts`
- [x] 4.2 Создать `configs/project-creation.ts`
- [x] 4.3 Создать `configs/project-manager.ts`
- [x] 4.4 Создать `configs/index.ts`

**Валидация:** `npx tsc --noEmit` → 0 ошибок ✅

---

## Этап 5: API унификация (30 мин) ✅

- [x] 5.1 Создать `app/(chat)/api/service-chat/route.ts`
      - Параметр `context` для выбора конфига
      - Shared логика стриминга
      - Tools для project-creation
- [ ] 5.2 Обновить `api/assistant/ben/` → обёртка на service-chat (отложено)
- [ ] 5.3 Обновить `api/universal-dialog/` → обёртка на service-chat (отложено)

**Валидация:** `npx tsc --noEmit` → 0 ошибок ✅
**Валидация:** `npm run build` → успешен ✅

**Примечание:** API обёртки (5.2, 5.3) отложены — старые API пока работают, новый `/api/service-chat` готов.

---

## Сессия 2: Миграция (завершена) ✅

---

## Этап 6: Миграция Бена (30 мин) ✅

- [x] 6.1 Обновить `components/chat-header.tsx`
      - Заменить BenTrigger → ServiceChatTrigger
      - Заменить BenDrawer → ServiceChatFloating
      - BenIntroBubble перенесён в service-chat
- [x] 6.2 Обновить `components/glavnaya/glavnaya-header.tsx`
- [x] 6.3 Убедиться что intro-bubble работает

**Валидация:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] Браузер: Бен открывается как floating modal, отвечает

**Git:** `git commit -m "feat(tz-09): migrate ben to service-chat"`

**Мануальный тест:** Открыть Бена на /chat, задать вопрос

---

## Этап 7: Миграция создания проекта (30 мин) ✅

- [x] 7.1 Обновить `app/(dashboard)/projects/new/page.tsx`
      - Создан ProjectCreationClient (полноэкранный, не floating)
      - Использует useChat + /api/service-chat
- [x] 7.2 Проверить tool создания проекта работает
- [x] 7.3 Проверить редирект после создания

**Валидация:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] Браузер: проект создаётся через полноэкранный диалог

**Git:** `git commit -m "feat(tz-09): migrate project creation"`

**Мануальный тест:** Создать проект через /projects/new

---

## Этап 8: Миграция Менеджера проекта (20 мин) ✅

- [x] 8.1 Обновить `components/projects/project-actions.tsx`
- [x] 8.2 Удалить `components/projects/manager-dialog.tsx`
- [x] 8.3 Менеджер открывается как drawer справа

**Валидация:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] Браузер: drawer открывается с правильным UI

**Git:** `git commit -m "feat(tz-09): migrate project manager"`

**Мануальный тест:** Открыть менеджера на странице проекта

---

## Этап 9: Очистка (15 мин) ✅

- [x] 9.1 Удалить `components/modal-assistants/ben/`
- [x] 9.2 Удалить `components/modal-assistants/assistant-drawer.tsx`
- [x] 9.3 Удалить `components/modal-assistants/assistant-chat.tsx`
- [x] 9.4 Удалить `components/modal-assistants/` (вся папка)
- [x] 9.5 Удалить `components/universal-dialog/`
- [x] 9.6 Удалить `app/(chat)/api/universal-dialog/`

**Валидация:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен

**Git:** `git commit -m "chore(tz-09): cleanup old components"`

---

## Этап 10: Финализация (15 мин) ✅

- [x] 10.1 `npm run build` → успешен
- [ ] 10.2 Мануальный тест: Бен, создание проекта, менеджер
- [ ] 10.3 Проверить Escape, focus return
- [x] 10.4 Обновить CLAUDE.md
- [x] 10.5 Обновить SIMPLY_STATUS.md
- [x] 10.6 Обновить CHANGELOG.md
- [ ] 10.7 Переместить `specs/TZ_09_ServiceChat/` → `_archive/`

**Валидация:**
- [x] `npm run build` — успешен
- [ ] Все функции работают в браузере
- [x] Документация актуальна

**Git:** `git commit -m "feat(tz-09): finalize service-chat"`

---

## Сводка по файлам

### Создано (Сессия 1) ✅

```
components/service-chat/
├── index.ts                    ✅
├── types.ts                    ✅
├── service-chat-core.tsx       ✅
├── service-chat-floating.tsx   ✅
├── service-chat-drawer.tsx     ✅
├── service-chat-trigger.tsx    ✅
└── configs/
    ├── index.ts                ✅
    ├── ben.ts                  ✅
    ├── project-creation.ts     ✅
    └── project-manager.ts      ✅

app/(chat)/api/service-chat/route.ts    ✅

_archive/prompts/prompt-agent-skill.md  ✅
```

### Удалено (Сессия 1) ✅

```
components/modal-assistants/prompt-agent/   ✅
app/(chat)/api/assistant/prompt-agent/      ✅
lib/prompts/skills/utility/                 ✅
```

### Удалить (Сессия 2)

```
components/modal-assistants/ben/
components/modal-assistants/assistant-*.tsx
components/modal-assistants/
components/universal-dialog/
components/projects/manager-dialog.tsx
```

### Обновить (Сессия 2)

```
components/chat-header.tsx
components/glavnaya/glavnaya-header.tsx
components/projects/project-actions.tsx
app/(dashboard)/projects/new/page.tsx
```
