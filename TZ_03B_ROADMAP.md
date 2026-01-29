# Дорожная карта: ТЗ-3B — Персонализация агентов

## Цель

Реализовать диалоговую персонализацию агентов, где пользователь создаёт персональную копию агента через скриптованный диалог (4 шага).

**Детали:** См. [TZ_03B_AGENT_PERSONALIZATION.md](TZ_03B_AGENT_PERSONALIZATION.md)

## Текущий статус

- **Этап:** ТЗ-3B (Персонализация агентов) — ✅ ЗАВЕРШЁН
- **Прогресс:** 44/44 задач (100%)
- **Предыдущий:** ТЗ-3A — Профиль пользователя (завершён)

---

## Этапы реализации

### 3B.0 Пререквизиты — Валидация ТЗ-3A (9 задач)

**Цель:** Убедиться, что ТЗ-3A полностью работоспособно перед началом ТЗ-3B.

- [x] Страница настроек `/settings` работает
- [x] Профиль пользователя сохраняется в БД (displayName, pronouns, occupation, bio)
- [x] Агенты используют данные профиля в промптах
- [x] Приветствие на главной персонализировано
- [x] Секция "Мои агенты" в sidebar показывает "Пока пусто"
- [x] Кнопка "+ В мои агенты" на странице агента (disabled)
- [x] Production build успешен
- [x] Мануальное тестирование пройдено
- [x] SIMPLY_ROADMAP.md актуален

---

### 3B.1 Типы и схема БД (3 задачи)

**Цель:** Обновить типы для соответствия ТЗ-3B.

- [x] Обновить тип `AgentCustomizations` в `lib/db/schema.ts`: заменить `brief` на `expert`
- [x] Убрать неиспользуемые поля из типа (userAddress, userContext, systemPromptOverride — берутся из профиля или не нужны)
- [x] Убедиться что таблица `userAgent` не требует миграции (структура уже подходит)

**Файлы:**
- `lib/db/schema.ts`

**Итоговый тип:**
```typescript
export type AgentCustomizations = {
  communicationStyle?: "formal" | "friendly" | "expert";
  specialization?: string;
};
```

---

### 3B.2 API endpoints (6 задач)

**Цель:** Создать CRUD API для персональных агентов.

- [x] Добавить POST в `/api/user-agents/route.ts` — создание персонального агента
- [x] Создать файл `app/(chat)/api/user-agents/[id]/route.ts`
- [x] Реализовать PATCH `/api/user-agents/[id]` — обновление
- [x] Реализовать DELETE `/api/user-agents/[id]` — удаление (soft delete: isActive = false)
- [x] Добавить query `createUserAgent()` в `lib/db/queries.ts`
- [x] Добавить queries `updateUserAgent()`, `deleteUserAgent()` в `lib/db/queries.ts`

**Файлы:**
- `app/(chat)/api/user-agents/route.ts` — добавить POST
- `app/(chat)/api/user-agents/[id]/route.ts` — новый файл
- `lib/db/queries.ts`

---

### 3B.3 Диалог персонализации (8 задач)

**Цель:** Создать скриптованный диалог (не AI) для настройки агента.

- [x] Создать компонент `PersonalizationDialog` (`components/personalization-dialog.tsx`)
- [x] Реализовать структуру шагов (steps array с типами)
- [x] Шаг 1: Ввод имени агента (text input, default "Мой {agentName}")
- [x] Шаг 2: Выбор стиля (buttons: Дружелюбный, Деловой, Экспертный)
- [x] Шаг 3: Специализация (text input, опционально, кнопка "Пропустить")
- [x] Шаг 4: Подтверждение (summary настроек, кнопки "Изменить" / "Создать")
- [x] После создания: success экран с кнопками "Начать чат" / "Закрыть"
- [x] Прогресс-индикатор внизу модального окна (шаг X из 4)

**Файлы:**
- `components/personalization-dialog.tsx` — новый файл

---

### 3B.4 Страница агента — Кнопка "В мои агенты" (4 задачи)

**Цель:** Активировать кнопку и открывать диалог персонализации.

- [x] Создать `AddToMyAgentsButton` компонент
- [x] Убрать `disabled` с кнопки "+ В мои агенты"
- [x] Добавить state для открытия диалога
- [x] Проверить что пользователь ещё не добавил этого агента (показывать "Уже добавлен" если есть)

**Файлы:**
- `app/(chat)/agents/[slug]/page.tsx`
- `app/(chat)/agents/[slug]/add-to-my-agents-button.tsx` — новый файл

---

### 3B.5 Sidebar — Секция "Мои агенты" (5 задач)

**Цель:** Отображать персональные агенты пользователя в sidebar.

- [x] Загружать user agents через GET `/api/user-agents` в `sidebar-agents.tsx`
- [x] Отображать список персональных агентов вместо "Пока пусто"
- [x] Каждый агент — кликабельный (создаёт новый чат)
- [x] При наведении показывать меню (⋯) → Редактировать / Удалить
- [x] Показывать иконку базового агента + имя персональной копии

**Файлы:**
- `components/sidebar-agents.tsx`

---

### 3B.6 Применение настроек в чате (5 задач)

**Цель:** Персональные агенты используют customizations в промптах.

- [x] Создать функцию `buildAgentCustomizations(customizations)` в `lib/ai/prompts.ts`
- [x] Обновить chat route: загружать userAgent если agentId не найден в каталоге
- [x] Применять customizations к system prompt (стиль, специализация)
- [x] Комбинировать: userContext (из профиля) + agentCustomizations + baseAgent.systemPrompt
- [x] Тест: персональный агент использует правильный стиль и специализацию

