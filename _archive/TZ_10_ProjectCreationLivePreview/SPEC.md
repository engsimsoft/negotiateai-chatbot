# ТЗ-10: Live Preview в создании проекта

**Версия:** 1.1
**Дата:** 2026-02-06
**Приоритет:** Высокий
**Оценка:** 2-3 сессии

---

## Цель

Создать **вау-эффект** при создании нового проекта через AI-диалог с **live preview** паспорта проекта, который обновляется в реальном времени по мере разговора.

**Философия:** Это первое взаимодействие пользователя с AI в контексте проектов. Должно впечатлять.

---

## Известные баги (исправить в рамках ТЗ)

### Баг 1: Отсутствует скрепка (attachments)

**Проблема:** В `ServiceChatInput` нет кнопки прикрепления файлов.

**Важность:** При создании проекта пользователь может загрузить документ (бриф, ТЗ, референс), чтобы AI сразу понял контекст.

**Решение:** Добавить `InputAttachments` в `ServiceChatInput` + обработку файлов.

### Баг 2: Нет заглушки голосового режима

**Проблема:** В `ServiceChatInput` параметр `showVoiceMode={false}`, нет кнопки голосового режима.

**Ожидание:** Должна быть заглушка (как на главной) — кнопка которая показывает "Скоро".

**Решение:** Включить `showVoiceMode={true}` по умолчанию.

### Баг 3: Диктовка теряет текст

**Проблема:** При использовании диктовки (Deepgram) записываются только последние 1-2 слова. Всё что было сказано до этого — теряется.

**Причина:** Скорее всего проблема в controlled mode `setValue` — при каждом вызове `onTranscript` перезаписывается значение вместо добавления.

**Где искать:**
- `components/input/input-context.tsx` — как работает `setValue` в controlled mode
- `components/input/input-voice-button.tsx` — как вызывается `setValue`
- `hooks/use-voice-recorder.ts` — как приходят транскрипты

**Решение:** Проверить что `setValue(prev => prev + " " + text)` работает корректно в controlled mode.

---

## Текущее состояние

Сейчас (`/projects/new`):
- Full-screen чат с AI
- AI собирает информацию через диалог
- Tool `createProject` автоматически создаёт проект в БД
- После создания — success card с кнопками

**Проблемы:**
1. Пользователь не видит что получится до создания
2. Нет контроля — AI решает когда создать
3. Нельзя поправить перед созданием
4. Не "вау"

---

## Целевое состояние

### Desktop Layout (>1024px)

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Создание проекта                                             │
├───────────────────────────────┬─────────────────────────────────┤
│                               │                                 │
│   📋 ПАСПОРТ ПРОЕКТА          │   💬 ДИАЛОГ                     │
│   ─────────────────────       │                                 │
│                               │   S: Привет! Расскажите...      │
│   Название                    │                                 │
│   ┌─────────────────────┐     │   > Хочу проект для контента    │
│   │ [AI заполняет]      │     │                                 │
│   └─────────────────────┘     │   S: Отлично! Какой контент?    │
│                               │                                 │
│   Описание                    │   > Посты для Instagram         │
│   ┌─────────────────────┐     │                                 │
│   │ [AI заполняет]      │     │   ...                           │
│   │                     │     │                                 │
│   └─────────────────────┘     │                                 │
│                               │                                 │
│   Инструкция для AI           │                                 │
│   ┌─────────────────────┐     │                                 │
│   │ [AI заполняет]      │     ├─────────────────────────────────┤
│   │                     │     │   [ Input field ]          🎤 ↑ │
│   └─────────────────────┘     │                                 │
│                               └─────────────────────────────────┘
│   ┌─────────────────────┐
│   │  ✓ Создать проект   │  ← Активируется когда все поля заполнены
│   └─────────────────────┘
│
└───────────────────────────────┘
```

### Mobile Layout (<1024px)

```
┌─────────────────────────────────┐
│  ← Создание проекта             │
├─────────────────────────────────┤
│                                 │
│  📋 Паспорт (collapsible)       │
│  ┌─────────────────────────┐    │
│  │ Название: [...]         │    │
│  │ Описание: [...]         │    │
│  │ [ ✓ Создать ]           │    │
│  └─────────────────────────┘    │
│                                 │
├─────────────────────────────────┤
│   💬 Диалог                     │
│   ...                           │
│                                 │
├─────────────────────────────────┤
│   [ Input ]                🎤 ↑ │
└─────────────────────────────────┘
```

---

## Ключевые изменения

### 1. Новый Tool: `updateProjectDraft`

**Вместо** `createProject` (создаёт сразу) **используем** `updateProjectDraft` (обновляет preview).

```typescript
tools.updateProjectDraft = tool({
  description: "Обновить черновик проекта на основе разговора. Вызывай по мере получения информации.",
  inputSchema: z.object({
    name: z.string().optional().describe("Название проекта (2-5 слов)"),
    description: z.string().optional().describe("Краткое описание (1-2 предложения)"),
    instruction: z.string().optional().describe("Инструкция для AI"),
  }),
  // НЕ создаёт проект — только обновляет state
});
```

### 2. Draft State Management

```typescript
interface ProjectDraft {
  name: string;
  description: string;
  instruction: string;
  isComplete: boolean; // true когда все обязательные поля заполнены
}

