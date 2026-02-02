# Дорожная карта: ТЗ-NEW-01 — Новая архитектура промптов + Чистка UI + Модальные помощники

## Цель

Переход от системы "8 агентов в БД" к новой архитектуре:
- Файловая система промптов с TypeScript конфигами
- Модальные помощники (Prompt-агент, Бен)
- Чистый интерфейс без агентов
- Подготовка к Anthropic

**Детали:** См. [TZ_NEW_01_ARCHITECTURE_MIGRATION.md](../../TZ_NEW_01_ARCHITECTURE_MIGRATION.md)

## Текущий статус

- **Этап:** ТЗ-NEW-01 — В разработке
- **Прогресс:** 71/77 задач (92%)
- **Завершено:**
  - ✅ Фаза 1: Инфраструктура промптов (tag: `tz-new-01/phase-1-prompts`)
  - ✅ Фаза 2: Anthropic SDK (tag: `tz-new-01/phase-2-anthropic`)
  - ✅ Фаза 3: Модальные помощники (tag: `tz-new-01/phase-3-modals`)
  - ✅ Фаза 4: Чистка UI (tag: `tz-new-01/phase-4-ui-clean`)
  - ✅ Фаза 5: Чистка кода (tag: `tz-new-01/phase-5-code-clean`)
  - ✅ Фаза 6: Миграция БД (tag: `tz-new-01/phase-6-db-migration`)
  - ✅ Фаза 7: Интеграция (tag: `tz-new-01/phase-7-integration`)
  - ✅ Фаза 8: Тестирование (tag: `tz-new-01/phase-8-testing`)
- **Следующая:** Фаза 9: Финализация

---

## Отличия от ТЗ

| ТЗ предлагает | Мы делаем | Причина |
|---------------|-----------|---------|
| YAML конфиги | TypeScript конфиги | Type safety, автокомплит, меньше зависимостей |
| Handlebars для шаблонов | Простой regex template | -80KB в bundle, достаточно для {{переменных}} |
| `isFirstTime` не описан | `hasSeenBenIntro` в БД users | Синхронизация между устройствами |

---

## Git-стратегия и точки восстановления

### Ветка разработки

```bash
# Создать feature branch от master
git checkout master
git pull
git checkout -b feature/tz-new-01-architecture
```

### Точки восстановления (теги)

После каждой фазы создаём тег — точку, к которой можно откатиться:

| После фазы | Тег | Команда |
|------------|-----|---------|
| Фаза 1 | `tz-new-01/phase-1-prompts` | `git tag tz-new-01/phase-1-prompts` |
| Фаза 2 | `tz-new-01/phase-2-anthropic` | `git tag tz-new-01/phase-2-anthropic` |
| Фаза 3 | `tz-new-01/phase-3-modals` | `git tag tz-new-01/phase-3-modals` |
| Фаза 4 | `tz-new-01/phase-4-ui-clean` | `git tag tz-new-01/phase-4-ui-clean` |
| Фаза 5 | `tz-new-01/phase-5-code-clean` | `git tag tz-new-01/phase-5-code-clean` |
| Фаза 6 | `tz-new-01/phase-6-db-migration` | `git tag tz-new-01/phase-6-db-migration` |
| Фаза 7 | `tz-new-01/phase-7-integration` | `git tag tz-new-01/phase-7-integration` |

### Коммиты по фазам

```bash
# После каждой фазы
git add .
git commit -m "feat(tz-new-01): Phase X — описание"
git tag tz-new-01/phase-X-name

# Если нужно откатиться
git reset --hard tz-new-01/phase-3-modals  # Откат к Phase 3
```

### Точка невозврата

**⚠️ Фаза 6 (Миграция БД)** — после неё откат сложнее (нужен бэкап БД).

Перед Фазой 6:
```bash
# Создать бэкап БД (если нужно)
pg_dump $DATABASE_URL > backup_before_migration.sql

# Или просто пометить что это point of no return
git tag tz-new-01/BEFORE-DB-MIGRATION
```

### Финальный merge

```bash
# После успешного тестирования
git checkout master
git merge feature/tz-new-01-architecture
git push origin master

# Удалить feature branch
git branch -d feature/tz-new-01-architecture

# Push теги (опционально, для истории)
git push --tags
```

---

## Этапы реализации

### Фаза 1: Инфраструктура промптов (11 задач)

**Цель:** Создать файловую систему промптов с builder API. Не ломает текущее.

