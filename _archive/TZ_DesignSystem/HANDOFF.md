# ТЗ-DS: Simply Design System — ЗАВЕРШЁН

**Дата завершения:** 2026-02-14
**Версия:** 3.18.0 → 3.19.0
**Ветка:** `feature/design-system`
**Сессий:** 5

## Все коммиты

| Коммит | Сессия | Описание |
|--------|--------|----------|
| `67f9f41` | 1 | Этап 1 — design tokens, fonts, design system law |
| `76c0695` | 2 | Этап 2 — auth fix, toast, weather, hover unification |
| `1b0af54` | 3-4 | Этап 3 — sidebar, glavnaya, input tokens |
| `3fc24a5` | 4 | Этап 4 — chat, projects, artifacts, modals tokens |
| `d5853c5` | 4 | Fix: blue→primary в 7 файлах projects/ |
| `459c2c9` | 4 | Hover animation на task-sidebar |
| `a5c584a` | 4 | Hover unification: карточки + pulse |
| `9ec3336` | 4 | Финализация v3.19.0, удаление geist, docs |
| `18c067e` | 5 | Revert UserMenu (дублирование навигации) |
| *(pending)* | 5 | docs/design-system.md + ADR-013 + регистрация в DOCUMENTATION_GUIDE |

## Итог

- **50+ замен** hardcoded цветов → семантические токены
- **0 хардкодов** в grep (gray/zinc/slate/stone/neutral/blue в UI)
- **Пакет geist удалён**, шрифты: Source Sans 3, Lora, JetBrains Mono
- **Hover паттерны** унифицированы: карточки (border-primary + shadow) и sidebar items (rounded-lg + bg-muted)
- **Тёплая палитра**: light #FAF9F5, dark #1C1B19, primary терракот
- **docs/design-system.md** — полноценный закон: структура UI, карта страниц, hover-паттерны, правила (ADR-013)

## Архив

Папка скопирована в `_archive/TZ_DesignSystem/`

## Открытые вопросы (backlog, не блокеры)

- User Menu на страницах без AppSidebar (/settings, /projects, /projects/[id], /chats, task) — переиспользовать паттерн GlavnayaHeader, **отдельное ТЗ**
- Иконки/бейджи помощников на Glavnaya — тёплые терракотовые акценты
- Полный редизайн навигации — отдельное ТЗ в будущем
