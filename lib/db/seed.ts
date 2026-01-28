import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { user } from "./schema";
import { generateHashedPassword } from "./utils";

config({
  path: ".env.local",
});

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL is not defined");
  }

  const client = postgres(process.env.POSTGRES_URL);
  const db = drizzle(client);

  console.log("🌱 Seeding database...");

  // Hash passwords
  const vladimirPassword = generateHashedPassword("change-me-vladimir");
  const juliaPassword = generateHashedPassword("change-me-julia");

  try {
    // Insert users (role field removed in ТЗ-1)
    await db.insert(user).values([
      {
        email: "vladimir@simply.local",
        password: vladimirPassword,
      },
      {
        email: "julia@simply.local",
        password: juliaPassword,
      },
    ]);

    console.log("✅ Seed completed!");
    console.log("\n👥 Users created:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("1. vladimir@simply.local");
    console.log("   Password: change-me-vladimir");
    console.log("");
    console.log("2. julia@simply.local");
    console.log("   Password: change-me-julia");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n⚠️  IMPORTANT: Change passwords after first login!");
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }

  await client.end();
  process.exit(0);
}

main();
