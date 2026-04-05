/**
 * ТЗ-COSTCTRL Phase 0 — Emergency data repair
 *
 * Disables deliveryEnabled=true for users without active TelegramConnection.
 * This stops the cron from wasting money on undeliverable briefings.
 *
 * Run once: npx tsx scripts/phase0-disable-invalid-delivery.ts
 */

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    console.error("❌ POSTGRES_URL not set in .env.local");
    process.exit(1);
  }

  const sql = postgres(url);

  try {
    // 1. Audit: find invalid state
    console.log("📋 Audit — users with deliveryEnabled=true:");
    const audit = await sql`
      SELECT bs."userId", u."email", bs."deliveryEnabled", bs."deliveryFormat",
        (tc."userId" IS NOT NULL AND tc."isActive") AS has_active_telegram
      FROM "BriefingSettings" bs
      JOIN "User" u ON u."id" = bs."userId"
      LEFT JOIN "TelegramConnection" tc ON tc."userId" = bs."userId"
      WHERE bs."deliveryEnabled" = true
      ORDER BY u."email"
    `;
    console.table(audit);

    const invalid = audit.filter((r) => !r.has_active_telegram);
    if (invalid.length === 0) {
      console.log("✅ No invalid state users. Nothing to repair.");
      return;
    }

    console.log(`\n⚠️  Found ${invalid.length} invalid state user(s). Repairing...`);

    // 2. Repair: disable delivery for users without active Telegram
    const result = await sql`
      UPDATE "BriefingSettings"
      SET "deliveryEnabled" = false, "updatedAt" = NOW()
      WHERE "deliveryEnabled" = true
        AND "userId" NOT IN (
          SELECT "userId" FROM "TelegramConnection" WHERE "isActive" = true
        )
      RETURNING "userId", "deliveryEnabled", "updatedAt"
    `;

    console.log(`\n✅ Updated ${result.length} row(s):`);
    console.table(result);

    // 3. Verify: re-run audit
    console.log("\n📋 Verification — users with deliveryEnabled=true after repair:");
    const after = await sql`
      SELECT bs."userId", u."email", bs."deliveryEnabled",
        (tc."userId" IS NOT NULL AND tc."isActive") AS has_active_telegram
      FROM "BriefingSettings" bs
      JOIN "User" u ON u."id" = bs."userId"
      LEFT JOIN "TelegramConnection" tc ON tc."userId" = bs."userId"
      WHERE bs."deliveryEnabled" = true
    `;

    if (after.length === 0) {
      console.log("✅ No remaining users with deliveryEnabled=true");
    } else {
      console.table(after);
      const stillInvalid = after.filter((r) => !r.has_active_telegram);
      if (stillInvalid.length > 0) {
        console.error("❌ Still have invalid state users!");
        process.exit(1);
      }
      console.log(`✅ All ${after.length} remaining users have active Telegram`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
