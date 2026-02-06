# Roadmap ТЗ-10: Live Preview в создании проекта

**Версия:** 1.0
**Дата:** 2026-02-06
**Целевая версия:** v3.9.0

---

## Обзор этапов

| Этап | Название | Сложность | Статус |
|------|----------|-----------|--------|
| 0 | Исправление багов ServiceChatInput | Средняя | [ ] |
| 1 | Split Layout + Draft State | Средняя | [ ] |
| 2 | Tool updateProjectDraft | Низкая | [ ] |
| 3 | Парсинг Tool Results | Средняя | [ ] |
| 4 | Editable Fields | Средняя | [ ] |
| 5 | Mobile Layout | Низкая | [ ] |
| 6 | Анимации + Polish | Низкая | [ ] |
| 7 | Финализация | Низкая | [ ] |

---

## Этап 0: Исправление багов ServiceChatInput

**Цель:** Исправить критические баги в ServiceChatInput перед основной работой

### Баги

1. **Нет скрепки (attachments)** — пользователь не может прикрепить файл
2. **Нет заглушки голосового режима** — нет кнопки VoiceMode
3. **Диктовка теряет текст** — записываются только последние 1-2 слова

### Задачи

- [ ] 0.1 Диагностика бага диктовки — найти причину потери текста
- [ ] 0.2 Исправить controlled mode в input-context.tsx
- [ ] 0.3 Добавить InputAttachments в ServiceChatInput
- [ ] 0.4 Включить showVoiceMode={true} по умолчанию
- [ ] 0.5 Тест: диктовка работает полностью
- [ ] 0.6 Тест: скрепка отображается
- [ ] 0.7 Тест: VoiceMode показывает заглушку

### Файлы

**Изменяемые:**
- `components/input/input-context.tsx` — исправить setValue для controlled mode
- `components/input/service-chat-input.tsx` — добавить attachments, включить voiceMode
- `app/(dashboard)/projects/new/project-creation-client.tsx` — передать showAttachments

### Диагностика бага диктовки

**Текущий код в input-voice-button.tsx:**
```typescript
onTranscript: (text) => {
  setValue((prev) => (prev ? prev + " " + text : text));
}
```

**Текущий код в input-context.tsx (controlled mode):**
```typescript
const setValue: Dispatch<SetStateAction<string>> = useCallback(
  (action) => {
    if (isControlled && onValueChange) {
      const newValue = typeof action === "function" ? action(controlledValue ?? "") : action;
      onValueChange(newValue);
    } else {
      setInternalValue(action);
    }
  },
  [isControlled, onValueChange, controlledValue]
);
```

**Гипотеза:** `controlledValue` в момент вызова может быть устаревшим (stale closure).
При streaming транскрипции Deepgram вызывает `onTranscript` несколько раз, но `controlledValue` не обновляется между вызовами.

**Решение:** Использовать ref для актуального значения или передавать setter напрямую.

### Критерий готовности

- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Диктовка записывает ВСЮ речь, не только последние слова
- [ ] Скрепка отображается в инпуте
- [ ] Кнопка VoiceMode показывает заглушку "Скоро"

### Мануальный тест

1. Открыть `/projects/new`
2. Проверить что есть скрепка слева
3. Проверить что есть кнопка VoiceMode (волны) справа
4. Нажать VoiceMode — показывает диалог "Скоро"
5. Нажать микрофон диктовки
6. Сказать длинное предложение (5+ слов)
7. Проверить что ВСЁ предложение записалось в поле ввода

---

## Этап 1: Split Layout + Draft State

**Цель:** Создать базовую структуру страницы с двумя колонками

### Задачи

- [ ] 1.1 Создать папку `app/(dashboard)/projects/new/components/`
- [ ] 1.2 Создать `project-draft-preview.tsx` — компонент preview
- [ ] 1.3 Создать `project-chat-panel.tsx` — компонент чата
- [ ] 1.4 Обновить `project-creation-client.tsx` — split layout
- [ ] 1.5 Добавить Draft state management

### Файлы

**Новые:**
- `app/(dashboard)/projects/new/components/project-draft-preview.tsx`
- `app/(dashboard)/projects/new/components/project-chat-panel.tsx`

**Изменяемые:**
- `app/(dashboard)/projects/new/project-creation-client.tsx`

### Структура Draft State

```typescript
interface ProjectDraft {
  name: string;
  description: string;
  instruction: string;
}

const [draft, setDraft] = useState<ProjectDraft>({
  name: "",
  description: "",
  instruction: "",
});

const isComplete = draft.name.trim() !== "" && draft.description.trim() !== "";
```

### Layout Structure

```tsx
<div className="flex min-h-dvh">
  {/* Left: Preview */}
  <aside className="w-[400px] border-r p-6 hidden lg:block">
    <ProjectDraftPreview draft={draft} onDraftChange={setDraft} />
  </aside>

  {/* Right: Chat */}
  <main className="flex-1 flex flex-col">
    <ProjectChatPanel ... />
  </main>
</div>
```