- [x] **1.1** Создать структуру папок `lib/prompts/`
- [x] **1.2** Создать `lib/prompts/types.ts` — типы PromptConfig, BuildContext, BuiltPrompt
- [x] **1.3** Создать `lib/prompts/template.ts` — простой template engine (regex replace)
- [x] **1.4** Создать `lib/prompts/core/base.ts` — базовые правила
- [x] **1.5** Создать `lib/prompts/core/formatting.ts` — форматирование
- [x] **1.6** Создать `lib/prompts/core/safety.ts` — безопасность
- [x] **1.7** Создать `lib/prompts/core/russian-market.ts` — специфика РФ
- [x] **1.8** Создать `lib/prompts/chat/config.ts` — конфиг и промпт чата
- [x] **1.9** Создать `lib/prompts/ben/config.ts` — конфиг и промпты Бена
- [x] **1.10** Создать `lib/prompts/assistants/prompt-agent/config.ts` — конфиг Prompt-агента
- [x] **1.11** Создать `lib/prompts/contexts/` — user-profile.ts, chat-memory.ts
- [x] **1.12** Создать `lib/prompts/builder.ts` — логика сборки промптов
- [x] **1.13** Создать `lib/prompts/index.ts` — экспорт buildPrompt()

**Верификация Фазы 1:**
```typescript
// Тест в консоли
import { buildPrompt } from '@/lib/prompts';
const result = await buildPrompt('chat', { user: { displayName: 'Владимир' } });
console.log(result.systemPrompt); // Содержит "Владимир"
console.log(result.model); // 'gemini-3-pro'
```

**Файлы:**
```
lib/prompts/
├── index.ts
├── types.ts
├── builder.ts
├── template.ts
├── core/
│   ├── index.ts
│   ├── base.ts
│   ├── formatting.ts
│   ├── safety.ts
│   └── russian-market.ts
├── chat/
│   └── config.ts
├── ben/
│   └── config.ts
├── assistants/
│   └── prompt-agent/
│       └── config.ts
└── contexts/
    ├── user-profile.ts
    └── chat-memory.ts
```

---

### Фаза 2: Anthropic SDK (4 задачи)

**Цель:** Установить и настроить Anthropic для будущих проектов.

- [x] **2.1** Установить `@ai-sdk/openai` для OpenRouter (вместо @ai-sdk/anthropic)
- [x] **2.2** Добавить `OPENROUTER_API_KEY` в `.env.local`
- [x] **2.3** Обновить `lib/ai/providers.ts` — добавить модели Claude через OpenRouter
- [x] **2.4** Создать тестовый endpoint `app/(chat)/api/test-anthropic/route.ts`

**Верификация Фазы 2:**
```bash
curl http://localhost:3000/api/test-anthropic
# {"success":true,"response":"Привет, я Claude!"}
```

**Файлы:**
- `lib/ai/providers.ts` — добавить anthropic
- `app/(chat)/api/test-anthropic/route.ts` — новый

---

### Фаза 3: Модальные помощники (12 задач)

**Цель:** Создать Prompt-агента и Бена как модальные помощники.

#### Prompt-агент:
- [x] **3.1** Создать `components/modal-assistants/prompt-agent/trigger.tsx` — кнопка [📝]
- [x] **3.2** Создать `components/modal-assistants/prompt-agent/drawer.tsx` — Drawer обёртка (Vaul)
- [x] **3.3** Создать `components/modal-assistants/assistant-chat.tsx` — общий мини-чат
- [x] **3.4** Создать `app/(chat)/api/assistant/prompt-agent/route.ts` — API endpoint

#### Бен:
- [x] **3.5** Создать `components/modal-assistants/ben/trigger.tsx` — кнопка [❓]
- [x] **3.6** Создать `components/modal-assistants/ben/drawer.tsx` — Drawer обёртка (Vaul)
- [x] **3.7** Общий `assistant-chat.tsx` с поддержкой разных режимов
- [x] **3.8** Создать `app/(chat)/api/assistant/ben/route.ts` — API endpoint

#### Интеграция:
- [x] **3.9** Создать `components/modal-assistants/index.ts` — экспорты
- [x] **3.10** Добавить кнопки [📝] и [❓] в header
- [x] **3.11** ~~`onInsertToChat`~~ — перенесено в Фазу 4 (опционально)
- [x] **3.12** Протестировать оба помощника

**Верификация Фазы 3:**
1. Кнопка [📝] открывает Sheet, Prompt-агент отвечает
2. Кнопка "В чат" вставляет текст в основной input
3. Кнопка [❓] открывает Sheet, Бен отвечает
4. Бен не отвечает на рабочие вопросы, перенаправляет в чат

