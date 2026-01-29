# Дорожная карта: ТЗ-4 — Упрощение UX и исправление @-mentions

## Цель

Убрать избыточную сложность, исправить логику @-mentions и сделать интерфейс понятным для пользователя 40+ без технического бэкграунда.

**Философия:** iPhone, не Android. Меньше опций — больше пользы.

**Детали:** См. [TZ_04_UX_SIMPLIFICATION.md](TZ_04_UX_SIMPLIFICATION.md)

## Текущий статус

- **Этап:** ТЗ-4 (Упрощение UX) — ✅ ЗАВЕРШЁН
- **Прогресс:** 32/32 задач (100%)
- **Предыдущий:** ТЗ-3B — Персонализация агентов (завершён)

---

## Этапы реализации

### 4.0 Пререквизиты — Валидация текущего состояния

**Цель:** Убедиться, что проект работает перед началом рефакторинга.

- [x] Production build успешен (`npm run build`)
- [x] Приложение запускается локально (`npm run dev`)
- [x] Чат с агентом работает
- [x] @-mentions работает (текущая логика с переключением)

---

### 4.1 Удаление персонализации из UI (5 задач)

**Цель:** Убрать UI персонализации агентов, сохранив backend для будущего.

- [x] Убрать кнопку "В мои агенты" со страницы `/agents/[slug]/page.tsx`
- [x] Убрать секцию "Мои агенты" из `components/sidebar-agents.tsx`
- [x] Удалить или закомментировать импорт `PersonalizationDialog` где используется
- [x] Удалить или закомментировать импорт `DeleteAgentDialog` где используется
- [x] Проверить что страница агента показывает только "Начать чат"

**Файлы:**
- `app/(chat)/agents/[slug]/page.tsx` — убрать AddToMyAgentsButton
- `components/sidebar-agents.tsx` — убрать секцию userAgents

**Не удалять (оставить для будущего):**
- `components/personalization-dialog.tsx`
- `components/delete-agent-dialog.tsx`
- `app/(chat)/api/user-agents/` — API endpoints

---

### 4.2 @-mentions — Одноразовый вызов (4 задачи)

**Цель:** @-mention вызывает агента на консультацию, не переключая чат.

- [x] В `app/(chat)/api/chat/route.ts`: убрать вызов `updateChatAgent()` при @-mention
- [x] Сохранять `Message.agentId` = mentionedAgentId для ответа гостевого агента
- [x] Добавить логику определения гостя: `Message.agentId !== Chat.agentId`
- [x] Протестировать: после @Помощник следующее сообщение идёт основному агенту

**Файлы:**
- `app/(chat)/api/chat/route.ts` — основные изменения

---

### 4.3 Визуализация гостевых сообщений (3 задачи)

**Цель:** Гостевой ответ визуально отличается от основного агента.

- [x] В `components/message.tsx`: определить является ли сообщение гостевым
- [x] Добавить CSS-классы для гостевых сообщений (отступ, фон, border)
- [x] Добавить метку "↩️ гость" для гостевых

**Файлы:**
- `components/message.tsx` — стилизация
- `components/messages.tsx` — передача chatAgentId
- `components/chat.tsx` — передача chatAgentId

---

### 4.4 Подсказка про @-mentions (4 задачи)

**Цель:** Обновить подсказку с новой логикой + добавить иконку для повторного показа.

- [x] Обновить текст в `components/chat-hint.tsx` с новой логикой
- [x] Изменить ключ localStorage на `simply-hint-guest-agent-seen`
- [x] Добавить иконку 💡 рядом с полем ввода в `multimodal-input.tsx`
- [x] Клик на 💡 показывает подсказку повторно

**Файлы:**
- `components/chat-hint.tsx` — новый текст
- `components/multimodal-input.tsx` — иконка 💡

---

### 4.5 Suggested actions из БД (4 задачи)

**Цель:** Заменить хардкод на данные из `agent.capabilities.exampleTasks`.

- [x] В `components/suggested-actions.tsx`: получать agent через props
- [x] Использовать `agent.capabilities.exampleTasks` вместо хардкода
- [x] Добавить дефолтные suggestions когда агент не выбран
- [x] Удалить массив `suggestedActions` с хардкодом

**Файлы:**
- `components/suggested-actions.tsx` — основные изменения
- `components/multimodal-input.tsx` — передача agent
- `components/chat.tsx` — передача agentId

---

### 4.6 Шапка чата — всегда показывать агента (2 задачи)

**Цель:** Шапка всегда отображает имя и иконку текущего агента.

- [x] В `chat-header.tsx`: agent всегда отображается
- [x] Проверить работу для каталожных агентов

**Файлы:**
- `components/chat-header.tsx`

---

### 4.7 Унификация приветствия (4 задачи)

**Цель:** Убрать greeting как сообщение, использовать заголовок + suggested actions.

