# Детальная установка и настройка

Пошаговое руководство по установке и настройке проекта Family AI Assistant.

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
- @ai-sdk/google (официальный SDK для Gemini API)
- Vercel AI SDK (для streaming и UI компонентов)
- NextAuth 5.0 (авторизация)
- Drizzle ORM (работа с БД)
- И другие зависимости

---

## Шаг 3: Получение API ключей

### 3.1 Google Gemini API Key

1. Перейди на [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Зарегистрируйся или войди в свой Google аккаунт
3. Нажми **Create API key in new project**
4. Скопируй сгенерированный ключ

**Важно:**
- Google предоставляет бесплатный доступ к Gemini с щедрыми лимитами для личного использования

### 3.2 Brave Search API Key

1. Перейди на [brave.com/search/api](https://brave.com/search/api/)
2. Нажми **Get Started** и зарегистрируйся
3. Перейди в раздел **API Keys**
4. Создай новый ключ
5. Скопируй ключ (он начинается с `BSA...`)

**Важно:**
- Бесплатный tier: 2000 запросов в месяц

### 3.3 PostgreSQL Database (Neon)

1. Перейди на [neon.tech](https://neon.tech)
2. Создай новый проект
3. Скопируй `POSTGRES_URL` (connection string)

**Альтернатива:** Используй Vercel Postgres при деплое на Vercel

### 3.4 Vercel Blob Storage

1. Перейди на [vercel.com/storage](https://vercel.com/storage)
2. Создай Blob store
3. Скопируй `BLOB_READ_WRITE_TOKEN`

---

## Шаг 4: Настройка переменных окружения

### 4.1 Создание .env.local

Скопируй шаблон `.env.example` в `.env.local`:

```bash
cp .env.example .env.local
```

**Важно:** `.env.local` не должен коммититься в Git (он уже в `.gitignore`)

### 4.2 Заполнение .env.local

Открой `.env.local` в редакторе и вставь свои ключи:

```bash
# Google Gemini API Key
GOOGLE_GENERATIVE_AI_API_KEY=ТВОЙ_КЛЮЧ_СЮДА

# Brave Search API Key
BRAVE_SEARCH_API_KEY=BSA_ТВОЙ_КЛЮЧ_СЮДА

# NextAuth Configuration
AUTH_SECRET=СГЕНЕРИРУЙ_ЧЕРЕЗ_openssl_rand_base64_32

# PostgreSQL Database
POSTGRES_URL=postgresql://username:password@host/database

# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN=ТВОЙ_ТОКЕН_СЮДА

# Next.js Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Генерация AUTH_SECRET:**
```bash
openssl rand -base64 32
```

**Проверка:**
- Не должно быть пробелов до или после ключей

---

## Шаг 5: Настройка базы данных

### 5.1 Применение миграций

```bash
npm run db:migrate
```

Эта команда создаст необходимые таблицы:
- `User` - пользователи
- `Chat` - чаты
- `Message` - сообщения
- `Document` - документы
- И другие таблицы NextAuth

### 5.2 Проверка БД (опционально)

```bash
npm run db:studio
```

Откроет Drizzle Studio - UI для просмотра и редактирования БД

---

## Шаг 6: Первый запуск

Запусти development сервер:

```bash
npm run dev
```

**Ожидаемый вывод:**

```
  ▲ Next.js 15.3.x
  - Local:        http://localhost:3000
  - Ready in Xs
```

Открой [http://localhost:3000](http://localhost:3000) в браузере.

### Что должно работать:

✅ Страница логина загружается
✅ Можно войти (если создали пользователя)
✅ Поле ввода активно
✅ Можно отправить сообщение
✅ Бот отвечает (streaming)

### Первый тест:

Отправь в чат:
```
Привет! Кто ты?
```

Бот должен ответить согласно своей роли (инженер/маркетолог)

---

## Шаг 7: Тестирование функций

### 7.1 Тест базового чата

```
Помоги мне с задачей
```

**Ожидаемое поведение:**
- Бот отвечает в соответствии с ролью
- Streaming работает (текст появляется постепенно)
- Markdown форматирование корректно

### 7.2 Тест web_search

```
Найди актуальную информацию о Next.js 15
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

### Проблема: "GOOGLE_GENERATIVE_AI_API_KEY is not valid"

**Причины:**
- Забыл создать `.env.local`
- Опечатка в названии переменной
- Неверный или неактивный ключ API
- Не перезапустил сервер после изменения .env.local

**Решение:**
1. Проверь что файл `.env.local` существует
2. Проверь что ключ называется `GOOGLE_GENERATIVE_AI_API_KEY`
3. Сгенерируй новый ключ на [aistudio.google.com](https://aistudio.google.com/app/apikey)
4. Перезапусти сервер: `Ctrl+C` → `npm run dev`

---

### Проблема: "Rate limit exceeded" (Brave Search)

**Причина:** Превышен лимит запросов к Brave API

**Решение:**
- Бесплатный tier: 1 запрос в секунду, 2000 в месяц
- Делай запросы медленнее

---

### Проблема: Database connection error

**Причина:** Неверный `POSTGRES_URL` или БД недоступна

**Решение:**
1. Проверь правильность connection string
2. Убедись что БД доступна
3. Проверь что миграции применены: `npm run db:migrate`

---

## Следующие шаги

После успешной установки:

1. **Изучи архитектуру** - прочитай [architecture.md](architecture.md)
2. **Настрой деплой** - следуй инструкциям в [deployment.md](deployment.md)
3. **Добавь пользователей** - создай seed скрипт или используй Drizzle Studio

---

## Полезные ссылки

- [Google AI for Developers](https://ai.google.dev/)
- [Brave Search API Docs](https://brave.com/search/api/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [NextAuth Documentation](https://next-auth.js.org/)
- [Drizzle ORM](https://orm.drizzle.team/)

---

## Нужна помощь?

Если столкнулся с проблемой, которой нет в этом руководстве:

1. Проверь [troubleshooting.md](troubleshooting.md) - там больше решений
2. Проверь логи в консоли браузера (F12 → Console)
3. Проверь логи сервера в терминале
4. Создай Issue в репозитории проекта
