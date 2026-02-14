# Передача сессии ТЗ-DS: Simply Design System

**Дата:** 2026-02-14
**Сессия:** 4 → 5

## Статус этапов
- [x] Этап 1: Фундамент темы ✅ (коммит `67f9f41`)
- [x] Этап 2: Auth + Toast + мелкие утилиты ✅ (коммит `76c0695`)
- [x] Этап 3: Sidebar + Glavnaya + Input ✅ (коммит `1b0af54`)
- [x] Этап 4: Chat + Projects + Артефакты + Модалки ✅ (ожидает коммит)
- [ ] Этап 5: Финализация ← СЛЕДУЮЩИЙ

## Следующая сессия: Этап 5 (Финализация)
1. Удалить пакет `geist` из `package.json` + `npm install`
2. Финальный `npm run build`
3. Финальное мануальное тестирование: все страницы light + dark
4. Обновить главный `CHANGELOG.md`
5. Обновить `SIMPLY_STATUS.md`
6. Обновить `package.json` (версия 3.19.0)
7. Переместить папку в `_archive/`

## Что сделано в сессии 4

### Этап 3 — коммит `1b0af54`
- 4 замены хардкодов в sidebar-user-nav.tsx и glavnaya-header.tsx
- font-serif добавлен к h1 в glavnaya-greeting.tsx
- Мануальный тест пройден ✅

### Этап 4 — замена хардкодов (24+ замены в 11 файлах)
- `markdown-viewer.tsx` — prose-pre zinc → muted/foreground
- `suggestion.tsx` — text-gray-500 → text-muted-foreground
- `artifact-actions.tsx` — dark:hover zinc → accent
- `artifact.tsx` — overlay zinc → black/50, border zinc → border-border
- `artifact-close-button.tsx` — dark:hover zinc → accent
- `console.tsx` — 6 замен: все zinc → semantic tokens
- `document-preview.tsx` — 4 замены: dark zinc → accent
- `presentation-pptx/client.tsx` — neutral → muted, white → background
- `document.tsx` — text-zinc-500 → text-muted-foreground
- `sidebar-history.tsx` — 4 замены text-zinc → text-muted-foreground
- `auth-form.tsx` — 2 замены text-zinc → text-muted-foreground

### Аудиты
- `components/projects/` — все хардкоды = статусные цвета (green/blue/amber/red/purple), намеренные
- `components/service-chat/` — чисто, уже на семантических токенах
- `image-lightbox.tsx` — bg-black/80, text-white — намеренные оверлеи lightbox

### Валидация
- `npx tsc --noEmit` — 0 ошибок ✅
- `npm run build` — успешен ✅
- Финальный grep по хардкодам — 0 результатов ✅

## Ключевые решения (из предыдущих сессий)
- **Tailwind v4:** тема в `@theme` блоках globals.css, НЕТ tailwind.config.ts
- **Шрифты:** `--font-source-sans`, `--font-lora`, `--font-jetbrains` → маппинг в @theme на `--font-sans`, `--font-serif`, `--font-mono`
- **Geist** → удалить пакет из package.json в Этапе 5
- **Lora** — только h1/h2 (страницы и секции), НЕ для логотипа "Simply"
- **"Simply" логотип** — чистый sans-serif без цвета (как "Claude" у Anthropic)
- **shadcn/ui** тоже переводим на токены, исключений нет
- **Hover карточек** — единый стиль: `hover:border-primary hover:shadow-sm transition-all`
- **Ветка:** `feature/design-system`
- **Статусные цвета в projects/** — green/blue/amber/red/purple оставлены намеренно (UX-дифференциация)

## Замечания / Баги (backlog)
- Иконки/бейджи помощников на Glavnaya — хочет тёплые терракотовые акценты (как спаркл у Anthropic). После завершения ТЗ-DS.
- **Артефакт боковой панели** при загрузке (sidebar видна до рендера основного контента) — исправить после завершения дорожной карты.

## Блокеры / Вопросы
- Нет
