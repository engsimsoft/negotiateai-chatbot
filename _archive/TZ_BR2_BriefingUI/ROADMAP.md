# Roadmap ТЗ-BR2: Briefing UI

**Создан:** 2026-02-19
**Версия проекта:** 3.26.0 → 3.27.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 4 |
| Текущий этап | 1 |
| Сессий (оценка) | 1 |

---

## Этап 1: Подготовка + типы + карточка на дашборде

**Статус:** ✅ Завершён

**Цель:** Вынести BriefingJSON типы в shared-файл, создать карточку BriefingCard и секцию ToolsSection на дашборде.

**Задачи:**
- [x] Создать `lib/briefing/briefing-types.ts` — вынести типы BriefingJSON, BriefingBlock, BriefingItem из briefing-analyzer.ts. Оставить в analyzer.ts Zod-схемы, типы импортировать из briefing-types.ts
- [x] Создать `components/briefing/briefing-card.tsx` — серверный компонент, три состояния (пустое/готов/генерируется). Props: `latestBriefing` (BriefingHistory | null). Логика: нет history → "Попробовать"; status='ready' → "Читать" (счётчики из briefingJson); status='generating' → спиннер. Hover паттерн A. Клик → `/briefing`
- [x] Создать `components/glavnaya/tools-section.tsx` — обёртка с SectionTitle "Инструменты" + grid карточек. Пока одна карточка — BriefingCard
- [x] Обновить `components/glavnaya/index.ts` — re-export ToolsSection
- [x] Обновить `app/(dashboard)/dashboard/page.tsx` — добавить fetch `getBriefingHistory({ userId, limit: 1 })`, передать в ToolsSection/BriefingCard. Добавить `<ToolsSection />` после `<ModeCardsSection />`
- [x] Создать `components/briefing/index.ts` — barrel export

**Файлы:**
- `lib/briefing/briefing-types.ts` — новый (типы)
- `lib/briefing/briefing-analyzer.ts` — рефакторинг (import types from briefing-types)
- `components/briefing/briefing-card.tsx` — новый
- `components/briefing/index.ts` — новый
- `components/glavnaya/tools-section.tsx` — новый
- `components/glavnaya/index.ts` — обновить
- `app/(dashboard)/dashboard/page.tsx` — обновить

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: на /dashboard видна секция "Инструменты" с карточкой "Утренний брифинг"
- [x] Браузер: карточка показывает корректное состояние (для тестового юзера — "Готов" с данными)
- [x] Браузер: клик на карточку → переход на /briefing (пока 404, это ОК)
- [x] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add lib/briefing/briefing-types.ts lib/briefing/briefing-analyzer.ts components/briefing/ components/glavnaya/tools-section.tsx components/glavnaya/index.ts app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat(tz-br2): briefing card + tools section on dashboard"
```

**Критерий готовности:** Карточка видна на дашборде и показывает корректное состояние из БД

---

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 1

## Этап 2: Страница /briefing + генерация

**Статус:** ✅ Завершён

**Цель:** Полноценная страница /briefing с header, рендером брифинга, кнопкой генерации и empty state.

**Задачи:**
- [x] Создать `app/(dashboard)/briefing/page.tsx` — Server Component. Auth guard, fetch latest briefing (status='ready'). Рендер BriefingPage
- [x] Создать `components/briefing/briefing-header.tsx` — header по паттерну 1.4: `← Dashboard` (Link), заголовок "☀️ Утренний брифинг" (font-serif text-2xl), дата + счётчики, кнопка ⚙️ (disabled заглушка), `<UserMenu />`
- [x] Создать `components/briefing/briefing-page.tsx` — основной layout. Props: briefing data. Показывает header + content или empty state
- [x] Создать `components/briefing/briefing-empty.tsx` — empty state: иконка ☀️, текст "Ваш первый брифинг ещё не создан", кнопка генерации
- [x] Создать `components/briefing/briefing-generate-button.tsx` — Client Component. POST /api/briefing/generate. Loading state (disabled + спиннер), error toast. По завершении `router.refresh()`
- [x] Создать `components/briefing/briefing-content.tsx` — рендер BriefingJSON. Логика: (1) мердж блоков с одинаковым topicId, (2) извлечь items с importance='high' в блок "Главное", (3) убрать high items из тематических блоков, (4) если high items нет — блок "Главное" не показывается, (5) рендер BriefingBlock[]
- [x] Создать `components/briefing/briefing-block.tsx` — один тематический блок (emoji + topicName + items). Блок "Главное" с `bg-primary/5` и более крупным шрифтом
- [x] Создать `components/briefing/briefing-item.tsx` — одна новость: title (ссылка на sourceUrl, target="_blank", text-primary), summary, мета (sourceName, бейдж EN→RU если sourceLanguage !== 'ru', relative time если publishedAt есть)
- [x] Обновить `components/briefing/index.ts` — добавить exports

**Файлы:**
- `app/(dashboard)/briefing/page.tsx` — новый
- `components/briefing/briefing-header.tsx` — новый
- `components/briefing/briefing-page.tsx` — новый
- `components/briefing/briefing-empty.tsx` — новый
- `components/briefing/briefing-generate-button.tsx` — новый
- `components/briefing/briefing-content.tsx` — новый
- `components/briefing/briefing-block.tsx` — новый
- `components/briefing/briefing-item.tsx` — новый
- `components/briefing/index.ts` — обновить

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: /briefing показывает брифинг с реальными данными (для тестового юзера)
- [x] Браузер: блок "Главное" первый (bg-primary/5), items с high НЕ дублируются в тематических блоках
- [x] Браузер: ссылки на источники кликабельны (target="_blank")
- [x] Браузер: бейдж EN→RU рядом с англоязычными источниками
- [x] Браузер: кнопка "Сгенерировать" → loading → обновление страницы
- [x] Браузер: empty state корректен (для нового пользователя)
- [x] Браузер: dark mode корректен
- [x] Браузер: `← Dashboard` возвращает на /dashboard
- [x] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add app/\(dashboard\)/briefing/ components/briefing/
git commit -m "feat(tz-br2): briefing page with content rendering + generation"
```

