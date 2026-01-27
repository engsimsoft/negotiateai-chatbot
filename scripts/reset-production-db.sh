#!/bin/bash
# ========================================
# ПОЛНЫЙ СБРОС PRODUCTION БД (Vercel)
# ========================================
# Этот скрипт:
# 1. Подтягивает env переменные с Vercel
# 2. Удаляет все таблицы из production БД
# 3. Запускает миграции заново
# ========================================

set -e  # Exit on error

echo "🚀 Сброс PRODUCTION базы данных через Vercel CLI"
echo ""
echo "⚠️  ВНИМАНИЕ: Это удалит ВСЕ данные из production БД!"
echo "   - Пользователи"
echo "   - Чаты"
echo "   - Сообщения"
echo "   - Артефакты"
echo ""

# Проверка Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "❌ Ошибка: Vercel CLI не установлен"
    echo "   Установи: npm i -g vercel"
    exit 1
fi

echo "✅ Vercel CLI найден"
echo ""

# Проверка что залогинен
if ! vercel whoami &> /dev/null; then
    echo "❌ Ошибка: Не залогинен в Vercel"
    echo "   Запусти: vercel login"
    exit 1
fi

VERCEL_USER=$(vercel whoami)
echo "✅ Залогинен как: $VERCEL_USER"
echo ""

read -p "Продолжить очистку PRODUCTION БД? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Отменено"
    exit 1
fi

echo ""
echo "1️⃣  Подтягивание production env..."

# Подтянуть production env во временный файл
vercel env pull .env.production.tmp --yes

if [ $? -ne 0 ]; then
    echo "❌ Ошибка при получении env переменных"
    exit 1
fi

echo "✅ Production env получен"
echo ""

# Загрузить переменные в текущую сессию
export $(cat .env.production.tmp | grep DATABASE_URL | xargs)

if [ -z "$DATABASE_URL" ]; then
    echo "❌ Ошибка: DATABASE_URL не найден в production env"
    rm .env.production.tmp
    exit 1
fi

echo "✅ DATABASE_URL найден"
echo ""

echo "2️⃣  Удаление всех таблиц из production БД..."

# Выполняем SQL скрипт
psql "$DATABASE_URL" -f scripts/clean-database.sql

if [ $? -eq 0 ]; then
    echo "✅ Все таблицы удалены"
else
    echo "❌ Ошибка при удалении таблиц"
    rm .env.production.tmp
    exit 1
fi

echo ""
echo "3️⃣  Запуск миграций на production БД..."

npm run db:migrate

if [ $? -eq 0 ]; then
    echo "✅ Миграции применены"
else
    echo "❌ Ошибка при применении миграций"
    rm .env.production.tmp
    exit 1
fi

# Очистка временного файла
rm .env.production.tmp

echo ""
echo "🎉 Production БД полностью очищена и пересоздана!"
echo ""
echo "📊 Следующие шаги:"
echo "   1. Проверь БД: source .env.production && npm run db:studio"
echo "   2. Открой приложение: https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app"
echo "   3. Зарегистрируй новых пользователей"
echo "   4. Протестируй агентов"
echo ""
