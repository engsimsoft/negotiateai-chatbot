# ТЗ-12: Secretary Integration

**Версия ТЗ:** 1.0
**Дата:** 2026-02-07
**Источник:** SECRETARY_PROMPT.md + SECRETARY_INTEGRATION.md

---

## Цель

Заменить текущий шаблонный промпт создания проекта на продуманный промпт «Секретаря» — адаптивное интервью с progressive filling, персонализацией и двухактной структурой.

## Требования

1. Заменить промпт в `buildProjectCreationPrompt()` на XML-промпт из SECRETARY_PROMPT.md
2. Передавать все 4 поля профиля: displayName, pronouns, occupation, bio
3. Модель: Gemini 3 Pro (вместо 2.5 Flash)
4. Убрать Quick Actions с экрана создания проекта
5. Обновить greeting с учётом pronouns (ты/вы)
6. Проверить лейблы UI и tool schema

## Ограничения

- Не менять провайдер (остаёмся на Gemini, Claude отключён по ADR 011)
- Не менять логику draft extraction и создания проекта
- Не менять структуру БД (поля name, description, context уже есть)

## Исходные материалы

- `SECRETARY_PROMPT.md` — полный XML-промпт секретаря
- `SECRETARY_INTEGRATION.md` — инструкция по интеграции + 8 тестов
- ADR 012 — разделение context/instruction