### Критерий готовности

- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Split layout отображается на desktop
- [ ] Preview показывает пустые поля
- [ ] Чат работает как раньше

### Мануальный тест

1. Открыть `/projects/new`
2. Должен быть split layout (preview слева, чат справа)
3. Preview показывает пустые поля (Название, Описание, Инструкция)
4. Чат работает, можно отправлять сообщения

---

## Этап 2: Tool updateProjectDraft

**Цель:** Заменить `createProject` на `updateProjectDraft` в API

### Задачи

- [ ] 2.1 Удалить tool `createProject` из service-chat route
- [ ] 2.2 Добавить tool `updateProjectDraft`
- [ ] 2.3 Обновить промпт AI для project-creation

### Файлы

**Изменяемые:**
- `app/(chat)/api/service-chat/route.ts`

### Tool Definition

```typescript
tools.updateProjectDraft = tool({
  description: "Обновить черновик проекта. Вызывай по мере получения информации — не жди всех данных.",
  inputSchema: z.object({
    name: z.string().optional().describe("Название проекта (2-5 слов, отражает суть)"),
    description: z.string().optional().describe("Краткое описание проекта (1-2 предложения)"),
    instruction: z.string().optional().describe("Системная инструкция для AI при работе с проектом"),
  }),
  execute: async (input) => {
    // Не создаём проект — просто возвращаем данные для frontend
    return {
      success: true,
      draft: {
        name: input.name || null,
        description: input.description || null,
        instruction: input.instruction || null,
      },
    };
  },
});
```

### Обновлённый промпт

```markdown
Ты — Simply, AI-ассистент для создания проектов.

## Твои задачи

1. **Собрать информацию** через диалог:
   - Какая цель проекта?
   - Для кого/чего?

2. **Обновлять черновик постепенно:**
   - Понял название → сразу вызови updateProjectDraft({name: "..."})
   - Понял цель → добавь description
   - Есть контекст → добавь instruction
   - Можно вызывать несколько раз, уточняя

3. **НЕ создавай проект** — пользователь сам нажмёт кнопку когда будет готов

## Правила

- Обновляй черновик по мере разговора, не жди всей информации
- Поля можно обновлять несколько раз
- Когда черновик заполнен, скажи что можно создавать
```

### Критерий готовности

- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] AI вызывает `updateProjectDraft` вместо `createProject`
- [ ] Tool возвращает draft данные

### Мануальный тест

1. Открыть `/projects/new`
2. Написать "Хочу проект для контента"
3. В консоли (Network tab) видно что AI вызывает `updateProjectDraft`
4. Проект НЕ создаётся автоматически

---

## Этап 3: Парсинг Tool Results

**Цель:** Обновлять preview в реальном времени при получении tool results

### Задачи

- [ ] 3.1 Добавить парсинг tool-result в project-creation-client
- [ ] 3.2 Обновлять draft state при получении updateProjectDraft
- [ ] 3.3 Preview обновляется в реальном времени

### Файлы

**Изменяемые:**
- `app/(dashboard)/projects/new/project-creation-client.tsx`

### Логика парсинга

```typescript
// В useMemo или useEffect при изменении chatMessages
useEffect(() => {
  for (const message of chatMessages) {
    for (const part of message.parts) {
      if (
        part.type === "tool-result" &&
        part.toolName === "updateProjectDraft" &&
        part.result?.success
      ) {
        const newDraft = part.result.draft;
        setDraft(prev => ({
          name: newDraft.name ?? prev.name,
          description: newDraft.description ?? prev.description,
          instruction: newDraft.instruction ?? prev.instruction,
        }));
      }
    }
  }
}, [chatMessages]);
```

### Критерий готовности

- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Preview обновляется когда AI вызывает tool
- [ ] Поля появляются постепенно по мере диалога

### Мануальный тест

1. Открыть `/projects/new`
2. Написать "Создай проект для написания постов в Instagram"
3. Наблюдать как поля preview заполняются в реальном времени
4. Название появляется первым, потом описание

---

## Этап 4: Editable Fields

**Цель:** Сделать поля preview редактируемыми

### Задачи

- [ ] 4.1 Создать `editable-field.tsx` компонент
- [ ] 4.2 Интегрировать в project-draft-preview
- [ ] 4.3 Добавить блокировку AI updates когда поле в фокусе
- [ ] 4.4 Добавить кнопку "Создать проект"

### Файлы

**Новые:**
- `app/(dashboard)/projects/new/components/editable-field.tsx`

**Изменяемые:**
- `app/(dashboard)/projects/new/components/project-draft-preview.tsx`
- `app/(dashboard)/projects/new/project-creation-client.tsx`