const [draft, setDraft] = useState<ProjectDraft>({
  name: "",
  description: "",
  instruction: "",
  isComplete: false,
});
```

### 3. Парсинг Tool Results

При получении `tool-result` с `toolName: "updateProjectDraft"`:
- Извлечь `name`, `description`, `instruction`
- Обновить `draft` state
- Preview обновляется в реальном времени

### 4. Редактируемые поля

Пользователь может:
- Кликнуть на поле в preview
- Отредактировать вручную
- Изменения сохраняются в draft

### 5. Кнопка "Создать проект"

- Появляется когда `draft.isComplete === true` (минимум name + description)
- При клике — `saveProject()` в БД
- Редирект на страницу проекта

---

## Компоненты

### Новые файлы

```
app/(dashboard)/projects/new/
├── page.tsx                    # Server component (как есть)
├── project-creation-client.tsx # Обновить — split layout
└── components/
    ├── project-draft-preview.tsx   # Live preview card
    ├── project-chat-panel.tsx      # Chat panel (правая колонка)
    └── editable-field.tsx          # Редактируемое поле
```

### Обновить

```
app/(chat)/api/service-chat/route.ts
├── Заменить tool createProject → updateProjectDraft
└── Добавить tool confirmProject (финальное создание)
```

---

## Промпт для AI

```markdown
Ты — Simply, AI-ассистент для создания проектов.

## Твои задачи

1. **Собрать информацию** через диалог:
   - Какая цель проекта?
   - Для кого/чего это?
   - Особенности, дедлайны?

2. **Обновлять черновик** по мере разговора:
   - Как только понял название — вызови updateProjectDraft({name: "..."})
   - Понял цель — добавь description
   - Достаточно контекста — добавь instruction

3. **НЕ создавай проект автоматически** — пользователь сам нажмёт кнопку

## Правила

- Обновляй черновик постепенно, не жди всей информации
- Поля могут обновляться несколько раз по мере уточнения
- Будь кратким, не повторяй что уже в черновике
```

---

## UX Flow

1. Пользователь открывает `/projects/new`
2. Видит split layout: пустой preview слева, чат справа
3. AI приветствует, спрашивает о проекте
4. Пользователь описывает
5. AI **сразу** обновляет preview (название появляется)
6. Диалог продолжается, preview заполняется
7. Пользователь может редактировать поля вручную
8. Когда готово — нажимает "Создать проект"
9. Проект создаётся, редирект

**Ключевой момент:** Preview обновляется **в реальном времени** по мере диалога, не в конце.

---

## Анимации

- Поля preview появляются с fade-in при заполнении
- Изменение текста — subtle highlight
- Кнопка "Создать" — появляется с анимацией когда ready
- Framer Motion для всех переходов

---

## Технические детали

### Парсинг tool-result из useChat

```typescript
// В chatMessages проверяем parts на tool-result
for (const part of message.parts) {
  if (part.type === "tool-result" && part.toolName === "updateProjectDraft") {
    const result = part.result;
    setDraft(prev => ({
      ...prev,
      ...(result.name && { name: result.name }),
      ...(result.description && { description: result.description }),
      ...(result.instruction && { instruction: result.instruction }),
      isComplete: Boolean((result.name || prev.name) && (result.description || prev.description)),
    }));
  }
}
```

### Создание проекта (финальное)

```typescript
async function handleCreateProject() {
  const project = await fetch("/api/projects", {
    method: "POST",
    body: JSON.stringify(draft),
  }).then(r => r.json());

  router.push(`/projects/${project.id}`);
}
```

---

## Критерии готовности

1. [ ] Split layout работает на desktop и mobile
2. [ ] Tool `updateProjectDraft` обновляет preview в реальном времени
3. [ ] Поля preview редактируемые
4. [ ] Кнопка "Создать" появляется когда ready
5. [ ] Проект создаётся только по клику пользователя
6. [ ] Анимации плавные
7. [ ] Голосовой ввод работает (ServiceChatInput)

---

## Связанные файлы

- `app/(dashboard)/projects/new/project-creation-client.tsx` — основной файл
- `app/(chat)/api/service-chat/route.ts` — API с tools
- `components/input/service-chat-input.tsx` — унифицированный инпут
- `lib/db/queries.ts` — `saveProject()`

---

## Версия после ТЗ

**v3.9.0** — Live Preview в создании проекта
