# Деплой на Vercel

Пошаговое руководство по развертыванию Simply на платформе Vercel.

## Почему Vercel?

- **Next.js native** - создатели Next.js
- **Бесплатный tier** - достаточно для проекта
- **Auto-deploy** - деплой при push в GitHub
- **Edge Functions** - быстрая работа по всему миру
- **Простая настройка** - 5 минут до продакшна

---

## Prerequisites

Перед деплоем убедись что:
- ✅ Проект работает локально (`npm run dev`)
- ✅ Все функции протестированы
- ✅ Есть аккаунт на [vercel.com](https://vercel.com)
- ✅ Репозиторий на GitHub
- ✅ API ключи (Anthropic, Google Gemini, Brave Search, и др.)
- ✅ PostgreSQL database (Neon)

---

## Шаг 1: Подготовка репозитория

### 1.1 Коммит всех изменений

```bash
git add .
git commit -m "Подготовка к деплою на Vercel"
```

### 1.2 Создание .gitignore (если нет)

Убедись что `.env.local` в `.gitignore`:

```
# .gitignore
.env.local
.env*.local
node_modules/
.next/
out/
.DS_Store
```

**Важно:** Никогда не коммить `.env.local` с реальными ключами!

### 1.3 Push в GitHub

```bash
git push origin master
```

---

## Шаг 2: Создание проекта в Vercel

### 2.1 Вход в Vercel

1. Перейди на [vercel.com](https://vercel.com)
2. Нажми **Sign Up** или **Login**
3. Авторизуйся через GitHub

### 2.2 Импорт проекта

1. На dashboard нажми **Add New** → **Project**
2. Выбери репозиторий **NegotiateAI Chatbot** (или новое название)
3. Нажми **Import**

### 2.3 Настройка проекта

**Framework Preset:** Next.js (определится автоматически)

**Root Directory:** `.` (по умолчанию)

**Build Command:** `npm run build` (по умолчанию)

**Output Directory:** `.next` (по умолчанию)

**Install Command:** `npm install` (по умолчанию)

---

## Шаг 3: Настройка Environment Variables

### 3.1 Добавление переменных

Полный список переменных для production (см. `.env.example`):

**AI Providers:**
- `ANTHROPIC_API_KEY` — основной AI-провайдер (Claude)
- `GOOGLE_GENERATIVE_AI_API_KEY` — vision-ocr, briefing фильтр, подкаст TTS

**Search & Tools:**
- `BRAVE_SEARCH_API_KEY` — веб-поиск
- `PERPLEXITY_API_KEY` — Deep Research tool
- `JINA_API_KEY` — Fetch URL fallback

**Voice:**
- `DEEPGRAM_API_KEY` — голосовой ввод (Deepgram Nova-3)

**Auth & DB:**
- `AUTH_SECRET` — шифрование сессий NextAuth
- `AUTH_TRUST_HOST` — `true` (для Vercel)
- `POSTGRES_URL` — PostgreSQL (Neon)

**Storage & App:**
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob Storage
- `NEXT_PUBLIC_APP_URL` — `https://your-domain.vercel.app`

**Telegram Bot (ТЗ-TG3):**
- `TELEGRAM_BOT_TOKEN` — токен бота @GetSimplyBot
- `TELEGRAM_WEBHOOK_SECRET` — секрет для валидации webhook

**Other:**
- `CLOUDCONVERT_API_KEY` — конвертация файлов

**Через Vercel CLI (рекомендуется):**

> **КРИТИЧНО:** Используй `printf`, НЕ `echo` — иначе trailing newline сломает ключи! См. [docs/mcp-tools.md](mcp-tools.md) раздел Vercel.

```bash
printf 'значение' | npx vercel env add ИМЯ_ПЕРЕМЕННОЙ production
```

### 3.2 Проверка переменных

```bash
npx vercel env ls production
```

Должно быть **15 переменных** для полной функциональности.

---

## Шаг 4: Настройка Vercel Postgres (опционально)

### 4.1 Создание Postgres Database

Если еще нет БД:

1. В Vercel project → **Storage** → **Create Database**
2. Выбери **Postgres**
3. Назови database (например, `family-ai-assistant`)
4. Выбери регион (ближайший к пользователям)
5. Нажми **Create**

### 4.2 Подключение к проекту

Vercel автоматически добавит переменные:
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`

---

## Шаг 5: Первый деплой

### 5.1 Запуск деплоя

Нажми **Deploy** (синяя кнопка).

Vercel начнёт:
1. ✅ Клонирование репозитория
2. ✅ Установка зависимостей (`npm install`)
3. ✅ Сборка проекта (`npm run build`)
4. ✅ Деплой на edge network

**Время:** ~2-3 минуты

### 5.2 Проверка деплоя

После завершения:
1. Увидишь **Deployment Complete** с конфетти 🎉
2. Получишь URL: `https://family-ai-assistant-xxxx.vercel.app`
3. Нажми **Visit** чтобы открыть

---

## Шаг 6: Применение миграций БД

После первого деплоя примени миграции:

```bash
# Локально, подключившись к production БД
POSTGRES_URL=<production-url> npm run db:migrate
```

Или используй Vercel CLI:

```bash
vercel env pull .env.production
npm run db:migrate
```

---

## Шаг 7: Создание пользователей

### 7.1 Через Drizzle Studio

```bash
# Подключись к production БД
POSTGRES_URL=<production-url> npm run db:studio
```

Создай двух пользователей:
- Email: `vladimir@example.com`, Role: `engineer`
- Email: `julia@example.com`, Role: `marketer`

### 7.2 Через seed скрипт (будущее)

После создания seed скрипта:

```bash
POSTGRES_URL=<production-url> npm run db:seed
```

---

## Шаг 8: Проверка работы

### 8.1 Тест базового функционала

Открой деплоенное приложение и протестируй:

**Тест 1: Интерфейс**
```
✅ Страница логина загружается
✅ Поле ввода активно
✅ Нет ошибок в консоли (F12)
```

**Тест 2: Авторизация**
```
✅ Можно войти как Владимир
✅ Можно войти как Юлия
✅ Session сохраняется
```

**Тест 3: Простой вопрос**
```
Вопрос: "Привет! Расскажи о себе"

✅ Бот отвечает согласно роли
✅ Streaming работает (текст появляется постепенно)
✅ Форматирование корректно
```

**Тест 4: web_search**
```
Вопрос: "Найди актуальную информацию о курсе доллара"

✅ Бот использует функцию web_search
✅ Возвращает результаты с ссылками
```

**Тест 5: get_current_date**
```
Вопрос: "Какая сегодня дата?"

✅ Бот возвращает актуальную дату
```

---

## Шаг 9: Настройка custom domain (опционально)

### 9.1 Добавление домена

Если у тебя есть домен:

1. В Vercel project settings → **Domains**
2. Нажми **Add**
3. Введи домен: `family.yourdomain.com`
4. Следуй инструкциям для настройки DNS

### 9.2 Обновление NEXT_PUBLIC_APP_URL

После настройки домена:

1. Project Settings → **Environment Variables**
2. Найди `NEXT_PUBLIC_APP_URL`
3. Измени на `https://family.yourdomain.com`
4. Сохрани

Vercel автоматически сделает redeploy.

---

## Auto-Deploy: Push to Deploy

### Как работает

После первого деплоя каждый push в GitHub автоматически деплоится:

```bash
# Локально
git add .
git commit -m "Обновление промпта для инженера"
git push origin master

# Vercel автоматически:
# 1. Детектит push
# 2. Запускает build
# 3. Деплоит новую версию
# 4. Отправляет уведомление
```

### Preview Deployments

Для feature branches:

```bash
git checkout -b feature/new-role
git push origin feature/new-role
```

Vercel создаст **preview deployment** с отдельным URL для тестирования.

---

## Мониторинг и логи

### Просмотр логов

1. В Vercel dashboard → твой проект
2. **Deployments** → выбери деплой
3. **View Function Logs**

Здесь видны:
- API вызовы
- Ошибки
- Performance metrics

### Real-time Logs

```bash
vercel logs --follow
```

Показывает логи в реальном времени.

---

## Troubleshooting деплоя

### Проблема: Build failed

**Симптомы:**
```
Error: Build failed
npm run build exited with 1
```

**Решения:**

1. **Проверь локальный build:**
```bash
npm run build
```
Если не работает локально - исправь ошибки.

2. **Проверь зависимости:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

3. **Проверь Node.js версию:**
В `package.json` добавь:
```json
"engines": {
  "node": ">=18.17.0"
}
```

---

### Проблема: Environment variables not working

**Симптомы:**
```
Error: GOOGLE_GENERATIVE_AI_API_KEY is not defined
```

**Решения:**

1. **Проверь названия переменных:**
   - Должны быть ТОЧНО как в `.env.example`
   - Case-sensitive (GOOGLE_GENERATIVE_AI_API_KEY ≠ google_generative_ai_api_key)

2. **Проверь что выбраны все environments:**
   - Production ✅
   - Preview ✅
   - Development ✅

3. **Redeploy после добавления переменных:**
   - Deployments → последний деплой → три точки → **Redeploy**

---

### Проблема: Database connection error

**Причина:** Неверный `POSTGRES_URL` или БД недоступна

**Решение:**

1. Проверь connection string
2. Убедись что миграции применены
3. Проверь что БД доступна из Vercel (whitelist IP если нужно)

---

### Проблема: Streaming не работает

**Симптомы:** Ответ появляется целиком, а не постепенно

**Причина:** Edge runtime не поддерживает streaming (редко)

**Решение:**

В `app/(chat)/api/chat/route.ts` добавь:
```typescript
export const runtime = 'edge';
```

Или используй Node.js runtime:
```typescript
export const runtime = 'nodejs';
```

---

### Проблема: Rate limit errors в production

**Симптомы:**
```
Error: 429 Too Many Requests
```

**Решения:**

1. **Gemini rate limits:**
   - Free tier: щедрые лимиты, но не unlimited
   - Upgrade план на Google AI Studio
   - Добавь rate limiting на клиенте

2. **Brave Search rate limits:**
   - Free tier: 1 req/sec, 2000/month
   - Добавь кэширование результатов
   - Upgrade план

---

## Оптимизация production

### Рекомендации

**1. Кэширование:**
```typescript
// Кэш для частых запросов
const cache = new Map();

function getCachedResponse(query) {
  if (cache.has(query)) {
    return cache.get(query);
  }
  // ... вызов API
  cache.set(query, response);
}
```

**2. Error handling:**
```typescript
try {
  const response = await streamText({...});
} catch (error) {
  console.error('Gemini API error:', error);
  // Fallback или повтор
}
```

**3. Мониторинг:**
- Настрой Vercel Analytics
- Отслеживай ошибки
- Проверяй usage API ключей

---

## Безопасность

### Checklist

- ✅ `.env.local` в `.gitignore`
- ✅ API ключи только в Vercel Environment Variables
- ✅ Никогда не хардкодить ключи в коде
- ✅ Использовать `NEXT_PUBLIC_` только для клиентских переменных
- ✅ Middleware защищает все routes кроме `/login`
- ✅ Паро ли пользователей хэшированы (bcrypt)

---

## Updating production

### Стандартный workflow

```bash
# 1. Внеси изменения локально
# 2. Протестируй
npm run dev

# 3. Commit
git add .
git commit -m "Описание изменений"

# 4. Push (автоматический деплой)
git push origin master

# 5. Проверь деплой в Vercel dashboard
# 6. Протестируй на production URL
```

### Rollback при ошибках

Если новая версия сломалась:

1. В Vercel → **Deployments**
2. Найди последний рабочий деплой
3. Три точки → **Promote to Production**

Мгновенный откат к рабочей версии.

---

## Полезные команды Vercel CLI

### Установка CLI

```bash
npm install -g vercel
```

### Основные команды

```bash
vercel           # Деплой из текущей папки
vercel --prod    # Деплой в production
vercel logs      # Просмотр логов
vercel env ls    # Список переменных окружения
vercel domains   # Управление доменами
```

---

## Стоимость

### Free tier (достаточно для проекта)

- ✅ 100GB bandwidth/месяц
- ✅ Unlimited deployments
- ✅ Automatic HTTPS
- ✅ Serverless Functions
- ✅ Edge Network

### Когда нужен Pro ($20/месяц)

- Больше 100GB bandwidth
- Больше команды (>3 человек)
- Advanced analytics
- Commercial projects

---

## Следующие шаги

После успешного деплоя:

1. ✅ Протестируй все функции
2. ✅ Создай пользователей (Владимир, Юлия)
3. ✅ Настрой мониторинг
4. ✅ Документируй изменения в CHANGELOG.md

---

## Полезные ссылки

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Vercel CLI Reference](https://vercel.com/docs/cli)
- [Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

---

## Связанные документы

- [setup.md](setup.md) - Локальная установка
- [architecture.md](architecture.md) - Архитектура проекта
- [troubleshooting.md](troubleshooting.md) - Решение проблем

---

**Обновлено:** 2026-04-30 (v3.101.0 — TZ_FilesAPIMigration: [vercel.json](../vercel.json) теперь 4 cron'а — `memory-deep-consolidate` (0 22 * * *), `memory-profile` (0 0 * * *), `briefing` (0 5 * * *), `reap-attachments` (0 3 * * *) для cleanup'а orphan xAI files. Production env требует `XAI_API_KEY`, `MOONSHOT_API_KEY`, `CRON_SECRET` — см. [docs/ai-providers.md](ai-providers.md) и [docs/setup.md](setup.md) для актуального списка).
