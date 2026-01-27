# Family AI Assistant — Полный обзор проекта

**Версия:** 2.1.4
**Дата:** 2026-01-27
**Статус:** ✅ Production Ready
**Production URL:** https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app

> **Назначение документа:** Предоставить полную актуальную информацию о состоянии проекта для разработки новых технических заданий и архитектурных решений.

---

## 📖 О проекте

### Что это?

**Family AI Assistant** — персональный семейный AI-ассистент с ролями и специализированными агентами на базе Google Gemini.

### Для кого?

Приватный проект для **двух пользователей** с разными потребностями:

| Пользователь | Роль | Потребности | Email |
|--------------|------|-------------|-------|
| **Владимир** | Инженер (engineer) | Технический помощник, личностный рост, развлечение | vladimir@family.local |
| **Юлия** | Маркетолог (marketer) | Маркетинг, копирайтинг, переводы, кулинария, астрология, развлечение | julia@family.local |

### Ключевая особенность

**Система из 8 специализированных AI-агентов** с персонализацией по ролям и автоматическим выбором AI модели для оптимизации затрат и качества ответов.

---

## ✅ Что реализовано (Этапы 1-3)

### Этап 1: Очистка и подготовка (ЗАВЕРШЁН - 2026-01-26)

**Цель:** Переиспользование кодовой базы NegotiateAI для нового назначения

