# Передача сессии ТЗ-10

**Дата:** 2026-02-06
**Сессия:** 0 (Подготовка)

---

## Статус этапов

- [ ] **Этап 0: Исправление багов ServiceChatInput** ← НАЧАТЬ ЗДЕСЬ
- [ ] Этап 1: Split Layout + Draft State
- [ ] Этап 2: Tool updateProjectDraft
- [ ] Этап 3: Парсинг Tool Results
- [ ] Этап 4: Editable Fields
- [ ] Этап 5: Mobile Layout
- [ ] Этап 6: Анимации + Polish
- [ ] Этап 7: Финализация

---

## Следующая сессия: начни с

1. **Прочитать ROADMAP.md** — Этап 0
2. **Исправить баг диктовки:**
   - Открыть `components/input/input-context.tsx`
   - Проблема: `controlledValue` в closure устаревает
   - Решение: использовать ref или изменить логику setValue
3. **Добавить attachments:**
   - Открыть `components/input/service-chat-input.tsx`
   - Добавить `InputAttachments` в `InputToolbarLeft`
4. **Включить VoiceMode:**
   - В том же файле: `showVoiceMode={true}` по умолчанию
5. **Тест:** диктовка, скрепка, voiceMode

---

## Ключевые файлы

| Файл | Что делать |
|------|------------|
| `components/input/input-context.tsx` | Исправить stale closure в setValue |
| `components/input/service-chat-input.tsx` | Добавить attachments, включить voiceMode |
| `app/(dashboard)/projects/new/project-creation-client.tsx` | После багов — split layout |

---

## Известные баги (Этап 0)

### Баг 1: Диктовка теряет текст

**Симптом:** Записываются только последние 1-2 слова
**Причина:** Stale closure — `controlledValue` не обновляется между вызовами `onTranscript`
**Где:** `input-context.tsx` строка ~113-122

```typescript
// ПРОБЛЕМА: controlledValue устаревает
const setValue = useCallback((action) => {
  const newValue = typeof action === "function"
    ? action(controlledValue ?? "")  // ← controlledValue stale!
    : action;
  onValueChange(newValue);
}, [controlledValue]);  // ← зависимость не помогает при быстрых вызовах
```

### Баг 2: Нет скрепки

**Симптом:** В ServiceChatInput нет кнопки attachments
**Причина:** Не добавлен компонент
**Где:** `service-chat-input.tsx`

### Баг 3: Нет VoiceMode

**Симптом:** Нет кнопки голосового режима
**Причина:** `showVoiceMode={false}` по умолчанию
**Где:** `service-chat-input.tsx`

---

## Контекст

- Версия: v3.8.1 (после интеграции ServiceChatInput)
- ServiceChatInput создан, но с багами
- CompactInput работает корректно (там uncontrolled mode)
- Разница: controlled vs uncontrolled mode в InputContext

---

## Блокеры / Вопросы

Нет блокеров. Можно начинать работу.
