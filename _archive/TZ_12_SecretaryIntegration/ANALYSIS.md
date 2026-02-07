# Анализ ТЗ-12: Secretary Integration

**Дата анализа:** 2026-02-07

---

## Резюме

Заменить текущий простой промпт для service-chat `project-creation` на полноценный промпт Секретаря из SECRETARY_PROMPT.md. Промпт включает XML-структуру с ролью, интервью, правилами tool usage, подсказками после оформления и примерами. Нужна персонализация через 4 поля профиля.

---

## Вопросы для уточнения

1. **[Модель]:** Какую модель использовать для Секретаря?
2. **[Quick Actions]:** Оставить/убрать кнопки быстрых действий?

---

## Ответы на вопросы

1. **Модель:** Gemini 3 Pro
2. **Quick Actions:** Убрать

---

## Потенциальные риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Gemini может хуже работать с XML-промптом чем Claude | Средняя | Среднее | Протестировать все 8 сценариев, при необходимости адаптировать |
| Длинный промпт увеличит latency первого ответа | Низкая | Низкое | Gemini 3 Pro быстрая модель, промпт ~2К символов |

---

## Зависимости

**Что нужно до начала:**
- [x] ТЗ-11 завершён (context/instruction разделение)
- [x] Tool updateProjectDraft уже принимает name, description, context
- [x] UI уже показывает «Контекст проекта»

**Затронутые компоненты (5 файлов):**
- `app/(chat)/api/service-chat/route.ts` — промпт, модель, profile fields
- `app/(dashboard)/projects/new/page.tsx` — передать pronouns
- `app/(dashboard)/projects/new/project-creation-client.tsx` — greeting + убрать quick actions
- `app/(dashboard)/projects/new/components/project-chat-panel.tsx` — убрать quick actions
- `components/service-chat/configs/project-creation.ts` — убрать quickActions, subtitle

---

## Оценка

- [x] Простое (1-2 сессии)
- [ ] Среднее (3-5 сессий)
- [ ] Сложное (5+ сессий)

**Обоснование:** 5 файлов, без изменений БД, без новых компонентов. Основная работа — замена промпта и чистка quick actions.
