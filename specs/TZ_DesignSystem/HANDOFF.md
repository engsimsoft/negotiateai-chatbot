# Передача сессии ТЗ-DS: Simply Design System

**Дата:** 2026-02-14
**Сессия:** 3 → 4

## Статус этапов
- [x] Этап 1: Фундамент темы ✅ (коммит `67f9f41`)
- [x] Этап 2: Auth + Toast + мелкие утилиты ✅ (коммит `76c0695`)
- [ ] Этап 3: Sidebar + Glavnaya + Input ← ТЕКУЩИЙ (аудит завершён, замены не начаты)
- [ ] Этап 4: Chat + Projects + Артефакты + Модалки
- [ ] Этап 5: Финализация

## Следующая сессия: начни с
1. Прочитать ROADMAP.md → Этап 3
2. Сделать замены по результатам аудита (см. ниже)
3. Применить `font-serif` к h1 заголовкам страниц где уместно
4. `npx tsc --noEmit` + `npm run build` → коммит Этапа 3
5. Запросить мануальный тест

## Что сделано в сессии 3

### Коммит Этапа 2 + Auth Fix
- Закоммичены все изменения Сессии 2: коммит `76c0695`
- 16 файлов: токены auth/toast/weather/file-viewer, hover карточек, auth fix (UNIQUE + toLowerCase + ghost session), миграция, docs

### Аудит файлов Этапа 3 (15 файлов прочитаны)
Полный аудит всех файлов Этапа 3. Код НЕ менялся, только чтение и анализ.

**Найдены хардкоды (4 шт в 2 файлах):**

| Файл | Строка | Было | Нужно | Контекст |
|------|--------|------|-------|----------|
| `sidebar-user-nav.tsx` | 63 | `bg-zinc-500/30` | `bg-muted` | Loading skeleton — круг аватара |
| `sidebar-user-nav.tsx` | 65 | `bg-zinc-500/30` | `bg-muted` | Loading skeleton — текст "Загрузка..." |
| `sidebar-user-nav.tsx` | 70 | `text-zinc-500` | `text-muted-foreground` | Loading spinner |
| `glavnaya-header.tsx` | 77 | `bg-zinc-500/30` | `bg-muted` | Loading skeleton — круг аватара |

**Чистые файлы (хардкодов нет):**
- `sidebar-layout.tsx` ✅ — только обёртки SidebarProvider/AppSidebar
- `glavnaya-greeting.tsx` ✅ — уже text-muted-foreground
- `section-title.tsx` ✅ — уже text-muted-foreground, bg-muted
- `tools-section.tsx` ✅ — уже bg-muted, hover:border-primary
- `projects-section.tsx` ✅ — уже bg-muted, hover:border-primary
- `glavnaya-input.tsx` ✅ — обёртка над CompactInput
- `chat-history-card.tsx` ✅ — уже text-foreground, text-muted-foreground
- `input-base.tsx` ✅ — уже bg-muted, border-border
- `input-textarea.tsx` ✅ — уже text-muted-foreground
- `compact-input.tsx` ✅ — обёртка
- `input-model-selector.tsx` ✅ — уже text-muted-foreground, bg-accent
- `input-voice-button.tsx` ✅ — text-red-500 для записи (НАМЕРЕННЫЙ семантический цвет)
- `input-attachments.tsx` ✅ — уже text-muted-foreground, hover:bg-accent
- `input-submit-button.tsx` ✅ — уже bg-foreground, bg-muted

**Тематические цвета (оставить как есть):**
- `helpers-section.tsx` — amber для кастомных помощников, sky для Конструктора (намеренные тематические)
- `input-voice-button.tsx` — red для индикатора записи (намеренный семантический)

### Задача 3.6: font-serif для h1
- `glavnaya-greeting.tsx:15` — `<h1>` приветствие, сейчас без font-serif → добавить
- Другие h1/h2 — проверить при работе

## Ключевые решения (из предыдущих сессий)
- **Tailwind v4:** тема в `@theme` блоках globals.css, НЕТ tailwind.config.ts
- **Шрифты:** `--font-source-sans`, `--font-lora`, `--font-jetbrains` → маппинг в @theme на `--font-sans`, `--font-serif`, `--font-mono`
- **Geist** → удалить пакет из package.json в Этапе 5
- **Lora** — только h1/h2 (страницы и секции), НЕ для логотипа "Simply"
- **"Simply" логотип** — чистый sans-serif без цвета (как "Claude" у Anthropic)
- **shadcn/ui** тоже переводим на токены, исключений нет
- **Hover карточек** — единый стиль: `hover:border-primary hover:shadow-sm transition-all`
- **Ветка:** `feature/design-system`

## Замечания / Баги (backlog)
- Иконки/бейджи помощников на Glavnaya — хочет тёплые терракотовые акценты (как спаркл у Anthropic). Учесть в Этапе 3 или 4.
- **Артефакт боковой панели** при загрузке (sidebar видна до рендера основного контента) — исправить после завершения дорожной карты.

## Uncommitted файлы
- `specs/TZ_DesignSystem/HANDOFF.md` — этот файл
- `specs/TZ_DesignSystem/CHANGELOG.md` — обновлён для Сессии 3

## Блокеры / Вопросы
- Нет
