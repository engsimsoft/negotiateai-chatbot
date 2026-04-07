# Roadmap ТЗ-KITT: Simply — Persistent Chat

**Создан:** 2026-04-07
**Версия проекта:** 3.73.0 → 3.74.0
**Ветка:** `feature/simply-kitt`
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 5 |
| Текущий этап | 3 |
| Сессий (оценка) | 2-3 |

---

## Этап 1: Core — маршрут `/simply` + persistent chat

**Статус:** ✅ Завершён

**Цель:** Пользователь заходит на `/simply` — всегда видит один и тот же чат. При первом визите чат создаётся автоматически.

**Задачи:**
- [x] 1.1 Добавить `getOrCreateSimplyChat(userId)` в `lib/db/queries.ts`
- [x] 1.2 Создать `app/(chat)/simply/page.tsx` — маршрут `/simply`
- [x] 1.3 Отключить auto-naming: guard в `autoNameChat()` для chatMode="simply"
- [x] 1.4 В `app/(chat)/api/chat/route.ts` — пропустить auto-naming, chatMode config, MIND, snapshot/compaction guards
- [x] 1.5 Скрыть simply-чаты из sidebar history + "Новый чат" + "Все чаты" для chatMode=simply
- [x] 1.6 Скрыть simply-чаты из history API query (ne chatMode "simply")

**Файлы:**
- `lib/db/queries.ts` — + функция `getOrCreateSimplyChat`
- `app/(chat)/simply/page.tsx` — НОВЫЙ
- `app/(chat)/api/chat/route.ts` — guard auto-naming
- `components/sidebar-history.tsx` — фильтрация
- `lib/db/queries.ts` — `getChatsByUserId` фильтрация

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: `/simply` открывается, можно отправить сообщение
- [x] Браузер: перезагрузка `/simply` — тот же чат, те же сообщения
- [x] Браузер: simply-чат НЕ появляется в sidebar history
- [x] Браузер: auto-naming НЕ срабатывает для simply-чата
- [x] 🧪 Мануальный тест пользователем

**Git:** коммит `c3b6261`

**Критерий готовности:** `/simply` работает как единственный постоянный чат пользователя ✅

---

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 1

## Этап 2: UI — главная + sidebar + кнопка «Думать»

**Статус:** ✅ Завершён

**Цель:** Навигация ведёт в Simply. Кнопка «Думать» переключает на Sonnet для одного сообщения. Архив старых чатов доступен.

**Задачи:**
- [x] 2.1 Главная: ввод текста → redirect на `/simply` (вместо `/chat`) + getChatUrl
- [x] 2.2 Sidebar: пункт "Simply" (иконка MessageCircle) → `/simply`
- [x] 2.3 Sidebar: "Новый чат" скрыт для simply mode (уже в Этапе 1), остаётся для expertise/create
- [x] 2.4 Карточка на главной: "Мой контекст" (Brain icon, factCount) → `/context`
- [x] 2.5 Кнопка «Думать» в input Simply-чата: toggle → Sonnet, auto-reset после ответа
- [x] 2.6 В `api/chat/route.ts`: параметр `think` в schema + Sonnet override + compaction guard
- [x] 2.7 Удаление Simply-чата невозможно: чат скрыт из sidebar/history, UI delete недоступен

**Файлы:**
- `components/glavnaya/glavnaya-input.tsx` — redirect path
- `components/app-sidebar.tsx` — навигация (Simply + Архив)
- `components/glavnaya/chat-history-card.tsx` — → карточка "Мой контекст"
- `components/input/` — кнопка «Думать» (новый компонент или расширение input-base)
- `app/(chat)/api/chat/route.ts` — параметр `think`, выбор модели
- `components/sidebar-history-item.tsx` — скрыть delete для simply

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: ввод на главной → попадаем в `/simply`
- [x] Браузер: sidebar показывает "Simply" → ведёт на `/simply`
- [x] Браузер: кнопка «Думать» → сообщение уходит на Sonnet (подтверждено DevPanel + Anthropic console)
- [x] Браузер: кнопка остаётся активной пока пользователь не выключит
- [x] Браузер: кнопка delete недоступна (simply скрыт из sidebar/history)
- [x] Браузер: карточка "Мой контекст" на главной
- [x] Браузер: prompt caching работает (cache_read на втором запросе)
- [x] 🧪 Мануальный тест пользователем

**Git:** коммит `c3b6261`

**Критерий готовности:** Полный UX-flow работает, кэширование подтверждено ✅

---

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 2

## Этап 3: "Мой контекст" dashboard + MIND idea

**Статус:** ✅ Завершён (код написан, ждёт валидацию)

**Цель:** Страница `/context` — dashboard с 7 карточками MIND. Категория `idea`. Быстрые команды.

