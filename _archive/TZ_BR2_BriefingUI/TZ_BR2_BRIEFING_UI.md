# ТЗ-BR2: Утренний брифинг — UI

**Версия:** 1.0 | **Дата:** 2026-02-19
**Зависимости:** ТЗ-BR1 (backend, БД, API)
**Результат:** Карточка на дашборде + страница `/briefing` + кнопка «Сгенерировать»

---

## Суть

Пользователь видит карточку брифинга на дашборде. Нажимает — переходит на страницу `/briefing`. Там кнопка «Сгенерировать» (пока нет cron) и готовый брифинг: блоки по темам, новости с summary, ссылки на источники.

---

## 1. Карточка на дашборде

### Расположение

Новая секция **«Инструменты»** на дашборде, ниже ModeCardsSection. Grid, расширяемый — будущие карточки (Совещание, Почтовый ассистент) встанут рядом.

В `app/(dashboard)/dashboard/page.tsx` добавить секцию после `<ModeCardsSection />`:

```
{/* Mode cards */}
<ModeCardsSection />

{/* Tools section */}
<ToolsSection />   ← новое
```

### Компонент `ToolsSection`

Обёртка с заголовком «Инструменты» (font-serif text-xl font-semibold text-muted-foreground — заголовок секции из раздела 4 design-system.md) + grid карточек. Пока одна карточка — брифинг. Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`.

### Компонент `BriefingCard`

Карточка в стиле design-system.md (border, hover:border-primary, hover:shadow-sm). Клик → переход на `/briefing`.

**Три состояния:**

**Не настроен** (нет briefing_settings или isActive: false):
```
☀️ Утренний брифинг
Персональный AI-дайджест каждое утро
                          [Настроить]
```

**Брифинг готов** (есть запись в briefing_history со status: 'ready'):
```
☀️ Утренний брифинг
Сегодня · 12 новостей · 3 важных
                            [Читать]
```

**Генерируется** (status: 'generating'):
```
☀️ Утренний брифинг
Генерируется...
[индикатор]
```

Данные: серверный компонент, запрос к БД (последний briefing_history пользователя + briefing_settings).

---

## 2. Страница `/briefing`

### Маршрут

`app/(dashboard)/briefing/page.tsx` — в route group `(dashboard)`, с общим layout и без sidebar (как `/settings`).

### Header

Паттерн из design-system.md (раздел 1.4):

```
sticky top-0 z-10 h-14 items-center border-b bg-background px-4 lg:px-6
```

- Слева: `← Dashboard` (навигация назад)
- Центр/левее: «☀️ Утренний брифинг» (font-serif text-2xl font-semibold — заголовок страницы)
- Справа: кнопка ⚙️ (заглушка) + `<UserMenu />` (components/user-menu.tsx)

### Layout страницы

```
[← Dashboard]              [⚙️] [UserMenu]    ← header h-14

☀️ Утренний брифинг
18 февраля 2026 · 12 новостей из 47 источников

[🔄 Сгенерировать]    ← пока нет cron

─────────────────────────────

🔴 Главное                          ← блок, importance: high
┌─────────────────────────────────┐
│ Заголовок новости                │
│ Summary — почему это важно       │
│ The Verge · EN→RU · 2ч назад    │
└─────────────────────────────────┘

🤖 AI
┌─────────────────────────────────┐
│ ...                              │
└─────────────────────────────────┘

