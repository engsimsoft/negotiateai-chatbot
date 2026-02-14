# Передача сессии ТЗ-DS: Simply Design System

**Дата:** 2026-02-14
**Сессия:** 2 → 3

## Статус этапов
- [x] Этап 1: Фундамент темы ✅ (коммит `67f9f41`)
- [x] Этап 2: Auth + Toast + мелкие утилиты ✅ (tsc + build ОК, ожидает коммит)
- [ ] Этап 3: Sidebar + Glavnaya + Input ← СЛЕДУЮЩИЙ
- [ ] Этап 4: Chat + Projects + Артефакты + Модалки
- [ ] Этап 5: Финализация

## Следующая сессия: начни с
1. Сделать коммит Этапа 2 + auth-fix (все изменения в uncommitted state)
2. Прочитать ROADMAP.md → Этап 3
3. Sidebar: `sidebar-user-nav.tsx` (2 замены), `sidebar-layout.tsx` (аудит)
4. Glavnaya: `glavnaya-header.tsx` (1 замена), все карточки (аудит)
5. Input: `components/input/*.tsx` (аудит)
6. Применить `font-serif` к h1 заголовкам страниц где уместно

## Что сделано в сессии 2

### Этап 2 — Замена хардкодов (11 замен в 5 файлах)
- `app/(auth)/login/page.tsx` — text-gray/dark:text-zinc → text-muted-foreground, text-foreground (3)
- `app/(auth)/register/page.tsx` — аналогично (3)
- `components/toast.tsx` — bg-zinc-100 → bg-muted, text-red/green → text-destructive/success, text-zinc-950 → text-foreground (3)
- `components/weather.tsx` — to-slate-900 → to-indigo-950 (1)
- `components/file-viewer/utils.ts` — text-gray-500 → text-muted-foreground (1)

### Унификация hover карточек на Glavnaya
- `components/projects/project-card.tsx` — hover:bg-muted/50 → hover:border-primary hover:shadow-sm (как у помощников)

### Фикс Auth — дубликаты пользователей (критический баг)
**Проблема:** регистрация создавала дубликаты с тем же email (нет UNIQUE constraint).
**Решение (3 уровня защиты):**
- `lib/db/schema.ts` — `.unique()` на email + миграция `0028_parallel_the_spike.sql`
- `lib/db/queries.ts` — `email.toLowerCase()` в getUser и createUser
- `app/(auth)/auth.ts` — `String(email).toLowerCase()` в authorize
- Очистка: 2 дубликата удалены, данные мерджнуты в основные аккаунты
- `app/(dashboard)/dashboard/page.tsx` — защита от «призрачной сессии» (удалённый user → сброс cookie → /login)

### Валидация
- `npx tsc --noEmit` — 0 ошибок ✅
- `npm run build` — успешен ✅
- Мануальный тест: логин/регистрация работает, главная загружается ✅

## Ключевые решения
- **Tailwind v4:** тема в `@theme` блоках globals.css, НЕТ tailwind.config.ts
- **Шрифты:** next/font переменные `--font-source-sans`, `--font-lora`, `--font-jetbrains` → маппинг в @theme на `--font-sans`, `--font-serif`, `--font-mono`
- **Geist** → удалить пакет из package.json в Этапе 5
- **Lora** — только h1/h2 (страницы и секции), НЕ для логотипа "Simply"
- **"Simply" логотип** — чистый sans-serif без цвета (как "Claude" у Anthropic). Сдержанность = элегантность
- **shadcn/ui** тоже переводим на токены, исключений нет
- **Hover карточек** — единый стиль: `hover:border-primary hover:shadow-sm transition-all`
- **Ветка:** `feature/design-system`

## Замечания / Баги (backlog)
- Иконки/бейджи помощников на Glavnaya — хочет тёплые терракотовые акценты (как спаркл у Anthropic). Учесть в Этапе 3.
- **Артефакт боковой панели** при загрузке (sidebar видна до рендера основного контента) — исправить после завершения дорожной карты.

## Аудит хардкодов (28 шт в 15 файлах)
Полный список — см. ANALYSIS.md → "Файлы с хардкодами"
Этап 2 закрыл 5 файлов. Осталось ~10 файлов (Этапы 3 + 4).

## Uncommitted файлы (нужен коммит в начале след. сессии)
- `app/(auth)/login/page.tsx` — токены
- `app/(auth)/register/page.tsx` — токены
- `app/(auth)/auth.ts` — email.toLowerCase()
- `app/(dashboard)/dashboard/page.tsx` — защита от призрачной сессии
- `components/toast.tsx` — токены
- `components/weather.tsx` — to-indigo-950
- `components/file-viewer/utils.ts` — text-muted-foreground
- `components/projects/project-card.tsx` — hover:border-primary
- `lib/db/schema.ts` — email .unique()
- `lib/db/queries.ts` — email.toLowerCase()
- `lib/db/migrations/0028_parallel_the_spike.sql` — UNIQUE constraint
- `specs/TZ_DesignSystem/` — ROADMAP, CHANGELOG, HANDOFF

## Блокеры / Вопросы
- Нет