**Критерий готовности:** Страница /briefing полностью функциональна — рендер, генерация, empty state, dark mode

---

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 2

## Этап 3: GET API + обновление карточки + polish

**Статус:** ✅ Завершён

**Цель:** GET endpoint, обратная связь карточки после генерации, design-system проверка.

**Задачи:**
- [x] Создать `app/(chat)/api/briefing/latest/route.ts` — GET endpoint. Auth, fetch latest briefing (status='ready') + settings. Response: `{ briefing: BriefingHistory | null, settings: BriefingSettings | null }`
- [x] Проверить что карточка на /dashboard обновляется после генерации (пользователь генерирует на /briefing → возвращается на /dashboard → карточка показывает "Готов")
- [x] Проверка design-system: `grep -rn "bg-gray\|text-gray\|border-gray\|bg-slate\|bg-zinc\|bg-stone\|bg-neutral\|bg-white\|text-black" --include="*.tsx" --include="*.ts" components/briefing/ app/\(dashboard\)/briefing/` — должен быть пустым
- [x] Обновить `docs/design-system.md` — добавить `/briefing` в карту страниц (раздел 1.2)

**Файлы:**
- `app/(chat)/api/briefing/latest/route.ts` — новый
- `docs/design-system.md` — обновить (раздел 1.2)

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] API: `GET /api/briefing/latest` возвращает корректные данные
- [x] Браузер: полный flow — /dashboard (карточка) → /briefing → генерация → назад на /dashboard (карточка обновилась)
- [x] Design-system grep — 0 нарушений
- [x] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add app/\(chat\)/api/briefing/latest/ docs/design-system.md
git commit -m "feat(tz-br2): GET /api/briefing/latest + design-system update"
```

**Критерий готовности:** Полный flow работает end-to-end, design-system без нарушений

---

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 3

## Этап 4: Финализация

**Статус:** ✅ Завершён

**Цель:** Документация, версия, архив.

**Задачи:**
- [x] Финальное мануальное тестирование (пользователь) — полный чеклист из ТЗ раздел 8
- [x] SQL-проверка БД (таблицы, данные)
- [x] Обновить главный `CHANGELOG.md`
- [x] Обновить `SIMPLY_STATUS.md`
- [x] Обновить `CLAUDE.md` (добавить briefing-types.ts, briefing components, /briefing page, GET endpoint)
- [x] Обновить `package.json` → 3.27.0
- [x] Обновить `docs/architecture.md` (если нужно)
- [x] Обновить `docs/ai-chats-map.md` (если нужно — проверить) — не нужно, AI-pipeline уже задокументирован в BR1
- [x] Переместить `specs/TZ_BR2_BriefingUI/` → `_archive/`

**Валидация:**
- [ ] `npm run build` — успешен
- [ ] Все функции работают в браузере
- [ ] Документация актуальна по DOCUMENTATION_GUIDE.md

**Git (после валидации):**
```bash
git add CHANGELOG.md SIMPLY_STATUS.md CLAUDE.md package.json docs/
git commit -m "docs(tz-br2): finalize v3.27.0 — briefing UI"
```

**Критерий готовности:** Все чеклисты пройдены, документация актуальна, ТЗ в архиве
