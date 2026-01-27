# Database Scripts

Скрипты для управления базой данных.

---

## 🗑️ Полная очистка БД

### Вариант 1: Через Vercel CLI (рекомендуется для production) ✨

**Самый безопасный способ для production БД!**

```bash
# 1. Установи Vercel CLI (если еще нет)
npm i -g vercel

# 2. Логин в Vercel
vercel login

# 3. Подтяни env переменные с production
vercel env pull .env.production

# 4. Запусти очистку с production env
source .env.production && npm run db:reset

# Или только SQL скрипт:
source .env.production && npm run db:clean
```

**Что делает:**
1. Получает актуальный `DATABASE_URL` с Vercel
2. Удаляет все таблицы из production БД
3. Запускает миграции заново
4. Создает чистую БД

**⚠️ ВНИМАНИЕ:** Все данные будут удалены!

---

### Вариант 2: Локальный БД (для разработки)

```bash
npm run db:reset
```

**Что делает:**
1. Использует `DATABASE_URL` из `.env.local`
2. Удаляет все таблицы из БД
3. Запускает миграции заново
4. Создает чистую БД

**Используй для:** Development/staging БД

---

### Вариант 3: Только удаление таблиц

```bash
npm run db:clean
```

**Что делает:**
- Удаляет все таблицы
- НЕ запускает миграции (нужно вручную: `npm run db:migrate`)

---

### Вариант 4: Вручную через Drizzle Studio

```bash
npm run db:studio
```

1. Откроется UI в браузере
2. Удали таблицы через интерфейс
3. Запусти миграции: `npm run db:migrate`

---

## 📋 Скрипты в проекте

### `clean-database.sql`
SQL скрипт для удаления всех таблиц в правильном порядке.

**Таблицы удаляются:**
- `Stream` - активные стримы
- `Suggestion` - предложения для артефактов
- `Vote_v2` - голоса за сообщения
- `Message_v2` - сообщения
- `Document` - артефакты
- `Chat` - чаты
- `User` - пользователи
- **Deprecated:** `Vote`, `Message` (старые таблицы)

### `reset-database.sh`
Bash скрипт для полного сброса БД с подтверждением.

**Требования:**
- PostgreSQL client (`psql`) установлен
- `DATABASE_URL` в `.env.local`

---

## 🆘 Troubleshooting

### Ошибка: `psql: command not found`

**macOS:**
```bash
brew install postgresql
```

**Ubuntu/Debian:**
```bash
sudo apt-get install postgresql-client
```

### Ошибка: `DATABASE_URL не установлен`

Проверь что в `.env.local` есть:
```
DATABASE_URL=postgresql://...
```

### Ошибка при удалении таблиц

1. Проверь подключение:
```bash
psql "$DATABASE_URL" -c "SELECT version();"
```

2. Проверь список таблиц:
```bash
psql "$DATABASE_URL" -c "\dt"
```

---

## 📝 После очистки БД

1. **Запусти миграции:**
   ```bash
   npm run db:migrate
   ```

2. **Проверь структуру:**
   ```bash
   npm run db:studio
   ```

3. **(Опционально) Seed данные:**
   ```bash
   npm run db:seed
   ```

---

## 🔐 Production БД (Vercel)

### Рекомендуемый workflow для production:

#### 1. Подготовка
```bash
# Установи Vercel CLI
npm i -g vercel

# Логин
vercel login

# Линк проекта (если еще не сделано)
vercel link
```

#### 2. Получение env переменных
```bash
# Подтянуть production env
vercel env pull .env.production

# Проверить DATABASE_URL
cat .env.production | grep DATABASE_URL
```

#### 3. Очистка production БД
```bash
# Полный сброс (с миграциями)
source .env.production && npm run db:reset

# Или только очистка
source .env.production && npm run db:clean
source .env.production && npm run db:migrate
```

#### 4. Проверка
```bash
# Открыть Drizzle Studio для production БД
source .env.production && npm run db:studio
```

---

### Альтернатива: Через Neon Dashboard

Если не хочешь использовать CLI:

1. Зайди на https://console.neon.tech
2. Выбери проект
3. SQL Editor → вставь SQL из `scripts/clean-database.sql`
4. Запусти локально: `source .env.production && npm run db:migrate`

---

## 🛡️ Безопасность

**Перед очисткой production:**
- ✅ Убедись что это действительно нужно
- ✅ Сделай backup (Neon делает автоматически, но проверь)
- ✅ Предупреди пользователей (если они есть)
- ✅ Протестируй на staging окружении

**После очистки:**
- ✅ Запусти миграции
- ✅ Проверь через Drizzle Studio
- ✅ Протестируй регистрацию нового пользователя
- ✅ Протестируй создание чата

---

## 📚 Полезные команды Vercel CLI

```bash
# Посмотреть все env переменные
vercel env ls

# Подтянуть env для разных окружений
vercel env pull .env.production    # Production
vercel env pull .env.preview       # Preview
vercel env pull .env.development   # Development

# Добавить новую env переменную
vercel env add

# Просмотр логов production
vercel logs --follow

# Deploy на production
vercel --prod
```

---

**Документация обновлена:** 2026-01-27
