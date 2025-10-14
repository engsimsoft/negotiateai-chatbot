# AI Agent Tools - Детальная документация

Описание трёх функций (tools) доступных NegotiateAI Assistant для работы с данными.

---

## Обзор

NegotiateAI Assistant использует **function calling** (tool use) от Claude для доступа к внешним данным и функциям.

**Доступные инструменты:**
1. `read_document(filepath)` - Чтение документов из базы знаний
2. `web_search(query)` - Поиск актуальной информации в интернете
3. `get_current_date()` - Получение текущей даты и времени

Claude автоматически выбирает какие инструменты использовать на основе запроса пользователя.

---

## 1. read_document(filepath)

### Описание

Читает документ из папки `knowledge/` и возвращает его содержимое как текст.

Поддерживает нативное чтение DOCX и PDF файлов через Anthropic Messages API.

### Parameters

```typescript
{
  filepath: string  // Путь к файлу относительно папки knowledge/
}
```

### Примеры

**Простой файл в корне:**
```typescript
read_document("ПОЛЬЗОВАТЕЛЬСКИЙ ПУТЬ ПОСТАВЩИКА.docx")
// Читает: knowledge/ПОЛЬЗОВАТЕЛЬСКИЙ ПУТЬ ПОСТАВЩИКА.docx
```

**Файл в подпапке:**
```typescript
read_document("Иран/Краткая информация об Иране.pdf")
// Читает: knowledge/Иран/Краткая информация об Иране.pdf
```

**Файл с пробелами:**
```typescript
read_document("База данных Российских производителей.docx")
// Путь корректно обрабатывает пробелы
```

### Поддерживаемые форматы

- ✅ `.docx` - Microsoft Word документы
- ✅ `.pdf` - PDF документы
- ❌ `.doc` - старый формат Word (не поддерживается)
- ❌ `.txt` - текстовые файлы (не поддерживается нативно)

### Возвращаемое значение

```typescript
string  // Полный текст документа
```

Пример:
```
"# ПОЛЬЗОВАТЕЛЬСКИЙ ПУТЬ ПОСТАВЩИКА

Описание шагов регистрации поставщика на платформе...

1. Регистрация
   - Заполнение формы...

2. Создание профиля
   - Загрузка документов..."
```

### Ошибки

**Document not found:**
```typescript
Error: Document not found: knowledge/nonexistent.docx
```

**Причины:**
- Файл не существует
- Неправильный путь (опечатка)
- Путь не включает подпапку

**Unsupported format:**
```typescript
Error: Unsupported file format: .txt
```

**Причины:**
- Формат файла не поддерживается (не DOCX/PDF)

**File too large:**
```typescript
Error: File size exceeds 10MB limit
```

**Причины:**
- Файл слишком большой (Anthropic API limit)

### Реализация

```typescript
// lib/tools.ts
async function readDocument(filepath: string): Promise<string> {
  // 1. Формируем полный путь
  const fullPath = path.join(process.cwd(), 'knowledge', filepath);

  // 2. Проверяем существование
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Document not found: ${filepath}`);
  }

  // 3. Читаем как base64
  const fileBuffer = fs.readFileSync(fullPath);
  const base64Content = fileBuffer.toString('base64');

  // 4. Определяем MIME type
  const ext = path.extname(filepath);
  const mimeType = {
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pdf': 'application/pdf'
  }[ext];

  // 5. Отправляем в Anthropic для извлечения текста
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
    }],
    max_tokens: 4096
  });

  return response.content[0].text;
}
```

### Как Claude использует

**Сценарий:**
```
User: "Что написано в файле про пользовательский путь?"

Claude анализирует:
1. Смотрит в index.md (в system prompt)
2. Находит документ: "ПОЛЬЗОВАТЕЛЬСКИЙ ПУТЬ ПОСТАВЩИКА.docx"
3. Вызывает: read_document("ПОЛЬЗОВАТЕЛЬСКИЙ ПУТЬ ПОСТАВЩИКА.docx")
4. Получает текст документа
5. Анализирует и отвечает пользователю

