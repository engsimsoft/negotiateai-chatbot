# ТЗ-DS: Simply Design System — «Тёплый интеллект»

> **Философия:** Вдохновлено Anthropic — тепло, человечность, надёжность. Не копия, а собственный путь с теми же ценностями.

---

## Зачем

1. **Разнобой в UI** — компоненты из разных этапов выглядят по-разному. Нет единой визуальной системы.
2. **Идентичность** — Simply должен выглядеть как продукт, а не как прототип. Аудитория 40-60+ ценит стабильность и профессионализм.
3. **Скорость разработки** — единая тема = Claude Code не принимает дизайн-решения, а следует токенам.

---

## Что делаем

### Фаза 1: Design Tokens + Шрифты
### Фаза 2: Применение ко всем компонентам

**Одно ТЗ, две фазы.** Фаза 1 — фундамент. Фаза 2 — проход по всем экранам.

---

## Фаза 1: Фундамент темы

### 1.1 Шрифты (Google Fonts, кириллица)

**Выбор и обоснование:**

| Роль | Шрифт | Почему |
|------|-------|--------|
| **Заголовки** | **Lora** (serif) | Элегантный serif с отличной кириллицей. Аналог Copernicus — "книжный", серьёзный. Подчёркивает интеллект. |
| **UI / Body** | **Inter** → **Source Sans 3** | Source Sans 3 — humanist sans-serif от Adobe (open source). Мягче Inter, теплее. Отличная кириллица во всех весах. |
| **Mono (код)** | **JetBrains Mono** | Стандарт для кода, отличная кириллица. |

> **Почему НЕ Poppins?** Poppins — geometric sans-serif, слишком "круглый" и молодёжный. Source Sans 3 ближе к Styrene по характеру: humanist, тёплый, но профессиональный. Для аудитории 40-60+ — идеален.

**Подключение через `next/font/google`:**
```typescript
// app/fonts.ts
import { Lora, Source_Sans_3, JetBrains_Mono } from 'next/font/google';

export const fontSerif = Lora({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-serif',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const fontSans = Source_Sans_3({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});

export const fontMono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500'],
});
```

### 1.2 Цветовая палитра Simply

> Вдохновлено палитрой Anthropic, адаптировано под собственную идентичность.

#### Light Mode

| Токен | Hex | Описание |
|-------|-----|----------|
| `--background` | `#FAF9F5` | Тёплый крем (вместо стерильного белого) |
| `--foreground` | `#1A1A18` | Почти чёрный с теплотой |
| `--card` | `#FFFFFF` | Карточки, инпуты |
| `--card-foreground` | `#1A1A18` | Текст на карточках |
| `--muted` | `#F0EEE6` | Фон второстепенных элементов |
| `--muted-foreground` | `#6B6965` | Вторичный текст |
| `--border` | `#E5E3DA` | Границы (тёплый серый) |
| `--input` | `#E5E3DA` | Границы инпутов |
| `--ring` | `#C97B5D` | Фокус-кольцо (терракот) |
| `--primary` | `#C97B5D` | Главный акцент — тёплый терракот |
| `--primary-foreground` | `#FFFFFF` | Текст на primary |
| `--secondary` | `#E8E6DC` | Вторичные кнопки, теги |
| `--secondary-foreground` | `#3D3D3A` | Текст на secondary |
| `--accent` | `#F0EEE6` | Hover-состояния |
| `--accent-foreground` | `#1A1A18` | Текст на accent |
| `--destructive` | `#D64545` | Ошибки, удаление |
| `--destructive-foreground` | `#FFFFFF` | Текст на destructive |
| `--success` | `#6B8F4E` | Успех, завершение (зелёный Anthropic) |
| `--warning` | `#D4A843` | Предупреждения |
| `--info` | `#5B8FB0` | Информационные (голубой Anthropic) |

#### Dark Mode

| Токен | Hex | Описание |
|-------|-----|----------|
| `--background` | `#1C1B19` | Тёплый тёмный (не чистый чёрный) |
| `--foreground` | `#EDECE8` | Мягкий белый |
| `--card` | `#252420` | Карточки |
| `--card-foreground` | `#EDECE8` | Текст на карточках |
| `--muted` | `#2D2C28` | Фон второстепенных |
| `--muted-foreground` | `#9B9890` | Вторичный текст |
| `--border` | `#3A3935` | Границы |
| `--input` | `#3A3935` | Инпуты |
| `--ring` | `#D4885F` | Фокус (ярче для тёмного) |
| `--primary` | `#D4885F` | Терракот (чуть ярче) |
| `--primary-foreground` | `#1C1B19` | Текст на primary |
| `--secondary` | `#33322E` | Вторичные |
| `--secondary-foreground` | `#EDECE8` | Текст |
| `--accent` | `#2D2C28` | Hover |
| `--accent-foreground` | `#EDECE8` | Текст |
| `--destructive` | `#E05555` | Ошибки |
| `--success` | `#7BA358` | Успех |
| `--warning` | `#E0B84A` | Предупреждения |
| `--info` | `#6BA0C4` | Информация |

