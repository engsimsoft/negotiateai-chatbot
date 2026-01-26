import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { user } from "./schema";
import { generateHashedPassword } from "./utils";

async function main() {
  // biome-ignore lint: Forbidden non-null assertion.
  const client = postgres(process.env.POSTGRES_URL!);
  const db = drizzle(client);

  console.log("🌱 Seeding database...");

  // Hash passwords
  const vladimirPassword = generateHashedPassword("change-me-vladimir");
  const juliaPassword = generateHashedPassword("change-me-julia");

  try {
    // Insert users
    await db.insert(user).values([
      {
        email: "vladimir@family.local",
        password: vladimirPassword,
        role: "engineer",
      },
      {
        email: "julia@family.local",
        password: juliaPassword,
        role: "marketer",
      },
    ]);

    console.log("✅ Seed completed!");
    console.log("\n👥 Users created:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("1. vladimir@family.local");
    console.log("   Role: engineer");
    console.log("   Password: change-me-vladimir");
    console.log("");
    console.log("2. julia@family.local");
    console.log("   Role: marketer");
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
