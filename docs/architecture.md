# Архитектура проекта

Подробное описание архитектуры NegotiateAI Assistant и принципов работы AI-агента.

## Общая схема

```
┌─────────────────────────────────────────────────────────────┐
│                    User (Browser)                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP/WebSocket
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Next.js Application (Vercel)                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  App Router (app/)                                   │  │
│  │  ├── page.tsx          - Главная страница чата       │  │
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
│  │  ├── anthropic.ts      - Anthropic API client        │  │
│  │  ├── tools.ts          - AI agent tools              │  │
│  │  └── brave-search.ts   - Brave Search integration    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                     │
                     │ External APIs
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  External Services                                          │
│  ├── Anthropic API      - Claude Sonnet 4.5               │
│  └── Brave Search API   - Web search                       │
└─────────────────────────────────────────────────────────────┘
                     │
                     │ File System
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Knowledge Base (knowledge/)                                │
│  ├── *.docx            - DOCX документы                    │
│  ├── *.pdf             - PDF документы                     │
│  └── [страны]/         - Папки с документацией по странам  │
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

**Технологии:**
- Next.js 14 (App Router)
- React 18
- Tailwind CSS
- Vercel AI SDK UI компоненты

---

### 2. API Layer

**Файл:** `app/api/chat/route.ts`

Отвечает за:
- Обработку HTTP POST запросов от клиента
- Валидацию входящих сообщений
- Вызов Anthropic API
- Streaming ответов клиенту
- Обработку ошибок

**Поток данных:**
```
User message → POST /api/chat → Anthropic API → Stream response → User
```

---

### 3. Business Logic Layer

**Папка:** `lib/`

#### lib/anthropic.ts
- Инициализация Anthropic SDK
- Конфигурация модели Claude Sonnet 4.5
- Управление system prompt
- Обработка function calling

#### lib/tools.ts
- Определение AI agent tools (3 функции)
- Реализация `read_document(filepath)`
- Реализация `web_search(query)`
- Реализация `get_current_date()`

#### lib/brave-search.ts
- Интеграция с Brave Search API
- Форматирование результатов поиска
- Обработка rate limits

---

### 4. Data Layer

**Папка:** `knowledge/`

- Оригинальные документы (DOCX, PDF)
- Структура по странам
- Индекс документов (`index.md`)
- Прямое чтение через Anthropic API

---

## Как работает AI Agent

### Инициализация агента

```typescript
// 1. Загрузка system prompt
const systemPrompt = loadSystemPrompt(); // из system-prompt.md

// 2. Встраивание index.md в промпт
const knowledgeIndex = readFile('index.md');
const fullPrompt = systemPrompt.replace('[ИНДЕКС ВСТАВЛЯЕТСЯ СЮДА]', knowledgeIndex);

// 3. Определение tools
const tools = [
  {
    name: 'read_document',
    description: 'Читает документ из базы знаний',
    input_schema: { filepath: 'string' }
  },
  {
    name: 'web_search',
    description: 'Ищет информацию в интернете',
    input_schema: { query: 'string' }
  },
  {
    name: 'get_current_date',
    description: 'Возвращает текущую дату',
    input_schema: {}
  }
];

// 4. Отправка в Anthropic API
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  system: fullPrompt,
  messages: [...conversation],
  tools: tools,
  stream: true
});
```

---

## Function Calling Flow

### Сценарий: Пользователь спрашивает о документе

```
1. User: "Что написано в файле ПОЛЬЗОВАТЕЛЬСКИЙ ПУТЬ ПОСТАВЩИКА.docx?"

2. API Layer: отправляет запрос в Anthropic API

3. Claude анализирует:
   - Запрос пользователя
   - System prompt (с индексом документов)
   - Доступные tools

4. Claude решает использовать read_document:
   {
     "tool": "read_document",
     "input": {
       "filepath": "ПОЛЬЗОВАТЕЛЬСКИЙ ПУТЬ ПОСТАВЩИКА.docx"
     }
   }