#### Дополнительные токены (Sidebar, Chart)

```css
/* Sidebar — чуть темнее основного фона */
--sidebar-background: #F5F3ED;  /* light */
--sidebar-background: #1A1917;  /* dark */
--sidebar-foreground: #3D3D3A;
--sidebar-accent: #E8E6DC;
--sidebar-accent-foreground: #1A1A18;
--sidebar-border: #E5E3DA;
--sidebar-ring: #C97B5D;

/* Charts — 5 цветов, гармоничная палитра */
--chart-1: #C97B5D;  /* терракот */
--chart-2: #5B8FB0;  /* голубой */
--chart-3: #6B8F4E;  /* зелёный */
--chart-4: #D4A843;  /* золотой */
--chart-5: #8B7BB0;  /* лавандовый */
```

### 1.3 Радиусы и тени

```css
/* Радиусы — мягкие, не агрессивные */
--radius: 0.625rem;  /* 10px — основной (shadcn default 0.5rem) */

/* Тени — тёплые, как у Anthropic */
--shadow-sm: 0 1px 2px rgba(26, 26, 24, 0.04);
--shadow-md: 0 4px 12px rgba(26, 26, 24, 0.06);
--shadow-lg: 0 8px 24px rgba(26, 26, 24, 0.08);
--shadow-card: 0 1px 3px rgba(26, 26, 24, 0.04), 0 1px 2px rgba(26, 26, 24, 0.02);
```

### 1.4 Файл `globals.css` — полная перезапись темы

Claude Code должен:
1. **Заменить** текущие CSS-переменные в `globals.css` на токены выше
2. **Подключить** шрифты через `next/font` в `layout.tsx`
3. **Обновить** `tailwind.config.ts` — добавить `fontFamily` с CSS-переменными
4. **Убрать** все хардкоженные цвета в компонентах (искать по hex и Tailwind classes)

---

## Фаза 2: Унификация компонентов

### 2.1 Принципы

- **Все цвета — через токены.** Никаких `bg-gray-100`, `text-gray-500`, `border-gray-200`. Только `bg-muted`, `text-muted-foreground`, `border-border`.
- **Все шрифты — через переменные.** `font-sans` для UI, `font-serif` для заголовков экранов.
- **Все тени — через токены.** `shadow-card`, `shadow-md`.
- **Консистентные отступы.** Карточки: `p-4` или `p-6`. Не смешивать.

### 2.2 Компоненты для проверки и обновления

#### Глобальные
- [ ] `app/layout.tsx` — подключить шрифты, CSS-переменные на `<body>`
- [ ] `globals.css` — полная замена цветовых токенов
- [ ] `tailwind.config.ts` — fontFamily: sans, serif, mono

#### Навигация и Layout
- [ ] `components/sidebar-layout.tsx` — sidebar background, border
- [ ] `components/ui/sidebar.tsx` — все sidebar-* токены
- [ ] `components/breadcrumbs/` — typography, цвета

#### Главная и Dashboard
- [ ] `components/glavnaya/` — все карточки, инпут, фоны
- [ ] `components/input/` — вся система инпутов (10 файлов)

#### Чат
- [ ] `components/chat/` — bubble цвета, фон, разделители
- [ ] `components/markdown-viewer.tsx` — typography для AI-ответов

#### Проекты
- [ ] `components/projects/project-page-layout.tsx` — фоны колонок
- [ ] `components/projects/project-pulse.tsx` — секции, иконки
- [ ] `components/projects/project-work-area.tsx` — фон рабочей области
- [ ] `components/projects/manager-drawer.tsx` — drawer styling
- [ ] `components/projects/phase-states/` — все 5 состояний
- [ ] `components/tasks/` — карточки задач, статусы, цвета бейджей

#### Артефакты и документы
- [ ] `components/artifacts/` — редактор, превью
- [ ] `components/file-viewer/` — модалка, рендереры

