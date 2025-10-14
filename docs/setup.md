# Детальная установка и настройка

Пошаговое руководство по установке и настройке проекта NegotiateAI Assistant.

## Prerequisites

Перед началом убедитесь, что у вас установлено:

- **Node.js** 18.17 или выше ([скачать](https://nodejs.org/))
- **npm** 9.0 или выше (устанавливается вместе с Node.js)
- **Git** для клонирования репозитория ([скачать](https://git-scm.com/))
- Текстовый редактор (VS Code, Cursor, и т.д.)

### Проверка версий

```bash
node --version   # должно быть >= v18.17
npm --version    # должно быть >= 9.0
```

---

## Шаг 1: Клонирование репозитория

```bash
git clone <repository-url>
cd "NegotiateAI Chatbot"
```

---

## Шаг 2: Установка зависимостей

```bash
npm install
```

Эта команда установит все необходимые пакеты из `package.json`:
- Next.js и React
- @anthropic-ai/sdk (официальный SDK для Anthropic API)
- Vercel AI SDK (для streaming и UI компонентов)
- И другие зависимости

---

## Шаг 3: Получение API ключей

### 3.1 Anthropic API Key

1. Перейди на [console.anthropic.com](https://console.anthropic.com/)
2. Зарегистрируйся или войди в аккаунт
3. Перейди в раздел **Settings** → **API Keys**
4. Нажми **Create Key**
5. Скопируй ключ (он начинается с `sk-ant-api03-...`)

**Важно:**
- Anthropic предоставляет $5 кредитов при регистрации
- Claude Sonnet 4.5: ~$3 за 1M input tokens, ~$15 за 1M output tokens
- Для тестирования проекта этого достаточно

### 3.2 Brave Search API Key

1. Перейди на [brave.com/search/api](https://brave.com/search/api/)
2. Нажми **Get Started** и зарегистрируйся
3. Перейди в раздел **API Keys**
4. Создай новый ключ
5. Скопируй ключ (он начинается с `BSA...`)

**Важно:**
- Бесплатный tier: 2000 запросов в месяц
- Rate limit: 1 запрос в секунду
- Для проекта этого достаточно

---

## Шаг 4: Настройка переменных окружения

### 4.1 Создание .env.local

Скопируй шаблон `.env.example` в `.env.local`:

```bash
cp .env.example .env.local
```

**Важно:** `.env.local` не должен коммититься в Git (он уже в `.gitignore`).

### 4.2 Заполнение .env.local

Открой `.env.local` в редакторе и вставь свои ключи:

```bash
# Anthropic API Key
ANTHROPIC_API_KEY=sk-ant-api03-ТВОЙ_КЛЮЧ_СЮДА

# Brave Search API Key
BRAVE_SEARCH_API_KEY=BSA_ТВОЙ_КЛЮЧ_СЮДА

# Next.js Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Проверка:**
- ANTHROPIC_API_KEY должен начинаться с `sk-ant-api03-`
- BRAVE_SEARCH_API_KEY должен начинаться с `BSA`
- Не должно быть пробелов до или после ключей

---

## Шаг 5: Проверка базы знаний

Убедись, что папка `knowledge/` содержит документы:

```bash
ls knowledge/
```

Должны быть видны:
- Папки стран (Алжир, Египет, Иран, Китай, ОАЭ, и т.д.)
- DOCX и PDF файлы в корне
- Всего ~40+ файлов и папок

Если папка пустая - скопируй документы из оригинальной папки MIR.TRADE.

---

## Шаг 6: Первый запуск

Запусти development сервер:

```bash
npm run dev
```

**Ожидаемый вывод:**

```
  ▲ Next.js 14.x.x
  - Local:        http://localhost:3000
  - Ready in Xs
```

Открой [http://localhost:3000](http://localhost:3000) в браузере.

### Что должно работать:

✅ Страница чата загружается
✅ Поле ввода активно
✅ Можно отправить сообщение
✅ Бот отвечает (streaming)

### Первый тест:

Отправь в чат:
```
Какие документы доступны в базе знаний?
```

Бот должен перечислить категории документов из `index.md`.

---

## Шаг 7: Тестирование функций

### 7.1 Тест read_document

```
Прочитай файл "ПОЛЬЗОВАТЕЛЬСКИЙ ПУТЬ ПОСТАВЩИКА.docx" и расскажи что там
```

**Ожидаемое поведение:**
- Бот использует функцию read_document
- Читает содержимое DOCX файла
- Анализирует и пересказывает содержание
- Даёт ссылку на источник

### 7.2 Тест web_search

```
Найди актуальную информацию о текущей ситуации с экспортом в Китай
```

**Ожидаемое поведение:**
- Бот использует функцию web_search
- Ищет информацию через Brave Search
- Возвращает результаты с ссылками на источники

### 7.3 Тест get_current_date

```
Какая сегодня дата?
```

**Ожидаемое поведение:**
- Бот использует функцию get_current_date
- Возвращает актуальную дату и время

---

## Troubleshooting установки

### Проблема: "npm install" выдаёт ошибки

**Решение:**
1. Проверь версию Node.js: `node --version` (должно быть >= 18.17)
2. Очисти кэш: `npm cache clean --force`
3. Удали `node_modules` и `package-lock.json`
4. Попробуй снова: `npm install`

---

### Проблема: "ANTHROPIC_API_KEY is not defined"

**Причины:**
- Забыл создать `.env.local`
- Опечатка в названии переменной
- Не перезапустил сервер после изменения .env.local

**Решение:**
1. Проверь что файл `.env.local` существует
2. Проверь что ключ называется `ANTHROPIC_API_KEY` (без опечаток)
3. Перезапусти сервер: `Ctrl+C` → `npm run dev`

---

### Проблема: "Rate limit exceeded" (Anthropic)

**Причина:** Превышен лимит запросов к API

**Решение:**
- Бесплатный tier Anthropic: 5 requests per minute
- Подожди 1 минуту и попробуй снова
- Или апгрейдни аккаунт на anthropic.com

---

### Проблема: "Rate limit exceeded" (Brave Search)

**Причина:** Превышен лимит запросов к Brave API

**Решение:**
- Бесплатный tier: 1 запрос в секунду, 2000 в месяц
- Делай запросы медленнее
- Проверь usage на brave.com/search/api

---

### Проблема: "Document not found" при чтении файла

**Причина:** Файл не найден в папке `knowledge/`

**Решение:**
1. Проверь что файл существует: `ls knowledge/`
2. Проверь правильность пути (учитывай подпапки)
3. Проверь название файла (включая расширение)

**Пример правильного пути:**
```
knowledge/База данных Российских производителей.docx  ✅
База данных Российских производителей.docx            ❌
```

---

### Проблема: Streaming не работает

**Симптомы:** Ответ появляется целиком, а не по частям

**Причина:** Middleware или прокси блокирует streaming

**Решение:**
- В development это работает из коробки
- В production проверь настройки Vercel (см. [deployment.md](deployment.md))

---

## Дополнительные команды

### Запуск в production mode

```bash
npm run build    # Сборка проекта
npm run start    # Запуск production сервера
```

### Проверка кода

```bash
npm run lint     # ESLint проверка
npm run format   # Prettier форматирование
```

---

## Следующие шаги

После успешной установки:

1. **Изучи архитектуру** - прочитай [architecture.md](architecture.md)
2. **Настрой деплой** - следуй инструкциям в [deployment.md](deployment.md)
3. **Кастомизируй промпт** - отредактируй `system-prompt.md` под свои нужды

---

## Полезные ссылки

- [Anthropic API Docs](https://docs.anthropic.com/)
- [Brave Search API Docs](https://brave.com/search/api/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)

---

## Нужна помощь?

Если столкнулся с проблемой, которой нет в этом руководстве:

1. Проверь [troubleshooting.md](troubleshooting.md) - там больше решений
2. Проверь логи в консоли браузера (F12 → Console)
3. Проверь логи сервера в терминале
4. Создай Issue в репозитории проекта
