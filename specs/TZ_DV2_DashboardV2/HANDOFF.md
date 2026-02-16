# Передача сессии ТЗ-DV2: Дашборд V2

**Дата:** 2026-02-17
**Сессия:** 4 (в процессе)

## Статус этапов
- [x] Этап 1: Удаление экосистемы помощников ✅ (commit `0bbe51b`)
- [x] Этап 2: chatMode — схема, миграция, API ✅ (commit `0ce7dd0`)
- [x] Этап 3: Промпты и Tools по chatMode ✅ (commit `cee6942`)
- [ ] **Этап 4A: Карточки на дашборде + убрать селектор модели** ← ТЕКУЩИЙ
- [ ] Этап 4B: ListDetailPage — универсальный layout-shell
- [ ] Этап 4C: Страницы /expertise и /create
- [ ] Этап 4D: Рефакторинг /projects на ListDetailPage
- [ ] Этап 5: AI = Simply + chatMode badge
- [ ] Этап 6: Финализация

## Что изменилось в сессии 4

**ТЗ обновлено до v2.0** — вместо простых карточек-ссылок:
- Полноценные страницы `/expertise`, `/create` на базе ListDetailPage
- Рефакторинг `/projects` на единый list-detail паттерн
- Этап 4 разбит на 4A/4B/4C/4D

**Решения архитектора (сессия 4):**
1. **Разбивка 4A-4D** — итеративно с валидацией
2. **ListDetailPage** — composition (layout-shell + render props, НЕ generics)
3. **`/projects`** — переводить на list-detail (единый паттерн)
4. **Flow создания** — redirect `/chat?mode=...`, чат при первом сообщении
5. **`/chats`** — все непроектные чаты (единый архив)
6. **Sidebar** — не трогать, не добавлять новые пункты

**Документы обновлены:**
- SPEC.md → v2.0
- ROADMAP.md → этапы 4A-4D, 5, 6

## Следующая сессия: начни с

1. **Прочитать ROADMAP.md** → задачи Этапа 4A
2. **Прочитать `docs/design-system.md`** — ОБЯЗАТЕЛЬНО перед UI работой
3. **Начать Этап 4A:**
   - Создать `components/glavnaya/mode-cards-section.tsx` (3 карточки → /expertise, /create, /projects)
   - Удалить `components/glavnaya/projects-section.tsx`
   - Обновить дашборд: ModeCardsSection вместо ProjectsSection
   - Убрать `InputModelSelector` из compact-input.tsx
   - Обработать `?mode=` query param в `app/(chat)/chat/page.tsx`

## Ключевые решения архитектора (все сессии)

- chatMode: varchar (не pgEnum) + Zod-валидация
- selectedChatModel убран из API → сервер определяет по chatMode
- Аватар: оставить SparklesIcon
- ToolsSection: удалена
- Greeting: одинаковый для всех режимов
- Badge в истории: 🔍 expertise, ✨ create
- Design system: `docs/design-system.md` — ОБЯЗАТЕЛЬНО
- Карточки: Паттерн A (border + shadow hover)
- ListDetailPage: composition, НЕ generics
- `/projects`: переводить на list-detail
- `/chats`: все непроектные чаты
- Sidebar: не трогать

## Блокеры / Вопросы
- Нет блокеров.
