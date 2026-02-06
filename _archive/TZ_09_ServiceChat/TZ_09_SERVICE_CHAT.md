# ТЗ-09: ServiceChat — унификация сервисных чатов

**Версия:** 1.0  
**Дата:** 2026-02-06  
**Для:** Claude Code (VS Code)  
**Базовая версия проекта:** 3.7.0  

---

## Цель

Унифицировать все "вторичные" чаты с AI (Бен, создание проекта, менеджер проекта) в единую архитектуру. Сейчас три разных реализации для одного паттерна — это усложняет поддержку и создаёт inconsistency в UX.

**Результат:** один переиспользуемый компонент ServiceChat, который через конфигурацию превращается в любого сервисного помощника. Один API endpoint. Единый стиль взаимодействия.

---

## Часть 1. Удалить Prompt-Agent

Prompt-agent убираем из интерфейса полностью. В будущем он станет внутренним инструментом (переводчик для генерации изображений), но сейчас пользователю он только мешает.

**Удалить:**
- UI компоненты (drawer, trigger, кнопка 📝)
- API route `/api/assistant/prompt-agent/`
- Любые упоминания в интерфейсе

**Оставить:**
- Промпт можно сохранить в архиве для будущего использования

---

## Часть 2. Архитектура ServiceChat

### Проблема сейчас

| Чат | UI | API | Модель |
|---|---|---|---|
| Бен | Vaul Drawer | `/api/assistant/ben/` | Gemini Flash |
| Создание проекта | Полноэкранная страница | `/api/universal-dialog/` | Gemini Flash |
| Менеджер проекта | shadcn Dialog (заглушка) | — | Claude Sonnet |

Три разных паттерна, три API, разные оболочки.

### Решение

**Два слоя:**

1. **ServiceChatCore** — ядро чата (messages, input, streaming). Одинаковое для всех.

2. **Оболочки** — разные контейнеры под разные use cases:
   - **Floating modal** — для Бена и создания проекта
   - **Drawer справа** — для Менеджера проекта (длинные разговоры)

### Когда что использовать

| Помощник | Тип оболочки | Позиция | Обоснование |
|---|---|---|---|
| **Бен** | Floating | bottom-right, 380×500 | Быстрые вопросы, не блокирует UI |
| **Создание проекта** | Floating | center, 440×540 | Короткое интервью, нет контекста за окном |
| **Менеджер проекта** | Drawer | right, 420px | Длинные разговоры, левая колонка с файлами остаётся видимой |

### Рекомендуемая структура файлов

```
components/service-chat/
├── service-chat-core.tsx       # Ядро: messages, input, streaming
├── service-chat-floating.tsx   # Floating modal оболочка
├── service-chat-drawer.tsx     # Drawer оболочка  
├── service-chat-trigger.tsx    # Унифицированная кнопка-триггер
├── configs/                    # Конфигурации помощников
│   ├── ben.ts
│   ├── project-creation.ts
│   └── project-manager.ts
└── index.ts
```

Структура на усмотрение — главное чтобы ядро было одно, а оболочки менялись через конфиг.

---

## Часть 3. Конфигурации помощников

### Формат конфига (рекомендация)

```typescript
interface ServiceChatConfig {
  id: string;                    // 'ben' | 'project-creation' | 'project-manager'
  title: string;                 // "Бен" | "Создание проекта" | "Менеджер проекта"
  subtitle?: string;             // "Помощь по платформе"
  icon: string;                  // ❓ | ➕ | 👤
  
  // Оболочка
  shell: 'floating' | 'drawer';
  position?: 'center' | 'bottom-right';  // для floating
  size?: { width: number; height: number };
  
  // AI
  model: 'gemini-flash' | 'claude-sonnet';
  systemPrompt: string;
  tools?: Record<string, Tool>;
  
  // UX
  quickActions?: QuickAction[];  // Карточки быстрых действий
  greeting?: string;             // "Привет! Чем помочь?"
  persistMessages?: boolean;     // Сохранять ли разговор при сворачивании
}
```

### Конфиг Бена

```typescript
{
  id: 'ben',
  title: 'Бен',
  subtitle: 'Помощь по платформе Simply',
  icon: '❓',
  shell: 'floating',
  position: 'bottom-right',
  size: { width: 380, height: 500 },
  model: 'gemini-flash',
  persistMessages: false,  // FAQ не нужно сохранять
  quickActions: [
    { icon: '🚀', label: 'С чего начать?', prompt: 'С чего начать работу в Simply?' },
    { icon: '📊', label: 'Что такое проект?', prompt: 'Объясни что такое проект' },
    // ...
  ]
}
```

### Конфиг создания проекта

