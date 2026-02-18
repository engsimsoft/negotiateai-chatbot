# Roadmap ТЗ-DV2U: UX навигации Dashboard V2

**Создан:** 2026-02-18
**Версия проекта:** 3.24.0 → 3.25.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 4 |
| Текущий этап | 1 |
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

## Этап 3: Контекст sidebar

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 2

**Цель:** AppSidebar фильтрует историю чатов и адаптирует навигацию под текущий chatMode. Кнопки "Новый чат" и "Все чаты" — контекстные.

**Задачи:**

- [ ] 3.1 Создать `ChatModeContext` (React Context) — Provider в `(chat)` layout, Chat компонент устанавливает chatMode
- [ ] 3.2 Добавить параметр `chatMode` в `/api/history` route — фильтрация чатов по chatMode
- [ ] 3.3 Обновить `getChatsByUserId` в `lib/db/queries.ts` — поддержка фильтрации по chatMode
- [ ] 3.4 Обновить `AppSidebar` — читать chatMode из ChatModeContext, адаптировать:
  - Кнопка "Новый чат" → "Новый запрос" (expertise) / "Новое задание" (create), href → `/chat?mode=xxx`
  - Ссылка "Все чаты" → "Все запросы" (→ /expertise) / "Все задания" (→ /create)
  - Заголовок истории: "Чаты" → "Запросы" / "Задания"
- [ ] 3.5 Обновить `SidebarHistory` — передавать chatMode в API `/api/history?chatMode=xxx`
- [ ] 3.6 Обновить `getChatHistoryPaginationKey` — добавить chatMode в URL пагинации

**Файлы:**
- `lib/contexts/chat-mode-context.tsx` — новый: React Context + Provider
- `app/(chat)/layout.tsx` — обернуть в ChatModeProvider
- `components/chat.tsx` — установить chatMode в контексте
- `components/app-sidebar.tsx` — читать chatMode, адаптировать навигацию
- `components/sidebar-history.tsx` — фильтрация через API с chatMode param
- `app/(chat)/api/history/route.ts` — параметр chatMode
- `lib/db/queries.ts` — getChatsByUserId + chatMode filter

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: открыть чат с chatMode='expertise' → sidebar показывает только запросы экспертизы
- [ ] Браузер: кнопка "Новый запрос" → создаёт чат с chatMode='expertise'
- [ ] Браузер: "Все запросы" → ведёт на /expertise
- [ ] Браузер: открыть обычный чат → sidebar показывает обычные чаты, "Все чаты" → /chats
- [ ] Браузер: переход между чатами разных mode → sidebar обновляется
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add [файлы этапа]
git commit -m "feat(tz-dv2u): stage 3 — contextual sidebar by chatMode"
```

**Критерий готовности:** Sidebar полностью контекстный — фильтрация, кнопки, ссылки соответствуют текущему chatMode.

---

## Этап 4: Финализация

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 3

**Задачи:**
- [ ] 4.1 Финальное мануальное тестирование (пользователь) — полный flow всех трёх частей
- [ ] 4.2 Обновить главный CHANGELOG.md
- [ ] 4.3 Обновить SIMPLY_STATUS.md
- [ ] 4.4 Обновить CLAUDE.md (если менялась структура)
- [ ] 4.5 Обновить package.json: 3.24.0 → 3.25.0
- [ ] 4.6 Переместить папку в `_archive/`

**Валидация:**
- [ ] `npm run build` — успешен
- [ ] Все функции работают в браузере
- [ ] Документация актуальна

**Git (после валидации):**
```bash
git add [файлы]
git commit -m "feat(tz-dv2u): finalize — v3.25.0"
```

**Критерий готовности:** Документация обновлена, ТЗ в архиве, version bumped.
