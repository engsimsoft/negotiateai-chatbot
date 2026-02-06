# ТЗ-10: Project Creation Live Preview

**Статус:** ✅ ЗАВЕРШЁН
**Версия:** v3.9.0
**Дата:** 2026-02-06

---

## Выполненные этапы

- [x] **Этап 0: Исправление багов ServiceChatInput** ✓
- [x] **Этап 1: Split Layout + Draft State** ✓
- [x] **Этап 2: Tool updateProjectDraft** ✓
- [x] **Этап 3: Парсинг Tool Results** ✓
- [x] **Этап 4: Кнопка "Создать проект"** ✓
- [x] **Этап 4.5: Фикс скролла левой панели** ✓

---

## Что реализовано

1. **Split Layout** — Preview слева (400px), Chat справа
2. **Live Preview** — поля заполняются в реальном времени при вызове AI tool
3. **Tool updateProjectDraft** — AI обновляет черновик постепенно
4. **Парсинг** — frontend ловит `tool-updateProjectDraft` и обновляет state
5. **Кнопка "Создать проект"** — появляется когда name + description заполнены
6. **API создания** — POST /api/projects с данными из черновика
7. **Success card** — показывается после создания с кнопками навигации
8. **Фикс скролла** — `h-dvh overflow-hidden` для контейнера, панели скроллят независимо

---

## Ключевые файлы

| Файл | Описание |
|------|----------|
| `app/(dashboard)/projects/new/project-creation-client.tsx` | Split layout + draft state + create logic |
| `app/(dashboard)/projects/new/components/project-draft-preview.tsx` | Preview с кнопкой создания |
| `app/(dashboard)/projects/new/components/project-chat-panel.tsx` | Chat panel |
| `app/(chat)/api/service-chat/route.ts` | updateProjectDraft tool |
| `components/input/input-context.tsx` | Фикс stale closure для controlled mode |
| `components/input/service-chat-input.tsx` | Attachments + VoiceMode по умолчанию |

---

## Важные технические детали

**Формат tool results в Vercel AI SDK:**
```json
{
  "type": "tool-updateProjectDraft",  // НЕ "tool-result"!
  "state": "output-available",
  "output": { ... },  // НЕ "result"!
  "input": { ... }
}
```

**Stale closure fix:**
Использовать useRef для отслеживания текущего значения в controlled mode при rapid callbacks (voice dictation).

---

## Не реализовано (отложено)

| Функция | Причина |
|---------|---------|
| Mobile Layout (drawer) | Будет переделываться при добавлении файлов |
| Анимации + Polish | UI изменится при добавлении файлов |
| Expand/Collapse инструкции | Отдельная задача |
| Загрузка файлов + AI-сортировка | Большая фича (отдельное ТЗ) |

---

## Workflow правила

- **Коммит** — обязательно делать по завершению сессии
- **Push** — по рекомендации (не обязательно)
- **Валидация** — `npx tsc --noEmit` после каждого этапа

---

## Следующие шаги (будущее ТЗ)

1. **Загрузка файлов в левой панели** — dropzone для документов
2. **AI-анализ файлов** — tool для предложения структуры папок
3. **Создание проекта с файлами** — автоматическая сортировка при создании
4. **Mobile Layout** — после стабилизации UI

---

**Закрыто:** 2026-02-06
