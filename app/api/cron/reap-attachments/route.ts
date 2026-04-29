import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

import {
  xaiListFiles,
  xaiDeleteFile,
} from "@/lib/ai/files/xai-files-client";
import { chatAttachment } from "@/lib/db/schema";

export const maxDuration = 240;

const ORPHAN_AGE_HOURS = 24;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sql = neon(process.env.POSTGRES_URL!);
  const db = drizzle(sql);

  let token: string | undefined;
  let totalScanned = 0;
  let totalReaped = 0;
  const reapErrors: string[] = [];

  do {
    const { data, nextToken } = await xaiListFiles({
      limit: 100,
      paginationToken: token,
    });
    totalScanned += data.length;

    for (const file of data) {
      const ageHours = (Date.now() - file.createdAt * 1000) / (1000 * 60 * 60);
      if (ageHours < ORPHAN_AGE_HOURS) continue;

      const exists = await db
        .select({ id: chatAttachment.id })
        .from(chatAttachment)
        .where(eq(chatAttachment.xaiFileId, file.id))
        .limit(1);

      if (exists.length === 0) {
        try {
          await xaiDeleteFile(file.id);
          totalReaped++;
        } catch (err) {
          reapErrors.push(
            `${file.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    token = nextToken;
  } while (token);

  return Response.json({
    totalScanned,
    totalReaped,
    errorCount: reapErrors.length,
    errors: reapErrors.slice(0, 20),
  });
}