5. lib/tools.ts выполняет read_document:
   - Находит файл в knowledge/
   - Читает содержимое через Anthropic API (поддержка DOCX)
   - Возвращает текст документа

6. Claude получает результат и генерирует ответ:
   "В документе описан путь поставщика:
   1. Регистрация...
   2. Создание профиля...
   [и т.д.]

   Источник: knowledge/ПОЛЬЗОВАТЕЛЬСКИЙ ПУТЬ ПОСТАВЩИКА.docx"

7. API Layer стримит ответ клиенту

8. UI отображает ответ с Markdown форматированием
```

---

## Чтение документов (read_document)

### Принцип работы

Anthropic API поддерживает нативное чтение DOCX и PDF через Messages API:

```typescript
async function readDocument(filepath: string): Promise<string> {
  // 1. Находим файл
  const fullPath = path.join(process.cwd(), 'knowledge', filepath);

  // 2. Читаем как бинарные данные
  const fileBuffer = fs.readFileSync(fullPath);
  const base64Content = fileBuffer.toString('base64');

  // 3. Определяем MIME type
  const mimeType = getMimeType(filepath); // .docx → application/vnd.openxmlformats...

  // 4. Отправляем в Anthropic API для извлечения текста
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: mimeType,
            data: base64Content
          }
        },
        {
          type: 'text',
          text: 'Извлеки и верни полный текст этого документа'
        }
      ]
    }]
  });

  return response.content[0].text;
}
```

**Преимущества:**
- Не нужна конвертация DOCX/PDF в TXT
- Сохраняется форматирование
- Claude понимает структуру документа

---

## Веб-поиск (web_search)

### Интеграция с Brave Search

```typescript
async function webSearch(query: string): Promise<SearchResult[]> {
  // 1. Вызов Brave Search API
  const response = await fetch('https://api.search.brave.com/res/v1/web/search', {
    headers: {
      'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY
    },
    params: {
      q: query,
      count: 10  // топ 10 результатов
    }
  });

  // 2. Парсинг результатов
  const data = await response.json();

  // 3. Форматирование для Claude
  const results = data.web.results.map(r => ({
    title: r.title,
    snippet: r.description,
    url: r.url
  }));

  return results;
}
```

**Когда используется:**
- Запросы о текущих событиях
- Актуальная информация (курсы валют, новости)
- Информация, которой нет в базе знаний

---

## Получение даты (get_current_date)

```typescript
function getCurrentDate(): string {
  const now = new Date();

  return {
    date: now.toISOString().split('T')[0],      // 2025-10-14
    time: now.toTimeString().split(' ')[0],     // 14:30:25
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dayOfWeek: now.toLocaleDateString('ru-RU', { weekday: 'long' }),
    formatted: now.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  };
}
```

**Когда используется:**
- Запросы о текущей дате
- Расчёты временных промежутков
- Контекст для анализа актуальности документов

---

## System Prompt Architecture

### Структура промпта

```markdown
# System Prompt: NegotiateAI Assistant

## РОЛЬ И МИССИЯ
[Описание роли агента]

## ФИЛОСОФИЯ РАБОТЫ
[Принципы работы]

## БАЗА ЗНАНИЙ
[ИНДЕКСНЫЙ ФАЙЛ index.md ВСТАВЛЯЕТСЯ СЮДА]

## ИНСТРУКЦИИ ПО ФУНКЦИЯМ

### read_document(filepath)
[Как использовать]

### web_search(query)
[Как использовать]

### get_current_date()
[Как использовать]

## СТРАТЕГИИ РАБОТЫ
[Сценарии использования]
```

### Встраивание index.md

При инициализации бота:
1. Читается `system-prompt.md`
2. Читается `index.md`
3. Содержимое `index.md` вставляется в маркер
4. Полный промпт отправляется в Anthropic API

**Зачем:**
- Claude видит полный индекс документов
- Может навигировать по базе знаний
- Знает какие документы существуют

---

## Streaming Responses

### Как работает streaming

```typescript
// Server-side (app/api/chat/route.ts)
const stream = await anthropic.messages.stream({
  model: 'claude-sonnet-4-20250514',
  messages: messages,
  tools: tools
});