Response: "В документе описан путь поставщика..."
```

### Best Practices

**1. Используй индекс для навигации:**

Claude должен сначала посмотреть в `index.md` чтобы найти правильный путь к файлу.

**2. Читай релевантные документы:**

Не читай все документы подряд - выбирай только те, что отвечают на вопрос.

**3. Ссылайся на источник:**

В ответе всегда указывай откуда информация:
```markdown
Согласно документу `knowledge/filename.docx`, ...
```

---

## 2. web_search(query)

### Описание

Ищет актуальную информацию в интернете через Brave Search API.

Возвращает топ 10 результатов с title, snippet и URL.

### Parameters

```typescript
{
  query: string  // Поисковый запрос
}
```

### Примеры

**Актуальная информация:**
```typescript
web_search("курс доллара к рублю сегодня")
```

**Новости:**
```typescript
web_search("последние новости об экспорте в Иран")
```

**Специфичный запрос:**
```typescript
web_search("China import regulations 2025")
```

### Возвращаемое значение

```typescript
Array<{
  title: string;
  snippet: string;
  url: string;
}>
```

Пример:
```json
[
  {
    "title": "Курс доллара на сегодня - ЦБ РФ",
    "snippet": "Официальный курс USD/RUB составляет 95.50 руб. на 14 октября 2025 года...",
    "url": "https://cbr.ru/currency_base/daily/"
  },
  {
    "title": "Доллар к рублю - прогноз на 2025",
    "snippet": "Аналитики прогнозируют стабилизацию курса...",
    "url": "https://example.com/forecast"
  }
]
```

### Ошибки

**Rate limit exceeded:**
```typescript
Error: 429 Too Many Requests - Brave Search rate limit
```

**Причины:**
- Превышен лимит: 1 request/second или 2000/month
- Слишком частые запросы

**Invalid API key:**
```typescript
Error: 403 Forbidden - Invalid Brave Search API key
```

**No results:**
```json
[]  // Пустой массив если нет результатов
```

### Реализация

```typescript
// lib/brave-search.ts
async function webSearch(query: string): Promise<SearchResult[]> {
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', '10');

  const response = await fetch(url.toString(), {
    headers: {
      'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY!,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Brave Search error: ${response.status}`);
  }

  const data = await response.json();

  return data.web?.results?.map((r: any) => ({
    title: r.title,
    snippet: r.description,
    url: r.url
  })) || [];
}
```

### Как Claude использует

**Сценарий:**
```
User: "Какой сейчас курс доллара?"

Claude анализирует:
1. Это запрос об актуальной информации
2. Нет в базе знаний (документы старые)
3. Нужен веб-поиск
4. Вызывает: web_search("курс доллара к рублю сегодня")
5. Получает результаты
6. Суммирует с указанием источников

Response: "По данным ЦБ РФ, курс доллара..."
```

### Rate Limits

**Free tier:**
- 1 request per second
- 2000 requests per month

**Best practices:**
1. Не делай поиск если информация есть в базе знаний
2. Формулируй точные запросы
3. Кэшируй результаты если возможно

---

## 3. get_current_date()

### Описание

Возвращает текущую дату и время на сервере.

### Parameters

Нет параметров.

```typescript
{}  // пустой объект
```

### Возвращаемое значение

```typescript
{
  date: string;        // YYYY-MM-DD
  time: string;        // HH:MM:SS
  timezone: string;    // Часовой пояс
  dayOfWeek: string;   // День недели
  formatted: string;   // Читаемый формат
}
```

Пример:
```json
{
  "date": "2025-10-14",
  "time": "15:30:45",
  "timezone": "Europe/Moscow",
  "dayOfWeek": "вторник",
  "formatted": "14 октября 2025 г."
}
```

### Реализация

```typescript
// lib/tools.ts
function getCurrentDate() {
  const now = new Date();

  return {
    date: now.toISOString().split('T')[0],
    time: now.toTimeString().split(' ')[0],
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

### Как Claude использует

**Сценарий 1: Прямой вопрос о дате**
```
User: "Какое сегодня число?"

Claude вызывает: get_current_date()
Response: "Сегодня 14 октября 2025 года, вторник."
```

**Сценарий 2: Контекст для анализа**
```
User: "Актуальна ли информация в документе от 2022 года?"

Claude вызывает: get_current_date()
Claude анализирует: Сейчас 2025 год, документ 3 года назад
Response: "Документ от 2022 года. С тех пор прошло 3 года..."
```

**Сценарий 3: Фильтрация веб-поиска**
```
User: "Найди новости за последнюю неделю"

Claude вызывает: get_current_date()
Claude формирует запрос: "новости after:2025-10-07"
```

---

## Function Calling Flow

### Как Claude выбирает функции

```
1. User message приходит

2. Claude анализирует:
   - Что спрашивает пользователь?
   - Какие функции доступны?
   - Какая функция нужна?

3. Claude принимает решение:
   ├─ Нужна информация из документа → read_document()
   ├─ Нужна актуальная информация → web_search()
   ├─ Нужна дата → get_current_date()
   └─ Всё есть в промпте → ответ напрямую

4. Если нужна функция:
   - Claude генерирует tool_use block
   - API вызывает функцию
   - Результат возвращается Claude
   - Claude генерирует финальный ответ
```

### Пример полного flow

**Request:**
```json
POST /api/chat
{
  "messages": [
    {
      "role": "user",
      "content": "Какой документ описывает путь поставщика? Прочитай его"
    }
  ]
}
```

**Claude Response (step 1):**
```json
{
  "stop_reason": "tool_use",
  "content": [
    {
      "type": "text",
      "text": "Я найду и прочитаю документ о пути поставщика."
    },
    {
      "type": "tool_use",
      "id": "tool_123",
      "name": "read_document",
      "input": {
        "filepath": "ПОЛЬЗОВАТЕЛЬСКИЙ ПУТЬ ПОСТАВЩИКА.docx"
      }
    }
  ]
}
```

**Tool execution:**
```typescript
const result = await readDocument("ПОЛЬЗОВАТЕЛЬСКИЙ ПУТЬ ПОСТАВЩИКА.docx");
// result = "# ПОЛЬЗОВАТЕЛЬСКИЙ ПУТЬ ПОСТАВЩИКА\n\n..."
```

**Send tool result back:**
```json
{
  "role": "user",
  "content": [
    {
      "type": "tool_result",
      "tool_use_id": "tool_123",
      "content": "# ПОЛЬЗОВАТЕЛЬСКИЙ ПУТЬ ПОСТАВЩИКА\n\n..."
    }
  ]
}
```

**Claude Response (step 2):**
```json
{
  "stop_reason": "end_turn",
  "content": [
    {
      "type": "text",
      "text": "Я прочитал документ. Вот краткое содержание:\n\n1. Регистрация..."
    }
  ]
}
```

---

## Определение Tools для API

```typescript
// lib/tools.ts - Tool definitions
export const tools = [
  {
    name: 'read_document',
    description: 'Читает документ из базы знаний knowledge/. Поддерживает DOCX и PDF форматы. Используй когда пользователь спрашивает о содержимом конкретного документа или когда нужна детальная информация из документации.',
    input_schema: {
      type: 'object',
      properties: {
        filepath: {
          type: 'string',
          description: 'Путь к файлу относительно папки knowledge/. Например: "filename.docx" или "Иран/document.pdf"'
        }
      },
      required: ['filepath']
    }
  },
  {
    name: 'web_search',
    description: 'Ищет актуальную информацию в интернете через Brave Search. Используй для: текущих событий, новостей, курсов валют, актуальных цен, или любой информации которой нет в базе знаний. Возвращает топ-10 результатов с title, snippet и URL.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Поисковый запрос. Формулируй точно и конкретно. Например: "курс доллара сегодня" или "China import regulations 2025"'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'get_current_date',
    description: 'Возвращает текущую дату и время сервера. Используй когда пользователь спрашивает "какая дата", "какое время", или когда нужно знать актуальную дату для контекста (например, проверить актуальность документа).',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];
```

---

## Best Practices

### Для разработчиков

**1. Валидация input:**
```typescript
function readDocument(filepath: string) {
  // Проверка на directory traversal
  if (filepath.includes('..')) {
    throw new Error('Invalid filepath');
  }
  // ...
}
```

**2. Error handling:**
```typescript
try {
  return await readDocument(filepath);
} catch (error) {
  return {
    error: true,
    message: error.message
  };
}
```

**3. Rate limiting:**
```typescript
// Для web_search
const throttle = pThrottle({ limit: 1, interval: 1000 });
const throttledSearch = throttle(webSearch);
```

### Для Claude (в промпте)

**1. Проверяй index.md перед read_document:**

```
Хорошо: Смотрю в index.md → нахожу файл → read_document()
Плохо: Угадываю название файла → read_document() → ошибка
```

**2. Используй web_search для актуальности:**

```
Хорошо: Вопрос о курсе валют → web_search()
Плохо: Читаю документ 2022 года о курсах
```

**3. Указывай источники:**

```
Хорошо: "Согласно документу X (knowledge/X.docx)..."
Плохо: "Я знаю что..."
```

---

## Связанные документы

- [architecture.md](../architecture.md) - Как работает function calling
- [anthropic.md](anthropic.md) - Настройка Anthropic API
- [troubleshooting.md](../troubleshooting.md) - Решение проблем с tools

---

## Дальнейшее развитие

### Возможные новые tools

**create_summary(filepath, type)**
- Создать краткое содержание документа
- Types: executive, detailed, bullet-points

**compare_documents(filepath1, filepath2)**
- Сравнить два документа
- Найти различия и сходства

**calculate(expression)**
- Вычислить математическое выражение
- Полезно для финансовых расчётов

**translate(text, target_lang)**
- Перевести текст
- Полезно для работы с документами на разных языках
