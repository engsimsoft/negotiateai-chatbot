-- Drop helperId FK constraint and column from Chat
ALTER TABLE "Chat" DROP CONSTRAINT IF EXISTS "Chat_helperId_Helper_id_fk";
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "helperId";

-- Drop Helper table
DROP TABLE IF EXISTS "Helper";