**Файлы (реализовано):**
```
components/modal-assistants/
├── index.ts
├── types.ts
├── assistant-chat.tsx      # Общий чат-компонент
├── assistant-drawer.tsx    # Общий Drawer (Vaul)
├── prompt-agent/
│   ├── index.ts
│   ├── trigger.tsx
│   └── drawer.tsx
└── ben/
    ├── index.ts
    ├── trigger.tsx
    └── drawer.tsx

app/(chat)/api/assistant/
├── prompt-agent/route.ts
└── ben/route.ts
```

---

### Фаза 4: Чистка UI (10 задач)

**Цель:** Убрать все элементы связанные с агентами из интерфейса.

#### Header:
- [x] **4.1** Убрать dropdown выбора агента
- [x] **4.2** Убрать badge модели
- [x] **4.3** Убрать Private/Public toggle (VisibilitySelector)
- [x] **4.4** Кнопки [📝] и [❓] уже добавлены в Фазе 3
- [x] **4.5** Новая структура: SidebarToggle | Simply | New Chat | [📝] [❓]

#### Chat:
- [x] **4.6** Убрать @-mentions из `multimodal-input.tsx`
- [x] **4.7** Убрать guest styling из `message.tsx`

#### Sidebar:
- [x] **4.8** Убрать `SidebarAgents` из `app-sidebar.tsx`

#### Роутинг:
- [x] **4.9** Удалить `app/(chat)/agents/` — весь каталог
- [x] **4.10** /agents → 404 (страницы удалены)

**Верификация Фазы 4:**
1. Header чистый: только logo, новый чат, [📝], [❓], профиль
2. Ввод @ = просто текст, нет автокомплита
3. Все сообщения выглядят одинаково (нет guest styling)
4. Sidebar без агентов
5. /agents → 404

**Файлы для изменения:**
- `components/chat-header.tsx`
- `components/multimodal-input.tsx`
- `components/message.tsx`
- `components/app-sidebar.tsx`

**Файлы для удаления:**
- `app/(chat)/agents/` — весь каталог

---

### Фаза 5: Чистка кода (15 задач) ✅

**Цель:** Удалить весь код связанный с агентами.

#### API routes:
- [x] **5.1** Удалить `app/(chat)/api/agents/` — весь каталог
- [x] **5.2** Удалить `app/(chat)/api/user-agents/` — весь каталог
- [x] **5.3** Удалить `app/(chat)/api/chats/[id]/agent/route.ts` (если есть)

#### Компоненты:
- [x] **5.4** Удалить `components/agent-selector.tsx`
- [x] **5.5** Удалить `components/delete-agent-dialog.tsx`
- [x] **5.6** Удалить `components/sidebar-agents.tsx`
- [x] **5.7** Удалить `components/mention-autocomplete.tsx`
- [x] **5.8** Удалить `components/personalization-dialog.tsx`

#### Библиотеки:
- [x] **5.9** Удалить `lib/agents/` — весь каталог (parse-mentions.ts)
- [x] **5.10** Удалить `lib/db/seed-agents.ts`

#### Queries:
- [x] **5.11** Удалить из `lib/db/queries.ts`:
  - getAgents, getAgentBySlug, getAgentByName, getAgentById
  - getUserAgents, getUserAgentsWithSource, getUserAgentById
  - createUserAgent, updateUserAgent, deleteUserAgent
  - updateChatAgent

#### Schema:
- [x] **5.12** Удалить из `lib/db/schema.ts`:
  - Таблица `agent`
  - Таблица `userAgent`
  - Relations для agent/userAgent

- [x] **5.13** Удалить поле `agentId` из Drizzle schema (таблица `chat`)
- [x] **5.14** Удалить поле `agentId` из Drizzle schema (таблица `message`)
- [x] **5.15** Добавить поле `hasSeenBenIntro` в таблицу `user` — выполнено в Фазе 6

**Верификация Фазы 5:**
```bash
npm run build  # ✅ Пройден без ошибок TypeScript
```

---

### Фаза 6: Миграция БД (4 задачи) ✅

**Цель:** Применить изменения схемы к БД.

- [x] **6.1** Создать SQL миграцию
- [x] **6.2** Выполнить миграцию на dev БД
- [x] **6.3** Проверить что таблицы удалены
- [x] **6.4** Проверить что поле `hasSeenBenIntro` добавлено

