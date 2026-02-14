# Roadmap ТЗ-DS: Simply Design System

**Создан:** 2026-02-13
**Версия проекта:** 3.18.0 → 3.19.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 5 |
| Текущий этап | 3 ✅ |
| Сессий (оценка) | 3-4 |

---

## Этап 1: Фундамент темы (шрифты + токены + SIMPLY_DESIGN_SYSTEM.md)

**Статус:** ✅ Завершён

**Цель:** Подключить новые шрифты, заменить все цветовые токены, создать файл-закон дизайн-системы.

**Задачи:**
- [x] 1.1 Создать `app/fonts.ts` — Lora, Source Sans 3, JetBrains Mono через `next/font/google`
- [x] 1.2 Обновить `app/layout.tsx` — импортировать шрифты, применить CSS-переменные на `<html>`
- [x] 1.3 Перезаписать цветовые токены в `globals.css` — light mode `:root`
- [x] 1.4 Перезаписать цветовые токены в `globals.css` — dark mode `.dark`
- [x] 1.5 Обновить `@theme` блок в `globals.css` — `--font-sans`, `--font-serif`, `--font-mono` + новые цвета (success, warning, info) + sidebar dark + тени
- [x] 1.6 Обновить `LIGHT_THEME_COLOR` / `DARK_THEME_COLOR` в `layout.tsx` — новые значения `#FAF9F5` / `#1C1B19`
- [x] 1.7 Заменить CodeMirror стили в `globals.css` — zinc/blue → семантические токены
- [x] 1.8 Заменить suggestion-highlight стили в `globals.css` — blue → primary/accent
- [x] 1.9 Удалить legacy CSS утилиты (`--foreground-rgb`, `--background-start-rgb`, `--background-end-rgb`)
- [x] 1.10 Обновить `--radius` → `0.625rem`
- [x] 1.11 Создать `SIMPLY_DESIGN_SYSTEM.md` в корне проекта (файл-закон)
- [x] 1.12 Обновить `CLAUDE.md` — добавить секцию "UI и дизайн" со ссылкой на дизайн-систему

**Файлы:**
- `app/fonts.ts` — новый
- `app/layout.tsx` — шрифты + theme-color
- `app/globals.css` — токены, @theme, CodeMirror, тени
- `SIMPLY_DESIGN_SYSTEM.md` — новый (корень проекта)
- `CLAUDE.md` — секция UI

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] `npm run dev` — сервер запускается
- [ ] Браузер: шрифты Lora и Source Sans 3 видны (DevTools → Computed → font-family)
- [ ] Браузер: фон `#FAF9F5` (тёплый крем), не белый
- [ ] Браузер: dark mode — фон `#1C1B19` (тёплый тёмный)
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add app/fonts.ts app/layout.tsx app/globals.css SIMPLY_DESIGN_SYSTEM.md CLAUDE.md
git commit -m "feat(tz-ds): phase 1 — design tokens, fonts, design system law"
```

**Критерий готовности:** Тема визуально изменилась — тёплые цвета, новые шрифты, dev server работает.

---

## Этап 2: Компоненты — globals.css стили + Auth + Toast

**Статус:** ✅ Завершён

**Цель:** Заменить хардкоженные цвета в CodeMirror-зависимых стилях globals.css (уже в Э1), auth страницах, toast, и мелких утилитах.

**Задачи:**
- [x] 2.1 `app/(auth)/login/page.tsx` — text-gray/dark:text-zinc → text-muted-foreground, text-foreground (3 замены)
- [x] 2.2 `app/(auth)/register/page.tsx` — text-gray/dark:text-zinc → text-muted-foreground, text-foreground (3 замены)
- [x] 2.3 `components/toast.tsx` — bg-zinc-100 → bg-muted, text-red/green → text-destructive/success, text-zinc-950 → text-foreground (3 замены)
- [x] 2.4 `components/weather.tsx` — to-slate-900 → to-indigo-950 (1 замена; остальные — тематические градиенты виджета погоды)
- [x] 2.5 `components/file-viewer/utils.ts` — text-gray-500 → text-muted-foreground (1 замена)

**Файлы:**
- `app/(auth)/login/page.tsx`
- `app/(auth)/register/page.tsx`
- `components/toast.tsx`
- `components/weather.tsx`
- `file-viewer/utils.ts` (или `components/file-viewer/utils.ts`)

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] Браузер: страница логина — корректные цвета light/dark
- [ ] Браузер: страница регистрации — корректные цвета light/dark
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add [файлы]
git commit -m "feat(tz-ds): phase 2 — auth, toast, weather tokens"
```

**Критерий готовности:** Auth-страницы и утилиты используют семантические токены.

---

## Этап 3: Компоненты — Sidebar + Glavnaya + Input

**Статус:** ✅ Завершён

**Цель:** Унифицировать sidebar, главную страницу, систему инпутов.

