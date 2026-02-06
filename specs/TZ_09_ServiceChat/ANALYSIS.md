# ТЗ-09: ServiceChat — Анализ

**Дата анализа:** 2026-02-06
**Статус:** Готово к разработке

---

## Текущее состояние

### 3 разных реализации одного паттерна

| Чат | UI компонент | Оболочка | API | Модель |
|-----|-------------|----------|-----|--------|
| **Бен** | `modal-assistants/ben/` | Vaul Drawer | `/api/assistant/ben/` | Gemini Flash |
| **Создание проекта** | `universal-dialog/` | Полноэкранная страница | `/api/universal-dialog/` | Gemini Flash |
| **Менеджер проекта** | `projects/manager-dialog.tsx` | shadcn Dialog (заглушка) | — | — |

### Файлы к изменению

#### УДАЛИТЬ (Prompt-Agent)

```
components/modal-assistants/prompt-agent/     # 3 файла
app/(chat)/api/assistant/prompt-agent/route.ts
+ импорты из chat-header.tsx
```

#### МИГРИРОВАТЬ → ServiceChat

```
components/modal-assistants/ben/              # → configs/ben.ts
components/modal-assistants/assistant-*.tsx   # → service-chat-core.tsx
components/universal-dialog/                  # → configs/project-creation.ts
components/projects/manager-dialog.tsx        # → configs/project-manager.ts
app/(chat)/api/assistant/ben/route.ts         # → /api/service-chat/
app/(chat)/api/universal-dialog/route.ts      # → /api/service-chat/
```

#### ОБНОВИТЬ ИМПОРТЫ

```
components/chat-header.tsx                    # Ben → ServiceChat
components/glavnaya/glavnaya-header.tsx       # Ben → ServiceChat
components/projects/project-actions.tsx       # ManagerDialog → ServiceChat
app/(dashboard)/projects/new/page.tsx         # UniversalDialog → ServiceChat
```

---

## Целевая архитектура

### Новая структура

```
components/service-chat/
├── index.ts
├── types.ts                         # ServiceChatConfig, ...
├── service-chat-core.tsx            # ЯДРО: messages, input, streaming
├── service-chat-floating.tsx        # ОБОЛОЧКА: floating modal
├── service-chat-drawer.tsx          # ОБОЛОЧКА: drawer справа
├── service-chat-trigger.tsx         # Универсальная кнопка
├── quick-actions.tsx                # Карточки быстрых действий
└── configs/
    ├── index.ts
    ├── ben.ts
    ├── project-creation.ts
    └── project-manager.ts

app/(chat)/api/service-chat/
└── route.ts                         # Унифицированный endpoint
```

### Конфиги помощников

| Помощник | Оболочка | Позиция | Размер | Модель |
|----------|----------|---------|--------|--------|
| **Бен** | floating | bottom-right | 380×500 | gemini-flash |
| **Создание проекта** | floating | center | 440×540 | gemini-flash |
| **Менеджер проекта** | drawer | right | 420px | claude-sonnet |

---

## Зависимости

### Переиспользовать

- **Vaul** — уже есть, для drawer
- **Framer Motion** — уже есть, для анимаций
- **shadcn Dialog** — для floating modal (Radix под капотом)

### Новое

- Ничего нового не нужно

---

## Вопросы (решены)

| Вопрос | Решение |
|--------|---------|
| Один API или несколько? | Один `/api/service-chat` с параметром `context` |
| Что с intro-bubble Бена? | Оставить как отдельный компонент |
| Сохранять ли сообщения? | Только для Менеджера (persistMessages) |
| Мобильная адаптация? | Floating → bottom sheet, Drawer → bottom sheet |

---

## Риски

| Риск | Митигация |
|------|-----------|
| Ломается Бен на проде | Этапная миграция, тест после каждого шага |
| Много мест использования | Чёткий чеклист импортов |
| Разные tools у разных помощников | Конфиг tools в каждом конфиге |

---

## Критерий готовности

- [ ] Prompt-agent удалён из UI
- [ ] Бен работает через floating modal (bottom-right)
- [ ] Создание проекта через floating modal (center)
- [ ] Менеджер открывается как drawer справа
- [ ] Одно ядро ServiceChatCore, разные оболочки
- [ ] Escape закрывает, focus возвращается
- [ ] `npx tsc --noEmit` = 0 ошибок
- [ ] `npm run build` успешен
