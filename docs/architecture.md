# Архитектура проекта

Подробное описание архитектуры Family AI Assistant и принципов работы персонализированного AI-ассистента.

## Общая схема

```
┌─────────────────────────────────────────────────────────────┐
│                    User (Browser)                           │
│              Владимир (Инженер) / Юлия (Маркетолог)         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP/WebSocket
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Next.js Application (Vercel)                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  App Router (app/)                                   │  │
│  │  ├── (auth)/           - Auth routes (NextAuth)      │  │
│  │  ├── (chat)/           - Chat UI                     │  │
│  │  └── api/chat/route.ts - Chat API endpoint           │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Components (components/)                            │  │
│  │  ├── Chat.tsx          - UI компонент чата           │  │
│  │  ├── Message.tsx       - Отдельное сообщение         │  │
│  │  └── ToolIndicator.tsx - Индикатор работы функций    │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Business Logic (lib/)                               │  │
│  │  ├── ai/providers.ts   - AI Provider config          │  │
│  │  ├── ai/tools/         - AI agent tools              │  │
│  │  ├── db/queries.ts     - Database queries            │  │
│  │  └── db/schema.ts      - Database schema             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                     │
                     │ External Services
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  External Services                                          │
│  ├── Google Gemini API  - Gemini 2.5 Pro                  │
│  ├── Brave Search API   - Web search                       │
│  └── PostgreSQL (Neon)  - Database                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Слои приложения

### 1. Presentation Layer (UI)

**Компоненты:** `app/`, `components/`

Отвечает за:
- Отображение интерфейса чата
- Взаимодействие с пользователем
- Streaming ответов в реальном времени
- Рендеринг Markdown
- Auth UI (login/register)

**Технологии:**
- Next.js 15.3 (App Router, RSC)
- React 18
- Tailwind CSS
- Vercel AI SDK UI компоненты

---

### 2. Authentication Layer

**Файлы:** `app/(auth)/`, `middleware.ts`

Отвечает за:
- Авторизацию пользователей (NextAuth 5.0)
- Управление сессиями
- Защиту routes
- Идентификацию пользователя и его роли

**Поток авторизации:**
```
Login → NextAuth → PostgreSQL → Session → Access to Chat
```

**Роли:**
- `engineer` - Владимир (технический помощник)
- `marketer` - Юлия (маркетинговый помощник)

---

### 3. API Layer

**Файл:** `app/(chat)/api/chat/route.ts`

Отвечает за:
- Обработку HTTP POST запросов от клиента
- Валидацию входящих сообщений
- Определение роли пользователя
- Выбор соответствующего system prompt
- Вызов Google Gemini API
- Streaming ответов клиенту
- Обработку ошибок

**Поток данных:**
```
User message → POST /api/chat → Role detection → Dynamic prompt → Gemini API → Stream response → User
```

---

### 4. Business Logic Layer

**Папка:** `lib/`

#### lib/ai/providers.ts
- Инициализация Google Gemini SDK
- Конфигурация модели Gemini 2.5 Pro
- Настройка параметров (temperature, max tokens)

#### lib/ai/tools/
- Определение и реализация AI agent tools
- `web-search.ts` - Поиск через Brave Search
- `get-current-date.ts` - Текущая дата/время

#### lib/db/
- `schema.ts` - Database schema (Drizzle ORM)
- `queries.ts` - Database queries (CRUD операции)
- `migrations/` - Миграции БД

---

### 5. Data Layer

**PostgreSQL Database (Neon)**

Основные таблицы:
- `User` - пользователи (email, role)
- `Chat` - чаты (userId, title)
- `Message` - сообщения (chatId, role, content)
- `Document` - документы (userId, title, content)
- NextAuth таблицы (sessions, accounts, verification tokens)

**Vercel Blob Storage:**
- Хранение загруженных файлов
- Аватары пользователей
- Attachments

---

## Персонализация и роли

### Как работает персонализация

```typescript
// Определение роли пользователя
const user = await getUser(session.userId);
const userRole = user.role; // 'engineer' or 'marketer'

// Динамический выбор system prompt
const systemPrompt = userRole === 'engineer'
  ? engineerPrompt  // "Ты технический ассистент..."
  : marketerPrompt; // "Ты маркетинговый ассистент..."

// Отправка в Gemini с персонализированным промптом
const { stream } = await streamText({
  model: google("gemini-2.5-pro"),
  system: systemPrompt,
  messages: userMessages,
  tools: tools
});
```

### System Prompts по ролям

**Инженер (Владимир):**
- Помощь с кодом, архитектурой, debugging
- Технические объяснения
- Code review и рефакторинг
- Выбор технологий

**Маркетолог (Юлия):**
- Помощь с контентом, копирайтингом
- Маркетинговая стратегия
- Анализ целевой аудитории
- SMM и SEO рекомендации

---

## Как работает AI Agent

### Инициализация агента

```typescript
// 1. Получение пользователя и роли
const user = await getUser(sessionId);