#### Модальные элементы
- [ ] `components/modal-assistants/` — Ben, другие
- [ ] `components/universal-dialog/` — все диалоги

#### Settings
- [ ] `app/(dashboard)/settings/` — страница настроек

### 2.3 Типографика — правила применения

| Элемент | Шрифт | Размер | Weight |
|---------|-------|--------|--------|
| Заголовок страницы (h1) | `font-serif` (Lora) | `text-2xl` | `600` |
| Заголовок секции (h2) | `font-serif` (Lora) | `text-xl` | `600` |
| Заголовок карточки (h3) | `font-sans` (Source Sans 3) | `text-lg` | `600` |
| Body text | `font-sans` | `text-base` | `400` |
| UI labels | `font-sans` | `text-sm` | `500` |
| Мелкий текст | `font-sans` | `text-xs` | `400` |
| Код | `font-mono` | `text-sm` | `400` |
| AI-ответ body | `font-sans` | `text-base` | `400` |

### 2.4 Статусы и бейджи — единая система

| Статус | Цвет фона | Цвет текста | Иконка |
|--------|-----------|-------------|--------|
| pending | `bg-muted` | `text-muted-foreground` | `Circle` |
| in_progress | `bg-info/10` | `text-info` | `Loader2` (animate-spin) |
| done | `bg-success/10` | `text-success` | `CheckCircle2` |
| locked | `bg-muted` | `text-muted-foreground/50` | `Lock` |
| review | `bg-warning/10` | `text-warning` | `Eye` |
| error | `bg-destructive/10` | `text-destructive` | `AlertCircle` |

---

## Ограничения и требования

1. **Не менять логику** — только визуал. Если компонент работает, его поведение не трогаем.
2. **Не менять структуру файлов** — токены в `globals.css`, шрифты в `fonts.ts`.
3. **Dark mode обязателен** — каждый токен имеет light и dark вариант.
4. **Кириллица** — все шрифты проверить на кириллицу.
5. **Поиск хардкода** — `grep -r` по проекту на все `#` hex-цвета и жёсткие Tailwind-цвета (`gray-`, `blue-`, `red-`, `green-`, `slate-`, `stone-`, `zinc-`, `neutral-`). Заменить на семантические токены.
6. **Production build** — должен проходить без ошибок после всех изменений.

---

## Фаза 3: Защита от "Шанхая" — файл-закон для Claude Code

### Проблема

Claude Code каждый сеанс начинает с чистого листа. Он видит файлы проекта, но **не знает правил дизайна**. Поэтому каждый раз "изобретает" стиль: один раз `bg-gray-100`, другой — `bg-slate-50`, третий — `bg-neutral-100`. Результат — базар.

### Решение: `SIMPLY_DESIGN_SYSTEM.md` в корне проекта

Создать файл **в корне репозитория** (рядом с README.md), который Claude Code **автоматически увидит** при анализе проекта. Это не документация для людей — это **закон для AI-разработчика**.

### 3.1 Содержимое `SIMPLY_DESIGN_SYSTEM.md`