**Задачи:**
- [x] 3.1 `components/sidebar-user-nav.tsx` — bg-zinc-500/30 → bg-muted (2), text-zinc-500 → text-muted-foreground (1)
- [x] 3.2 `components/sidebar-layout.tsx` — проверено, чисто (только обёртки)
- [x] 3.3 `components/glavnaya/glavnaya-header.tsx` — bg-zinc-500/30 → bg-muted (1)
- [x] 3.4 `components/glavnaya/` — проверены все карточки, чисто (уже на токенах)
- [x] 3.5 `components/input/` — проверена вся система, чисто (уже на токенах)
- [x] 3.6 Применить `font-serif` к h1 в `glavnaya-greeting.tsx`

**Файлы:**
- `components/sidebar-user-nav.tsx`
- `components/sidebar-layout.tsx`
- `components/glavnaya/glavnaya-header.tsx`
- `components/glavnaya/*.tsx` — аудит
- `components/input/*.tsx` — аудит

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] Браузер: sidebar — корректные цвета, шрифты
- [ ] Браузер: Glavnaya — тёплый фон, Lora в заголовках
- [ ] Браузер: dark mode — всё корректно
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add [файлы]
git commit -m "feat(tz-ds): phase 3 — sidebar, glavnaya, input tokens"
```

**Критерий готовности:** Sidebar и Glavnaya визуально единые, font-serif применён к заголовкам.

---

## Этап 4: Компоненты — Chat + Projects + Артефакты + Модалки

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 3

**Цель:** Заменить все оставшиеся хардкоды в чат-компонентах, проектах, артефактах, модалках.

**Задачи:**
- [ ] 4.1 `components/markdown-viewer.tsx` — text-gray → text-muted-foreground (1 замена)
- [ ] 4.2 `components/suggestion.tsx` — text-gray → text-muted-foreground (1 замена)
- [ ] 4.3 `components/artifact-actions.tsx` — bg-white/bg-zinc → bg-card (1 замена)
- [ ] 4.4 `components/artifact.tsx` — border-gray/bg-white → border-border/bg-card (1 замена)
- [ ] 4.5 `components/artifact-close-button.tsx` — bg-white → bg-card (1 замена)
- [ ] 4.6 `components/console.tsx` — bg-zinc, text-gray → токены (3 замены)
- [ ] 4.7 `components/document-preview.tsx` — bg-white, text-gray → токены (3 замены)
- [ ] 4.8 `components/image-lightbox.tsx` — bg-black/bg-white → bg-background/bg-card (1 замена)
- [ ] 4.9 `artifacts/presentation-pptx/client.tsx` — bg-white, text-gray → токены (3 замены)
- [ ] 4.10 `components/projects/` — аудит на хардкоды, font-serif для заголовков секций
- [ ] 4.11 `components/service-chat/` — аудит на хардкоды
- [ ] 4.12 Финальный grep-проверка: 0 хардкоженных цветов во всём проекте

**Файлы:**
- `components/markdown-viewer.tsx`
- `components/suggestion.tsx`
- `components/artifact-actions.tsx`
- `components/artifact.tsx`
- `components/artifact-close-button.tsx`
- `components/console.tsx`
- `components/document-preview.tsx`
- `components/image-lightbox.tsx`
- `artifacts/presentation-pptx/client.tsx`
- `components/projects/*.tsx` — аудит
- `components/service-chat/*.tsx` — аудит

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] `grep -rn "bg-gray\|text-gray\|border-gray\|bg-slate\|bg-zinc\|bg-stone\|bg-neutral\|bg-white\|text-black" --include="*.tsx" --include="*.ts"` → **0 результатов**
- [ ] Браузер: артефакты — корректные цвета light/dark
- [ ] Браузер: чат — корректные цвета
- [ ] Браузер: проекты — font-serif в заголовках секций
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add [файлы]
git commit -m "feat(tz-ds): phase 4 — chat, projects, artifacts, modals tokens"
```

**Критерий готовности:** Grep по хардкодам = 0 результатов. Все компоненты на семантических токенах.

---

## Этап 5: Финализация

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 4

**Задачи:**
- [ ] 5.1 Удалить пакет `geist` из `package.json` + `npm install`
- [ ] 5.2 Финальный `npm run build`
- [ ] 5.3 Финальное мануальное тестирование (пользователь): все страницы light + dark
- [ ] 5.4 Обновить главный `CHANGELOG.md`
- [ ] 5.5 Обновить `SIMPLY_STATUS.md`
- [ ] 5.6 Обновить `package.json` (версия 3.19.0)
- [ ] 5.7 Переместить папку в `_archive/`

**Валидация:**
- [ ] `npm run build` — успешен
- [ ] Grep хардкодов — 0
- [ ] Light mode + Dark mode — визуально единый стиль
- [ ] Кириллица — корректна во всех весах
- [ ] Документация актуальна
- [ ] 🧪 Финальный мануальный тест

**Git (после валидации):**
```bash
git add .
git commit -m "feat(tz-ds): finalize v3.19.0 — Simply Design System"
```

**Критерий готовности:** Production build проходит, визуал единый, документация обновлена.