**Файлы:**
- `lib/ai/prompts.ts`
- `app/(chat)/api/chat/route.ts`

---

### 3B.7 Редактирование персональных агентов (4 задачи)

**Цель:** Возможность изменить настройки персонального агента.

- [x] Переиспользовать `PersonalizationDialog` в режиме редактирования
- [x] Предзаполнять поля текущими значениями
- [x] Добавить кнопку "Оставить как есть" для пропуска шагов
- [x] Вызов из меню (⋯) в sidebar

**Файлы:**
- `components/personalization-dialog.tsx` (режим edit)
- `components/sidebar-agents.tsx` (меню редактирования)

---

### 3B.8 Удаление персональных агентов (3 задачи)

**Цель:** Возможность удалить персонального агента.

- [x] Создать компонент `DeleteAgentDialog` с подтверждением
- [x] Вызов из меню (⋯) в sidebar
- [x] Soft delete через API (isActive = false)

**Файлы:**
- `components/delete-agent-dialog.tsx` — новый файл
- `components/sidebar-agents.tsx`

---

### 3B.9 Финализация (5 задач)

**Цель:** Тестирование, сборка, документация.

- [x] `npm run build` — production build успешен
- [x] Обновить документацию: TZ_03B_ROADMAP.md
- [x] Обновить SIMPLY_ROADMAP.md, CLAUDE.md
- [x] Обновить CHANGELOG.md (v2.6.0)
- [x] Коммит: "feat: agent personalization — ТЗ-3B complete"

---

## Ключевые файлы

**Новые:**
- `components/personalization-dialog.tsx` — диалог персонализации
- `components/delete-agent-dialog.tsx` — подтверждение удаления
- `app/(chat)/api/user-agents/[id]/route.ts` — PATCH, DELETE endpoints
- `app/(chat)/agents/[slug]/add-to-my-agents-button.tsx` — кнопка "В мои агенты"

**Модифицируемые:**
- `lib/db/schema.ts` — тип AgentCustomizations
- `lib/db/queries.ts` — createUserAgent, updateUserAgent, deleteUserAgent, getUserAgentsWithSource
- `app/(chat)/api/user-agents/route.ts` — добавить POST
- `app/(chat)/agents/[slug]/page.tsx` — кнопка "В мои агенты"
- `components/sidebar-agents.tsx` — секция "Мои агенты"
- `lib/ai/prompts.ts` — buildAgentCustomizations
- `app/(chat)/api/chat/route.ts` — применение customizations

**Документация (обновить после):**
- SIMPLY_ROADMAP.md, CLAUDE.md, CHANGELOG.md

---

## Критерии готовности

### Валидация ТЗ-3A (перед началом)
- [x] Все пункты чеклиста из раздела "Пререквизиты" выполнены

### Диалог персонализации
- [x] Кнопка "В мои агенты" открывает модальное окно
- [x] Диалог проходит все 4 шага
- [x] Кнопки выбора работают
- [x] Текстовый ввод работает
- [x] Можно пропустить специализацию
- [x] Шаг подтверждения показывает все настройки
- [x] Кнопка "Изменить" возвращает к редактированию
- [x] После создания агент появляется в "Мои агенты"

### Отображение
- [x] Персональные агенты в sidebar
- [x] Иконка и имя персональной копии отображаются
- [x] Меню (⋯) с действиями

### Использование
- [x] Можно начать чат с персональным агентом
- [x] Промпт включает данные из профиля пользователя
- [x] Промпт включает настройки агента (стиль, специализация)
- [x] Агент работает согласно настройкам

### Редактирование и удаление
- [x] Можно открыть редактирование из sidebar
- [x] Редактирование показывает текущие значения
- [x] Изменения сохраняются
- [x] Удаление работает с подтверждением

### Общее
- [x] Production build успешен
- [x] Нет регрессий в функционале ТЗ-3A
- [x] Документация обновлена

---

## Текущая сессия

**2026-01-29:**
- [x] Валидация ТЗ-3A — пройдена
- [x] Обновлён тип AgentCustomizations (brief → expert)
- [x] API: POST /api/user-agents (создание)
- [x] API: PATCH /api/user-agents/[id] (обновление)
- [x] API: DELETE /api/user-agents/[id] (soft delete)
- [x] Queries: createUserAgent, updateUserAgent, deleteUserAgent, getUserAgentsWithSource
- [x] PersonalizationDialog — 4 шага + режим редактирования
- [x] AddToMyAgentsButton — кнопка на странице агента
- [x] DeleteAgentDialog — подтверждение удаления
- [x] Sidebar: секция "Мои агенты" с меню действий
- [x] buildAgentCustomizations — применение стиля и специализации
- [x] Chat route: fallback на userAgent, применение customizations
- [x] npm run build — успешно

---

## Связанные документы

- [TZ_03B_AGENT_PERSONALIZATION.md](TZ_03B_AGENT_PERSONALIZATION.md) — полное ТЗ
- [TZ_03A_USER_PROFILE.md](TZ_03A_USER_PROFILE.md) — ТЗ-3A (завершено)
- [TZ_02_MULTIAGENT_CHAT.md](TZ_02_MULTIAGENT_CHAT.md) — ТЗ-2 (завершено)
- [SIMPLY_ROADMAP.md](SIMPLY_ROADMAP.md) — общая дорожная карта проекта

---

**Создано:** 2026-01-29
**Источник:** TZ_03B_AGENT_PERSONALIZATION.md
