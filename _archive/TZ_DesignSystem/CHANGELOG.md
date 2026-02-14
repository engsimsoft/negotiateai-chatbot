# Changelog ТЗ-DS: Simply Design System

## Сессия 4 — 2026-02-14

### Этап 3 — Sidebar + Glavnaya + Input (коммит `1b0af54`)
- `sidebar-user-nav.tsx` — bg-zinc-500/30 → bg-muted (2), text-zinc-500 → text-muted-foreground (1)
- `glavnaya-header.tsx` — bg-zinc-500/30 → bg-muted (1)
- `glavnaya-greeting.tsx` — добавлен font-serif к h1

### Этап 4 — Chat + Projects + Артефакты + Модалки
- `markdown-viewer.tsx` — prose-pre:bg-zinc → prose-pre:bg-muted/text-foreground
- `suggestion.tsx` — text-gray-500 → text-muted-foreground
- `artifact-actions.tsx` — dark:hover:bg-zinc-700 → dark:hover:bg-accent
- `artifact.tsx` — bg-zinc-900/50 → bg-black/50, border-zinc → border-border
- `artifact-close-button.tsx` — dark:hover:bg-zinc-700 → dark:hover:bg-accent
- `console.tsx` — 6 замен: bg-zinc/border-zinc/text-zinc → bg-muted/border-border/text-foreground
- `document-preview.tsx` — 4 замены: dark:border-zinc/dark:bg-zinc → dark:bg-accent
- `presentation-pptx/client.tsx` — bg-neutral → bg-muted, bg-white → bg-background
- `document.tsx` — text-zinc-500 → text-muted-foreground
- `sidebar-history.tsx` — text-zinc-500/400 → text-muted-foreground (4 замены)
- `auth-form.tsx` — text-zinc-600/400 → text-muted-foreground (2 замены)
- `image-lightbox.tsx` — оставлено (bg-black/80, text-white — оверлеи)
- `components/projects/` — аудит: только статусные цвета (намеренные)
- `components/service-chat/` — аудит: чисто
- Финальный grep: 0 хардкодов (gray/zinc/slate/stone/neutral)

### Files
- components/markdown-viewer.tsx
- components/suggestion.tsx
- components/artifact-actions.tsx
- components/artifact.tsx
- components/artifact-close-button.tsx
- components/console.tsx
- components/document-preview.tsx
- components/document.tsx
- components/sidebar-history.tsx
- components/auth-form.tsx
- artifacts/presentation-pptx/client.tsx
- specs/TZ_DesignSystem/ROADMAP.md
- specs/TZ_DesignSystem/CHANGELOG.md
- specs/TZ_DesignSystem/HANDOFF.md

---

## Сессия 3 — 2026-02-14

### Changed
- Коммит `76c0695` — все изменения Сессии 2 закоммичены (16 файлов: токены, auth fix, миграция, docs)

### Аудит Этапа 3 (чтение, без изменений кода)
- Прочитаны 15 файлов: sidebar (2), glavnaya (7), input (6)
- Найдены 4 хардкода в 2 файлах (`sidebar-user-nav.tsx`, `glavnaya-header.tsx`)
- 13 файлов чистые — уже на семантических токенах
- Тематические цвета (amber, sky, red) — намеренные, оставить

### Files
- specs/TZ_DesignSystem/HANDOFF.md
- specs/TZ_DesignSystem/CHANGELOG.md

---

## Сессия 2 — 2026-02-14

### Changed (Design Tokens — Этап 2)
- `app/(auth)/login/page.tsx` — text-gray/dark:text-zinc → text-muted-foreground, text-foreground
- `app/(auth)/register/page.tsx` — аналогично login
- `components/toast.tsx` — bg-zinc-100 → bg-muted, text-red/green → text-destructive/success, text-zinc-950 → text-foreground
- `components/weather.tsx` — to-slate-900 → to-indigo-950
- `components/file-viewer/utils.ts` — text-gray-500 → text-muted-foreground
- `components/projects/project-card.tsx` — hover:bg-muted/50 → hover:border-primary hover:shadow-sm (унификация с helpers)

### Fixed (Auth — критический баг)
- `lib/db/schema.ts` — добавлен `.unique()` на email
- `lib/db/queries.ts` — `email.toLowerCase()` в getUser и createUser
- `app/(auth)/auth.ts` — `String(email).toLowerCase()` в authorize
- `app/(dashboard)/dashboard/page.tsx` — защита от призрачной сессии (удалённый user → сброс cookie → /login)
- Миграция `0028_parallel_the_spike.sql` — UNIQUE constraint на email
- Очистка БД: 2 дубликата удалены, данные мерджнуты

### Files
- app/(auth)/login/page.tsx
- app/(auth)/register/page.tsx
- app/(auth)/auth.ts
- app/(dashboard)/dashboard/page.tsx
- components/toast.tsx
- components/weather.tsx
- components/file-viewer/utils.ts
- components/projects/project-card.tsx
- lib/db/schema.ts
- lib/db/queries.ts
- lib/db/migrations/0028_parallel_the_spike.sql

---

## Сессия 1 — 2026-02-13

### Added
- `app/fonts.ts` — Lora, Source Sans 3, JetBrains Mono (next/font/google)
- `SIMPLY_DESIGN_SYSTEM.md` — файл-закон дизайн-системы в корне проекта
- Секция "UI и дизайн" в `CLAUDE.md`
- Токены success, warning, info в globals.css + @theme
- Тёплые тени shadow-sm, shadow-md, shadow-lg, shadow-card

### Changed
- `app/globals.css` — полная перезапись: тёплая палитра light/dark, @theme, radius 0.625rem
- `app/layout.tsx` — шрифты на `<html>`, theme-color, lang="ru"
- CodeMirror стили: zinc/blue → bg-muted/bg-accent
- Suggestion-highlight: blue → primary
- `components/glavnaya/glavnaya-header.tsx` — убран font-bold, добавлен font-semibold

### Removed
- Legacy CSS утилиты (--foreground-rgb, --background-start-rgb, --background-end-rgb)
- Ссылки на --font-geist в @theme

### Files
- app/fonts.ts (new)
- app/globals.css
- app/layout.tsx
- SIMPLY_DESIGN_SYSTEM.md (new)
- CLAUDE.md
- components/app-sidebar.tsx
- components/glavnaya/glavnaya-header.tsx
