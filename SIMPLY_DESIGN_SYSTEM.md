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
```bash
grep -rn "bg-gray\|text-gray\|border-gray\|bg-slate\|bg-zinc\|bg-stone\|bg-neutral\|bg-white\|text-black" --include="*.tsx" --include="*.ts" | grep -v node_modules
```

Результат должен быть ПУСТЫМ (0 строк).
