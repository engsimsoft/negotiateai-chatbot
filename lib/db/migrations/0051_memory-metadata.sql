-- ТЗ-SaveFactV2: Add metadata JSONB column to memory_entry
ALTER TABLE memory_entry ADD COLUMN metadata JSONB DEFAULT NULL;
