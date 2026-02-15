# Roadmap ТЗ-C3: Context Window Management для обычного чата

**Создан:** 2026-02-15
**Версия проекта:** 3.21.0 → 3.22.0
**Статус:** ✅ Завершён

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 5 |
| Текущий этап | 0 (планирование) |
| Сессий (оценка) | 1-2 |

---

## Этап 1: Подготовка — адаптация инфраструктуры

**Статус:** ✅ Завершён

**Цель:** Сделать fallback-клерка и factory инструментов универсальными (работают и для задач, и для обычного чата).

**Задачи:**

- [x] **1.1** `lib/ai/clerks/snapshot-creator.ts` — сделать `taskTitle`/`taskGoal` optional, добавить `chatTitle?: string`
- [x] **1.2** `lib/prompts/clerks/snapshot-creator.md` — универсализировать промпт
- [x] **1.3** `lib/ai/tools/chat-tools.ts` — разрешить `createSnapshot` для обычного чата

**Файлы:**
- `lib/ai/clerks/snapshot-creator.ts` — адаптация интерфейса и buildUserMessage
- `lib/prompts/clerks/snapshot-creator.md` — универсализация языка
- `lib/ai/tools/chat-tools.ts` — убрать isProjectChat guard для createSnapshot

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Task expert chat route (`tasks/[taskId]/chat/route.ts`) компилируется без изменений — не сломали
- [x] 🧪 Мануальный тест: проверить что обычный чат и проектный чат работают (регрессия)

**Git (после валидации):**
```bash
git add lib/ai/clerks/snapshot-creator.ts lib/prompts/clerks/snapshot-creator.md lib/ai/tools/chat-tools.ts
git commit -m "feat(tz-c3): universalize snapshot clerk and tools factory"
```

**Критерий готовности:** Клерк принимает как task-контекст, так и chat-контекст. `createSnapshot` tool доступен для обычного чата.

---

## Этап 2: Wiring в chat/route.ts — snapshot-aware context management

**Статус:** ✅ Завершён

**Цель:** Обычный чат умеет: загружать snapshots, тримить сообщения, инжектировать контекст, предлагать создание snapshot, запускать fallback.

**Задачи:**

- [x] **2.1** Добавить импорты в начало `chat/route.ts`
- [x] **2.2** Загрузка snapshot state (безусловно, работает и для project chats)
- [x] **2.3** Snapshot-aware message trimming (messagesForModel вместо messagesFromDb в uiMessages)
- [x] **2.4** Инжекция snapshotContext в system prompt (`<previous_context>` блок)
- [x] **2.5** Генерация assistantMessageId + передача в getStandardTools
- [x] **2.6** Context suggestion injection + fallback clerk trigger
- [x] **2.7** Emit `data-context-usage` в dataStream
- [x] **2.8** onFinish filter — `tool-createSnapshot` в whitelist (КРИТИЧНО)

**Файлы:**
- `app/(chat)/api/chat/route.ts` — основная работа

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: обычный чат работает, отправка сообщений, streaming
- [x] 🧪 Мануальный тест: Gemini вызвал createSnapshot, snapshot saved в БД, нет ошибок

**Git (после валидации):**
```bash
git add app/(chat)/api/chat/route.ts
git commit -m "feat(tz-c3): context management wiring in chat route"
```

**Критерий готовности:** `chat/route.ts` содержит полную логику snapshot management. Короткие чаты работают без изменений. Длинные чаты получат suggestion при 70%.

---

## Этап 3: UI — ContextIndicator + ChatSidebar секция "Итоги"

**Статус:** ✅ Завершён

**Цель:** Пользователь видит индикатор заполненности контекста и может перейти к итогам через правую панель.

**Задачи:**

- [x] **3.1** `components/chat.tsx` — обработка `data-context-usage` event
  - Добавить state: `const [contextPercent, setContextPercent] = useState(0)`
  - В `onData` callback (~строка 208-255): обработать `data-context-usage` → `setContextPercent(data.percent)`

- [x] **3.2** `components/chat.tsx` — рендер ContextIndicator
  - Импортировать `ContextIndicator` из `@/components/projects/context-indicator`
  - Разместить НАД инпутом (в sticky bottom секции, ~строка 459-483)
  - Передать `percent={contextPercent}`

