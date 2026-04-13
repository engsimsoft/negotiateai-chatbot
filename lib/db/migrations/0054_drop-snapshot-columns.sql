-- ТЗ-CreateSnapshotAudit (v3.87.3): drop dead snapshot columns from Chat table.
-- createSnapshot tool removed (2 all-time calls, 0 from project task expert).
-- See docs/decisions/052-context-management-strategy-per-provider.md

ALTER TABLE "Chat" DROP COLUMN IF EXISTS "snapshots";
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "contextState";
