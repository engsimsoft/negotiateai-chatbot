# Roadmap ТЗ-DV2U: UX навигации Dashboard V2

**Создан:** 2026-02-18
**Версия проекта:** 3.24.0 → 3.25.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 4 |
| Текущий этап | ЗАКРЫТО |
| Сессий (оценка) | 1-2 |

---

## Этап 1: Терминология

**Статус:** ✅ Завершён

**Цель:** Привести тексты на страницах /expertise, /create, /chats в соответствие с режимами (запрос/задание/чат). Унифицировать ChatsPageContent → ModeChatsPage.

**Задачи:**

- [x] 1.1 Унифицировать: рефакторить `ChatsPageContent` → использовать `ModeChatsPage` (устранить дублирование)
- [x] 1.2 Добавить prop `itemCountLabel` в `ModeChatsPage` (вместо хардкоженной функции `chatCountLabel`)
- [x] 1.3 Добавить props `summaryLabel` и `openLabel` в `ChatDetailPanel` (вместо хардкоженных "О чём чат" / "Открыть чат")
- [x] 1.4 Обновить `/expertise` — title оставить "Экспертиза", createButton.label → "Новый запрос", itemCountLabel → "запрос/запроса/запросов", emptyState → "Нет запросов", detailLabels → "О чём запрос" / "Открыть запрос"
- [x] 1.5 Обновить `/create` — title → "Создание", createButton.label → "Новое задание", itemCountLabel → "задание/задания/заданий", emptyState → "Нет заданий", detailLabels → "О чём задание" / "Открыть задание"
- [x] 1.6 Обновить `/chats` — добавить createButton `{ label: "Новый чат", href: "/chat" }`, itemCountLabel → "чат/чата/чатов", detailLabels → "О чём чат" / "Открыть чат"

**Файлы:**
- `components/chats/mode-chats-page.tsx` — добавить props (itemCountLabel, detailLabels)
- `components/chats/chats-page-content.tsx` — рефакторить → использовать ModeChatsPage (или удалить)
- `components/chats/chat-detail-panel.tsx` — props summaryLabel, openLabel
- `app/(dashboard)/expertise/page.tsx` — обновить пропсы
- `app/(dashboard)/create/page.tsx` — обновить пропсы (title: "Создание")
- `app/(dashboard)/chats/page.tsx` — обновить пропсы (добавить createButton)

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: /expertise — счётчик "N запросов", кнопка "Новый запрос", детали "О чём запрос" / "Открыть запрос →"
- [x] Браузер: /create — заголовок "Создание", счётчик "N заданий", кнопка "Новое задание", детали "О чём задание" / "Открыть задание →"
- [x] Браузер: /chats — кнопка "+ Новый чат" в header, детали "О чём чат" / "Открыть чат →"
- [x] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add [файлы этапа]
git commit -m "feat(tz-dv2u): stage 1 — terminology unification"
```

**Критерий готовности:** Все три страницы (/chats, /expertise, /create) используют единый ModeChatsPage с корректной терминологией.

---

## Этап 2: Breadcrumbs в чате

**Статус:** ✅ Завершён

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 1

**Цель:** При открытии чата из /expertise или /create — в header чата отображаются breadcrumbs ("Экспертиза > Название" или "Создание > Название"). Для chatMode='chat' — без breadcrumbs.

**Задачи:**

- [x] 2.1 В `app/(chat)/chat/[id]/page.tsx` — передать `chat.chatMode` в компонент `Chat`
- [x] 2.2 В `components/chat.tsx` — пробросить `chatMode` в `ChatHeader` как prop
- [x] 2.3 В `components/chat-header.tsx` — добавить breadcrumbs по chatMode:
  - `expertise` → "Экспертиза" (ссылка на /expertise) > ChevronRight > "Запрос" (текст)
  - `create` → "Создание" (ссылка на /create) > ChevronRight > "Задание" (текст)
  - `chat` → без breadcrumbs (как сейчас)
  - Разместить рядом с SidebarToggle, аналогично существующим project breadcrumbs

**Файлы:**
- `app/(chat)/chat/[id]/page.tsx` — передать chatMode
- `components/chat.tsx` — пробросить prop chatMode в ChatHeader
- `components/chat-header.tsx` — отрисовать breadcrumbs по chatMode

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] Браузер: открыть чат с chatMode='expertise' → видны breadcrumbs "Экспертиза > Запрос"
- [ ] Браузер: открыть чат с chatMode='create' → видны breadcrumbs "Создание > Задание"
- [ ] Браузер: открыть обычный чат → без breadcrumbs (как было)
- [ ] Браузер: клик на "Экспертиза" в breadcrumbs → переход на /expertise
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add [файлы этапа]
git commit -m "feat(tz-dv2u): stage 2 — chat breadcrumbs by chatMode"
```

**Критерий готовности:** Пользователь видит контекст (откуда пришёл) в header чата и может вернуться по breadcrumbs.

---

## ~~Этап 3: Контекст sidebar~~ — ОТМЕНЁН

**Статус:** ❌ Отменён — переход на route groups в следующем ТЗ

**Причина:** Контекстный sidebar через React Context/деривацию — workaround. Route groups Next.js (`/expertise/[id]`, `/create/[id]`) дают layout + sidebar "из коробки".

---

## ~~Этап 4: Финализация~~ — ОТМЕНЁН

**Статус:** ❌ Отменён — версия не поднимается, ТЗ закрывается как частично выполненное
