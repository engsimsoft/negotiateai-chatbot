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
| Текущий этап | 2 |
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
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: `/simply` открывается, можно отправить сообщение
- [ ] Браузер: перезагрузка `/simply` — тот же чат, те же сообщения
- [ ] Браузер: simply-чат НЕ появляется в sidebar history
- [ ] Браузер: auto-naming НЕ срабатывает для simply-чата
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add app/(chat)/simply/ lib/db/queries.ts app/(chat)/api/chat/route.ts components/sidebar-history.tsx
git commit -m "feat(tz-kitt): persistent /simply route + chat creation"
```

**Критерий готовности:** `/simply` работает как единственный постоянный чат пользователя

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
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: ввод на главной → попадаем в `/simply`
- [ ] Браузер: sidebar показывает "Simply" → ведёт на `/simply`
- [ ] Браузер: кнопка «Думать» → сообщение уходит на Sonnet (проверить через DevPanel)
- [ ] Браузер: следующее сообщение — снова Haiku
- [ ] Браузер: старые чаты доступны через «Архив»
- [ ] Браузер: кнопка delete скрыта для Simply-чата
- [ ] Браузер: карточка "Мой контекст" → ведёт на `/context`
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add components/glavnaya/ components/app-sidebar.tsx components/input/ app/(chat)/api/chat/route.ts components/sidebar-history-item.tsx
git commit -m "feat(tz-kitt): UI navigation + Think button + archive"
```

**Критерий готовности:** Полный UX-flow: главная → Simply, кнопка «Думать» работает, архив доступен

---

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 2

## Этап 3: "Мой контекст" dashboard + MIND idea

**Статус:** ⬜ Не начат

**Цель:** Страница `/context` — dashboard с 7 карточками MIND. Категория `idea`. Быстрые команды.

**Задачи:**
- [ ] 3.1 Добавить категорию `idea` в `MEMORY_CATEGORIES` (`lib/ai/memory/types.ts`)
- [ ] 3.2 Обновить промпт извлечения фактов (`lib/prompts/memory/extract.md`) — добавить idea
- [ ] 3.3 Обновить Zod-схему в `lib/ai/memory/extract.ts` — добавить idea
- [ ] 3.4 Быстрые команды в system prompt: "идея: ..." → мгновенная запись
- [ ] 3.5 API: `GET /api/user/memory/context` — факты сгруппированные по категориям (count + top-2 preview)
- [ ] 3.6 Создать `app/(dashboard)/context/page.tsx` — Server Component (auth → ContextPage)
- [ ] 3.7 Создать `components/context/context-page.tsx` — Client Component (dashboard layout)
- [ ] 3.8 Создать `components/context/context-card.tsx` — карточка категории (иконка, badge count, 2 preview-факта)
- [ ] 3.9 Секция Opus-профиль (read-only, из существующего API)
- [ ] 3.10 Кнопки управления: "Настройки памяти" → /settings, "Удалить всё"

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
- `lib/prompts/core/base.md` — быстрые команды
- `app/(chat)/api/user/memory/context/route.ts` — НОВЫЙ API
- `app/(dashboard)/context/page.tsx` — НОВЫЙ
- `components/context/context-page.tsx` — НОВЫЙ
- `components/context/context-card.tsx` — НОВЫЙ

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: `/context` показывает карточки с данными из MIND
- [ ] Браузер: пустые карточки скрыты
- [ ] Браузер: badge показывает count, preview — 2 факта
- [ ] Браузер: Opus-профиль отображается
- [ ] Браузер: написать "идея: тест" → MIND сохраняет с category=idea
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add lib/ai/memory/ lib/prompts/ app/(dashboard)/context/ components/context/ app/(chat)/api/user/memory/context/
git commit -m "feat(tz-kitt): /context dashboard + MIND idea category"
```

**Критерий готовности:** Dashboard "Мой контекст" показывает все категории MIND с данными

---

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 3

## Этап 4: Polish + edge cases

**Статус:** ⬜ Не начат

**Цель:** Обработать крайние случаи, убедиться что ничего не сломано.

**Задачи:**
- [ ] 4.1 Проверить что expertise/create/projects работают без изменений
- [ ] 4.2 Проверить что MIND извлечение работает для simply-чата (sourceType)
- [ ] 4.3 Проверить что Compaction API работает для simply-чата
- [ ] 4.4 Проверить DevPanel для simply-чата
- [ ] 4.5 Мобильный UI: sidebar, навигация, /context
- [ ] 4.6 Проверить starred/visibility для simply-чата (отключить если не нужно)

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: expertise работает как раньше
- [ ] Браузер: create работает как раньше
- [ ] Браузер: projects работают как раньше
- [ ] Браузер: /context responsive на мобильных
- [ ] 🧪 Мануальный тест пользователем (все режимы)

**Git (после валидации):**
```bash
git commit -m "fix(tz-kitt): edge cases + cross-mode verification"
```

---

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 4

## Этап 5: Финализация

**Статус:** ⬜ Не начат

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../../DOCUMENTATION_GUIDE.md) → пройти чеклист.

**Документация (обязательная):**
- [ ] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти чеклист
- [ ] Обновить главный CHANGELOG.md
- [ ] Обновить SIMPLY_STATUS.md
- [ ] Обновить CLAUDE.md (новые файлы, маршруты)
- [ ] Обновить package.json: 3.74.0

**Документация (по чеклисту):**
- [ ] ADR нужен? → Да: `docs/decisions/NNN-simply-persistent-chat.md` (KITT model, почему один чат)
- [ ] docs/architecture.md → обновить (новый маршрут /simply)
- [ ] docs/ai-chats-map.md → обновить (chatMode=simply)
- [ ] docs/design-system.md → обновить (карта страниц)

**Завершение:**
- [ ] Финальное мануальное тестирование (пользователь)
- [ ] Merge `feature/simply-kitt` → `master`
- [ ] Переместить папку в `_archive/`

**Валидация:**
- [ ] `npm run build` — успешен
- [ ] Все функции работают в браузере
- [ ] Документация актуальна