**SQL миграция:**
```sql
-- Очистка данных (тестовая БД)
TRUNCATE TABLE "Message_v2" CASCADE;
TRUNCATE TABLE "Chat" CASCADE;

-- Удаление полей agentId
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "agentId";
ALTER TABLE "Message_v2" DROP COLUMN IF EXISTS "agentId";

-- Удаление таблиц агентов
DROP TABLE IF EXISTS "UserAgent" CASCADE;
DROP TABLE IF EXISTS "Agent" CASCADE;

-- Добавление флага Бена
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "has_seen_ben_intro" BOOLEAN DEFAULT false;
```

**Верификация Фазы 6:**
```bash
npm run db:migrate  # Успешно
# Проверить в Drizzle Studio что таблицы agent/userAgent отсутствуют
```

---

### Фаза 7: Интеграция (6 задач) ✅

**Цель:** Связать всё вместе, переключить chat route на builder.

- [x] **7.1** Обновить `app/(chat)/api/chat/route.ts`:
  - Использовать `buildPrompt('chat', context)` вместо загрузки из БД
  - Убрать всю логику агентов (resolveAgent, @-mentions)
  - Убрать buildAgentCustomizations

- [x] **7.2** Обновить `components/onboarding-dialog.tsx`:
  - После завершения проверить `hasSeenBenIntro`
  - Если false → открыть BenSheet с `isFirstTime={true}`
  - После закрытия → PATCH user `hasSeenBenIntro = true`

- [x] **7.3** Создать API для обновления `hasSeenBenIntro`:
  - `app/(chat)/api/user/ben-intro/route.ts` — PATCH

- [x] **7.4** Очистить неиспользуемые импорты во всех файлах

- [x] **7.5** Обновить `lib/ai/prompts.ts`:
  - Удалить `buildAgentCustomizations` (перенесено в lib/prompts)
  - Оставить `buildUserContext` для обратной совместимости или удалить

- [x] **7.6** Production build

**Верификация Фазы 7:**
```bash
npm run build  # Успешно
npm run dev    # Приложение работает
```

---

### Фаза 8: Тестирование (5 задач) ✅

**Цель:** Полное мануальное тестирование всех сценариев.

#### Автоматическое:
- [x] **8.1** `npm run build` — без ошибок
- [x] **8.2** `npm run lint` — без ошибок

#### Мануальное:
- [x] **8.3** Сценарий: Prompt-агент
  ```
  1. Нажать [📝] в header
  2. Написать: "хочу пост про кофе"
  3. Ответить на уточнения
  4. Нажать "В чат"
  5. Промпт в input основного чата
  ```

- [x] **8.4** Сценарий: Бен
  ```
  1. Нажать [❓] в header
  2. Написать: "как создать таблицу?"
  3. Бен объясняет
  4. Написать: "напиши текст про маркетинг"
  5. Бен перенаправляет в чат
  ```

- [x] **8.5** Сценарий: Онбординг + Бен (nice to have — onboarding не активирован)
  ```
  1. Зарегистрировать нового пользователя
  2. Пройти онбординг (3 шага)
  3. Бен появляется с приветствием
  4. Закрыть Бена
  5. Повторно открыть — обычный чат (не онбординг)
  ```

- [x] **8.6** Сценарий: Чистый интерфейс
  ```
  1. Header: logo, новый чат, [📝], [❓], профиль
  2. Ввод @Помощник → просто текст
  3. /agents → 404
  4. Sidebar без агентов
  ```

- [x] **8.7** Сценарий: Основной чат
  ```
  1. Новый чат
  2. Написать вопрос → ответ приходит
  3. Попросить создать таблицу → Excel artifact
  4. Голосовой ввод работает
  ```

---

### Фаза 9: Финализация (6 задач)

**Цель:** Документация и завершение.

#### Документация (SSOT):
- [ ] **9.1** Переписать `docs/ai-agents.md`:
  - Удалить все ссылки на старых агентов
  - Описать модальных помощников (Бен, Prompt-агент)
  - Обновить ссылки на `lib/prompts/`
  - Удалить схему БД Agent/UserAgent
- [ ] **9.2** Обновить `CLAUDE.md`:
  - Удалить ссылки на `lib/db/seed-agents.ts`
  - Удалить секции Agents UI/API
  - Добавить секцию Modal Assistants
  - Обновить структуру кода
- [ ] **9.3** Проверить все docs/ на актуальность ссылок

#### Финализация:
- [ ] **9.4** Обновить `SIMPLY_STATUS.md` — добавить завершённый этап
- [ ] **9.5** Обновить `CHANGELOG.md` — версия 3.0.0
- [ ] **9.6** Переместить ТЗ и дорожную карту в `_archive/`

