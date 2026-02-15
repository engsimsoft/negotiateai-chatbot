# Roadmap ТЗ-08: Chat Sidebar (Панель материалов чата)

**Создан:** 2026-02-15
**Версия проекта:** 3.20.0 → 3.21.0
**Статус:** ✅ Завершён

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 3 |
| Текущий этап | ✅ Все завершены |
| Сессий | 2 |

---

## Этап 1: Панель + кнопка toggle + извлечение данных

**Статус:** ✅ Завершён

**Цель:** Кнопка PanelRight в header чата открывает/закрывает правую панель. Панель показывает два списка: артефакты и вложения текущего чата. Empty state когда списки пусты.

**Задачи:**
- [x] Создать `components/chat-sidebar.tsx` — компонент правой панели
  - Layout: `fixed right-0 top-[3.5rem] bottom-0 z-30 w-[380px]` (паттерн manager-drawer)
  - Slide-in анимация: `translate-x-full → translate-x-0`, `duration-300 ease-in-out`
  - Header панели: "Материалы чата" + кнопка закрытия (X)
  - Секция "Артефакты": список карточек (иконка по kind + title + format label)
  - Секция "Вложения": список карточек (thumbnail для изображений, иконка для файлов + имя файла)
  - Empty state: "Пока нет материалов" если оба списка пусты
  - На мобильных (< md): полная ширина `w-full`
- [x] Извлечение данных из `messages` (`useMemo`)
  - Артефакты: `tool-createDocument` + `tool-updateDocument` parts → `{ id, title, kind }`
  - Дедупликация по `id` (один артефакт может создаваться и обновляться)
  - Вложения: `file` parts → `{ name, url, contentType }`
- [x] Добавить кнопку toggle в `components/chat-header.tsx`
  - Иконка: `PanelRight` из Lucide
  - Позиция: `ml-auto` блок, перед кнопкой Бена
  - Tooltip: "Материалы чата"
  - Prop: `onToggleSidebar`, `isSidebarOpen`
- [x] Добавить state в `components/chat.tsx`
  - `const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(false)`
  - Передать в ChatHeader: `onToggleSidebar`, `isSidebarOpen`
  - Передать в ChatSidebar: `open`, `onClose`, `messages`
  - Рендер `<ChatSidebar>` после основного div (как `<Artifact>`)

**Файлы:**
- `components/chat-sidebar.tsx` — **новый**
- `components/chat-header.tsx` — + кнопка PanelRight
- `components/chat.tsx` — + state + рендер ChatSidebar

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: кнопка PanelRight видна в header чата
- [x] Браузер: клик по кнопке — панель slide-in справа
- [x] Браузер: повторный клик — панель закрывается
- [x] Браузер: пустой чат — показан empty state "Пока нет материалов"
- [x] Браузер: отправить сообщение с вложением → вложение появляется в списке
- [x] Браузер: попросить AI создать документ → артефакт появляется в списке
- [x] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add components/chat-sidebar.tsx components/chat-header.tsx components/chat.tsx
git commit -m "feat(tz-08): chat sidebar panel with artifacts and attachments list"
```

**Критерий готовности:** Панель открывается/закрывается, показывает списки артефактов и вложений текущего чата. Визуально — референс Claude.ai.

---

⛔ НЕ НАЧИНАТЬ Этап 2 без подтверждения Этапа 1

---

## Этап 2: Интерактивность (scroll-to-message + скачивание)

**Статус:** ✅ Завершён

**Цель:** Клик по элементу → smooth scroll к сообщению + highlight (навигация по чату). Кнопка ↓ на каждом элементе — скачивание. Превью артефактов/вложений — через inline-карточки в чате.

**Задачи:**
- [x] Клик по артефакту/вложению → scroll к сообщению + highlight
  - `messageId` хранится в извлечённых данных
  - `scrollIntoView({ behavior: "smooth", block: "center" })`
  - CSS-анимация `sidebar-highlight` (2s fade-out с primary цветом)
  - `id="message-${message.id}"` добавлен в `message.tsx`
- [x] Кнопка скачивания (↓) на каждом элементе
  - Иконка `Download` из Lucide, справа в строке
  - Для вложений: прямая ссылка `<a href={url} download={name}>`
  - Для артефактов: fetch content из `/api/document?id=` → скачать как файл (расширение по kind)
  - `stopPropagation` на кнопке чтобы не тригерить scroll
- [x] Hover-эффекты по дизайн-системе
  - Карточки: `hover:bg-muted/60 transition-all duration-150`
  - Кнопка ↓: `opacity-0 group-hover:opacity-100` (появляется при наведении на строку)

**Файлы:**
- `components/chat-sidebar.tsx` — scroll + highlight + скачивание (убраны useArtifact, ImageLightbox, FileViewer)
- `components/message.tsx` — + `id="message-${message.id}"` на контейнер
- `app/globals.css` — + `sidebar-highlight` keyframes

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: клик по артефакту → чат проскроллился к сообщению + highlight
- [x] Браузер: клик по вложению → чат проскроллился к сообщению + highlight
- [x] Браузер: кнопка ↓ на артефакте → файл скачивается
- [x] Браузер: кнопка ↓ на вложении → файл скачивается
- [x] Браузер: hover по элементу → кнопка ↓ появляется плавно
- [x] Браузер: кнопка ↓ НЕ скроллит (stopPropagation)
- [x] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add components/chat-sidebar.tsx components/message.tsx app/globals.css
git commit -m "feat(tz-08): sidebar scroll-to-message navigation + download"
```

**Критерий готовности:** Все элементы кликабельны → scroll + highlight. Скачивание работает. Код стал проще — убраны лишние зависимости.

---

⛔ НЕ НАЧИНАТЬ Этап 3 без подтверждения Этапа 2

---

## Этап 3: Финализация

**Статус:** ✅ Завершён

**Цель:** Документация, версия, архив.

**Задачи:**
- [x] Финальное мануальное тестирование (пользователь) — 100%
- [x] Обновить главный `CHANGELOG.md`
- [x] Обновить `SIMPLY_STATUS.md`
- [x] Обновить `CLAUDE.md` (добавить ChatSidebar + RightSidebar в структуру кода)
- [x] Обновить `package.json` — версия `3.21.0`
- [x] Переместить папку: `mv specs/TZ_08_ChatSidebar/ _archive/`

**Дополнительно (сверх плана):**
- [x] Push-layout: правый сайдбар сдвигает контент (`md:mr-[380px]`)
- [x] Авто-закрытие: открытие правого → закрывает левый (и наоборот)
- [x] Fix: React setState error (вынос setLeftSidebarOpen из updater в useEffect)
- [x] Унификация: RightSidebar shell (bg-sidebar, Sheet mobile, sidebar-токены)
- [x] Design System обновлён (раздел 1.3 + sidebar-токены в раздел 2)

**Валидация:**
- [x] `npm run build` — успешен
- [x] Все функции работают в браузере
- [x] Документация актуальна

**Git (после валидации):**
```bash
git add CHANGELOG.md SIMPLY_STATUS.md CLAUDE.md package.json
git commit -m "chore(tz-08): finalize Chat Sidebar (v3.21.0)"
```

**Критерий готовности:** Документация обновлена, ТЗ в архиве, версия 3.21.0.
