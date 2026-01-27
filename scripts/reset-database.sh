#!/bin/bash
# ========================================
# ПОЛНЫЙ СБРОС БАЗЫ ДАННЫХ
# ========================================
# Этот скрипт:
# 1. Удаляет все таблицы из БД
# 2. Запускает миграции заново
# 3. Создает чистую БД
# ========================================

set -e  # Exit on error

echo "🗑️  Полный сброс базы данных..."
echo ""
echo "⚠️  ВНИМАНИЕ: Все данные будут удалены!"
echo "   - Пользователи"
echo "   - Чаты"
echo "   - Сообщения"
echo "   - Артефакты"
echo ""
read -p "Продолжить? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Отменено"
    exit 1
fi

echo ""
echo "1️⃣  Проверка подключения к БД..."

if [ -z "$DATABASE_URL" ]; then
    echo "❌ Ошибка: DATABASE_URL не установлен"
    echo "   Проверь .env.local файл"
    exit 1
fi

echo "✅ DATABASE_URL найден"
echo ""

echo "2️⃣  Удаление всех таблиц..."

# Выполняем SQL скрипт
psql "$DATABASE_URL" -f scripts/clean-database.sql

if [ $? -eq 0 ]; then
    echo "✅ Все таблицы удалены"
else
    echo "❌ Ошибка при удалении таблиц"
    exit 1
fi

echo ""
echo "3️⃣  Запуск миграций..."

npm run db:migrate

if [ $? -eq 0 ]; then
    echo "✅ Миграции применены"
else
    echo "❌ Ошибка при применении миграций"
    exit 1
fi

echo ""
echo "🎉 База данных полностью очищена и пересоздана!"
echo ""
echo "📊 Проверка структуры БД:"
echo "   npm run db:studio"
echo ""