// 2. Загрузка персонализированного system prompt
const systemPrompt = getSystemPromptForRole(user.role);

// 3. Определение tools (через Vercel AI SDK)
const tools = {
  webSearch: tool({
    description: 'Search the web for current information',
    parameters: z.object({
      query: z.string()
    }),
    execute: async ({ query }) => await braveSearch(query)
  }),
  getCurrentDate: tool({
    description: 'Get current date and time',
    parameters: z.object({}),
    execute: async () => new Date().toISOString()
  })
};

// 4. Отправка в Google Gemini API
const { stream } = await streamText({
  model: google("gemini-2.5-pro"),
  system: systemPrompt,
  messages: chatHistory,
  tools: tools
});
```

---

## Tool Calling Flow

### Сценарий: Поиск информации

```
1. User: "Найди информацию о Next.js 15"

2. API Layer:
   - Определяет роль пользователя
   - Загружает system prompt для роли
   - Отправляет запрос в Gemini

3. Gemini анализирует:
   - Запрос пользователя
   - System prompt (роль)
   - Доступные tools

4. Gemini решает использовать webSearch:
   {
     "tool": "webSearch",
     "args": { "query": "Next.js 15 new features" }
   }

5. lib/ai/tools/web-search.ts выполняет поиск:
   - Вызов Brave Search API
   - Парсинг результатов
   - Форматирование в текст
   - Возврат результата

6. Gemini получает результаты и генерирует ответ:
   "Next.js 15 включает следующие новые возможности:
   1. React Server Components by default
   2. Улучшенная производительность...

   Источники:
   - https://nextjs.org/blog/next-15
   - https://vercel.com/blog/next-15"

7. API Layer стримит ответ клиенту

8. UI отображает ответ с Markdown форматированием
```

---

## Database Architecture

### User Schema

```typescript
export const User = pgTable("User", {
  id: text("id").primaryKey(),
  email: text("email").unique().notNull(),
  role: text("role").notNull(), // 'engineer' | 'marketer'
  password: text("password"), // hashed
  createdAt: timestamp("createdAt").defaultNow()
});
```

### Chat & Message Schema

```typescript
export const Chat = pgTable("Chat", {
  id: text("id").primaryKey(),
  userId: text("userId").references(() => User.id),
  title: text("title").notNull(),
  createdAt: timestamp("createdAt").defaultNow()
});

export const Message = pgTable("Message", {
  id: text("id").primaryKey(),
  chatId: text("chatId").references(() => Chat.id),
  role: text("role").notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow()
});
```

---

## Security

### API Keys
- Хранятся в `.env.local` (не коммитятся)
- Используются только на сервере (server-side)
- Не передаются клиенту

### Authentication
- NextAuth 5.0 с PostgreSQL adapter
- Хэширование паролей (bcrypt)
- Secure session cookies
- CSRF protection

### Authorization
- Middleware защищает все routes кроме `/login`
- Пользователи видят только свои чаты
- Role-based access control (RBAC)

---

## Почему такая архитектура?

### Принятые решения

**1. Next.js App Router**
- Серверные компоненты для безопасности API keys
- Built-in API routes
- Легкий деплой на Vercel
- React Server Components для performance

**2. Google Gemini API**
- Free tier для личного использования
- Отличное качество ответов
- Мультимодальность (текст, изображения)
- Долгий контекст (1M токенов)
- См. [ADR 001](decisions/001-why-gemini.md)

**3. Персонализация через роли**
- Разные system prompts для каждой роли
- Гибкость в добавлении новых ролей
- Улучшенный user experience
- См. [ADR 002](decisions/002-family-bot-concept.md)

**4. Без guest режима**
- Безопасность и приватность
- Полная персонализация
- Упрощение auth логики
- См. [ADR 003](decisions/003-no-guest-mode.md)

**5. PostgreSQL + Drizzle ORM**
- Type-safe database queries
- Удобные миграции
- Отличная интеграция с NextAuth
- Бесплатный tier на Neon

---

## Полезные ссылки

- [Google AI for Developers](https://ai.google.dev/)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [NextAuth Documentation](https://next-auth.js.org/)
- [Drizzle ORM](https://orm.drizzle.team/)

---

## Связанные документы

- [setup.md](setup.md) - Установка и настройка
- [deployment.md](deployment.md) - Деплой на Vercel
- [troubleshooting.md](troubleshooting.md) - Решение проблем
- [ADR 001](decisions/001-why-gemini.md) - Почему Gemini
- [ADR 002](decisions/002-family-bot-concept.md) - Концепция семейного бота
- [ADR 003](decisions/003-no-guest-mode.md) - Удаление guest режима
