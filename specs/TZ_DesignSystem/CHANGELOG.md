# Changelog ТЗ-DS: Simply Design System

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