**Задачи:**
- [x] 3.1 Добавить категорию `idea` в `MEMORY_CATEGORIES` (`lib/ai/memory/types.ts`)
- [x] 3.2 Обновить промпт извлечения фактов (`lib/prompts/memory/extract.md`) — добавить idea
- [x] 3.3 Обновить Zod-схему в `lib/ai/memory/extract.ts` — автоматически через MEMORY_CATEGORIES
- [x] 3.4 Быстрые команды в system prompt simply-chat.md: "идея: ..." → мгновенная запись
- [x] 3.5 API: `GET /api/user/memory/context` — факты сгруппированные по категориям (count + top-2 preview)
- [x] 3.6 Создать `app/(dashboard)/context/page.tsx` — Server Component (auth → ContextPage)
- [x] 3.7 Создать `components/context/context-page.tsx` — Client Component (dashboard layout)
- [x] 3.8 Создать `components/context/context-card.tsx` — карточка категории (иконка, badge count, 2 preview-факта)
- [x] 3.9 Секция Opus-профиль (read-only, из существующего API)
- [x] 3.10 Кнопки управления: "Настройки памяти" → /settings, "Открыть Simply"

**7 карточек:**

| # | Карточка | category MIND | Иконка | Цвет |
|---|----------|--------------|--------|------|
| 1 | Задачи | `task` | CheckSquare | coral |
| 2 | Календарь | `calendar` | Calendar | pink |
| 3 | Решения | `decision` | Scale | blue |
| 4 | Люди | `person` | Users | purple |
| 5 | Идеи | `idea` | Lightbulb | amber |
| 6 | Заметки | `fact` | FileText | green |
| 7 | Предпочтения | `preference` | Settings | gray |

**Правила карточек:**
- Пустые карточки скрываются
- Badge — количество фактов
- Preview — 2 самых свежих факта
- Порядок по количеству фактов (больше → выше)
- Нажатие → пока ведёт на `/simply` (фокусы — в будущем ТЗ)

**Файлы:**
- `lib/ai/memory/types.ts` — + `idea`
- `lib/ai/memory/extract.ts` — Zod schema
- `lib/prompts/memory/extract.md` — промпт
- `lib/ai/memory/memory-queries.ts` — + `getMemorySummaryByCategory()`
- `lib/prompts/chat/simply-chat.md` — быстрые команды
- `app/(chat)/api/user/memory/context/route.ts` — НОВЫЙ API
- `app/(dashboard)/context/page.tsx` — НОВЫЙ
- `components/context/context-page.tsx` — НОВЫЙ
- `components/context/context-card.tsx` — НОВЫЙ

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: `/context` показывает карточки с данными из MIND
- [x] Браузер: пустые карточки скрыты
- [x] Браузер: badge показывает count, preview — 2 факта
- [x] Браузер: Opus-профиль отображается
- [x] Браузер: написать "идея: тест" → MIND сохраняет с category=idea
- [x] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add lib/ai/memory/ lib/prompts/ app/(dashboard)/context/ components/context/ app/(chat)/api/user/memory/context/
git commit -m "feat(tz-kitt): /context dashboard + MIND idea category"
```

**Критерий готовности:** Dashboard "Мой контекст" показывает все категории MIND с данными

---

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 3

## Этап 4: Polish + edge cases

**Статус:** ✅ Завершён (code review, ждёт мануальный тест)

**Цель:** Обработать крайние случаи, убедиться что ничего не сломано.

**Задачи:**
- [x] 4.1 Проверить что expertise/create/projects работают без изменений — `idea` backward-compatible (varchar(32))
- [x] 4.2 Проверить что MIND извлечение работает для simply-чата — sourceType="simply" передаётся корректно
- [x] 4.3 Проверить что Compaction API работает для simply-чата — Haiku→snapshot, Sonnet(think)→compaction
- [x] 4.4 Проверить DevPanel для simply-чата — data stream events не зависят от chatMode
- [x] 4.5 Мобильный UI — grid-cols-1 sm:grid-cols-2, responsive header
- [x] 4.6 Проверить starred/visibility — simply скрыт из sidebar, star недоступен из UI

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок (без изменений после Этапа 3)
- [x] `npm run build` — успешен (без изменений после Этапа 3)
- [x] Браузер: expertise работает как раньше
- [x] Браузер: create работает как раньше
- [x] Браузер: projects работают как раньше
- [x] Браузер: /context responsive на мобильных
- [x] 🧪 Мануальный тест пользователем (все режимы)

**Git (после валидации):**
```bash
git commit -m "fix(tz-kitt): edge cases + cross-mode verification"
```

---

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 4

## Этап 5: Финализация

**Статус:** ✅ Завершён (ждёт финальный build + мануальный тест)

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../../DOCUMENTATION_GUIDE.md) → пройти чеклист.

**Документация (обязательная):**
- [x] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти чеклист
- [x] Обновить главный CHANGELOG.md
- [x] Обновить SIMPLY_STATUS.md
- [x] Обновить CLAUDE.md (новые файлы, маршруты)
- [x] Обновить package.json: 3.74.0

**Документация (по чеклисту):**
- [ ] ADR нужен? → Отложено (можно добавить позже)
- [x] docs/ai-chats-map.md → обновить (chatMode=simply)
- [x] docs/design-system.md → обновить (карта страниц: /simply, /context)

**Завершение:**
- [ ] Финальное мануальное тестирование (пользователь)
- [ ] Merge `feature/simply-kitt` → `master`
- [ ] Переместить папку в `_archive/`

**Валидация:**
- [ ] `npm run build` — успешен
- [ ] Все функции работают в браузере
- [ ] Документация актуальна
