import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

import {
  libraryCollection,
  libraryCollectionDocument,
  libraryDocument,
} from "../lib/db/schema";
import {
  attachFileToCollection,
  createCollection as xaiCreateCollection,
} from "../lib/ai/library/xai-collections";

const DEFAULT_NAME = "Мои документы";

async function main() {
  if (!process.env.POSTGRES_URL) throw new Error("POSTGRES_URL not set");

  const client = neon(process.env.POSTGRES_URL);
  const db = drizzle(client);

  const orphans = await db
    .select({
      id: libraryDocument.id,
      userId: libraryDocument.userId,
      xaiFileId: libraryDocument.xaiFileId,
      filename: libraryDocument.filename,
    })
    .from(libraryDocument)
    .leftJoin(
      libraryCollectionDocument,
      eq(libraryCollectionDocument.documentId, libraryDocument.id),
    )
    .where(isNull(libraryCollectionDocument.documentId));

  console.log(`Found ${orphans.length} orphan documents`);

  for (const doc of orphans) {
    try {
      let [defaultColl] = await db
        .select()
        .from(libraryCollection)
        .where(
          and(
            eq(libraryCollection.userId, doc.userId),
            eq(libraryCollection.isDefault, true),
          ),
        )
        .limit(1);

      if (!defaultColl) {
        const xai = await xaiCreateCollection(DEFAULT_NAME);
        [defaultColl] = await db
          .insert(libraryCollection)
          .values({
            userId: doc.userId,
            xaiCollectionId: xai.collection_id,
            name: DEFAULT_NAME,
            emoji: null,
            sortOrder: 0,
            isDefault: true,
          })
          .returning();
        console.log(`   + created default collection for user ${doc.userId}`);
      }

      await attachFileToCollection(defaultColl.xaiCollectionId, doc.xaiFileId);
      await db.insert(libraryCollectionDocument).values({
        collectionId: defaultColl.id,
        documentId: doc.id,
      });
      await db
        .update(libraryCollection)
        .set({
          documentCount: sql`${libraryCollection.documentCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(libraryCollection.id, defaultColl.id));

      console.log(`✅ ${doc.filename} → «${defaultColl.name}»`);
    } catch (err) {
      console.error(
        `❌ ${doc.filename}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