```typescript
{
  id: 'project-creation',
  title: 'Создание проекта',
  subtitle: 'Расскажите о вашей задаче',
  icon: '➕',
  shell: 'floating',
  position: 'center',
  size: { width: 440, height: 540 },
  model: 'gemini-flash',
  tools: { createProject },
  persistMessages: false,
}
```

### Конфиг Менеджера проекта

```typescript
{
  id: 'project-manager',
  title: 'Менеджер проекта',
  subtitle: 'Организация и управление',
  icon: '👤',
  shell: 'drawer',
  // drawer всегда справа, ширина ~420px
  model: 'claude-sonnet',
  tools: { updateInstruction, generateSummary, organizeFiles, ... },
  persistMessages: true,  // длинные разговоры
  quickActions: [
    { icon: '📁', label: 'Разобрать файлы', prompt: 'Помоги разобрать файлы по папкам' },
    { icon: '📊', label: 'Подвести итог', prompt: 'Подведи итог по проекту' },
    { icon: '📝', label: 'Изменить инструкцию', prompt: 'Хочу обновить инструкцию проекта' },
    { icon: '📋', label: 'Разбить на задачи', prompt: 'Разбей цель на конкретные задачи' },
  ]
}
```

---

## Часть 4. API унификация

### Рекомендация: один endpoint

Вместо трёх отдельных routes — один `/api/service-chat` с параметром `context`:

```typescript
// POST /api/service-chat
// body: { context: string, messages: Message[], projectId?: string }

// Внутри route:
const config = SERVICE_CHAT_CONFIGS[context];
const model = getModel(config.model);
const systemPrompt = buildSystemPrompt(config, user, project);
// ... стандартный streaming
```

### Альтернатива

Если удобнее — оставить отдельные routes, но вынести общую логику в shared функции. Главное — не дублировать код стриминга и обработки сообщений.

---

## Часть 5. Сохранение состояния

### Для Бена и создания проекта
Не сохранять. Закрыл — начал заново. Это логично для коротких взаимодействий.

### Для Менеджера проекта
Сохранять в рамках сессии (пока страница открыта). Пользователь может свернуть drawer, сделать что-то в проекте, развернуть — разговор на месте.

### Рекомендуемый подход
Lift state up — хранить messages в родительском компоненте или контексте, а не внутри ServiceChatCore. Тогда при закрытии/открытии оболочки сообщения не теряются.

---

## Часть 6. Мобильная адаптация

### Рекомендация

| Desktop | Mobile |
|---|---|
| Floating modal | Bottom sheet (Vaul с direction="bottom") |
| Drawer справа | Bottom sheet |

Vaul уже поддерживает это нативно. Можно использовать `useMediaQuery` для переключения.

---

## Часть 7. Accessibility

### Обязательно

- Focus trap внутри открытого модала/drawer
- Escape закрывает
- Return focus на триггер после закрытия
- Visible close button (для touch-устройств нет Escape)

### Примечание

Если использовать Radix Dialog / Vaul — большинство этого работает из коробки.

---

## Ограничения

### Обязательно

- Удалить prompt-agent из UI
- Один компонент-ядро для всех сервисных чатов
- Бен и создание проекта — floating modal
- Менеджер проекта — drawer справа
- Accessibility: focus trap, escape, return focus

### На усмотрение Claude Code

- Структура файлов и папок
- Формат конфигов
- Один API endpoint или несколько с shared логикой
- Конкретная реализация сохранения состояния
- Библиотеки для анимаций (Framer Motion уже есть, можно использовать)
- Детали мобильной адаптации

### Не входит в это ТЗ

- Логика tools для Менеджера проекта (промпт, tool calling) — отдельное ТЗ
- Промпты помощников — отдельная задача
- Интеграция с RAG

---

## Критерий готовности

- Prompt-agent удалён из интерфейса
- Бен работает через floating modal (bottom-right)
- Создание проекта работает через floating modal (center)
- Менеджер проекта открывается как drawer справа (пока заглушка, но в правильной оболочке)
- Код чата не дублируется — одно ядро, разные оболочки
- Escape закрывает, focus возвращается на триггер

---

## Референсы

- **assistant-ui** (https://www.assistant-ui.com/examples/modal) — паттерн floating modal для AI-чатов
- **Vaul** — drawer с direction="right" для боковой панели
- **shadcn Dialog** — floating modal с Radix под капотом

---

**Связанные документы:**
- `SIMPLY_ENTITIES_CONCEPT.md` — концепция Бена и Менеджера проекта
- `TZ_07C3_PROJECT_ENTRY_POINTS.md` — карточка Менеджера (текущая заглушка)
- Прототип `simply-service-chat-preview.jsx` — визуализация концепции
