# Анализ ТЗ-DS: Simply Design System

## Резюме

Полная перезапись визуальной темы Simply: шрифты (Lora + Source Sans 3 + JetBrains Mono), цветовые токены (тёплая палитра вместо холодной shadcn), тени, радиусы. Затем проход по всем компонентам для замены хардкоженных цветов на семантические токены. Финал — файл-закон `SIMPLY_DESIGN_SYSTEM.md`.

## Аудит кодовой базы

### Текущее состояние шрифтов
- Пакет `geist` v1.3.1 в `package.json`, но **нигде не импортирован** в коде
- `globals.css` ссылается на `--font-geist` и `--font-geist-mono` — вероятно, system fallback
- Нет файла `fonts.ts` — нужно создать с нуля
- `layout.tsx` уже использует `className="font-sans antialiased"` — подключение через CSS-переменные подойдёт

### Текущее состояние цветов
- **28 хардкоженных цветов** в 15 `.tsx` файлах (bg-gray, text-gray, bg-white, bg-zinc и т.д.)
- **1 хардкод** в `.ts` файлах (`file-viewer/utils.ts`)
- **0 хардкодов** в `components/ui/` — shadcn базовые компоненты уже чистые
- `globals.css` — CodeMirror стили с `bg-zinc-800`, `bg-zinc-200`, `bg-zinc-900`
- `globals.css` — suggestion-highlight с `bg-blue-200`, `bg-blue-300` и т.д.

### Tailwind v4
- **Нет `tailwind.config.ts`** — проект на Tailwind CSS v4
- Тема определена через `@theme` блоки в `globals.css`
- Добавление шрифтов через `--font-serif: var(--font-lora)` в `@theme` блоке
- Добавление кастомных цветов (success, warning, info) через `@theme`

### Файлы с хардкодами (полный список)
| Файл | Кол-во | Что |
|------|--------|-----|
| `app/(auth)/login/page.tsx` | 3 | bg-white, text-gray |
| `app/(auth)/register/page.tsx` | 3 | bg-white, text-gray |
| `components/artifact-actions.tsx` | 1 | bg-zinc/bg-white |
| `components/artifact.tsx` | 1 | border-gray/bg-white |
| `components/artifact-close-button.tsx` | 1 | bg-white |
| `components/console.tsx` | 3 | bg-zinc, text-gray |
| `components/document-preview.tsx` | 3 | bg-white, text-gray |
| `components/glavnaya/glavnaya-header.tsx` | 1 | text-gray |
| `components/image-lightbox.tsx` | 1 | bg-black/bg-white |
| `components/markdown-viewer.tsx` | 1 | text-gray |
| `components/sidebar-user-nav.tsx` | 2 | text-gray |
| `components/suggestion.tsx` | 1 | text-gray |
| `components/toast.tsx` | 1 | bg-white |
| `components/weather.tsx` | 3 | text-gray, bg-white |
| `artifacts/presentation-pptx/client.tsx` | 3 | bg-white, text-gray |
| `file-viewer/utils.ts` | 1 | hex color |
| `globals.css` | ~8 | zinc, blue в CodeMirror и suggestion стилях |

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.

### ✅ Согласен с ТЗ
- Шрифты (Lora, Source Sans 3, JetBrains Mono) — отличный выбор, подключение через `next/font/google` стандартное
- Цветовая палитра light/dark — полная, покрывает все токены shadcn + новые (success, warning, info)
- Радиусы и тени — согласен
- Порядок Фазы 1 — согласен

### ⚠️ Технические особенности
| # | Тема | Деталь |
|---|------|--------|
| 1 | Tailwind v4 | Нет `tailwind.config.ts`. Шрифты и новые цвета добавляются в `@theme` блок в `globals.css`, не в отдельный конфиг |
| 2 | Пакет `geist` | Нужно удалить из `package.json` после перехода на Source Sans 3 |
| 3 | `--font-sans` | В `@theme` блоке заменить `var(--font-geist)` → `var(--font-source-sans-3)` |
| 4 | Новые токены | `success`, `warning`, `info` — нужно добавить в `@theme` блок для Tailwind |
| 5 | CodeMirror стили | В `globals.css` есть zinc/blue хардкоды в `.cm-editor` и `.suggestion-highlight` — заменим |
| 6 | `LIGHT_THEME_COLOR` / `DARK_THEME_COLOR` | В `layout.tsx` хардкоженные HSL для meta theme-color — обновить на новые значения |

### ❓ Решено с архитектором
- Source Sans 3 вместо Inter — **да**, spacing подкрутим по месту в Фазе 2
- Lora — **только** h1 и h2 (страницы и секции), всё остальное sans
- shadcn/ui — **тоже** переводим на токены, исключений нет
- `SIMPLY_DESIGN_SYSTEM.md` — создаём **в Фазе 1** (закон для Фазы 2)
- Порядок Фазы 2 — обновлён (shadcn → sidebar → glavnaya → chat → projects → модалки)

## Потенциальные риски
- **Spacing drift** — Source Sans 3 визуально крупнее Inter/Geist, потребуется подгонка padding/gap
- **CodeMirror** — тёмная тема артефактов может потребовать тонкой настройки
- **Presentation PPTX** — хардкоды в артефакте презентаций могут быть намеренными (для экспорта)

## Оценка сложности
- [x] Среднее (3-5 сессий)
