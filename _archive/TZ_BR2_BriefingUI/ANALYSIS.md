# Анализ ТЗ-BR2: Briefing UI

**Дата анализа:** 2026-02-19

---

## Резюме

UI для утреннего брифинга: карточка на дашборде (`/dashboard`), отдельная страница `/briefing` с рендером BriefingJSON, кнопка генерации и GET-эндпоинт. Зависит от BR1 (backend, таблицы, API generate).

Общее впечатление: ТЗ solid, хорошо описывает структуру. Но есть одна критическая проблема с логикой состояний карточки и несколько технических нюансов.

---

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.
> Каждая рекомендация требует согласования с архитектором.

### ✅ Согласен с ТЗ

- **Файловая структура** — `components/briefing/*` + `components/glavnaya/tools-section.tsx` + `app/(dashboard)/briefing/` — корректно, совпадает с существующими паттернами
- **ToolsSection на дашборде** — grid-карточки после ModeCardsSection. Grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` совпадает с ModeCardsSection
- **Страница `/briefing` в `(dashboard)` route group** — без sidebar, свой header — паттерн как `/settings`
- **Header по паттерну 1.4** — `sticky top-0 z-10 h-14 border-b bg-background px-4 lg:px-6`, `← Dashboard` + `UserMenu` справа — 100% совпадает с settings-page.tsx
- **Generate button как Client Component** — `router.refresh()` после генерации — стандартный паттерн проекта
- **Блок «Главное»** — фильтрация по importance: 'high', `bg-primary/5` — допустимо по design-system.md
- **Дизайн** — все указанные токены и паттерны корректны по design-system.md
- **GET /api/briefing/latest** — простой endpoint, полезен для будущего (SWR, polling). Размещение в `app/(chat)/api/briefing/` — корректно (рядом с generate)

### ⚠️ Рекомендую изменить

| # | Было (ТЗ) | Рекомендация | Обоснование из кода |
|---|-----------|--------------|-------------------|
| 1 | **Card state: "Не настроен" при нет settings или isActive: false** | Определять состояние карточки по `briefingHistory`, не по `briefingSettings` | **Критично.** В текущей системе нет UI для создания настроек. Seed-скрипт создаёт settings для тестового юзера, но обычные пользователи никогда не будут иметь запись в BriefingSettings. Это значит: пользователь заходит → генерирует брифинг → возвращается на /dashboard → карточка ВСЕГДА показывает "Не настроен", хотя брифинг готов. **Предлагаю:** нет записей в history → "Не настроен"; latest status='ready' → "Готов"; latest status='generating' → "Генерируется" |
| 2 | **Кнопка "Настроить" на карточке** | Заменить на "Попробовать" или "Начать" | Кнопка ⚙️ на `/briefing` — заглушка. Настроек нет. "Настроить" вводит в заблуждение. "Попробовать" точнее — ведёт на `/briefing` где можно сгенерировать первый брифинг |
| 3 | ТЗ не упоминает extraction типов | Вынести `BriefingJSON`, `BriefingBlock`, `BriefingItem` в отдельный `lib/briefing/briefing-types.ts` | Сейчас типы определены в `lib/briefing/briefing-analyzer.ts` (строки 21-47), который импортирует `@ai-sdk/google`. Client-компоненты не смогут безопасно импортировать из этого файла. Нужен отдельный файл с типами |
| 4 | Заголовок секции: "font-serif text-xl font-semibold text-muted-foreground" | Использовать существующий компонент `SectionTitle` из `components/glavnaya/section-title.tsx` | Текущий SectionTitle использует `text-sm font-semibold uppercase tracking-wide text-muted-foreground` — это стиль label-секций на главной. Стиль ТЗ (font-serif text-xl) скорее для заголовков страниц, не секций дашборда. Нужно решение: (а) использовать SectionTitle как есть, (б) обновить SectionTitle под design-system, (в) без заголовка. **Вопрос к архитектору** |

### ❓ Требует уточнения

- **Дубликаты items в «Главное» и тематических блоках** — ТЗ говорит: "Первый блок — новости с importance: 'high' из всех тем". Новости с high показываются только в «Главное» (и убираются из тематических блоков)? Или дублируются и там и там? Прошу подтвердить.
- **Реальные данные: дублирующиеся topicId в JSON** — Проверил реальный briefingJson в БД: AI-анализатор создаёт два блока с одинаковым topicId (например, два блока "ai" с emoji "🤖"). UI должен это обрабатывать — мерджить блоки с одинаковым topicId? Рекомендую мерджить при рендере (объединять items из блоков с одинаковым topicId).
- **"2ч назад" в мете новости** — В реальных данных `publishedAt` отсутствует (поле optional в Zod-схеме). Что показывать вместо relative time? Предлагаю: если publishedAt есть — показать relative time, если нет — не показывать метку времени.

---

## Дополнительные наблюдения (не блокирующие)

### Orphaned "generating" записи в BR1

Текущий `POST /api/briefing/generate` (строка 55) создаёт запись со status='generating', а потом (строка 126) создаёт НОВУЮ запись со status='ready'. Запись "generating" никогда не обновляется. В БД уже есть 2 orphaned "generating" записи. Для UI это не проблема (берём latest по generatedAt), но для чистоты данных стоит в будущем перейти на UPDATE вместо INSERT.

### GET /api/briefing/latest — optional для MVP

Карточка на дашборде — Server Component, запрашивает БД напрямую. Страница `/briefing` тоже. Generate button получает ответ из POST и вызывает `router.refresh()`. GET endpoint не обязателен для текущего flow. Но он полезен для будущего (SWR-polling, real-time). Реализуем как в ТЗ — это просто.

### Auto-create settings при первой генерации

Когда пользователь впервые нажмёт «Сгенерировать», у него нет записи в BriefingSettings. Текущий generate route обрабатывает это: берёт defaults. Но settings запись не создаётся. Если в будущем появится UI настроек — стоит создавать settings автоматически при первой генерации. Не блокирует BR2.

---

## Потенциальные риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Генерация долгая (до 60 сек) — UX кнопки | Средняя | Низкое | Loading state на кнопке, disable повторного клика |
| briefingJson пустой или с ошибкой | Низкая | Среднее | Проверка status='ready' перед рендером, graceful fallback на empty state |
| Дублирующиеся topicId блоки в JSON от AI | Высокая (уже есть) | Низкое | Мерджить блоки с одинаковым topicId при рендере |

---

## Зависимости

**Что нужно до начала:**
- [x] ТЗ-BR1 (v3.26.0 — Morning Briefing Backend) завершён ✅
- [x] Таблицы BriefingSettings, BriefingSources, BriefingHistory в БД ✅
- [x] POST /api/briefing/generate работает ✅
- [x] BriefingJSON типы определены ✅

**Затронутые компоненты:**
- `app/(dashboard)/dashboard/page.tsx` — добавить fetch briefing data + ToolsSection
- `components/glavnaya/index.ts` — re-export ToolsSection
- `lib/db/queries.ts` — возможно новый query getLatestBriefing (или использовать getBriefingHistory limit=1)
- `lib/briefing/briefing-analyzer.ts` → `lib/briefing/briefing-types.ts` — extraction типов

**Новые файлы:**
- `components/briefing/` — 8 компонентов
- `components/glavnaya/tools-section.tsx` — секция инструментов
- `app/(dashboard)/briefing/page.tsx` — страница
- `app/(chat)/api/briefing/latest/route.ts` — GET endpoint
- `lib/briefing/briefing-types.ts` — типы BriefingJSON

---

## Оценка

- [x] Простое (1-2 сессии)
- [ ] Среднее (3-5 сессий)
- [ ] Сложное (5+ сессий)

**Обоснование:** Чистый UI без сложной логики. Данные уже в БД, API generate работает. Основная работа — создание компонентов и рендер JSON. 1 сессия.

---

## Ответы архитектора (2026-02-19)

1. **Card state logic:** ✅ Согласен — определять по `briefingHistory`, не по settings. Логика: нет history → "Пустое состояние" (Попробовать); latest status='ready' за сегодня → "Готов" (Читать); latest status='generating' → "Генерируется"
2. **Кнопка "Настроить" → "Попробовать":** ✅ Да
3. **Заголовок секции:** ✅ Использовать существующий `SectionTitle` (text-sm uppercase). Единообразие важнее wireframe
4. **Дубликаты в «Главное»:** ✅ Items с importance: high — ТОЛЬКО в «Главное», НЕ дублируются в тематических блоках. Пользователь не видит одно и то же дважды
5. **Мердж topicId блоков:** ✅ Да, мерджить на стороне рендера. Защита от нестабильного output модели
6. **publishedAt:** Если есть — показать relative time, если нет — не показывать метку времени