🏎️ Формула-1
┌─────────────────────────────────┐
│ ...                              │
└─────────────────────────────────┘
```

### Компоненты

**`briefing-page.tsx`** — основной layout страницы. Server component. Загружает последний брифинг из briefing_history. Если нет — показывает empty state с кнопкой «Сгенерировать первый брифинг».

**`briefing-header.tsx`** — шапка по паттерну 1.4: навигация назад (← Dashboard), заголовок, дата, счётчики (N новостей из M источников), кнопка настроек (заглушка), `<UserMenu />` справа.

**`briefing-generate-button.tsx`** — Client component. Кнопка «Сгенерировать». Вызывает `POST /api/briefing/generate`. Показывает loading state. По завершении — `router.refresh()` для обновления данных.

**`briefing-content.tsx`** — рендер briefingJson. Маппит blocks → BriefingBlock компоненты.

**`briefing-block.tsx`** — один тематический блок (emoji + название + список items).

**`briefing-item.tsx`** — одна новость: заголовок (ссылка на sourceUrl), summary, мета (sourceName, язык, время).

**`briefing-empty.tsx`** — empty state: иконка, текст «Ваш первый брифинг ещё не создан», кнопка генерации.

### Блок «Главное»

Первый блок — новости с importance: 'high' из всех тем. Собирается на клиенте из briefingJson (фильтр по importance). Если нет high — блок не показывается.

Визуально: отдельный цвет фона (bg-primary/5), более крупный шрифт заголовков.

### Пометка перевода

Если sourceLanguage !== язык пользователя — показать бейдж `EN→RU` рядом с sourceName. Мелкий, text-xs, приглушённый.

### Ссылки на источники

Заголовок каждой новости — кликабельная ссылка (target="_blank", rel="noopener"). Цвет: text-primary.

---

## 3. API для UI

### `GET /api/briefing/latest`

Возвращает последний готовый брифинг пользователя (status: 'ready'). Используется для обновления карточки и страницы без перезагрузки.

Ответ: `{ briefing: BriefingHistory | null, settings: BriefingSettings | null }`

Расположение: `app/(chat)/api/briefing/latest/route.ts`

---

## 4. Файловая структура

```
components/briefing/
├── briefing-card.tsx              // карточка на дашборде
├── briefing-page.tsx              // layout страницы /briefing
├── briefing-header.tsx            // шапка с датой и счётчиками
├── briefing-generate-button.tsx   // кнопка генерации (client)
├── briefing-content.tsx           // рендер JSON → блоки
├── briefing-block.tsx             // один тематический блок
├── briefing-item.tsx              // одна новость
└── briefing-empty.tsx             // empty state

components/glavnaya/
└── tools-section.tsx              // секция «Инструменты» на дашборде

app/(dashboard)/briefing/
└── page.tsx                       // страница брифинга

app/(chat)/api/briefing/
├── generate/route.ts              // POST — генерация (из BR1)
└── latest/route.ts                // GET — последний брифинг
```

---

## 5. Дизайн

Строго по `docs/design-system.md` — файл-закон:

- **Шрифты:** font-serif (Lora) для заголовка страницы и заголовков блоков, font-sans (Source Sans 3) для всего остального — дефолт, не указывать
- **Header:** паттерн из раздела 1.4 — `sticky top-0 z-10 h-14 border-b bg-background px-4 lg:px-6`, UserMenu справа
- **BriefingCard на дашборде:** Hover паттерн A — `hover:border-primary hover:shadow-sm transition-all`
- **Цвета:** ТОЛЬКО семантические токены (раздел 2). bg-background, bg-card, bg-muted, text-foreground, text-muted-foreground, border-border. Никаких hex, никаких gray-*/slate-*
- **Блок «Главное»:** bg-primary/5 — допустимо как акцент (аналог bg-info/10 для статусов)
- **Dark mode:** обязателен. bg-card вместо bg-white, text-foreground вместо text-black
- **Тени:** только shadow-sm, shadow-md, shadow-lg, shadow-card
- **Радиусы:** rounded-md, rounded-lg стандартные
- **Отступы:** карточки p-4, между секциями gap-4, внутри секций gap-2
- **Проверка перед коммитом:** grep из раздела 12 design-system.md — результат должен быть пустым

---

## 6. Обновить design-system.md

После реализации — добавить `/briefing` в карту страниц (раздел 1.2):

```
├── /briefing → свой header (← Dashboard + "Утренний брифинг" + ⚙️ + UserMenu)
│   User Menu: ✅   Theme Toggle: ✅
```

---

## 7. Что НЕ делать

- ServiceChat настройку (отдельное ТЗ)
- Cron/расписание (отдельное ТЗ)
- Страницу настроек брифинга (пока кнопка ⚙️ — заглушка)
- Telegram/SvoyChat доставку
- Аудио/TTS
- История брифингов (список предыдущих) — в будущем

---

## 8. Проверка готовности

1. На дашборде видна карточка «Утренний брифинг» в секции «Инструменты»
2. Клик → страница `/briefing` с empty state
3. Нажать «Сгенерировать» → loading → появляется брифинг с реальными новостями
4. Новости сгруппированы по темам, блок «Главное» первый
5. Ссылки на источники кликабельны (target="_blank")
6. Карточка на дашборде обновилась: «Сегодня · N новостей»
7. Dark mode корректен

---

**Версия релиза:** 3.27.0
