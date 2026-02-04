# ТЗ-07A: Статус и продолжение работы

**Дата обновления:** 2026-02-04
**Версия проекта:** 3.3.3
**Статус:** Этап 8 — Финальное тестирование

---

## Что сделано в этой сессии (2026-02-04, Сессия 3)

### ГЛАВНОЕ: Унифицированная система инпутов

**Проблема:** Было 3+ разных компонента инпута с дублированием кода. Микрофон работал только в чате. Не было индикации какая модель используется на главной/проекте.

**Решение:** Создана композиционная система `components/input/` — как конструктор LEGO. Меняем один компонент — работает везде.

### Дизайн в стиле Google Gemini / Claude Desktop

```
╭──────────────────────────────────────────────────────╮
│  Спросите что угодно...                              │
├──────────────────────────────────────────────────────┤
│  📎          Авто (рекомендуется) ▾      🎤    🔊   │
╰──────────────────────────────────────────────────────╯
```

### Структура `components/input/`

```
components/input/
├── input-context.tsx           # Контекст (связь компонентов)
├── input-base.tsx              # Базовый контейнер + toolbar
├── input-textarea.tsx          # Поле ввода с auto-resize
├── input-voice-button.tsx      # 🎤 Диктовка (Deepgram) — РАБОТАЕТ
├── input-voice-mode-button.tsx # 🔊 Голосовой режим — Coming soon
├── input-model-selector.tsx    # Селектор модели (Google/Anthropic)
├── input-attachments.tsx       # 📎 Attachments
├── input-submit-button.tsx     # Кнопка отправки
├── compact-input.tsx           # Готовый пресет
└── index.tsx                   # Экспорты
```

### Использование

```tsx
// Главная (Google Gemini)
<CompactInput provider="google" redirectPath="/chat" />

// Проект (Anthropic Claude)
<CompactInput provider="anthropic" redirectPath={`/projects/${id}/chat`} />

// Будущий helper
<CompactInput provider="google" redirectPath="/helpers/marketer/chat" />
```

---

## Предыдущая сессия (Сессия 2)

- Исправлены баги удаления проекта
- Исправлен контекст sidebar для чатов проекта
- Добавлено меню для чатов на странице проекта
- Создан API для управления чатами (DELETE/PATCH)
- Удалён функционал "Поделиться"

---

## Текущее состояние

### Завершённые этапы
- ✅ Этап 1: Схема БД и миграции
- ✅ Этап 2: Helpers presets
- ✅ Этап 3: Навигация и маршруты
- ✅ Этап 4: Sidebar (контекстный)
- ✅ Этап 5: Главная страница
- ✅ Этап 6: Автонейминг чатов
- ✅ Этап 7: Universal Dialog
- ✅ **Унифицированная система инпутов** (Сессия 3)

### Текущий этап
- 🔄 Этап 8: Финальное тестирование

---

## Что осталось сделать

### Мануальные тесты
- [ ] Главная → ввод текста → чат создаётся
- [ ] Селектор модели на главной работает (Google)
- [ ] Селектор модели на проекте работает (Anthropic)
- [ ] Кнопка 🎤 диктовки работает везде
- [ ] Кнопка 🔊 показывает "Coming soon"
- [ ] Breadcrumbs на всех уровнях
- [ ] Responsive на мобильных

### Документация
- [ ] Обновить SIMPLY_STATUS.md
- [ ] Обновить CHANGELOG.md
- [ ] Создать тег v3.4.0

---

## Созданные файлы в Сессии 3

| Файл | Описание |
|------|----------|
| `components/input/input-context.tsx` | Контекст для связи компонентов |
| `components/input/input-base.tsx` | Базовый контейнер + toolbar |
| `components/input/input-textarea.tsx` | Поле ввода |
| `components/input/input-voice-button.tsx` | 🎤 Кнопка диктовки |
| `components/input/input-voice-mode-button.tsx` | 🔊 Кнопка голосового режима |
| `components/input/input-model-selector.tsx` | Селектор модели |
| `components/input/input-attachments.tsx` | 📎 Кнопка attachments |
| `components/input/input-submit-button.tsx` | Кнопка отправки |
| `components/input/compact-input.tsx` | Готовый пресет |
| `components/input/index.tsx` | Экспорты |

### Обновлённые файлы

| Файл | Изменения |
|------|-----------|
| `components/glavnaya/glavnaya-input.tsx` | Теперь использует CompactInput |
| `components/projects/project-input.tsx` | Теперь использует CompactInput |

---

## Ключевые файлы

| Файл | Описание |
|------|----------|
| `components/input/` | **Унифицированная система инпутов** |
| `components/chat.tsx` | Главный чат + автонейминг |
| `components/sidebar-history.tsx` | История чатов |
| `app/(chat)/api/chat/[id]/route.ts` | API чатов |

---

## Архитектурные решения

### Почему композиция?
1. **Расширяемость** — легко добавить новую кнопку
2. **Переиспользование** — собираем что нужно из готовых блоков
3. **Поддержка** — меняем один файл, работает везде

### Два режима
- `mode="redirect"` — главная/проект (редирект с query params)
- `mode="send"` — чат (отправка через useChat)

### Два провайдера
- `provider="google"` — модели Gemini
- `provider="anthropic"` — модели Claude

---

## Будущие задачи (заложено в архитектуру)

1. **Голосовой режим** — `input-voice-mode-button.tsx` готов, нужно API
2. **Attachments на главной** — можно включить когда нужно
3. **Helpers** — просто добавить `<CompactInput />`
4. **Full mode для чатов** — можно создать `FullInput` пресет

---

## Команды

```bash
npm run dev          # Dev сервер
npx tsc --noEmit     # Проверка TypeScript
npm run build        # Сборка
```

---

## Рабочие версии

```json
{
  "ai": "5.0.123",
  "react": "19.0.0-rc-45804af1-20241021",
  "@ai-sdk/react": "2.0.105",
  "@ai-sdk/google": "^1.2.18"
}
```
