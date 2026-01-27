-- ========================================
-- ПОЛНАЯ ОЧИСТКА БАЗЫ ДАННЫХ
-- ========================================
-- Этот скрипт удаляет ВСЕ таблицы из БД
-- Используй с осторожностью!
-- После выполнения нужно запустить: npm run db:migrate
-- ========================================

-- Удаляем все таблицы в правильном порядке (учитывая foreign keys)

-- 1. Dependent tables (с foreign keys)
DROP TABLE IF EXISTS "Stream" CASCADE;
DROP TABLE IF EXISTS "Suggestion" CASCADE;
DROP TABLE IF EXISTS "Vote_v2" CASCADE;
DROP TABLE IF EXISTS "Message_v2" CASCADE;
DROP TABLE IF EXISTS "Document" CASCADE;
DROP TABLE IF EXISTS "Chat" CASCADE;

-- 2. Deprecated tables (старые)
DROP TABLE IF EXISTS "Vote" CASCADE;
DROP TABLE IF EXISTS "Message" CASCADE;

-- 3. User table (последняя, т.к. на неё ссылаются другие)
DROP TABLE IF EXISTS "User" CASCADE;

-- 4. Drizzle migrations table (опционально - если хочешь переинициализировать миграции)
-- DROP TABLE IF EXISTS "__drizzle_migrations" CASCADE;

-- Проверка: должно вернуть 0 таблиц
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name NOT LIKE '__drizzle%';
