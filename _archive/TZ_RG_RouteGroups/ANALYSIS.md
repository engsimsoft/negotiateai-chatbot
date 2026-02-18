# Анализ ТЗ — Route Groups

## Резюме

Перевести три режима чатов (chat, expertise, create) с единого маршрута `/chat/[id]` на отдельные route groups с контекстными sidebar. URL станут осмысленными: `/expertise/[id]`, `/create/[id]`. Каждый sidebar показывает только свою историю, кнопку создания и заголовок.

---

## Вопросы для уточнения

### 1. Создание нового чата — механика

Сейчас новый чат создаётся через `/chat?mode=expertise` (отдельная страница `app/(chat)/chat/page.tsx` генерирует UUID и рендерит пустой Chat).

После route groups, `/expertise` уже занят dashboard list page (`app/(dashboard)/expertise/page.tsx`). Создать `app/(expertise)/expertise/page.tsx` нельзя — конфликт URL.

**Предлагаю:** Кнопка "+ Новый запрос" в sidebar генерирует UUID клиентски и навигирует на `/expertise/[uuid]`. Страница `expertise/[id]/page.tsx` обрабатывает оба сценария:
- Чат найден в БД → загрузить и отрендерить
- Чат НЕ найден в БД → отрендерить пустой Chat (как сейчас делает `chat/page.tsx`)

Это чисто, без дополнительных страниц и конфликтов. **Согласен?**

### 2. Фильтрация истории в sidebar

Текущий API `/api/history` (вызывает `getChatsByUserId`) возвращает ВСЕ не-проектные чаты без фильтрации по chatMode. Sidebar сейчас показывает смешанный список.

Для mode-specific sidebar нужна фильтрация. **Два варианта:**
- **(a) Добавить `?chatMode=expertise` в `/api/history`** — эффективно, одна строка в query. Формально это "изменение API", но non-breaking (добавление опционального параметра)
- **(b) Фильтровать client-side** — загружаем все чаты, фильтруем в React. Менее эффективно, но API не трогаем

**Рекомендую (a).** Один параметр, не ломает обратную совместимость. Если ТЗ жёстко запрещает — сделаю (b). **Какой вариант?**

### 3. Минимальные изменения в Chat-компоненте

ТЗ говорит "Не менять компонент Chat". Однако в `chat.tsx:363-366` есть хардкод:
```typescript
const newUrl = projectId
  ? `/projects/${projectId}/chat/${id}`
  : `/chat/${id}`;
```

Также в `multimodal-input.tsx:173` и `suggested-actions.tsx:40`:
```typescript
window.history.replaceState({}, "", `/chat/${chatId}`);
```

Эти строки ОБЯЗАТЕЛЬНО нужно сделать mode-aware, иначе после отправки первого сообщения URL сбросится на `/chat/[id]`.

**Предлагаю:** Создать утилиту `getChatUrl(chatId, chatMode, projectId?)` в `lib/utils.ts` и заменить хардкоды на её вызов. Это не меняет поведение Chat — только URL-формирование. **Допустимо?**

---

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.
> Каждая рекомендация требует согласования с архитектором.

### ✅ Согласен с ТЗ

- **Route Groups архитектура** — `(chat)/chat/[id]`, `(expertise)/expertise/[id]`, `(create)/create/[id]` — ОК, нет конфликта с dashboard pages потому что `/expertise` ≠ `/expertise/[id]`
- **Shared Chat компонент** — ОК, Chat принимает `initialChatMode` как prop, ничего менять не нужно
- **Breadcrumbs упростятся** — ОК, `chat-header.tsx` уже имеет `CHAT_MODE_BREADCRUMBS` конфиг. Breadcrumbs будут работать as-is
- **Старые ссылки `/chat/[id]` → redirect** — ОК, добавим redirect logic в существующий `chat/[id]/page.tsx`
- **Списковые страницы без изменений** — ОК, `/chats`, `/expertise`, `/create` остаются в `(dashboard)` group
- **API/бэкенд без изменений** — ОК, chat API уже принимает chatMode

### ⚠️ Рекомендую изменить

