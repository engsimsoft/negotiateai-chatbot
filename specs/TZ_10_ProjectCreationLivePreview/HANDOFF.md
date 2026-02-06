# Передача сессии ТЗ-10

**Дата:** 2026-02-06
**Сессия:** 1 (После исправления багов)

---

## Статус этапов

- [x] **Этап 0: Исправление багов ServiceChatInput** ✓ DONE
- [ ] **Этап 1: Split Layout + Draft State** ← НАЧАТЬ ЗДЕСЬ
- [ ] Этап 2: Tool updateProjectDraft
- [ ] Этап 3: Парсинг Tool Results
- [ ] Этап 4: Editable Fields
- [ ] Этап 5: Mobile Layout
- [ ] Этап 6: Анимации + Polish
- [ ] Этап 7: Финализация

---

## Выполнено в Этапе 0

### Баг 1: Диктовка теряет текст ✓
- **Файл:** `components/input/input-context.tsx`
- **Решение:** Добавлен `valueRef` для отслеживания актуального значения в callback
- **Строки:** 118-122, 128

### Баг 2: Нет скрепки ✓
- **Файл:** `components/input/service-chat-input.tsx`
- **Решение:** Добавлен `InputAttachments` в `InputToolbarLeft`
- **Строки:** 15, 44-45, 61, 86

### Баг 3: Нет VoiceMode ✓
- **Файл:** `components/input/service-chat-input.tsx` + `project-creation-client.tsx`
- **Решение:** `showVoiceMode = true` по умолчанию, убрано явное `showVoiceMode={false}`

---

## Следующая сессия: Этап 1

**Цель:** Split Layout — левая панель (чат) + правая панель (Live Preview)

**Прочитать:** `specs/TZ_10_ProjectCreationLivePreview/ROADMAP.md` — Этап 1

**Ключевые задачи:**
1. Создать `ProjectDraftContext` для хранения draft state
2. Создать `ProjectDraftPreview` компонент (правая панель)
3. Изменить layout в `project-creation-client.tsx` на split view
4. Responsive: на mobile — только чат, preview в drawer

**Файлы для изменения:**
| Файл | Действие |
|------|----------|
| `app/(dashboard)/projects/new/project-draft-context.tsx` | Создать — контекст для draft |
| `components/projects/project-draft-preview.tsx` | Создать — UI превью |
| `app/(dashboard)/projects/new/project-creation-client.tsx` | Изменить — split layout |

---

## Контекст

- Версия: v3.8.1
- ServiceChatInput работает корректно (диктовка, скрепка, voiceMode)
- Готово к разработке Live Preview

---

## Блокеры / Вопросы

Нет блокеров.
