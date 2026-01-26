# NegotiateAI Chatbot - Полный технический обзор

**Версия отчета:** 1.0
**Дата:** 2026-01-26
**Статус проекта:** ✅ Production

---

## 1. Описание проекта

AI чат-бот для переговоров (MIR.TRADE) на базе Google Gemini 2.5 Pro.

- **Production URL:** https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app
- **Версия:** 1.0.14 (стабилизация)
- **Статус:** ✅ Deployed, работает стабильно
- **Основан на:** [Vercel AI Chatbot Template](https://github.com/vercel/ai-chatbot)

### Назначение

Специализированный IT-помощник для проекта MIR.TRADE, созданный для работы с документацией проекта и оказания помощи в технических вопросах. Предоставляет доступ к базе знаний проекта (30+ документов) через AI-инструменты.

---

## 2. Технологический стек

### Framework & Language

| Категория | Технология | Версия |
|-----------|------------|--------|
| Framework | Next.js | 15.3.0-canary.31 |
| Language | TypeScript | 5.6.3 |
| React | React 19 (RC) | 19.0.0-rc-45804af1 |
| Node.js | Node.js | 20+ (required) |

### AI & ML

| Категория | Технология | Версия |
|-----------|------------|--------|
| AI Model | Google Gemini 2.5 Pro | latest |
| AI SDK | ai (Vercel AI SDK) | 5.0.105 |
| Provider SDK | @ai-sdk/google | 2.0.44 |
| Token Tracking | tokenlens | 1.3.0 |

### Database & Storage

| Категория | Технология | Версия |
|-----------|------------|--------|
| Database | PostgreSQL (Neon) | - |
| ORM | Drizzle ORM | 0.34.0 |
| File Storage | Vercel Blob | 0.24.1 |
| Caching | Redis (optional) | 5.0.0 |

### Authentication

| Категория | Технология | Версия |
|-----------|------------|--------|
| Auth | NextAuth.js | 5.0.0-beta.25 |
| Password Hashing | bcrypt-ts | 5.0.2 |

### Deployment & Monitoring

| Категория | Технология | Версия |
|-----------|------------|--------|
| Deployment | Vercel | - |
| Analytics | @vercel/analytics | 1.3.1 |
| Telemetry | @vercel/otel | 1.12.0 |

### UI/UX

| Категория | Технология | Версия |
|-----------|------------|--------|
| Styling | Tailwind CSS | 4.1.13 |
| Components | Radix UI | Multiple |
| Icons | Lucide React | 0.446.0 |
| Animations | Framer Motion | 11.3.19 |
| Code Editor | CodeMirror | 6.0.1 |
| Themes | next-themes | 0.3.0 |

---

## 3. API ключи и переменные окружения

### Обязательные переменные

| Переменная | Назначение | Обязательно | Источник |
|------------|------------|-------------|----------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Gemini AI API | ✅ | https://aistudio.google.com/app/apikey |
| `BRAVE_SEARCH_API_KEY` | Brave Search API для веб-поиска | ✅ | https://brave.com/search/api |
| `POSTGRES_URL` | PostgreSQL connection string | ✅ | neon.tech или vercel.com/storage |
| `AUTH_SECRET` | NextAuth session encryption | ✅ | `openssl rand -base64 32` |

### Опциональные переменные

| Переменная | Назначение | По умолчанию |
|------------|------------|--------------|
| `NEXT_PUBLIC_APP_URL` | URL приложения | http://localhost:3000 |
| `REDIS_URL` | Redis для resumable streams | - (optional) |
| `NODE_ENV` | Окружение | development |

### Примечания

- **Vercel Blob:** Используется для загрузки файлов, но токен настраивается автоматически при деплое на Vercel
- **Free tiers:** Gemini AI и Brave Search имеют бесплатные tier-ы (Brave: 2000 запросов/месяц)

---

## 4. AI инструменты (Tools)

Система использует 8 AI-инструментов, доступных через Vercel AI SDK:

### 4.1 Работа с документами базы знаний

| Tool | Описание | Параметры | Возвращает | Timeout |
|------|----------|-----------|------------|---------|
| **readDocument** | Чтение документов из knowledge/ (PDF, DOCX, TXT, MD, JPG, PNG) с OCR | `filepath: string` | `{success, content, fileType, fileSizeKB}` | 120s |

**Особенности:**
- Поддерживает OCR для PDF и изображений через Google Gemini Vision
- Ограничение на `knowledge/` директорию (безопасность)
- Поддержка форматов: PDF, DOCX, TXT, MD, JPG, JPEG, PNG
- Автоматическая обработка DOCX через mammoth
- Умные подсказки при неправильном пути к файлу

### 4.2 Управление артефактами (Documents)

| Tool | Описание | Параметры | Возвращает | Timeout |
|------|----------|-----------|------------|---------|
| **createDocument** | Создание нового артефакта (текст, код, таблица, изображение) | `title: string, kind: enum` | `{id, title, kind, content}` | 120s |
| **updateDocument** | Обновление существующего артефакта | `id: string, description: string` | `{id, title, kind, content}` | 120s |
| **requestSuggestions** | Генерация предложений по улучшению документа | `documentId: string` | `{id, suggestions[]}` | 30s |

**Типы артефактов (kind):**
- `text` - текстовые документы
- `code` - код (JavaScript, Python, HTML)
- `sheet` - таблицы
- `image` - изображения

### 4.3 Утилиты

| Tool | Описание | Параметры | Возвращает | Timeout |
|------|----------|-----------|------------|---------|
| **getCurrentDate** | Получение текущей даты и времени | - | `{date, timestamp, timezone, formatted}` | 1s |
| **getWeather** | Получение погоды по координатам или городу | `city: string` или `lat, lon` | `{temperature, conditions, ...}` | 10s |

### 4.4 Веб-поиск

| Tool | Описание | Параметры | Возвращает | Timeout |
|------|----------|-----------|------------|---------|
| **webSearch** | Поиск в интернете через Brave Search API | `query: string, count?: number` | `{query, results[], count}` | 15s |

**Параметры Brave Search:**
- `count`: 1-20 результатов (default: 5)
- `country`: "US"
- `search_lang`: "en"
- Free tier: 2000 запросов/месяц

---

## 5. Возможности приложения

### Реализовано ✅

- [x] **AI Chat с streaming** - Потоковая генерация ответов через Gemini 2.5 Pro
- [x] **Веб-поиск** - Интеграция с Brave Search API
- [x] **Работа с документами** - Чтение PDF, DOCX, TXT, MD с OCR
- [x] **Артефакты** - Создание и редактирование интерактивных документов
- [x] **База знаний** - 106 файлов в `knowledge/` (30+ приоритетных)
- [x] **Guest режим** - Доступ без регистрации
- [x] **История чатов** - Сохранение и восстановление диалогов
- [x] **Управление токенами** - Умная загрузка истории (max 140K tokens)
- [x] **Performance monitoring** - TTFT и общее время ответа
- [x] **Vision OCR** - Распознавание текста с изображений и PDF

### В разработке 🚧

- [ ] **UI кастомизация** - Брендинг NegotiateAI
- [ ] **Расширенная загрузка файлов** - Через UI интерфейс
- [ ] **Резюмируемые потоки** - Resumable streams через Redis

### Не реализовано ❌

- [ ] **Генерация изображений** - Только распознавание текста
- [ ] **Multi-modal input** - Работает только OCR, нет анализа изображений

---

## 6. Схема базы данных

База данных PostgreSQL с следующими таблицами:

| Таблица | Описание | Ключевые поля |
|---------|----------|---------------|
| **User** | Пользователи | id (uuid), email, password |
| **Chat** | История чатов | id (uuid), userId, title, visibility, lastContext (jsonb) |
| **Message_v2** | Сообщения (новая версия) | id, chatId, role, parts (json), attachments, tokenCount |
| **Vote_v2** | Голосования за сообщения | chatId, messageId, isUpvoted |
| **Document** | Артефакты/документы | id, title, content, kind, userId, createdAt |
| **Suggestion** | Предложения по улучшению документов | id, documentId, originalText, suggestedText, description |
| **Stream** | Управление потоками | id, chatId, createdAt |

### Устаревшие таблицы (deprecated)

- `Message` - старая версия сообщений (до message parts)
- `Vote` - старая версия голосований

### Особенности

- **Token tracking:** Каждое сообщение хранит `tokenCount` для умного управления контекстом
- **Last context:** В таблице `Chat` хранится последний usage (токены, стоимость)
- **Visibility:** Чаты могут быть `public` или `private`

---

## 7. Аутентификация

### Методы авторизации

| Метод | Описание | Статус |
|-------|----------|--------|
| **Email + Password** | Классическая регистрация | ✅ Работает |
| **Guest mode** | Анонимный доступ | ✅ Работает |

### Реализация

- **NextAuth.js 5.0-beta.25** с Credentials provider
- **Guest users:** Создаются автоматически с email `guest-{timestamp}`
- **Password hashing:** bcrypt-ts
- **Session storage:** JWT tokens
- **Session secret:** `AUTH_SECRET` переменная окружения

### Защищенные роуты

- `/` - главная страница (авто-редирект в guest mode)
- `/chat/:id` - страница чата
- `/api/*` - API endpoints

### Middleware

- Автоматический редирект на `/api/auth/guest` для неавторизованных пользователей
- Проверка JWT токенов через `next-auth/jwt`
- Специальная обработка для `/api/auth/*` endpoints

---

## 8. Ключевые файлы

### AI/Chat

| Путь | Назначение |
|------|------------|
| [app/(chat)/api/chat/route.ts](app/(chat)/api/chat/route.ts) | Chat API endpoint (POST/DELETE), streaming, tool calls |
| [lib/ai/providers.ts](lib/ai/providers.ts) | Конфигурация Gemini 2.5 Pro провайдера |
| [lib/ai/models.ts](lib/ai/models.ts) | Список доступных моделей и pricing |
| [lib/ai/tools/](lib/ai/tools/) | Реализация всех AI-инструментов |
| [lib/ai/prompts.ts](lib/ai/prompts.ts) | Генерация system prompts |
| [lib/ai/vision-ocr.ts](lib/ai/vision-ocr.ts) | OCR для PDF и изображений через Gemini Vision |
| [system-prompt.md](system-prompt.md) | Базовый system prompt (580 строк) |

### Auth/DB

| Путь | Назначение |
|------|------------|
| [app/(auth)/auth.ts](app/(auth)/auth.ts) | NextAuth configuration |
| [app/(auth)/auth.config.ts](app/(auth)/auth.config.ts) | NextAuth config |
| [app/(auth)/api/auth/guest/route.ts](app/(auth)/api/auth/guest/route.ts) | Guest mode endpoint |
| [lib/db/schema.ts](lib/db/schema.ts) | Drizzle ORM schema (7 таблиц) |
| [lib/db/queries.ts](lib/db/queries.ts) | Database queries |
| [lib/db/migrate.ts](lib/db/migrate.ts) | Database migrations |
| [middleware.ts](middleware.ts) | Auth middleware для защиты роутов |

### Configuration

| Путь | Назначение |
|------|------------|
| `.env.example` | Пример переменных окружения |
| [next.config.ts](next.config.ts) | Next.js configuration |
| [drizzle.config.ts](drizzle.config.ts) | Drizzle ORM configuration |
| [package.json](package.json) | Dependencies и scripts |
| [tsconfig.json](tsconfig.json) | TypeScript configuration |

### Knowledge Base

| Путь | Назначение |
|------|------------|
| [knowledge/](knowledge/) | База знаний проекта (106 файлов) |
| [knowledge/index.md](knowledge/index.md) | Индекс документов (43KB) |
| `knowledge/0-PRIORITY-ОПРОСНИК/` | Критичные документы (опросник, презентация, переговоры) |
| `knowledge/1-PRIORITY-КОММЕРЧЕСКИЕ/` | Коммерческие предложения |
| `knowledge/2-PRIORITY-ФУНКЦИОНАЛ/` | Описание функционала |
| `knowledge/3-PRIORITY-КИТАЙ/` | Документы по Китаю |
| `knowledge/4-PRIORITY-РОССИЯ/` | Документы по России |

### Documentation

| Путь | Назначение |
|------|------------|
| [README.md](README.md) | Главный README проекта |
| [CLAUDE.md](CLAUDE.md) | Навигация для AI (инструкции Claude) |
| [CHANGELOG.md](CHANGELOG.md) | История изменений |
| [DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md) | SSOT - правила документации |
| [docs/setup.md](docs/setup.md) | Детальная инструкция по установке |
| [docs/architecture.md](docs/architecture.md) | Архитектура приложения |
| [docs/deployment.md](docs/deployment.md) | Инструкции по деплою |
| [docs/api/tools.md](docs/api/tools.md) | Документация AI tools |

---

## 9. Deployment

### Платформа

- **Platform:** Vercel
- **Production URL:** https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app
- **Region:** Auto (ближайший к пользователю)
- **Build command:** `npm run build` (включает миграции БД)
- **Framework:** Next.js 15.3 (Auto-detected)

### Переменные окружения (Vercel Dashboard)

Все необходимые переменные настроены в Vercel Dashboard → Settings → Environment Variables:

- `GOOGLE_GENERATIVE_AI_API_KEY`
- `BRAVE_SEARCH_API_KEY`
- `POSTGRES_URL` (auto from Neon integration)
- `AUTH_SECRET`
- `BLOB_READ_WRITE_TOKEN` (auto from Vercel Blob)

### CI/CD

- **Auto-deploy:** Каждый push в `master` автоматически деплоится
- **Preview deploys:** Каждый PR получает preview URL
- **Build time:** ~2-3 минуты
- **Database migrations:** Автоматически при build (`tsx lib/db/migrate && next build`)

### Мониторинг

- **Analytics:** @vercel/analytics
- **OpenTelemetry:** @vercel/otel для трейсинга
- **Performance:** TTFT и общее время ответа логируется в консоль
- **Token usage:** Отслеживается через tokenlens

---

## 10. Архитектура

### Общая структура

```
┌─────────────────┐
│   User Browser  │
└────────┬────────┘
         │ HTTPS
┌────────▼────────────────────────┐
│   Next.js 15 (Vercel)           │
│   ┌─────────────────────────┐   │
│   │  App Router             │   │
│   │  - (auth) routes        │   │
│   │  - (chat) routes        │   │
│   └─────────────────────────┘   │
│                                  │
│   ┌─────────────────────────┐   │
│   │  API Routes             │   │
│   │  - /api/chat (POST)     │   │
│   │  - /api/files/upload    │   │
│   │  - /api/auth/*          │   │
│   └─────────────────────────┘   │
│                                  │
│   ┌─────────────────────────┐   │
│   │  AI SDK Integration     │   │
│   │  - Google Gemini        │   │
│   │  - Streaming support    │   │
│   │  - Tool calls           │   │
│   └─────────────────────────┘   │
└──────────┬───────────┬──────────┘
           │           │
    ┌──────▼──────┐ ┌──▼──────────┐
    │  PostgreSQL │ │ Google APIs  │
    │   (Neon)    │ │ - Gemini     │
    │             │ │ - Vision OCR │
    └─────────────┘ └──────────────┘
           │
    ┌──────▼──────┐
    │ Vercel Blob │
    │  (Storage)  │
    └─────────────┘
```

### Request Flow (Chat)

1. **User sends message** → `/api/chat` POST
2. **Authentication check** via NextAuth middleware
3. **Load chat history** from PostgreSQL (умная загрузка с учетом токенов)
4. **Generate system prompt** с учетом контекста
5. **Call Gemini API** через Vercel AI SDK
   - Temperature: 1.0 (полная креативность Gemini)
   - Thinking budget: 1024 tokens
   - Stop when: 5 steps (multi-step reasoning)
6. **Stream response** через Server-Sent Events (SSE)
7. **Tool calls** обрабатываются автоматически
8. **Save messages** в БД с токен-подсчетом
9. **Update usage stats** в chat.lastContext

### Tool Execution Flow

1. **AI decides** to use a tool
2. **Tool wrapper** перехватывает вызов
   - Логирование старта
   - Установка timeout
   - Error handling
3. **Tool execution** (readDocument, webSearch, etc.)
4. **Result returned** to AI
5. **AI continues** generation с учетом результата

---

## 11. Performance & Optimization

### Token Management

- **Max context:** 140,000 tokens для истории
- **Reserve:** ~60K tokens для system prompt (10K) + response (50K)
- **Smart loading:** Загружаются только последние сообщения, помещающиеся в лимит
- **Token counting:** Каждое сообщение подсчитывается при сохранении
- **Filtering:** Tool results удаляются из истории (только для генерации, не для хранения)

### Streaming Optimization

- **Word chunking:** `smoothStream({ chunking: "word" })`
- **TTFT tracking:** Time To First Token измеряется и логируется
- **Performance logs:** `[Performance] Chat ${id}: TTFT = ${ms}ms, Total = ${ms}ms`

### Database Optimization

- **Indexes:** На userId, chatId для быстрого поиска
- **Connection pooling:** Через postgres.js
- **Migrations:** Автоматические при build

---

## 12. Security

### API Keys

- **Хранение:** Только в Vercel Environment Variables
- **Доступ:** Server-only, никогда не отправляются клиенту
- **Ротация:** Рекомендуется периодическая смена

### File Upload

- **Размер:** Максимум 20MB
- **Типы:** Только JPEG, PNG, PDF, DOCX, TXT, MD
- **Обработка:** Серверная валидация через Zod
- **Хранение:** Vercel Blob с public access (для мультимодального AI)

### Knowledge Base

- **Ограничение:** Только файлы из `knowledge/` директории
- **Path validation:** Проверка на directory traversal
- **Normalization:** Все пути нормализуются перед чтением

### Authentication

- **Password hashing:** bcrypt (cost factor: default)
- **Session encryption:** AUTH_SECRET (base64, 32 bytes)
- **Timing attack protection:** Dummy password comparison для несуществующих юзеров

---

## 13. Мониторинг и отладка

### Логирование

- **Tool execution:** `[toolName] Executing with params: {...}`
- **Performance:** `[Performance] Chat ${id}: TTFT = ${ms}ms`
- **Token tracking:** `[Token Aware] Chat ${id}: Total context = ${tokens} tokens`
- **Vision OCR:** `[Vision OCR] Processing PDF (${KB}KB)`
- **Web Search:** `[webSearch] Executing search: {...}`

### Error Handling

- **ChatSDKError:** Типизированные ошибки (bad_request, unauthorized, forbidden, etc.)
- **Tool wrapper:** Автоматический timeout и error handling для всех tools
- **Database errors:** Wrapped в ChatSDKError с понятными сообщениями

### Analytics

- **Vercel Analytics:** Автоматический сбор метрик
- **OpenTelemetry:** Трейсинг запросов через @vercel/otel
- **Token usage:** Детальная статистика через tokenlens

---

## 14. Развитие проекта

### Ближайшие планы

1. **UI кастомизация** - Брендинг NegotiateAI
2. **Расширенная загрузка файлов** - Drag & drop, множественная загрузка
3. **Resumable streams** - Поддержка Redis для устойчивых потоков

### Долгосрочные планы

- Добавление новых AI tools
- Интеграция с внешними API
- Расширение базы знаний
- Улучшение UX/UI

### История версий

- **1.0.14** (2025-12-01) - Стабилизация, переход на единую модель Gemini
- **1.0.13** (2025-12-01) - Миграция на Google Gemini
- **1.0.0** - Первый стабильный релиз

---

## 15. Полезные команды

### Development

```bash
npm install              # Установка зависимостей
npm run dev              # Запуск dev сервера (localhost:3000)
npm run build            # Production build с миграциями БД
npm start                # Запуск production сервера
```

### Database

```bash
npm run db:generate      # Генерация миграций из schema
npm run db:migrate       # Применение миграций
npm run db:studio        # Запуск Drizzle Studio (GUI)
npm run db:push          # Push схемы без миграций (dev only)
```

### Linting & Formatting

```bash
npm run lint             # Проверка кода через ultracite
npm run format           # Форматирование кода
```

### Testing

```bash
npm test                 # Запуск Playwright тестов
```

---

## 16. Контакты и ресурсы

### Ссылки

- **Production:** https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app
- **GitHub:** (приватный репозиторий)
- **Vercel Dashboard:** vercel.com/dashboard
- **Neon Dashboard:** neon.tech/dashboard

### API Ключи

- **Google AI Studio:** https://aistudio.google.com/app/apikey
- **Brave Search API:** https://brave.com/search/api

### Документация

- **Next.js 15:** https://nextjs.org/docs
- **Vercel AI SDK:** https://sdk.vercel.ai/docs
- **Google Gemini:** https://ai.google.dev/docs
- **NextAuth.js:** https://authjs.dev/
- **Drizzle ORM:** https://orm.drizzle.team/docs

---

**Конец отчета**