// Преобразование в ReadableStream для клиента
return new Response(stream.toReadableStream(), {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  }
});
```

```typescript
// Client-side (components/Chat.tsx)
const { messages, input, handleSubmit } = useChat({
  api: '/api/chat',
  streamMode: 'text'  // Streaming включен
});

// React автоматически обновляет UI по мере получения токенов
```

**Преимущества:**
- Пользователь видит ответ сразу
- Снижается воспринимаемая задержка
- Лучший UX для длинных ответов

---

## Обработка ошибок

### Уровни обработки

**1. API Layer**
```typescript
try {
  const response = await anthropic.messages.create({...});
  return response;
} catch (error) {
  if (error.status === 429) {
    return { error: 'Rate limit exceeded. Попробуй через минуту.' };
  }
  if (error.status === 401) {
    return { error: 'Invalid API key. Проверь ANTHROPIC_API_KEY' };
  }
  return { error: 'Ошибка API. Попробуй позже.' };
}
```

**2. Tools Layer**
```typescript
function readDocument(filepath: string) {
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Документ не найден: ${filepath}`);
  }
  // ... читаем файл
}
```

**3. Client Layer**
```typescript
// UI показывает ошибку пользователю
if (error) {
  return <ErrorMessage>{error.message}</ErrorMessage>;
}
```

---

## Безопасность

### API Keys
- Хранятся в `.env.local` (не коммитятся)
- Используются только на сервере (server-side)
- Не передаются клиенту

### File Access
- Доступ только к папке `knowledge/`
- Валидация путей (предотвращение directory traversal)
- Только чтение (не запись)

### Rate Limiting
- Anthropic: автоматический retry с backoff
- Brave Search: ограничение 1 req/sec
- Client-side: debounce для предотвращения спама

---

## Масштабирование

### Текущая архитектура
- Stateless API (каждый запрос независим)
- Vercel автоматически масштабирует
- Нет базы данных (документы в файловой системе)

### Ограничения
- Размер папки `knowledge/` (Vercel: 50MB limit для функций)
- Rate limits внешних API
- Длина контекста Claude (200K токенов)

### Возможные улучшения
- Добавить векторную БД для больших баз знаний
- Кэширование частых запросов
- Redis для session management
- Разделение на микросервисы

---

## Почему такая архитектура?

### Принятые решения

**1. Next.js App Router**
- Серверные компоненты для безопасности API keys
- Built-in API routes
- Оптимизация для production
- Легкий деплой на Vercel

**2. Прямое подключение к Anthropic API**
- Нативная поддержка DOCX/PDF
- Официальный SDK
- Лучшая документация
- См. [ADR 001](decisions/001-why-anthropic-direct.md)

**3. Без векторной БД**
- Небольшая база знаний (~40 документов)
- Claude Sonnet 4.5 имеет большой контекст (200K токенов)
- Индекс в промпте достаточно эффективен
- См. [ADR 003](decisions/003-no-vector-db.md)

**4. Function Calling**
- Claude выбирает нужные инструменты сам
- Гибкость в использовании
- Естественная интеграция

---

## Дальнейшее развитие

### Roadmap архитектуры

**Phase 1: MVP (текущая)**
- Базовый чат
- 3 функции (read_document, web_search, get_current_date)
- Streaming

**Phase 2: Улучшения**
- История чатов (БД)
- Аутентификация пользователей
- Кэширование ответов

**Phase 3: Advanced**
- Векторный поиск для больших баз
- Multi-turn conversations с контекстом
- Аналитика использования

---

## Полезные ссылки

- [Anthropic Messages API](https://docs.anthropic.com/claude/reference/messages_post)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [Function Calling Guide](https://docs.anthropic.com/claude/docs/tool-use)

---

## Связанные документы

- [setup.md](setup.md) - Установка и настройка
- [deployment.md](deployment.md) - Деплой на Vercel
- [troubleshooting.md](troubleshooting.md) - Решение проблем
- [ADR 001](decisions/001-why-anthropic-direct.md) - Почему Anthropic API