- [x] **3.3** `components/chat-sidebar.tsx` — извлечение snapshots из messages
  - В хуке `useExtractedMaterials` добавить: сканировать parts на `tool-createSnapshot` с `state === "output-available"`
  - Собирать: `{ messageId, shortSummary }` — аналогично артефактам
  - ChatSidebar уже получает `messages` — извлечение внутри хука

- [x] **3.4** `components/chat-sidebar.tsx` — рендер секции "Итоги"
  - Новая секция перед "Артефакты": `Итоги · {snapshots.length}`
  - Каждый элемент: иконка Bookmark, shortSummary (truncate), клик → `scrollToMessage(messageId)`
  - Стиль: тот же паттерн что артефакты (`hover:bg-sidebar-accent`)

- [x] **3.5** Проброс не нужен — ChatSidebar извлекает snapshots из messages внутри хука (задача 3.3)

**Файлы:**
- `components/chat.tsx` — ContextIndicator + context percent state
- `components/chat-sidebar.tsx` — секция "Итоги"
- `components/projects/context-indicator.tsx` — БЕЗ ИЗМЕНЕНИЙ (уже generic)

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: ContextIndicator не виден при коротких чатах (< 60%)
- [x] Браузер: ChatSidebar показывает секцию "Итоги" когда есть snapshots
- [x] 🧪 Мануальный тест: открыть чат, проверить что правая панель работает, артефакты и вложения не сломаны

**Git (после валидации):**
```bash
git add components/chat.tsx components/chat-sidebar.tsx
git commit -m "feat(tz-c3): context indicator and snapshots section in chat UI"
```

**Критерий готовности:** Индикатор появляется при 60%+. Секция "Итоги" в sidebar работает с навигацией к snapshot сообщениям.

---

## Этап 4: E2E тест — полный цикл snapshot в обычном чате

**Статус:** ✅ Завершён

**Цель:** Проверить полный цикл: долгий чат → suggestion → snapshot → trimming → продолжение.

**Задачи:**

- [x] **4.1** Мануальный тест: полный цикл — все инструменты, артефакты, загрузка файлов
- [x] **4.2** Фикс: Tool Activity для createDocument/updateDocument (устранение 10-30 сек пустоты)
- [x] **4.3** Фикс: имена файлов "file" → оригинальное имя
- [x] **4.4** Фикс: конвертированные файлы (.xlsx→.txt) → оригинальное расширение
- [x] **4.5** Фикс: auto-scroll при открытом артефакте (убрана агрессивная memo-оптимизация)
- [x] **4.6** Добавлена поддержка .xlsm и .csv загрузки

**Валидация этапа:**
- [x] `npm run build` — успешен
- [x] 🧪 Мануальный тест: все инструменты, артефакты, загрузка файлов — 100%

**Git (после валидации):**
```bash
git add [файлы если были фиксы]
git commit -m "fix(tz-c3): e2e fixes for chat context management"
```

**Критерий готовности:** Полный цикл работает end-to-end. Регрессии нет.

---

## Этап 5: Финализация

**Статус:** ✅ Завершён

**Задачи:**
- [x] Финальное мануальное тестирование (пользователь) — 100%
- [x] Обновить главный `CHANGELOG.md`
- [x] Обновить `SIMPLY_STATUS.md`
- [x] Обновить `CLAUDE.md` (добавить Context Management для чата в описание)
- [x] Обновить `package.json` (версия 3.22.0)
- [x] Переместить папку в `_archive/`

**Валидация:**
- [x] `npm run build` — успешен
- [x] Документация актуальна

**Git:**
```bash
git add CHANGELOG.md SIMPLY_STATUS.md CLAUDE.md package.json
git commit -m "chore(tz-c3): finalize context management v3.22.0"
```

---

## Зависимости между этапами

```
Этап 1 (инфраструктура) → Этап 2 (chat/route.ts) → Этап 3 (UI) → Этап 4 (E2E) → Этап 5 (финализация)
```

Каждый этап зависит от предыдущего. Параллельная работа невозможна (UI зависит от route, route зависит от инфраструктуры).