```markdown
# Simply Design System — ОБЯЗАТЕЛЬНО К ИСПОЛНЕНИЮ

> Этот файл — единственный источник правды для визуального стиля Simply.
> Любой новый компонент, страница или модификация UI ОБЯЗАНЫ следовать этим правилам.
> Нарушение = баг.

## Цвета

ЗАПРЕЩЕНО использовать:
- Любые хардкоженные hex-цвета (#fff, #333, #f5f5f5 и т.д.)
- Tailwind цвета напрямую: gray-*, slate-*, zinc-*, stone-*, neutral-*, blue-*, red-*, green-*
- Любые цвета, которых нет в списке ниже

ОБЯЗАТЕЛЬНО использовать ТОЛЬКО семантические токены:
- Фоны: bg-background, bg-card, bg-muted, bg-accent, bg-primary, bg-secondary, bg-destructive
- Текст: text-foreground, text-muted-foreground, text-card-foreground, text-primary-foreground
- Границы: border-border, border-input
- Фокус: ring-ring
- Статусы: text-success, text-warning, text-info, bg-success/10, bg-warning/10, bg-info/10

## Шрифты

- Заголовки страниц и секций (h1, h2): `font-serif` (Lora)
- Весь остальной UI: `font-sans` (Source Sans 3) — это дефолт, указывать не нужно
- Код: `font-mono` (JetBrains Mono)

ЗАПРЕЩЕНО:
- Подключать другие шрифты
- Использовать font-family напрямую в style={{}}

## Типографика

| Элемент | Класс | Weight |
|---------|-------|--------|
| Заголовок страницы | font-serif text-2xl font-semibold | 600 |
| Заголовок секции | font-serif text-xl font-semibold | 600 |
| Заголовок карточки | text-lg font-semibold | 600 |
| Основной текст | text-base | 400 |
| UI labels | text-sm font-medium | 500 |
| Мелкий текст | text-xs | 400 |
| Код | font-mono text-sm | 400 |

## Тени

ТОЛЬКО эти тени (определены в globals.css):
- shadow-sm, shadow-md, shadow-lg, shadow-card

ЗАПРЕЩЕНО: Произвольные shadow-[...] значения.

## Радиусы

Использовать стандартные: rounded-sm, rounded-md, rounded-lg, rounded-xl.
Базовый --radius: 0.625rem.

## Статусы задач

| Статус | Фон | Текст | Иконка |
|--------|-----|-------|--------|
| pending | bg-muted | text-muted-foreground | Circle |
| in_progress | bg-info/10 | text-info | Loader2 animate-spin |
| done | bg-success/10 | text-success | CheckCircle2 |
| locked | bg-muted | text-muted-foreground/50 | Lock |
| review | bg-warning/10 | text-warning | Eye |
| error | bg-destructive/10 | text-destructive | AlertCircle |

## Отступы карточек

- Карточки: p-4 или p-6 (выбрать один и придерживаться в контексте)
- Между секциями: space-y-4 или gap-4
- Внутри секций: space-y-2 или gap-2

## Dark Mode

Каждый компонент ОБЯЗАН корректно работать в dark mode.
Не использовать bg-white — использовать bg-card.
Не использовать text-black — использовать text-foreground.

## Проверка перед коммитом

Перед завершением работы выполнить:
grep -rn "bg-gray\|text-gray\|border-gray\|bg-slate\|bg-zinc\|bg-stone\|bg-neutral\|bg-white\|text-black" --include="*.tsx" --include="*.ts" | grep -v "node_modules\|components/ui/"

Результат должен быть ПУСТЫМ (0 строк).
```

### 3.2 Обновить `CLAUDE.md` (или создать, если нет)

В корневой файл `CLAUDE.md` добавить секцию:

```markdown
## UI и дизайн

Перед любой работой с UI-компонентами — ПРОЧИТАЙ `SIMPLY_DESIGN_SYSTEM.md`.
Это обязательный стандарт. Все цвета, шрифты и отступы должны соответствовать этому файлу.
Хардкоженные цвета и прямые Tailwind палитры (gray-*, slate-*) ЗАПРЕЩЕНЫ.
```

### 3.3 Почему это работает

Claude Code при старте сессии сканирует корневые файлы проекта. Файлы с именами `CLAUDE.md`, `README.md` и файлы в корне имеют наивысший приоритет. Когда Claude Code видит явные ЗАПРЕЩЕНО/ОБЯЗАТЕЛЬНО — он следует правилам, потому что это не "рекомендации", а **constraints**.

Ключевые принципы файла:
1. **Формулировки-запреты** — не "желательно использовать", а "ЗАПРЕЩЕНО"
2. **Конкретные примеры** — не "используйте токены", а "bg-muted вместо bg-gray-100"
3. **Проверочная команда** — grep в конце, чтобы Claude Code мог сам себя проверить
4. **Компактность** — весь файл умещается в контекстное окно без проблем

---

## Результат

После выполнения ТЗ:
- Simply имеет единый визуальный стиль — тёплый, профессиональный, "книжный"
- Все компоненты используют одни и те же токены
- Переключение light/dark mode работает корректно
- Любой новый компонент автоматически наследует тему
- **`SIMPLY_DESIGN_SYSTEM.md` в корне** — Claude Code в будущих ТЗ не принимает дизайн-решений, а следует закону
- **`CLAUDE.md` обновлён** — ссылка на дизайн-систему в блоке обязательного чтения
- Больше никакого "Шанхая" — один стиль, одни правила, навсегда

---

## Метрика успеха

- `grep -rn "bg-gray\|text-gray\|border-gray\|bg-slate\|bg-zinc\|bg-stone\|bg-neutral" --include="*.tsx" --include="*.ts"` → **0 результатов** (кроме shadcn/ui базовых файлов в `components/ui/`)
- Production build → ✅
- Light mode + Dark mode → визуально единый стиль
- Кириллица → корректно во всех весах