**Коммит:**
```
feat: New prompt architecture + Modal assistants — ТЗ-NEW-01 complete

- Remove agent system (8 agents, DB tables, UI)
- Add file-based prompt system with TypeScript configs
- Add modal assistants: Prompt-agent, Ben (help)
- Add Anthropic SDK preparation
- Clean UI: no agent dropdown, no @-mentions
```

---

## Ключевые файлы

### Создать (28 файлов):

```
lib/prompts/                              # Новая система промптов
├── index.ts
├── types.ts
├── builder.ts
├── template.ts
├── core/{base,formatting,safety,russian-market}.ts
├── chat/config.ts
├── ben/config.ts
├── assistants/prompt-agent/config.ts
└── contexts/{user-profile,chat-memory}.ts

components/modal-assistants/              # Модальные помощники
├── index.ts
├── prompt-agent/{trigger,sheet,chat}.tsx
└── ben/{trigger,sheet,chat}.tsx

app/(chat)/api/assistant/                 # API помощников
├── prompt-agent/route.ts
└── ben/route.ts

app/(chat)/api/test-anthropic/route.ts    # Тест Anthropic
app/(chat)/api/user/ben-intro/route.ts    # Флаг Бена
```

### Удалить (17 файлов/папок):

```
app/(chat)/api/agents/                    # 3 файла
app/(chat)/api/user-agents/               # 2 файла
app/(chat)/agents/                        # 5 файлов
components/agent-selector.tsx
components/delete-agent-dialog.tsx
components/sidebar-agents.tsx
components/mention-autocomplete.tsx
components/personalization-dialog.tsx
lib/agents/parse-mentions.ts
lib/db/seed-agents.ts
```

### Изменить (10 файлов):

```
lib/db/schema.ts                          # -2 таблицы, -2 поля, +1 поле
lib/db/queries.ts                         # -11 функций
lib/ai/providers.ts                       # +Anthropic
app/(chat)/api/chat/route.ts              # Использовать buildPrompt
components/chat-header.tsx                # Новая структура
components/app-sidebar.tsx                # -SidebarAgents
components/multimodal-input.tsx           # -@mentions
components/message.tsx                    # -guest styling
components/onboarding-dialog.tsx          # +вызов Бена
package.json                              # +@ai-sdk/anthropic
```

---

## Критерии готовности

### Must have:
- [x] Таблицы `agent` и `userAgent` удалены из БД
- [x] Поля `agentId` удалены из `chat` и `message`
- [x] Поле `hasSeenBenIntro` добавлено в `user`
- [x] Структура `lib/prompts/` создана и работает
- [x] `buildPrompt()` возвращает корректный промпт
- [ ] Header: logo, новый чат, [📝], [❓], профиль
- [ ] @-mentions не работают (просто текст)
- [ ] Нет визуального различия сообщений
- [ ] /agents → 404
- [ ] Prompt-агент работает, "В чат" вставляет текст
- [ ] Бен работает, перенаправляет рабочие вопросы
- [ ] Anthropic SDK установлен
- [ ] Production build успешен

### Nice to have:
- [ ] Бен появляется после онбординга
- [ ] Тестовый endpoint Anthropic работает

---

## Оценка объёма

| Фаза | Задач | Описание |
|------|-------|----------|
| 1. Инфраструктура промптов | 13 | Файловая система + builder |
| 2. Anthropic SDK | 4 | Установка и настройка |
| 3. Модальные помощники | 12 | Prompt-агент + Бен |
| 4. Чистка UI | 10 | Header, chat, sidebar |
| 5. Чистка кода | 15 | Удаление файлов |
| 6. Миграция БД | 4 | SQL + применение |
| 7. Интеграция | 6 | Связывание всего |
| 8. Тестирование | 7 | Мануальные сценарии |
| 9. Финализация | 6 | Документация + SSOT |
| **Итого** | **77** | |

---

## Связанные документы

- [TZ_NEW_01_ARCHITECTURE_MIGRATION.md](../../TZ_NEW_01_ARCHITECTURE_MIGRATION.md) — полное ТЗ
- [SIMPLY_STATUS.md](../../SIMPLY_STATUS.md) — текущее состояние
- [SIMPLY_PRODUCT_VISION.md](../../SIMPLY_PRODUCT_VISION.md) — видение продукта

---

**Создано:** 2026-02-01
**Статус:** К разработке
