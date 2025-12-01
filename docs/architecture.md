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
│  │  ├── providers.ts      - AI Provider config          │  │
│  │  ├── tools.ts          - AI agent tools              │  │
│  │  └── brave-search.ts   - Brave Search integration    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                     │
                     │ External APIs
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  External Services                                          │
│  ├── Google Gemini API  - Gemini 2.5 Pro (единая модель)  │
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
- Вызов Google Gemini API
- Streaming ответов клиенту
- Обработку ошибок

**Поток данных:**
```
User message → POST /api/chat → Google Gemini API → Stream response → User
```

---

### 3. Business Logic Layer

**Папка:** `lib/`

#### lib/ai/providers.ts
- Инициализация Google Gemini SDK
- Конфигурация модели Gemini 2.5 Pro

#### lib/ai/tools/
- Определение и реализация AI agent tools (например, `read-document.ts`)

#### lib/integrations/brave-search.ts
- Интеграция с Brave Search API
- Форматирование результатов поиска

---

### 4. Data Layer

**Папка:** `knowledge/`

- Оригинальные документы (DOCX, PDF)
- Структура по странам
- Индекс документов (`index.md`)
- Прямое чтение через Gemini Vision API

---

## Как работает AI Agent

### Инициализация агента

```typescript
// 1. Загрузка system prompt
const systemPrompt = loadSystemPrompt(); // из system-prompt.md

// 2. Встраивание index.md в промпт
const knowledgeIndex = readFile('index.md');
const fullPrompt = systemPrompt.replace('[ИНДЕКС ВСТАВЛЯЕТСЯ СЮДА]', knowledgeIndex);

// 3. Определение tools (через Vercel AI SDK)
const tools = {
  readDocument: { /*...*/ },
  webSearch: { /*...*/ },
  getCurrentDate: { /*...*/ }
};

// 4. Отправка в Google Gemini API через Vercel AI SDK
const { stream } = await streamText({
  model: google("gemini-2.5-pro"),
  system: fullPrompt,
  prompt: last(messages).content,
  tools: tools
});
```

---

## Function Calling Flow

### Сценарий: Пользователь спрашивает о документе

```
1. User: "Что написано в файле ПОЛЬЗОВАТЕЛЬСКИЙ ПУТЬ ПОСТАВЩИКА.docx?"

2. API Layer: отправляет запрос в Google Gemini API

3. Gemini анализирует:
   - Запрос пользователя
   - System prompt (с индексом документов)
   - Доступные tools

4. Gemini решает использовать readDocument:
   // Vercel AI SDK генерирует tool_code, который выполняет readDocument

5. lib/ai/tools/read-document.ts выполняет чтение:
   - Находит файл в knowledge/
   - Читает содержимое через Gemini Vision API (для DOCX/PDF)
   - Возвращает текст документа

6. Gemini получает результат и генерирует ответ:
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

Google Gemini Vision API поддерживает нативное чтение DOCX и PDF.

```typescript
// lib/ai/vision-ocr.ts
async function readDocument(filepath: string): Promise<string> {
  // 1. Находим файл
  const fullPath = path.join(process.cwd(), 'knowledge', filepath);

  // 2. Читаем как бинарные данные
  const fileBuffer = fs.readFileSync(fullPath);

  // 3. Отправляем в Gemini Vision API для извлечения текста
  const { text } = await experimental_streamText({
    model: google("gemini-2.5-pro"),
    prompt: 'Извлеки и верни полный текст из этого документа.',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Извлеки текст.' },
          { type: 'image', image: fileBuffer } // SDK обрабатывает Buffer для документов
        ],
      },
    ],
  });

  return text;
}
```

**Преимущества:**
- Не нужна конвертация DOCX/PDF в TXT на стороне сервера
- Gemini понимает структуру и контекст документа

---

## System Prompt Architecture

### Структура промпта

```markdown
# System Prompt: NegotiateAI Assistant

## РОЛЬ И МИССИЯ
[Описание роли агента]

## БАЗА ЗНАНИЙ
[ИНДЕКСНЫЙ ФАЙЛ index.md ВСТАВЛЯЕТСЯ СЮДА]

## ИНСТРУКЦИИ ПО ФУНКЦИЯМ
[Описание как использовать инструменты]

## СТРАТЕГИИ РАБОтЫ
[Сценарии использования]
```

### Встраивание index.md

При инициализации бота:
1. Читается `system-prompt.md`
2. Читается `index.md`
3. Содержимое `index.md` вставляется в маркер
4. Полный промпт отправляется в Google Gemini API как `system` message.

**Зачем:**
- Gemini видит полный индекс документов
- Может навигировать по базе знаний
- Знает какие документы существуют

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

---

## Почему такая архитектура?

### Принятые решения

**1. Next.js App Router**
- Серверные компоненты для безопасности API keys
- Built-in API routes
- Легкий деплой на Vercel

**2. Прямое подключение к Google Gemini API**
- Нативная поддержка DOCX/PDF через Vision API
- Официальный SDK от Vercel/Google
- См. [ADR 001](decisions/001-why-anthropic-direct.md) (устарел, но причина перехода актуальна)

**3. Без векторной БД**
- Небольшая база знаний (~40 документов)
- Gemini 2.5 Pro имеет огромный контекст (1M токенов)
- Индекс в промпте достаточно эффективен

---

## Полезные ссылки

- [Google AI for Developers](https://ai.google.dev/)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)

---

## Связанные документы

- [setup.md](setup.md) - Установка и настройка
- [deployment.md](deployment.md) - Деплой на Vercel
- [troubleshooting.md](troubleshooting.md) - Решение проблем
- [ADR 001](decisions/001-why-anthropic-direct.md) - Почему Anthropic API (УСТАРЕЛ)