### EditableField Component

```tsx
interface EditableFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  disabled?: boolean;
}

export function EditableField({ label, value, onChange, ... }: EditableFieldProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          ...
        />
      ) : (
        <Input ... />
      )}
    </div>
  );
}
```

### Кнопка создания

```tsx
<Button
  onClick={handleCreateProject}
  disabled={!isComplete}
  className="w-full"
>
  {isComplete ? "✓ Создать проект" : "Заполните название и описание"}
</Button>
```

### Критерий готовности

- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Поля можно редактировать вручную
- [ ] Кнопка "Создать" появляется когда ready
- [ ] Проект создаётся по клику

### Мануальный тест

1. Заполнить через диалог
2. Кликнуть на название, изменить вручную
3. Проверить что изменение сохранилось
4. Нажать "Создать проект"
5. Проект создан, редирект на страницу проекта

---

## Этап 5: Mobile Layout

**Цель:** Адаптировать для мобильных устройств

### Задачи

- [ ] 5.1 Добавить collapsible preview для mobile
- [ ] 5.2 Responsive breakpoints (lg:)
- [ ] 5.3 Тест на разных размерах экрана

### Файлы

**Изменяемые:**
- `app/(dashboard)/projects/new/project-creation-client.tsx`
- `app/(dashboard)/projects/new/components/project-draft-preview.tsx`

### Mobile Layout

```tsx
{/* Mobile: Preview сверху (collapsible) */}
<div className="lg:hidden">
  <Collapsible open={previewOpen} onOpenChange={setPreviewOpen}>
    <CollapsibleTrigger className="w-full">
      <div className="flex items-center justify-between p-4 border-b">
        <span>📋 Паспорт проекта</span>
        <ChevronDown className={cn("transition", previewOpen && "rotate-180")} />
      </div>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <ProjectDraftPreview ... />
    </CollapsibleContent>
  </Collapsible>
</div>

{/* Desktop: Preview слева */}
<aside className="hidden lg:block w-[400px] ...">
  <ProjectDraftPreview ... />
</aside>
```

### Критерий готовности

- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Mobile: collapsible preview работает
- [ ] Desktop: split layout работает

### Мануальный тест

1. Открыть на desktop — split layout
2. Уменьшить окно до mobile — preview сворачивается
3. Кликнуть на preview — разворачивается
4. Функциональность работает на обоих размерах

---

## Этап 6: Анимации + Polish

**Цель:** Добавить плавные анимации и отполировать UX

### Задачи

- [ ] 6.1 Анимация появления полей (fade-in)
- [ ] 6.2 Highlight при изменении значения
- [ ] 6.3 Анимация кнопки "Создать"
- [ ] 6.4 Убрать success card (теперь редирект сразу)
- [ ] 6.5 Общий polish

### Файлы

**Изменяемые:**
- `app/(dashboard)/projects/new/components/project-draft-preview.tsx`
- `app/(dashboard)/projects/new/components/editable-field.tsx`

### Анимации

```tsx
// Fade-in при появлении значения
<AnimatePresence>
  {value && (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      {value}
    </motion.div>
  )}
</AnimatePresence>

// Highlight при изменении
<motion.div
  key={value}
  initial={{ backgroundColor: "hsl(var(--primary) / 0.1)" }}
  animate={{ backgroundColor: "transparent" }}
  transition={{ duration: 1 }}
>
  ...
</motion.div>
```

### Критерий готовности

- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Анимации плавные
- [ ] Нет мерцания
- [ ] UX приятный

### Мануальный тест

1. Создать проект через диалог
2. Наблюдать анимации при заполнении
3. Отредактировать поле — видно highlight
4. Создать проект — плавный переход

---

## Этап 7: Финализация

**Цель:** Документация, версия, архив

### Задачи

- [ ] 7.1 Обновить CLAUDE.md
- [ ] 7.2 Обновить SIMPLY_STATUS.md
- [ ] 7.3 Обновить CHANGELOG.md (главный)
- [ ] 7.4 Обновить package.json → v3.9.0
- [ ] 7.5 Переместить ТЗ в архив

### Файлы

**Изменяемые:**
- `CLAUDE.md`
- `SIMPLY_STATUS.md`
- `CHANGELOG.md`
- `package.json`

### Критерий готовности

- [ ] Версия 3.9.0 в package.json
- [ ] Документация актуальна
- [ ] ТЗ в архиве

---

## Чек-лист финальной проверки

- [ ] Desktop layout работает
- [ ] Mobile layout работает
- [ ] Preview обновляется в реальном времени
- [ ] Поля редактируемые
- [ ] Кнопка "Создать" работает
- [ ] Проект создаётся в БД
- [ ] Редирект на страницу проекта
- [ ] Голосовой ввод работает
- [ ] Анимации плавные
- [ ] Нет ошибок в консоли
