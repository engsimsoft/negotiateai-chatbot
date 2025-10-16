# Troubleshooting - Решение частых проблем

Решения для типичных проблем при разработке и эксплуатации NegotiateAI Assistant.

---

## Категории проблем

- [Установка и настройка](#установка-и-настройка)
- [API и интеграции](#api-и-интеграции)
- [Чтение документов](#чтение-документов)
- [Веб-поиск](#веб-поиск)
- [Streaming и UI](#streaming-и-ui)
- [Деплой и production](#деплой-и-production)

---

## Установка и настройка

### Ошибка: "npm install" failed

**Симптомы:**
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Решение 1:** Проверь версию Node.js
```bash
node --version  # должно быть >= 18.17
```

Если версия старая - установи новую с [nodejs.org](https://nodejs.org/)

**Решение 2:** Очисти кэш npm
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

**Решение 3:** Используй legacy peer deps (временно)
```bash
npm install --legacy-peer-deps
```

---

### Ошибка: "ANTHROPIC_API_KEY is not defined"

**Симптомы:**
```
Error: Environment variable ANTHROPIC_API_KEY is not set
```

**Причины:**
1. Файл `.env.local` не создан
2. Опечатка в названии переменной
3. Сервер не перезапущен после изменения .env

**Решение:**

1. Проверь что `.env.local` существует:
```bash
ls -la .env.local
```

2. Проверь содержимое:
```bash
cat .env.local
```

Должно быть:
```
ANTHROPIC_API_KEY=sk-ant-api03-...
```

3. Перезапусти сервер:
```bash
# Ctrl+C для остановки
npm run dev
```

---

### Ошибка: "Port 3000 is already in use"

**Симптомы:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Решение 1:** Убей процесс на порту 3000
```bash
# macOS/Linux
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID [PID_NUMBER] /F
```

**Решение 2:** Используй другой порт
```bash
PORT=3001 npm run dev
```

---

## API и интеграции

### Anthropic API: "401 Unauthorized"

**Симптомы:**
```
Error: 401 Unauthorized - Invalid API key
```

**Причины:**
1. API ключ неправильный
2. API ключ не активен
3. Аккаунт Anthropic заблокирован

**Решение:**

1. Проверь формат ключа:
```bash
echo $ANTHROPIC_API_KEY
# Должно начинаться с: sk-ant-api03-
```

2. Создай новый ключ на [console.anthropic.com](https://console.anthropic.com/settings/keys)

3. Обнови `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-api03-НОВЫЙ_КЛЮЧ
```

4. Перезапусти сервер

---

### Anthropic API: "429 Too Many Requests"

**Симптомы:**
```
Error: 429 Rate limit exceeded
```

**Причина:** Превышен лимит запросов

**Free tier limits:**
- 5 requests per minute
- 50 requests per day
- 300 requests per month

**Решение 1:** Подожди 1 минуту

**Решение 2:** Upgrade на платный план
- Перейди на [console.anthropic.com/settings/plans](https://console.anthropic.com/settings/plans)
- Выбери **Build** план ($5 минимум)

**Решение 3:** Добавь rate limiting в код
```typescript
// lib/anthropic.ts
import pThrottle from 'p-throttle';

const throttle = pThrottle({
  limit: 5,      // 5 запросов
  interval: 60000 // в минуту
});

const throttledCall = throttle(async () => {
  return await anthropic.messages.create({...});
});
```

---

### Brave Search: "422 SUBSCRIPTION_TOKEN_INVALID" ⚠️ ЧАСТАЯ ПРОБЛЕМА

**Симптомы:**
```
Error: 422 Unprocessable Entity - SUBSCRIPTION_TOKEN_INVALID
```

**Причина:** Shell environment variable перекрывает .env.local

**Диагностика:**
```bash
# 1. Проверь что в .env.local
grep BRAVE_SEARCH_API_KEY .env.local
# Должно быть: BRAVE_SEARCH_API_KEY=BSAyJ8Ibj...

# 2. Проверь что читает Node.js
echo $BRAVE_SEARCH_API_KEY
# Если видишь ДРУГОЙ ключ - проблема найдена!

# 3. Проверь переменную через Node
node -e "console.log(process.env.BRAVE_SEARCH_API_KEY)"
```

**Решение:**

**Environment variables приоритет:**
1. **Shell environment** (export BRAVE_SEARCH_API_KEY=...) ← **ВЫСШИЙ ПРИОРИТЕТ**
2. .env.local файл (Next.js)

Если переменная уже установлена в shell, Next.js **НЕ перезаписывает её** из .env.local!

**Исправление:**
1. **Перезапусти VS Code** (или Terminal) - очистит shell environment
2. Или выполни в терминале:
```bash
unset BRAVE_SEARCH_API_KEY
npm run dev
```
3. Убедись что в shell configs (~/.zshrc, ~/.bashrc) нет export BRAVE_SEARCH_API_KEY

**Проверка после исправления:**
```bash
echo $BRAVE_SEARCH_API_KEY
# Должен показать ПРАВИЛЬНЫЙ ключ из .env.local
```

---

### Brave Search: "403 Forbidden"

**Симптомы:**
```
Error: 403 Forbidden - Invalid API key
```

**Решение:**

1. Проверь ключ на [brave.com/search/api](https://brave.com/search/api)
2. Убедись что ключ начинается с `BSA`
3. Обнови `.env.local`:
```
BRAVE_SEARCH_API_KEY=BSA_НОВЫЙ_КЛЮЧ
```

---

### Brave Search: "429 Rate Limit"

**Симптомы:**
```
Error: 429 Too many requests
```

**Free tier limits:**
- 1 request per second
- 2000 requests per month

**Решение 1:** Проверь usage
- Перейди на [brave.com/search/api/dashboard](https://brave.com/search/api/dashboard)
- Посмотри сколько запросов использовано

**Решение 2:** Добавь debouncing
```typescript
// Не делать запрос чаще чем раз в секунду
let lastCall = 0;
async function search(query) {
  const now = Date.now();
  if (now - lastCall < 1000) {
    await new Promise(r => setTimeout(r, 1000));
  }
  lastCall = Date.now();
  return await braveSearch(query);
}
```

---

## Чтение документов

### Ошибка: "Document not found"

**Симптомы:**
```
Error: Document not found: knowledge/filename.docx
```

**Причины:**
1. Файл не существует
2. Неправильный путь
3. Опечатка в названии

**Решение:**

1. Проверь что файл существует:
```bash
ls -la "knowledge/ПОЛЬЗОВАТЕЛЬСКИЙ ПУТЬ ПОСТАВЩИКА.docx"
```

2. Проверь правильность пути (учитывай подпапки):
```
✅ Правильно: knowledge/Иран/Document.pdf
❌ Неправильно: Иран/Document.pdf
❌ Неправильно: knowledge/iran/Document.pdf (case-sensitive!)
```

3. Проверь расширение файла:
```bash
# Покажет реальное расширение
file "knowledge/filename.docx"
```

---

### Ошибка: "Unsupported file format"

**Симптомы:**
```
Error: File format not supported: .txt
```

**Поддерживаемые форматы:**
- ✅ .docx
- ✅ .pdf
- ❌ .txt
- ❌ .doc (старый формат)
- ❌ .odt

**Решение:**

Конвертируй файлы в DOCX или PDF:
```bash
# Конвертация TXT в DOCX (macOS)
textutil -convert docx input.txt -output output.docx

# Или используй онлайн конвертеры
```

---

### Ошибка: "File too large"

**Симптомы:**
```
Error: File size exceeds limit (>10MB)
```

**Причина:** Anthropic API лимит на размер документа

**Решение 1:** Сжать PDF
```bash
# macOS
python -m pip install --upgrade pikepdf
python -c "import pikepdf; pdf = pikepdf.open('input.pdf'); pdf.save('output.pdf', compress_streams=True)"
```

**Решение 2:** Разбить большой документ на части
```bash
# Разбить PDF на страницы
pdftk input.pdf burst output page_%02d.pdf
```

**Решение 3:** Экспортировать DOCX с меньшим качеством изображений

---

### Ошибка: "Cannot read Cyrillic characters"

**Симптомы:** Бот читает файл, но кириллица выглядит как "?????"

**Причина:** Encoding проблемы (редко с Anthropic API)

**Решение:**

Anthropic API обычно корректно обрабатывает кириллицу. Если проблема:
1. Пересохрани DOCX в UTF-8 encoding
2. Экспортируй в PDF (PDF лучше с кириллицей)

---

## Веб-поиск

### Ошибка: "No results found"

**Симптомы:** Brave Search возвращает пустой массив

**Причины:**
1. Слишком специфичный запрос
2. Опечатка в запросе
3. Brave не индексировал эту информацию

**Решение:**

1. Переформулируй запрос (сделай шире)
2. Используй английский (больше результатов)
3. Проверь запрос вручную на [search.brave.com](https://search.brave.com)

---

### Ошибка: "Search timeout"

**Симптомы:**
```
Error: Request timeout after 10s
```

**Решение:** Увеличь timeout
```typescript
// lib/brave-search.ts
const response = await fetch(url, {
  signal: AbortSignal.timeout(20000) // 20 секунд
});
```

---

## Streaming и UI

### Проблема: Streaming не работает

**Симптомы:** Весь ответ появляется сразу, а не постепенно

**Причины:**
1. Middleware блокирует streaming
2. Прокси сервер буферизует ответ
3. Неправильная настройка fetch

**Решение 1:** Проверь настройки API route
```typescript
// app/api/chat/route.ts
export const runtime = 'edge'; // Используй edge runtime

return new Response(stream, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // Отключить буферизацию nginx
  }
});
```

**Решение 2:** В development режиме всегда должно работать
```bash
npm run dev  # Проверь здесь
```

---

### Проблема: Markdown не рендерится

**Симптомы:** Вместо форматирования видно символы `**bold**`, `# Header`

**Решение:** Убедись что используется markdown компонент
```typescript
import ReactMarkdown from 'react-markdown';

<ReactMarkdown>{message.content}</ReactMarkdown>
```

---

### Проблема: Долгая загрузка (>30 секунд)

**Причины:**
1. Большой документ читается
2. Много вызовов функций
3. Медленный интернет

**Решение 1:** Добавь loading indicator
```typescript
{isLoading && <LoadingSpinner />}
```

**Решение 2:** Увеличь timeout (см. выше)

---

## Деплой и production

### Build failed на Vercel

**Симптомы:**
```
Error: Build failed
Command "npm run build" exited with 1
```

**Решение 1:** Проверь build локально
```bash
npm run build
```
Исправь все ошибки которые увидишь.

**Решение 2:** Проверь Node.js версию

В `package.json` добавь:
```json
"engines": {
  "node": ">=18.17.0"
}
```

**Решение 3:** Проверь логи Vercel

В Vercel dashboard:
- Deployments → Failed deployment → View Build Logs
- Ищи ошибку в логах

---

### Environment variables не работают в production

**Симптомы:**
```
Error: ANTHROPIC_API_KEY is undefined (production)
```

**Решение:**

1. Проверь что переменные добавлены в Vercel:
   - Project Settings → Environment Variables
   - Должны быть для Production ✅

2. Redeploy после добавления переменных:
   - Deployments → Latest → Redeploy

3. Проверь что переменная не имеет префикс `NEXT_PUBLIC_`:
```
✅ Правильно: ANTHROPIC_API_KEY (server-side)
❌ Неправильно: NEXT_PUBLIC_ANTHROPIC_API_KEY (leaked to client!)
```

---

### Документы не найдены в production

**Симптомы:**
```
Error: ENOENT: no such file or directory, open 'knowledge/file.docx'
```

**Причины:**
1. Папка `knowledge/` не включена в деплой
2. Путь к файлам неправильный

**Решение 1:** Проверь `.vercelignore`

Убедись что НЕТ:
```
# ❌ Не должно быть
knowledge/
```

**Решение 2:** Проверь размер папки
```bash
du -sh knowledge/
```

Vercel limit: 50MB для serverless functions.

Если больше - нужно:
- Сжать PDF файлы
- Удалить дубликаты
- Использовать внешнее хранилище (S3, Cloudflare R2)

---

### Функции работают локально, но не на Vercel

**Симптомы:** Все работает в dev, но в production функции не вызываются

**Причина:** Edge runtime ограничения

**Решение:** Смени runtime

```typescript
// app/api/chat/route.ts
export const runtime = 'nodejs'; // Вместо 'edge'
```

Edge runtime имеет ограничения:
- Нет fs (file system) - используй fetch
- Нет некоторых Node.js модулей

---

### CORS errors в production

**Симптомы:**
```
Access to fetch has been blocked by CORS policy
```

**Решение:** Добавь CORS headers

```typescript
// app/api/chat/route.ts
export async function POST(req: Request) {
  // ... твой код ...

  return new Response(data, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

export async function OPTIONS(req: Request) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
```

---

## Performance Issues

### Проблема: Медленные ответы (>10 секунд)

**Причины:**
1. Большой system prompt
2. Много tool calls
3. Большой документ

**Решение 1:** Оптимизируй system prompt
- Сократи промпт (удали лишнее)
- Важная информация в начале

**Решение 2:** Используй caching (Anthropic prompt caching)
```typescript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  system: [
    {
      type: 'text',
      text: systemPrompt,
      cache_control: { type: 'ephemeral' } // Кэш на 5 минут
    }
  ],
  messages: [...],
});
```

**Решение 3:** Parallel tool calls
Claude может вызывать несколько tools параллельно - это быстрее.

---

## Debugging Tips

### Просмотр логов в production

```bash
# Vercel CLI
vercel logs --follow

# Или в dashboard
# Deployments → View Function Logs
```

### Локальный debug

```typescript
// Добавь console.log в критичные места
console.log('Tool called:', toolName, toolInput);
console.log('Document path:', filepath);
console.log('API response:', response);
```

### Проверка API ключей

```bash
# Anthropic API
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-4-5-20250929","messages":[{"role":"user","content":"Hi"}],"max_tokens":10}'

# Brave Search API
curl "https://api.search.brave.com/res/v1/web/search?q=test" \
  -H "X-Subscription-Token: $BRAVE_SEARCH_API_KEY"
```

---

## Когда обращаться за помощью

Если проблема не решается:

1. ✅ Проверь все решения в этом документе
2. ✅ Посмотри логи (браузер F12 + terminal)
3. ✅ Проверь [setup.md](setup.md) и [architecture.md](architecture.md)
4. ✅ Поищи в [Anthropic Docs](https://docs.anthropic.com/)
5. ✅ Создай Issue в репозитории с:
   - Описанием проблемы
   - Шагами для воспроизведения
   - Логами ошибок
   - Environment (OS, Node version, etc.)

---

## Полезные ссылки

- [Anthropic API Status](https://status.anthropic.com/)
- [Brave Search Status](https://status.brave.com/)
- [Vercel Status](https://www.vercel-status.com/)
- [Next.js Troubleshooting](https://nextjs.org/docs/messages)

---

## Связанные документы

- [setup.md](setup.md) - Установка и настройка
- [architecture.md](architecture.md) - Архитектура проекта
- [deployment.md](deployment.md) - Деплой на Vercel
