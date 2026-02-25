import { NextResponse } from "next/server";

export async function GET() {
  const checks: Record<string, string> = {};

  // Check env vars
  checks.POSTGRES_URL = process.env.POSTGRES_URL ? "set" : "MISSING";
  checks.AUTH_SECRET = process.env.AUTH_SECRET ? "set" : "MISSING";
  checks.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ? "set" : "MISSING";
  checks.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "MISSING";

  // Check DB connection
  try {
    const mod = await import("@/lib/db/queries");
    checks.db_import = "ok";
  } catch (e: unknown) {
    checks.db_import = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Try a simple DB query
  try {
    const { getUserById } = await import("@/lib/db/queries");
    await getUserById("00000000-0000-0000-0000-000000000000");
    checks.db_query = "ok";
  } catch (e: unknown) {
    checks.db_query = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json(checks);
}