**Выполнено:**
- ✅ Создана архивная ветка `archive/mir-trade-v1.0.14` (старый проект MIR.TRADE)
- ✅ Обновлена документация (README.md, CLAUDE.md, docs/*)
- ✅ Созданы ADR (Architecture Decision Records):
  - [ADR 001: Почему Google Gemini](docs/decisions/001-why-gemini.md)
  - [ADR 002: Концепция семейного бота](docs/decisions/002-family-bot-concept.md)
  - [ADR 003: Отказ от guest режима](docs/decisions/003-no-guest-mode.md)
- ✅ Удалены устаревшие файлы (126 файлов, ~75MB)
- ✅ Production build протестирован ✅

**Результат:** Кодовая база полностью очищена от legacy кода, документация актуальна

---

### Этап 2: Авторизация и роли (ЗАВЕРШЁН - 2026-01-27)

**Цель:** Убрать guest mode, добавить роли пользователей

**Выполнено:**
- ✅ Удален guest режим полностью
- ✅ Добавлена колонка `role` в таблицу User (миграция 0009)
- ✅ Создан seed скрипт для тестовых пользователей (`npm run db:seed`)
- ✅ Middleware обновлён (redirect на /login вместо guest)
- ✅ NextAuth 5.0 настроен корректно
- ✅ Типы упрощены (Session/User)

**База данных:**
- **User**: `id`, `email`, `role` (engineer/marketer), `password` (hashed)
- **Chat**: `id`, `userId`, `title`, `agentId`, `createdAt`
- **Message**: `id`, `chatId`, `role`, `content`, `createdAt`
- **Document**: артефакты (text, code, sheet)
- NextAuth таблицы: Session, Account, VerificationToken

**Результат:** Система авторизации работает, 2 пользователя с разными ролями

---

### Этап 3: AI-агенты и персонализация (ЗАВЕРШЁН - 2026-01-27)

**Цель:** Система специализированных AI-агентов с автоматическим выбором модели

#### 🤖 8 специализированных AI-агентов

**Полный список:**

| Агент | Иконка | Роль | Модель | Назначение |
|-------|--------|------|--------|------------|
| **Маркетолог** | 📊 | Marketer | Gemini 3 Pro | Профессиональный маркетинговый консультант: стратегия, аналитика, целевая аудитория, продвижение в VK/Telegram |
| **Копирайтер** | ✍️ | Marketer | Gemini 3 Pro | Создание продающих текстов для соцсетей: посты, рекламные тексты, короткие абзацы с эмодзи, SMM |
| **Переводчик** | 🌐 | Marketer | Gemini 3 Pro | Точный перевод с учетом контекста: технические термины, сохранение стиля, многоязычность |
| **Кулинар** | 🍳 | Marketer | Gemini 2.5 Flash | Кулинарный помощник: подробные рецепты, советы по готовке, ингредиенты |
| **Астролог** | ⭐ | Marketer | Gemini 2.5 Flash | Нумерология и гороскопы: использует getCurrentDate для актуальных прогнозов |
| **Наставник** | 📚 | Both | Gemini 3 Pro | Личностный рост по методике Стивена Кови: 7 навыков, целеполагание, саморазвитие |
| **Универсальный** | 💬 | Both | Gemini 2.5 Flash | Общий ассистент для любых задач: помощь по любым вопросам |
| **Одессит** | 😄 | Both | Gemini 2.5 Flash | Развлекательный агент: одесский юмор, байки, webSearch для информации |

**Персонализация по ролям:**
- **Юлия (marketer)**: видит все 8 агентов
- **Владимир (engineer)**: видит 3 агента (Наставник, Универсальный, Одессит)

**Технические детали:**
- **Промпты:** Markdown файлы в `lib/ai/agents/*.md` (один файл = один агент)
- **Конфигурация:** `lib/ai/agents/index.ts` (AGENTS массив)
- **Загрузка:** `lib/ai/prompts.ts` функция `loadAgentPrompt()` с кешированием
- **Выбор модели:** `getModelForAgent(agentId)` → `agent.defaultModel`
- **БД:** Поле `agentId` в таблице `chat` (миграция 0010)

**UI особенности:**
- Главный экран с карточками агентов (Grid layout, адаптивный дизайн)
- Иконки агентов в header чата и sidebar history
- Приветственные сообщения при создании нового чата
- Badge индикатор активной AI модели (🤖 "Авто", "Gemini 3 Pro", etc.)

**ADR:** [docs/decisions/004-agent-system.md](docs/decisions/004-agent-system.md) - полное обоснование архитектурного решения

---

#### 🧠 Автоматический выбор AI моделей (v2.1.0-2.1.1)

**Доступные модели:**

| Модель | ID | Назначение | Использование | Характеристики |
|--------|-----|------------|---------------|----------------|
| **Gemini 3 Pro** | `gemini-3-pro-preview` | Профессиональные чаты с агентами | Маркетолог, Копирайтер, Переводчик, Наставник | 1M контекст, dynamic thinking, $2/$12 за 1M |
| **Gemini 2.5 Flash** | `gemini-2.5-flash` | Развлекательные чаты, быстрые задачи | Кулинар, Астролог, Универсальный, Одессит | Быстрее и дешевле |
| **Gemini 2.5 Pro** | `gemini-2.5-pro` | Артефакты и suggestions (internal) | Text/Code/Sheet artifacts, AI suggestions | Высокое качество генерации кода/текста |

**Режимы выбора модели:**
- **"auto" (по умолчанию)** - система автоматически выбирает оптимальную модель для агента
- **"gemini-3-pro"** - ручной выбор профессиональной модели
- **"gemini-2.5-flash"** - ручной выбор быстрой модели

**Конфигурация:**
- **Файл:** [lib/ai/models.ts](lib/ai/models.ts) - `DEFAULT_CHAT_MODEL = "auto"`
- **Provider:** [lib/ai/providers.ts](lib/ai/providers.ts) - Google AI SDK настройки
- **Выбор на сервере:** [app/(chat)/api/chat/route.ts](app/(chat)/api/chat/route.ts)

**UI индикатор модели (v2.1.1):**
- Badge в header чата с иконкой 🤖
- Показывает: "Авто", "Gemini 3 Pro" или "Gemini 2.5 Flash"
- Tooltip объясняет режим (автоматический vs ручной выбор)
- Адаптивный дизайн (мобильный: короткое название, десктоп: полное)

---

#### 🛠️ AI-инструменты

**Все агенты имеют доступ ко всем инструментам:**

##### 1. Интернет и поиск

**Web Search (Brave Search API)**
- **Возможности:** Поиск актуальной информации в интернете, новости, текущие события
- **Параметры:** До 20 результатов, фильтрация по стране/языку, автоопределение языка (русский/английский)
- **Требования:** `BRAVE_SEARCH_API_KEY` в .env.local
- **Файл:** [lib/ai/tools/web-search.ts](lib/ai/tools/web-search.ts)
- **Использование:** "Найди последние новости о Next.js 15"

##### 2. Зрение и распознавание

**Image OCR (Google Gemini Vision)**
- **Форматы:** JPG, JPEG, PNG
- **Возможности:** Распознавание текста на фото, анализ скриншотов, чтение таблиц (Markdown)
- **Модель:** Gemini 2.5 Flash
- **Файл:** [lib/ai/vision-ocr.ts](lib/ai/vision-ocr.ts)

**PDF OCR**
- **Возможности:** Чтение текстовых PDF, распознавание отсканированных PDF, многостраничные документы
- **Таймауты:** До 120 секунд для больших файлов

**Загрузка файлов через чат**
- **Лимит:** 20MB
- **Форматы:** JPG, PNG, PDF, DOCX, TXT, MD
- **Хранилище:** Vercel Blob Storage
- **Обработка:** DOCX → TXT (mammoth), PDF/Images → multimodal

##### 3. База знаний (Knowledge Base)

**Read Document**
- **Путь:** `knowledge/` папка (security-restricted)
- **Форматы:** DOCX, PDF, TXT, MD, JPG, JPEG, PNG
- **Возможности:** Чтение из базы знаний, OCR для изображений/PDF, индекс в `knowledge/index.md`
- **Безопасность:** Directory traversal защита, только knowledge/ доступна
- **Файл:** [lib/ai/tools/read-document.ts](lib/ai/tools/read-document.ts)
- **Использование:** "Прочитай knowledge/index.md"

##### 4. Артефакты (Artifacts)

**Text Artifact (текстовые документы)**
- **Возможности:** Markdown форматирование, копирование, AI suggestions, потоковое создание
- **Модель:** Gemini 2.5 Pro (internal `artifact-model`)
- **Файлы:** [artifacts/text/server.ts](artifacts/text/server.ts), [artifacts/text/client.tsx](artifacts/text/client.tsx)

**Code Artifact (код)**
- **Возможности:** Python, JavaScript, HTML/CSS, подсветка синтаксиса, копирование
- **Модель:** Gemini 2.5 Pro (internal `artifact-model`)
- **Файлы:** [artifacts/code/server.ts](artifacts/code/server.ts), [artifacts/code/client.tsx](artifacts/code/client.tsx)

**Sheet Artifact (таблицы)**
- **Возможности:** CSV данные, интерактивная таблица, экспорт CSV
- **Модель:** Gemini 2.5 Pro (internal `artifact-model`)
- **Файлы:** [artifacts/sheet/server.ts](artifacts/sheet/server.ts), [artifacts/sheet/client.tsx](artifacts/sheet/client.tsx)

**Хранение:** Все артефакты сохраняются в БД (таблица `documents`), привязаны к пользователю

**Sharing (планируется Stage 4):**
- Artifact-only sharing - публичные ссылки на артефакты БЕЗ истории чата
- Use case: Юлия создает презентацию → делится с боссом → босс видит только результат

##### 5. Публичный доступ к чатам (Visibility)

**Chat Visibility Selector**
- **Возможности:** Переключение между Private (по умолчанию) и Public режимами
- **Private (🔒):** Только владелец чата имеет доступ
- **Public (🌐):** Любой человек с ссылкой может просмотреть чат (read-only)
- **Файл:** [components/visibility-selector.tsx](components/visibility-selector.tsx)
- **БД:** Поле `visibility` в таблице `chat` (enum: private/public, default: private)

**Use Case:**
- Юлия работает с Маркетологом над стратегией
- Хочет показать результат коллеге/боссу
- Переключает чат на "Public" → копирует ссылку → отправляет
- Коллега открывает → видит весь чат (историю переписки + артефакты)
- После показа переключает обратно на "Private"

**Важно:**
- Public mode показывает ВСЮ историю чата (все сообщения)
- Для sharing только артефакта БЕЗ истории → использовать Artifact-only sharing (Stage 4)

##### 6. Утилиты

**Get Current Date**
- **Возможности:** ISO 8601 формат, Unix timestamp, часовой пояс, русский формат
- **Файл:** [lib/ai/tools/get-current-date.ts](lib/ai/tools/get-current-date.ts)
- **Использование:** "Какой сегодня день?" (для Астролога)

**Get Weather**
- **Возможности:** Погода по координатам/городу, текущая температура, восход/закат, почасовой прогноз
- **API:** Open-Meteo (бесплатный)
- **Файл:** [lib/ai/tools/get-weather.ts](lib/ai/tools/get-weather.ts)

**Request Suggestions**
- **Назначение:** Предложения по улучшению текстовых артефактов
- **Возможности:** До 5 умных предложений, описание каждого изменения
- **Модель:** Gemini 2.5 Pro
- **Файл:** [lib/ai/tools/request-suggestions.ts](lib/ai/tools/request-suggestions.ts)

**Полное описание:** [docs/ai-capabilities.md](docs/ai-capabilities.md)

---

#### 🎨 UI/UX особенности

**Главный экран (Agent Selector):**
- Grid layout с карточками агентов (1 колонка mobile, 2 tablet, 3 desktop)
- Каждая карточка: иконка (48px), название, описание (2 строки), hover эффект
- Фильтрация по роли: `getAgentsByRole(user.role)`
- Клик на агента → создание нового чата с `agentId`

**Chat Header:**
- Иконка и название агента
- Badge индикатор модели (🤖 "Авто", "Gemini 3 Pro", etc.)
- Tooltip с объяснением режима
- Адаптивный дизайн (скрывает иконку на мобильных)

**Sidebar History:**
- Иконки агентов в истории чатов
- Группировка по датам (Today, Yesterday, Last Week, etc.)
- Fallback: 💬 если агент не найден

**Приветственные сообщения:**
- Каждый агент приветствует пользователя при создании чата
- Уникальный текст для каждого агента
- Автоматически добавляется в initialMessages

---

## 🏗️ Технический стек

### Frontend
- **Next.js 15.3** - App Router, React Server Components
- **React 18** - UI библиотека
- **TypeScript** - Type safety
- **Tailwind CSS** - Стилизация
- **Vercel AI SDK UI** - Chat компоненты

### AI и ML
- **Google Gemini 3 Pro** - Профессиональные задачи (dynamic thinking, 1M контекст)
- **Google Gemini 2.5 Flash** - Быстрые задачи, развлечение
- **Vercel AI SDK** (@ai-sdk/google) - Streaming, tool calling
- **Brave Search API** - Web search
- **Open-Meteo API** - Погода

### Backend
- **NextAuth 5.0-beta.25** - Авторизация
- **PostgreSQL (Neon)** - База данных
- **Drizzle ORM** - Type-safe database queries
- **Vercel Blob Storage** - Файловое хранилище

### Deployment
- **Vercel** - Production hosting
- **GitHub** - Source control
- **Environment Variables** - Через Vercel Dashboard

### Инструменты разработки
- **npm** - Package manager
- **ESLint** - Code linting
- **TypeScript** - Компилятор

---

## 📐 Архитектура

### Слои приложения

```
┌─────────────────────────────────────────────┐
│         User (Browser)                      │
│   Владимир (Инженер) / Юлия (Маркетолог)    │
└──────────────────┬──────────────────────────┘
                   │ HTTP/WebSocket
                   ▼
┌─────────────────────────────────────────────┐
│      Next.js Application (Vercel)           │
│  ┌───────────────────────────────────────┐  │
│  │  App Router (app/)                    │  │
│  │  ├── (auth)/ - NextAuth 5.0           │  │
│  │  ├── (chat)/ - Chat UI                │  │
│  │  └── api/chat/ - Chat API endpoint    │  │
│  └───────────────────────────────────────┘  │
│                    │                         │
│  ┌───────────────────────────────────────┐  │
│  │  Business Logic (lib/)                │  │
│  │  ├── ai/agents/ - 8 агентов           │  │
│  │  ├── ai/prompts.ts - Загрузка         │  │
│  │  ├── ai/providers.ts - Gemini config  │  │
│  │  ├── ai/tools/ - AI инструменты       │  │
│  │  └── db/ - Drizzle queries/schema     │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│      External Services                      │
│  ├── Google Gemini API (3 Pro + 2.5 Flash) │
│  ├── Brave Search API                       │
│  ├── PostgreSQL (Neon)                      │
│  └── Vercel Blob Storage                    │
└─────────────────────────────────────────────┘
```

### Поток данных при работе с агентом

```
1. User выбирает агента → создается чат с agentId
2. User отправляет сообщение
3. API route:
   - Получает agentId из chat
   - Загружает промпт: loadAgentPrompt(agentId)
   - Выбирает модель: getModelForAgent(agentId) или user choice
   - Формирует tools (все доступны всем агентам)
4. Вызов Google Gemini API:
   - streamText({ system: agentPrompt, model: modelId, tools })
5. Gemini анализирует запрос + промпт + tools
6. Gemini может вызвать tools (webSearch, getCurrentDate, etc.)
7. Streaming ответа клиенту
8. UI отображает ответ с Markdown форматированием
```

### Персонализация по ролям

```typescript
// 1. Определение роли пользователя
const user = await getUser(session.userId);
const userRole = user.role; // 'engineer' | 'marketer'

// 2. Фильтрация агентов
const agents = getAgentsByRole(userRole);
// Юлия (marketer) → 8 агентов
// Владимир (engineer) → 3 агента

// 3. Загрузка промпта агента
const agentPrompt = await loadAgentPrompt(agentId);

// 4. Выбор AI модели
const modelId = selectedChatModel === "auto"
  ? getModelForAgent(agentId)  // автовыбор
  : selectedChatModel;          // ручной выбор

// 5. Отправка в Gemini
const { stream } = await streamText({
  model: google(modelId),
  system: agentPrompt,
  messages: chatHistory,
  tools: allTools
});
```

---

## ⚠️ Ограничения и требования

### Что НЕ поддерживается

❌ Прямой экспорт артефактов в PDF
❌ Экспорт таблиц в XLSX (только CSV через копирование)
❌ Запись файлов в `knowledge/` (только чтение)
❌ Загрузка файлов > 20MB
❌ Генерация изображений (DALL-E, Stable Diffusion)
❌ Аудио/видео обработка
❌ Открытая регистрация (только 2 пользователя)

### Требования

**API ключи (.env.local):**
- `GOOGLE_GENERATIVE_AI_API_KEY` - обязательно (Google AI Studio)
- `BRAVE_SEARCH_API_KEY` - опционально (для webSearch)
- `AUTH_SECRET` - обязательно (`openssl rand -base64 32`)
- `POSTGRES_URL` - обязательно (Neon или Vercel Postgres)
- `BLOB_READ_WRITE_TOKEN` - обязательно (Vercel Blob Storage)

**Хранилище:**
- Vercel Blob Storage - для загрузки файлов
- PostgreSQL/Neon - для сохранения чатов, артефактов, suggestions

**Папка knowledge/:**
- Должна существовать в корне проекта
- Рекомендуется `knowledge/index.md` с индексом файлов
- Используется для read_document tool

---

## 📈 Планы развития

### ✅ Этап 3: AI-агенты — ЗАВЕРШЁН (2026-01-27)

**Выполнено:**
- ✅ 8 специализированных AI-агентов с уникальными промптами
- ✅ Автоматический выбор AI модели (Gemini 3 Pro / 2.5 Flash)
- ✅ Персонализация по ролям (engineer/marketer)
- ✅ Иконки и приветствия в UI
- ✅ Миграция БД (поле `agentId` в таблице `chat`)
- ✅ Тестирование под обоими пользователями
- ✅ Production build успешен
- ✅ UI индикатор модели и режим "auto" по умолчанию

**Документация:**
- [CHANGELOG.md v2.1.1](CHANGELOG.md#211---2026-01-27---ui-model-indicator--auto-mode-default)
- [CHANGELOG.md v2.1.0](CHANGELOG.md#210---2026-01-27---stage-3-ai-agents-system-)
- [TZ_STAGE_3_ROADMAP.md](TZ_STAGE_3_ROADMAP.md) - полная дорожная карта
- [ADR 004: Agent System](docs/decisions/004-agent-system.md)

---

### 🚧 Этап 4: Система проектов (ПЛАНИРУЕТСЯ)

**Цель:** База знаний per-project, привязка чатов к проектам

**Ключевые задачи:**

#### 1. База данных (1-2 дня)
- [ ] Таблица `Project` в БД (название, описание, иконка, цвет, userId)
- [ ] Таблица `ProjectFile` (файлы проекта = база знаний)
- [ ] Привязка чатов к проектам (поле `projectId` в таблице `chat`)
- [ ] Миграции Drizzle

#### 2. API для загрузки файлов (2-3 дня)
- [ ] Endpoint `POST /api/files/upload` (пока отсутствует!)
- [ ] Загрузка в Vercel Blob Storage
- [ ] Извлечение текста из PDF/DOCX (OCR)
- [ ] Сохранение metadata в БД (ProjectFile)
- [ ] Валидация: размер < 20MB, allowed mime types

#### 3. UI управления проектами (2-3 дня)
- [ ] Страница `/projects` - список проектов
- [ ] Модальное окно создания проекта (название, описание, иконка, цвет)
- [ ] Страница `/projects/[id]` - детали проекта
- [ ] Загрузка файлов в проект (drag & drop)
- [ ] Список файлов проекта с preview
- [ ] Удаление файлов

#### 4. Группировка чатов по проектам (1-2 дня)
- [ ] Sidebar: группировка чатов по проектам
- [ ] "Без проекта" - старые чаты
- [ ] Выбор проекта при создании нового чата
- [ ] Иконка проекта в header чата

#### 5. AI tool для чтения файлов проекта (2-3 дня)
- [ ] Обновить `read_document` tool:
  - Читать из Vercel Blob вместо локальной папки knowledge/
  - Фильтрация по projectId текущего чата
  - Автоматическое предложение релевантных файлов
- [ ] Простой поиск по ключевым словам (без vector search на старте)
- [ ] Логирование: какие файлы использовал AI

#### 6. Artifact-only sharing (2-3 дня) 🎯 NEW!
- [ ] Database schema: добавить `isPublic`, `shareToken` в таблицу Document
- [ ] Database queries: shareDocument, unshareDocument, getPublicDocument
- [ ] API endpoint: POST/DELETE `/api/document/[id]/share`
- [ ] Public share page: `/share/artifact/[token]` (БЕЗ авторизации!)
- [ ] UI: Share buttons в артефактах (Text, Code, Sheet)
- [ ] Security: noindex meta tags, проверка владения, токены nanoid(32)
- [ ] Testing: публичный доступ работает, приватные артефакты защищены

**Use Case:**
- Юлия создает HTML презентацию с агентом
- Кликает "Поделиться" → получает ссылку `/share/artifact/abc123xyz`
- Отправляет ссылку боссу (Telegram, email, WhatsApp)
- Босс открывает → видит ТОЛЬКО артефакт (БЕЗ истории чата и переписки)
- Privacy: вся переписка остается приватной, босс не видит промпты

#### 7. Тестирование и финализация (1 день)
- [ ] Создать проект, загрузить файлы
- [ ] Создать чат в проекте, проверить что AI читает файлы
- [ ] Поделиться артефактом, проверить публичную ссылку (incognito mode)
- [ ] Тестирование под Юлией и Владимиром
- [ ] Production build

**Оценка времени:** 11-17 дней (с Artifact sharing)

**Техническое задание:** [TZ_STAGE_4_ROADMAP.md](TZ_STAGE_4_ROADMAP.md)

**Новая фича (🎯 Приоритет!):**
- **Artifact-only sharing** - публичные ссылки на артефакты без показа истории чата
- Решает реальный кейс: Юлия создает презентацию → делится с боссом → босс видит только результат
- Безопасность: токены nanoid(32) = 5.24e57 комбинаций, проверка владения, noindex
- Детальное ТЗ в Фазе 6 roadmap (16 часов разработки)

**Архитектурные решения для обсуждения:**
- Vector search vs keyword search для поиска в файлах
- Автоматическое определение релевантных файлов vs ручной выбор
- Лимиты: максимум файлов в проекте, максимум проектов на пользователя
- Режим "auto-attach files" при создании чата в проекте
- **Expiring links** для artifact sharing (7 дней vs permanent vs custom)

---

### Будущие улучшения (после Этапа 4)

**Экспорт артефактов:**
- Экспорт в DOCX (библиотека `docx`)
- Экспорт в PDF
- Экспорт таблиц в XLSX

**Расширение AI возможностей:**
- Image generation (DALL-E 3 / Stable Diffusion)
- Code execution (sandboxed environment)
- Audio transcription (Whisper)
- Video analysis

**Инструменты для маркетолога:**
- SEO анализ
- Analytics интеграция (Google Analytics)
- Social media планирование
- Competitor analysis

**Vector search для файлов:**
- Embedding файлов в векторную БД (Pinecone/Supabase pgvector)
- Semantic search вместо keyword search
- RAG (Retrieval-Augmented Generation) для точных ответов

---

## 🎯 Архитектурные решения (ADR)

### [ADR 001: Выбор Google Gemini](docs/decisions/001-why-gemini.md)

**Контекст:** Выбор AI модели для проекта

**Решение:** Google Gemini (3 Pro + 2.5 Flash)

**Причины:**
- Free tier для личного использования
- Отличное качество ответов
- Мультимодальность (текст, изображения, PDF, audio, video)
- Долгий контекст (1M токенов для Gemini 3 Pro)
- Dynamic thinking для продвинутого reasoning

**Последствия:**
- ✅ Экономия средств (бесплатно до лимита)
- ✅ Высокое качество для профессиональных задач
- ❌ Зависимость от Google API

---

### [ADR 002: Концепция семейного бота](docs/decisions/002-family-bot-concept.md)

**Контекст:** Проект MIR.TRADE закрыт, нужно новое назначение

**Решение:** Персональный семейный AI-ассистент для 2 пользователей

**Причины:**
- Кодовая база уже существует (NegotiateAI)
- Реальная потребность у семьи Владимира
- Возможность персонализации под роли
- Приватность и безопасность

**Последствия:**
- ✅ Полный контроль над данными
- ✅ Персонализация под каждого пользователя
- ❌ Нет монетизации (личный проект)

---

### [ADR 003: Отказ от guest режима](docs/decisions/003-no-guest-mode.md)

**Контекст:** В старой версии был guest mode для анонимных пользователей

**Решение:** Удалить guest mode полностью

**Причины:**
- Только 2 известных пользователя
- Упрощение auth логики
- Безопасность (нет анонимных данных)
- Персонализация невозможна для guest

**Последствия:**
- ✅ Упрощенная архитектура
- ✅ Полная персонализация
- ❌ Нельзя тестировать без регистрации (решено через seed скрипт)

---

### [ADR 004: Система из 8 специализированных агентов](docs/decisions/004-agent-system.md)

**Контекст:** Нужна персонализация для engineer и marketer

**Решение:** 8 специализированных AI-агентов с автоматическим выбором модели

**Причины:**
- Персонализация опыта для каждой роли
- Оптимизация затрат (дорогая модель только для сложных задач)
- Четкое разделение ответственности (один агент = одна роль)
- Улучшение качества для специфичных задач

**Альтернативы рассмотренные:**
1. Единый универсальный промпт (слишком общий)
2. Dynamic prompts (сложнее контролировать качество)
3. Больше агентов 10+ (избыточно для 2 пользователей)
4. Меньше агентов 3-5 (теряем персонализацию)

**Последствия:**
- ✅ Высокое качество для специфичных задач
- ✅ Экономия средств (автовыбор модели)
- ✅ Понятный UX (выбор агента как собеседника)
- ❌ Больше файлов для поддержки (8 промптов)
- ❌ Сложнее добавлять глобальные фичи

**Технические детали:**
- Промпты в Markdown (lib/ai/agents/*.md)
- Кеширование промптов в памяти (Map cache)
- Функция getModelForAgent() для автовыбора
- UI индикатор модели (v2.1.1)
- Режим "auto" по умолчанию (v2.1.1)

---

## 📚 Документация и workflow

### Структура документации

**Точка входа:**
- [README.md](README.md) - Быстрый старт (80-150 строк)

**Навигация для AI:**
- [CLAUDE.md](CLAUDE.md) - Контекст для Claude Code

**План разработки:**
- [ROADMAP.md](ROADMAP.md) - Этапы 1-4, текущий статус
- [TZ_STAGE_3_ROADMAP.md](TZ_STAGE_3_ROADMAP.md) - Детальный план Этапа 3
- [TZ_STAGE_4_ROADMAP.md](TZ_STAGE_4_ROADMAP.md) - Детальный план Этапа 4 (черновик)

**История изменений:**
- [CHANGELOG.md](CHANGELOG.md) - Semantic Versioning, v2.0.0 → v2.1.4

**Детальная документация:**
- [docs/setup.md](docs/setup.md) - Установка и настройка
- [docs/architecture.md](docs/architecture.md) - Архитектура системы
- [docs/ai-capabilities.md](docs/ai-capabilities.md) - AI возможности (SSOT!)
- [docs/deployment.md](docs/deployment.md) - Deployment на Vercel
- [docs/troubleshooting.md](docs/troubleshooting.md) - Решение проблем

**Архитектурные решения:**
- [docs/decisions/](docs/decisions/) - ADR (4 документа)

**Правила документации:**
- [DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md) - SSOT принципы

### Принцип SSOT (Single Source of Truth)

- Каждая информация живёт в ОДНОМ месте
- Остальные файлы ссылаются на неё
- Обновил в одном месте → везде актуально

**Пример:**
- ✅ AI capabilities описаны в [docs/ai-capabilities.md](docs/ai-capabilities.md)
- ✅ README ссылается на этот документ
- ✅ CLAUDE.md ссылается на этот документ
- ❌ НЕ дублировать список tools в нескольких файлах!

### Workflow разработки

**При создании нового ТЗ:**
1. Прочитать [PROJECT_STATUS.md](PROJECT_STATUS.md) (этот документ) - полный контекст
2. Прочитать [ROADMAP.md](ROADMAP.md) - текущий прогресс
3. Прочитать [docs/ai-capabilities.md](docs/ai-capabilities.md) - что уже есть
4. Прочитать релевантные ADR из [docs/decisions/](docs/decisions/)
5. Создать детальный plan (TZ_STAGE_N_ROADMAP.md)

**При реализации:**
1. Следовать плану (TZ_STAGE_N_ROADMAP.md)
2. Обновлять чекбоксы [x] в roadmap
3. Коммитить часто (по задачам)
4. Тестировать после каждой фазы

**При завершении этапа:**
1. Обновить [CHANGELOG.md](CHANGELOG.md)
2. Обновить [ROADMAP.md](ROADMAP.md) (статус этапа)
3. Обновить [docs/ai-capabilities.md](docs/ai-capabilities.md) (если новые фичи)
4. Создать ADR если было важное решение
5. Создать git tag: `git tag -a v2.N.0 -m "Release v2.N.0"`
6. Деплой на Vercel: `vercel --prod`

---

## 🔗 Полезные ссылки

**Production:**
- **URL:** https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app
- **Vercel Dashboard:** https://vercel.com/engsimsoft-gmailcoms-projects
- **GitHub Repo:** (приватный)

**External APIs:**
- **Google AI Studio:** https://aistudio.google.com/app/apikey
- **Brave Search API:** https://brave.com/search/api
- **Neon Console:** https://console.neon.tech

**Documentation:**
- **Next.js:** https://nextjs.org/docs
- **Vercel AI SDK:** https://sdk.vercel.ai/docs
- **Google Gemini API:** https://ai.google.dev/
- **Drizzle ORM:** https://orm.drizzle.team/
- **NextAuth:** https://next-auth.js.org/

---

## 📊 Статистика проекта

**Версия:** 2.1.4
**Дата завершения Этапа 3:** 2026-01-27
**Файлов изменено (Stage 3):** 32 файла
**Строк кода добавлено (Stage 3):** ~3500 строк
**AI-агентов:** 8
**AI моделей:** 3 (Gemini 3 Pro, 2.5 Flash, 2.5 Pro)
**AI инструментов:** 8 (webSearch, getCurrentDate, readDocument, createDocument, updateDocument, requestSuggestions, getWeather, Vision/OCR)
**Пользователей:** 2 (Владимир, Юлия)
**Production build:** ✅ Успешен
**TypeScript ошибок:** 0
**ESLint warnings:** 0

---

## 🎓 Итог для супервайзера

**Проект находится в отличном состоянии:**
- ✅ **Этап 3 полностью завершён** - система из 8 агентов работает
- ✅ **Production ready** - deployed и протестирован
- ✅ **Документация актуальна** - следует SSOT принципам
- ✅ **Архитектура чистая** - legacy код удален полностью
- ✅ **Качество кода** - 0 TypeScript ошибок, 0 ESLint warnings

**Следующий этап (Этап 4):**
- Система персональных проектов
- База знаний per-project
- Загрузка файлов в проекты
- AI читает файлы проекта при ответе

**Готово к разработке новых ТЗ!**

---

**Документ создан:** 2026-01-27
**Автор:** Владимир (с помощью Claude Code)
**Для:** Супервайзер (Claude Code в браузере - архитектура и ТЗ)
