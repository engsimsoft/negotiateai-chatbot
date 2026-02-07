# Roadmap ТЗ-12: Secretary Integration

**Создан:** 2026-02-07
**Версия проекта:** 3.10.0 → 3.11.0
**Статус:** В работе

> **Инструкция:** [specs/ROADMAP_GUIDE.md](../ROADMAP_GUIDE.md)

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Всего этапов | 3 |
| Текущий этап | 1 |
| Оценка сессий | 1-2 |

---

## Этапы

### Этап 1: Замена промпта и модели (backend)

**Статус:** 🔄 В работе (модель уже обновлена на gemini-3-pro)

**Цель:** Заменить шаблонный промпт на XML-промпт Секретаря, передать все поля профиля

**Задачи:**
- [x] 1.1 Обновить `getModelId()` — `project-creation` → `"gemini-3-pro"`
- [ ] 1.2 Расширить `buildSystemPrompt()` options — добавить `userPronouns`, `userBio`
- [ ] 1.3 Заменить `buildProjectCreationPrompt()` — новый XML-промпт из SECRETARY_PROMPT.md
  - Динамический `<user_context>`: пустые поля не включать
  - Подстановка {{displayName}} → userName, {{pronouns}} → userPronouns и т.д.
- [ ] 1.4 Обновить POST handler — извлечь `pronouns` и `bio` из `getUserById()`
- [ ] 1.5 Уточнить описание tool `updateProjectDraft` — description поля: "2-4 предложения" (было "1-2")

**Файлы:**
- `app/(chat)/api/service-chat/route.ts` — все изменения этого этапа

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок TypeScript
- [ ] `npm run build` — сборка успешна
- [ ] 🧪 **Мануальный тест:** Открыть создание проекта, написать "У меня кофейня на Арбате, хочу заняться маркетингом". Проверить: секретарь здоровается по имени, задаёт уточняющие вопросы, вызывает updateProjectDraft, поля заполняются.

**Git (после валидации):**
```bash
git add app/(chat)/api/service-chat/route.ts
git commit -m "feat(tz-12): replace project-creation prompt with Secretary + gemini-3-pro"
```

**Критерий готовности:** Промпт Секретаря работает, паспорт заполняется через updateProjectDraft

---

### Этап 2: Передача pronouns + обновление greeting

**Статус:** ⬜ Не начат

> ⛔ **НЕ НАЧИНАТЬ** без подтверждения валидации Этапа 1

**Цель:** Greeting уважает pronouns (ты/вы), профиль полностью передаётся в промпт

**Задачи:**
- [ ] 2.1 `page.tsx` — добавить `pronouns: userProfile.pronouns` в объект для клиента
- [ ] 2.2 `project-creation-client.tsx` — добавить `pronouns` в интерфейс `UserProfile`
- [ ] 2.3 `project-creation-client.tsx` — обновить greeting:
  - pronouns === "ты" → `"Привет, {name}! Расскажи, какой проект хочешь создать?"`
  - иначе → `"Привет, {name}! Расскажите, какой проект хотите создать?"`
  - без имени → `"Привет! Расскажите, какой проект хотите создать?"`

**Файлы:**
- `app/(dashboard)/projects/new/page.tsx` — добавить pronouns
- `app/(dashboard)/projects/new/project-creation-client.tsx` — greeting + interface

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] 🧪 **Мануальный тест:** Переключить pronouns в профиле (ты ↔ вы), открыть создание проекта. Greeting должен соответствовать.

**Git (после валидации):**
```bash
git add app/(dashboard)/projects/new/page.tsx app/(dashboard)/projects/new/project-creation-client.tsx
git commit -m "feat(tz-12): pass pronouns to greeting, respect ты/вы"
```

**Критерий готовности:** Greeting корректен для обоих вариантов обращения

---

### Этап 3: Убрать Quick Actions + Финализация

**Статус:** ⬜ Не начат

> ⛔ **НЕ НАЧИНАТЬ** без подтверждения валидации Этапа 2

**Цель:** Убрать кнопки быстрых действий, обновить subtitle, подготовить документацию

**Задачи:**
- [ ] 3.1 `project-creation.ts` (config) — удалить `quickActions`, обновить `subtitle`
- [ ] 3.2 `project-creation-client.tsx` — удалить `showQuickActions`, `handleQuickAction`, убрать передачу props
- [ ] 3.3 `project-chat-panel.tsx` — удалить пропсы и рендер quick actions, убрать импорт `QuickAction`
- [ ] 3.4 Финализация:
  - [ ] Перенести CHANGELOG.md → главный CHANGELOG.md
  - [ ] Обновить SIMPLY_STATUS.md
  - [ ] Обновить CLAUDE.md (если нужно)
  - [ ] Обновить package.json → 3.11.0
  - [ ] Переместить `specs/TZ_12_SecretaryIntegration/` → `_archive/`

**Файлы:**
- `components/service-chat/configs/project-creation.ts` — убрать quickActions
- `app/(dashboard)/projects/new/project-creation-client.tsx` — убрать quick action логику
- `app/(dashboard)/projects/new/components/project-chat-panel.tsx` — убрать quick action UI

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: экран создания — нет кнопок, чат работает корректно
- [ ] 🧪 **Мануальный тест — полный flow:**
  1. Тест 1 (стандартный диалог): "У меня кофейня на Арбате"
  2. Тест 2 (много информации): бизнес-план для инвестора
  3. Тест 3 (размытый запрос): "хочу что-то с маркетингом"
  4. Тест 6 (ты/вы): переключить pronouns
  5. Тест 7 (подсказки после оформления): проверить Акт 2

**Git (после валидации):**
```bash
git add components/service-chat/configs/project-creation.ts \
       app/(dashboard)/projects/new/project-creation-client.tsx \
       app/(dashboard)/projects/new/components/project-chat-panel.tsx
git commit -m "feat(tz-12): remove quick actions, finalize Secretary integration"
```

**Критерий готовности:** Все тесты пройдены, документация обновлена, папка в архиве

---

## Что НЕ меняем (уже корректно после ТЗ-11)

- **`project-draft-preview.tsx`** — лейблы "Название", "Описание", "Контекст проекта" ✅
- **Tool schema** — name, description, context ✅
- **`extractDraftUpdate()`** — работает с partial updates ✅
- **API schema** — профиль берётся из БД (не из request body) ✅
- **Структура БД** — колонки context и instruction уже есть ✅

---

## Правила валидации

### После каждой задачи
```bash
npx tsc --noEmit  # Должен быть 0 ошибок
```

### После каждого этапа
```bash
npm run build     # Должен пройти
npm run dev       # Проверить в браузере
```

---

## Чек-лист перехода между этапами

Прежде чем начать следующий этап:
- [ ] Все задачи текущего этапа отмечены [x]
- [ ] Валидация этапа пройдена (все пункты)
- [ ] **Git commit сделан** (фиксация этапа)
- [ ] Пользователь подтвердил мануальный тест
- [ ] CHANGELOG.md обновлён
- [ ] HANDOFF.md обновлён
