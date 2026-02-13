# Передача сессии ТЗ-DS: Simply Design System

**Дата:** 2026-02-13
**Сессия:** 1

## Статус этапов
- [ ] Этап 1: Фундамент темы (шрифты + токены + SIMPLY_DESIGN_SYSTEM.md) ← ТЕКУЩИЙ
- [ ] Этап 2: Auth + Toast + мелкие утилиты
- [ ] Этап 3: Sidebar + Glavnaya + Input
- [ ] Этап 4: Chat + Projects + Артефакты + Модалки
- [ ] Этап 5: Финализация

## Следующая сессия: начни с
1. Прочитать ROADMAP.md → Этап 1
2. Создать `app/fonts.ts` с тремя шрифтами
3. Обновить `app/layout.tsx` для подключения
4. Перезаписать токены в `globals.css`

## Ключевые решения
- Tailwind v4: тема в `@theme` блоках globals.css, нет tailwind.config.ts
- Geist → Source Sans 3 (удалить пакет `geist` в Этапе 5)
- Lora — только h1/h2 (страницы и секции)
- shadcn/ui тоже переводим на токены
- SIMPLY_DESIGN_SYSTEM.md создаём в Этапе 1 (закон для Фазы 2)
- Ветка: `feature/design-system`

## Блокеры / Вопросы
- Нет
