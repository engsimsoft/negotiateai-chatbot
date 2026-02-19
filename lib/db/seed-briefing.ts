// ТЗ-BR1: Seed briefing settings + sources for testing
//
// Usage: npm run db:seed-briefing
// Requires: .env.local with POSTGRES_URL

import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { briefingSettings, briefingSources } from "./schema";
import { getDefaultSources } from "../briefing/topics-catalog";
import { eq } from "drizzle-orm";

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL! });
const db = drizzle(pool);

// Target user for seeding (change as needed)
const TARGET_USER_ID = "bed95407-4160-492e-bdfd-9cf8819878be";

async function seed() {
  console.log(`[Seed] Seeding briefing data for user ${TARGET_USER_ID}...`);

  // 1. Upsert briefing settings
  const existingSettings = await db
    .select()
    .from(briefingSettings)
    .where(eq(briefingSettings.userId, TARGET_USER_ID));

  if (existingSettings.length > 0) {
    await db
      .update(briefingSettings)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(briefingSettings.userId, TARGET_USER_ID));
    console.log("[Seed] Updated existing briefing settings (isActive: true)");
  } else {
    const now = new Date();
    await db.insert(briefingSettings).values({
      userId: TARGET_USER_ID,
      isActive: true,
      timezone: "Europe/Moscow",
      generationTime: "06:00",
      language: "ru",
      maxItems: 15,
      createdAt: now,
      updatedAt: now,
    });
    console.log("[Seed] Created briefing settings");
  }

  // 2. Delete existing sources for clean seed
  const deleted = await db
    .delete(briefingSources)
    .where(eq(briefingSources.userId, TARGET_USER_ID))
    .returning();
  if (deleted.length > 0) {
    console.log(`[Seed] Cleaned up ${deleted.length} existing sources`);
  }

  // 3. Add default sources (2 per topic = ~20 sources)
  const defaults = getDefaultSources();

  for (const { topicId, source } of defaults) {
    await db.insert(briefingSources).values({
      userId: TARGET_USER_ID,
      topicId,
      sourceUrl: source.url,
      sourceName: source.name,
      sourceLanguage: source.language,
      tier: source.tier,
      rssUrl: source.rss ?? null,
      fetchMethod: source.fetchMethod,
      isActive: true,
      priority: 5,
      createdAt: new Date(),
    });
  }

  console.log(`[Seed] Added ${defaults.length} sources`);
  console.log("[Seed] Done!");

  await pool.end();
}

seed().catch((err) => {
  console.error("[Seed] Failed:", err);
  process.exit(1);
});