- [x] В `app/(chat)/api/chat/route.ts`: убрать создание greetingMessages
- [x] В `components/greeting.tsx`: персонализированный заголовок с именем пользователя (уже было)
- [x] Suggested actions отображаются в пустом чате
- [x] Suggested actions кликабельны и отправляют сообщение

**Файлы:**
- `app/(chat)/api/chat/route.ts` — убрать greetingMessages
- `components/greeting.tsx` — UI (без изменений)

---

### 4.8 Очистка хардкода (2 задачи)

**Цель:** Удалить все упоминания старого проекта.

- [x] Поиск и удаление "AGORA", "Saleor", "тендер" в UI компонентах
- [x] Проверить seed данные агентов на устаревшие примеры

**Файлы:**
- `components/suggested-actions.tsx` — очищено

---

### 4.9 Финализация (4 задачи)

**Цель:** Тестирование, сборка, документация.

- [x] `npm run build` — production build успешен
- [x] Обновить документацию: TZ_04_ROADMAP.md, CLAUDE.md
- [x] Обновить CHANGELOG.md (v2.7.0)
- [x] Коммит: "refactor: UX simplification — ТЗ-4 complete"

---

## Ключевые файлы

**Модифицированные:**
- `app/(chat)/api/chat/route.ts` — логика @-mentions (НЕ обновлять Chat.agentId), убран greeting
- `app/(chat)/agents/[slug]/page.tsx` — убрана кнопка персонализации
- `components/sidebar-agents.tsx` — убрана секция "Мои агенты"
- `components/message.tsx` — стилизация гостевых сообщений
- `components/messages.tsx` — передача chatAgentId
- `components/suggested-actions.tsx` — данные из БД вместо хардкода
- `components/chat-hint.tsx` — новый текст подсказки
- `components/multimodal-input.tsx` — иконка 💡, передача agentId
- `components/chat.tsx` — передача chatAgentId и agentId

**Сохранены для будущего:**
- `components/personalization-dialog.tsx`
- `components/delete-agent-dialog.tsx`
- `app/(chat)/api/user-agents/route.ts`
- `app/(chat)/api/user-agents/[id]/route.ts`
- Таблица `user_agents` в БД

---

## Критерии готовности

### Персонализация убрана из UI
- [x] Кнопка "В мои агенты" отсутствует на странице агента
- [x] Секция "Мои агенты" отсутствует в sidebar
- [x] Диалог персонализации не вызывается

### @-mentions работает правильно
- [x] @-mention НЕ меняет Chat.agentId
- [x] Гостевой агент отвечает один раз
- [x] Следующее сообщение без @ идёт основному агенту
- [x] Визуально гостевой ответ отличается (отступ + фон + метка)

### Подсказка
- [x] Показывается при первом чате
- [x] Объясняет @-mentions как "позвать на консультацию"
- [x] Можно закрыть
- [x] Иконка 💡 позволяет вызвать повторно

### Suggested actions
- [x] Берутся из `agent.capabilities.exampleTasks`
- [x] Разные для каждого агента
- [x] Нет упоминаний AGORA/Saleor/тендеров

### Шапка чата
- [x] Всегда показывает имя + иконку агента
- [x] Dropdown для смены работает

### Приветствие
- [x] Greeting НЕ добавляется как сообщение
- [x] Пустой чат показывает заголовок + suggested actions

### Общее
- [x] Production build успешен
- [x] Документация обновлена

---

## Текущая сессия

**2026-01-29:**
- [x] Валидация текущего состояния
- [x] 4.1: Убрана кнопка "В мои агенты" и секция "Мои агенты" из sidebar
- [x] 4.2: @-mentions теперь не меняет Chat.agentId — одноразовый "гостевой" вызов
- [x] 4.3: Гостевые сообщения визуально выделены (отступ, фон, метка "↩️ гость")
- [x] 4.4: Обновлена подсказка + иконка 💡 для повторного показа
- [x] 4.5: Suggested actions берутся из agent.capabilities.exampleTasks
- [x] 4.6: Шапка чата — без изменений (уже работало корректно)
- [x] 4.7: Убрано создание greeting message в chat route
- [x] 4.8: Хардкод AGORA/Saleor очищен
- [x] 4.9: Финальный build, документация
- ✅ ТЗ-4 завершён

---

## Связанные документы

- [TZ_04_UX_SIMPLIFICATION.md](TZ_04_UX_SIMPLIFICATION.md) — полное ТЗ
- [TZ_03B_AGENT_PERSONALIZATION.md](TZ_03B_AGENT_PERSONALIZATION.md) — ТЗ-3B (откатили UI)
- [TZ_02_MULTIAGENT_CHAT.md](TZ_02_MULTIAGENT_CHAT.md) — ТЗ-2 (исправлена логика @-mentions)
- [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md) — видение продукта
- [SIMPLY_ROADMAP.md](SIMPLY_ROADMAP.md) — общая дорожная карта проекта

---

**Создано:** 2026-01-29
**Завершено:** 2026-01-29
**Источник:** TZ_04_UX_SIMPLIFICATION.md