| # | Было (ТЗ) | Рекомендация | Обоснование из кода |
|---|-----------|--------------|---------------------|
| 1 | Три отдельных sidebar-компонента (ChatSidebar, ExpertiseSidebar, CreateSidebar) | **Один AppSidebar с mode-awareness.** Расширить `SidebarContext` на `chatMode` | `app-sidebar.tsx:26-28` уже имеет `SidebarContext` union type с `general` и `project`. Добавить `chatMode` field к `general` — минимальное изменение. Три отдельных sidebar = дублирование 90% кода (навигация, footer, structure одинаковы) |
| 2 | ТЗ не упоминает URL-replacement в Chat | **Обязательно обновить URL-formation.** Создать `getChatUrl()` утилиту | `multimodal-input.tsx:173`, `suggested-actions.tsx:40`, `chat.tsx:365` — хардкодят `/chat/${id}`. Без обновления после первого сообщения URL сбросится с `/expertise/abc` на `/chat/abc` |
| 3 | ТЗ не упоминает ссылки в dashboard list pages | **Обновить ссылки "Открыть чат" в list pages** | `chat-list-item.tsx:111` и `chat-detail-panel.tsx:68` хардкодят `href="/chat/${chat.id}"`. Нужно использовать `getChatUrl()` |
| 4 | ТЗ не упоминает layout-дубли | **Три layout.tsx будут почти идентичны.** Можно вынести shared-логику | `app/(chat)/layout.tsx` = Script + SWRProvider + DataStreamProvider + SidebarLayout. Все три layout-а будут копией. Рекомендую: создать shared `ChatLayoutShell` компонент, layouts вызывают его. Или просто продублировать — всего 20 строк |
| 5 | ТЗ не упоминает `createButton.href` в dashboard pages | **Обновить ссылки создания в dashboard** | `expertise/page.tsx:23`: `href="/chat?mode=expertise"`, `create/page.tsx:23`: `href="/chat?mode=create"`. Нужно обновить на новые URL (см. Вопрос 1 выше) |

### ❓ Требует уточнения

- **Sidebar: один компонент или три?** — Моя рекомендация: один AppSidebar с mode-aware `SidebarContext`. Но если архитектор планирует значительно различные sidebar-ы в будущем (разные секции, виджеты) — три отдельных может быть оправдано. Какой подход?
- **Layout: дублировать или абстрагировать?** — 20 строк × 3 = чистая копия, или `ChatLayoutShell` component? Для 20 строк дублирование может быть проще
- **`experimental_ppr = true`** — в текущем `(chat)/layout.tsx` есть `export const experimental_ppr = true`. Нужен ли PPR в новых layouts?

---

## Полная карта затронутых файлов

### Создать (новые)
| Файл | Описание |
|------|----------|
| `app/(expertise)/expertise/[id]/page.tsx` | Страница чата expertise |
| `app/(expertise)/layout.tsx` | Layout для expertise (SWR + DataStream + Sidebar) |
| `app/(create)/create/[id]/page.tsx` | Страница чата create |
| `app/(create)/layout.tsx` | Layout для create |
| `docs/adr/route-groups.md` | ADR (описан в ТЗ) |

### Изменить (существующие)
| Файл | Что меняется |
|------|-------------|
| `app/(chat)/chat/[id]/page.tsx` | Добавить redirect по chatMode |
| `components/app-sidebar.tsx` | Mode-aware context (заголовок, кнопка, ссылка "Все...") |
| `components/sidebar-history.tsx` | Фильтрация по chatMode |
| `components/sidebar-history-item.tsx:83` | `getChatUrl()` вместо `/chat/${id}` |
| `components/chats/chat-list-item.tsx:111` | `getChatUrl()` вместо `/chat/${id}` |
| `components/chats/chat-detail-panel.tsx:68` | `getChatUrl()` вместо `/chat/${id}` |
| `components/multimodal-input.tsx:173` | `getChatUrl()` вместо `/chat/${chatId}` |
| `components/suggested-actions.tsx:40` | `getChatUrl()` вместо `/chat/${chatId}` |
| `components/chat.tsx:363-366` | `getChatUrl()` вместо хардкода |
| `lib/utils.ts` | Добавить `getChatUrl()` утилиту |
| `app/(dashboard)/expertise/page.tsx:23` | Обновить `createButton.href` |
| `app/(dashboard)/create/page.tsx:23` | Обновить `createButton.href` |
| `app/(dashboard)/chats/page.tsx:20` | Возможно обновить `createButton.href` |

### Не трогать
| Файл | Почему |
|------|--------|
| `components/chat.tsx` | Поведение Chat не меняется (только URL-утилита) |
| `components/chat-header.tsx` | Breadcrumbs уже mode-aware |
| `lib/ai/chat-mode-config.ts` | Конфигурация не меняется |
| `lib/db/schema.ts` | Схема не меняется |
| `app/(chat)/api/*` | API не меняется |
| `components/right-sidebar.tsx` | Правая панель не меняется |

---

## Потенциальные риски

1. **URL конфликт при навигации** — переход `/expertise/abc` → отправка сообщения → URL не должен сброситься на `/chat/abc`. Митигация: `getChatUrl()` утилита
2. **Sidebar history перезагрузка** — при переходе между mode groups layout перемонтируется, история sidebar заново загрузится. Это OK (и даже полезно — sidebar покажет правильный mode)
3. **SEO/Crawlers** — не применимо (приложение за авторизацией)
4. **Старые закладки** — митигация: redirect в `/chat/[id]` page

---

## Зависимости

- ✅ ТЗ-DV2U (терминология + breadcrumbs) — завершено
- ✅ chatMode в БД — уже существует
- ✅ Dashboard list pages — уже работают

---

## Оценка сложности

- [x] Простое (1-2 сессии)

Основная работа — роутинг и ссылки, без новой бизнес-логики. ~15 файлов, из них 4 новых (page + layout × 2), остальные — точечные замены хардкодов.
