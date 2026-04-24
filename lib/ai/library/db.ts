/**
 * ТЗ-XAI-COL-1: DB-queries для Library (collections + documents).
 *
 * Pattern: lib/ai/memory/memory-queries.ts — локальный db-client через Neon HTTP.
 * Все queries filter'ят по userId — строгая изоляция.
 */

import "server-only";

import { neon } from "@neondatabase/serverless";
import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import {
  libraryCollection,
  libraryCollectionDocument,
  libraryDocument,
} from "@/lib/db/schema";
import type { LibraryCollection, LibraryDocument } from "@/lib/db/schema";
import {
  createCollection as xaiCreateCollection,
  deleteCollection as xaiDeleteCollection,
} from "./xai-collections";

export const DEFAULT_COLLECTION_NAME = "Мои документы";

// biome-ignore lint: Forbidden non-null assertion.
const sql_client = neon(process.env.POSTGRES_URL!);
const db = drizzle(sql_client);

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export async function createLibraryCollection(params: {
  userId: string;
  xaiCollectionId: string;
  name: string;
  emoji?: string | null;
}): Promise<LibraryCollection> {
  const [row] = await db
    .insert(libraryCollection)
    .values({
      userId: params.userId,
      xaiCollectionId: params.xaiCollectionId,
      name: params.name,
      emoji: params.emoji ?? null,
      sortOrder: sql`
        COALESCE(
          (SELECT MAX("sortOrder") + 1
             FROM "library_collection"
            WHERE "userId" = ${params.userId}),
          0
        )
      `,
    })
    .returning();
  return row;
}

export async function listLibraryCollectionsByUser(
  userId: string,
): Promise<LibraryCollection[]> {
  return db
    .select()
    .from(libraryCollection)
    .where(eq(libraryCollection.userId, userId))
    .orderBy(libraryCollection.sortOrder, desc(libraryCollection.createdAt));
}

export interface LibraryCollectionSummary {
  id: string;
  name: string;
  isDefault: boolean;
  documentsCount: number;
}

export async function listLibraryCollectionsSummaryByUser(
  userId: string,
): Promise<LibraryCollectionSummary[]> {
  const rows = await db
    .select({
      id: libraryCollection.id,
      name: libraryCollection.name,
      isDefault: libraryCollection.isDefault,
      documentsCount: sql<number>`COUNT(${libraryCollectionDocument.documentId})::int`,
    })
    .from(libraryCollection)
    .leftJoin(
      libraryCollectionDocument,
      eq(libraryCollectionDocument.collectionId, libraryCollection.id),
    )
    .where(eq(libraryCollection.userId, userId))
    .groupBy(libraryCollection.id)
    .orderBy(libraryCollection.sortOrder, desc(libraryCollection.createdAt));
  return rows;
}

export async function getDefaultCollectionForUser(
  userId: string,
): Promise<LibraryCollection | null> {
  const [row] = await db
    .select()
    .from(libraryCollection)
    .where(
      and(
        eq(libraryCollection.userId, userId),
        eq(libraryCollection.isDefault, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function ensureDefaultCollectionForUser(
  userId: string,
): Promise<LibraryCollection> {
  const existing = await getDefaultCollectionForUser(userId);
  if (existing) return existing;

  let xaiCollectionId: string | null = null;
  try {
    const xai = await xaiCreateCollection(DEFAULT_COLLECTION_NAME);
    xaiCollectionId = xai.collection_id;

    const [row] = await db
      .insert(libraryCollection)
      .values({
        userId,
        xaiCollectionId,
        name: DEFAULT_COLLECTION_NAME,
        emoji: null,
        sortOrder: 0,
        isDefault: true,
      })
      .returning();
    return row;
  } catch (err) {
    if (xaiCollectionId) {
      await xaiDeleteCollection(xaiCollectionId).catch(() => {});
    }
    throw err;
  }
}

export async function getLibraryCollectionById(
  id: string,
): Promise<LibraryCollection | null> {
  const [row] = await db
    .select()
    .from(libraryCollection)
    .where(eq(libraryCollection.id, id))
    .limit(1);
  return row ?? null;
}

export async function updateLibraryCollection(params: {
  id: string;
  name?: string;
  emoji?: string | null;
}): Promise<LibraryCollection> {
  const patch: Partial<LibraryCollection> = { updatedAt: new Date() };
  if (params.name !== undefined) patch.name = params.name;
  if (params.emoji !== undefined) patch.emoji = params.emoji;

  const [row] = await db
    .update(libraryCollection)
    .set(patch)
    .where(eq(libraryCollection.id, params.id))
    .returning();
  return row;
}

export async function deleteLibraryCollectionById(id: string): Promise<void> {
  await db
    .delete(libraryCollection)
    .where(eq(libraryCollection.id, id));
}

export async function reorderLibraryCollections(params: {
  userId: string;
  order: Array<{ id: string; sortOrder: number }>;
}): Promise<void> {
  if (params.order.length === 0) return;

  const ids = params.order.map((o) => o.id);
  const owned = await db
    .select({ id: libraryCollection.id })
    .from(libraryCollection)
    .where(
      and(
        eq(libraryCollection.userId, params.userId),
        inArray(libraryCollection.id, ids),
      ),
    );
  const ownedIds = new Set(owned.map((o) => o.id));

  for (const entry of params.order) {
    if (!ownedIds.has(entry.id)) continue;
    await db
      .update(libraryCollection)
      .set({ sortOrder: entry.sortOrder, updatedAt: new Date() })
      .where(eq(libraryCollection.id, entry.id));
  }
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export async function createLibraryDocument(params: {
  userId: string;
  xaiFileId: string;
  filename: string;
  mimeType: string;
  size: number;
  status?: "uploading" | "processing" | "ready" | "error";
  autoType?: string | null;
  autoTags?: string[] | null;
  autoDescription?: string | null;
  originalFileUrl?: string | null;
}): Promise<LibraryDocument> {
  const [row] = await db
    .insert(libraryDocument)
    .values({
      userId: params.userId,
      xaiFileId: params.xaiFileId,
      filename: params.filename,
      mimeType: params.mimeType,
      size: params.size,
      status: params.status ?? "processing",
      autoType: params.autoType ?? null,
      autoTags: params.autoTags ?? null,
      autoDescription: params.autoDescription ?? null,
      originalFileUrl: params.originalFileUrl ?? null,
    })
    .returning();
  return row;
}

export async function getLibraryDocumentById(
  id: string,
): Promise<LibraryDocument | null> {
  const [row] = await db
    .select()
    .from(libraryDocument)
    .where(eq(libraryDocument.id, id))
    .limit(1);
  return row ?? null;
}

export async function updateLibraryDocumentPatch(
  id: string,
  patch: Partial<{
    filename: string;
    status: "uploading" | "processing" | "ready" | "error";
    statusError: string | null;
    xaiFileId: string;
    autoType: string | null;
    autoTags: string[] | null;
    autoDescription: string | null;
    autoSummary: string | null;
    originalFileUrl: string | null;
  }>,
): Promise<LibraryDocument> {
  const [row] = await db
    .update(libraryDocument)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(libraryDocument.id, id))
    .returning();
  return row;
}

export async function deleteLibraryDocumentById(id: string): Promise<void> {
  // Cascade на library_collection_document настроен в миграции 0061.
  // Счётчики documentCount коллекций чиним в detach-функции ПЕРЕД DELETE в роуте.
  await db.delete(libraryDocument).where(eq(libraryDocument.id, id));
}

export interface ListDocumentsFilters {
  collectionId?: string;
  autoType?: string;
  tag?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listLibraryDocumentsByUser(
  userId: string,
  filters: ListDocumentsFilters = {},
): Promise<{ rows: LibraryDocument[]; total: number }> {
  const limit = Math.min(filters.limit ?? 50, 200);
  const offset = filters.offset ?? 0;

  const conditions = [eq(libraryDocument.userId, userId)];
  if (filters.autoType) {
    conditions.push(eq(libraryDocument.autoType, filters.autoType));
  }
  if (filters.tag) {
    conditions.push(
      sql`${libraryDocument.autoTags} @> ${JSON.stringify([filters.tag])}::jsonb`,
    );
  }
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    const filenameClause = ilike(libraryDocument.filename, pattern);
    const descriptionClause = ilike(libraryDocument.autoDescription, pattern);
    const combined = or(filenameClause, descriptionClause);
    if (combined) conditions.push(combined);
  }

  const where = and(...conditions);

  let rows: LibraryDocument[];
  let totalRows: Array<{ count: number }>;

  if (filters.collectionId) {
    rows = await db
      .select()
      .from(libraryDocument)
      .innerJoin(
        libraryCollectionDocument,
        eq(libraryCollectionDocument.documentId, libraryDocument.id),
      )
      .where(
        and(
          where,
          eq(libraryCollectionDocument.collectionId, filters.collectionId),
        ),
      )
      .orderBy(desc(libraryDocument.createdAt))
      .limit(limit)
      .offset(offset)
      .then((records) => records.map((r) => r.library_document));

    totalRows = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(libraryDocument)
      .innerJoin(
        libraryCollectionDocument,
        eq(libraryCollectionDocument.documentId, libraryDocument.id),
      )
      .where(
        and(
          where,
          eq(libraryCollectionDocument.collectionId, filters.collectionId),
        ),
      );
  } else {
    rows = await db
      .select()
      .from(libraryDocument)
      .where(where)
      .orderBy(desc(libraryDocument.createdAt))
      .limit(limit)
      .offset(offset);

    totalRows = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(libraryDocument)
      .where(where);
  }

  return { rows, total: totalRows[0]?.count ?? 0 };
}

// ---------------------------------------------------------------------------
// Document ↔ Collection M:N
// ---------------------------------------------------------------------------

export async function getDocumentCollectionIds(
  documentId: string,
): Promise<string[]> {
  const rows = await db
    .select({ collectionId: libraryCollectionDocument.collectionId })
    .from(libraryCollectionDocument)
    .where(eq(libraryCollectionDocument.documentId, documentId));
  return rows.map((r) => r.collectionId);
}

export async function attachDocumentToCollection(
  documentId: string,
  collectionId: string,
): Promise<void> {
  await db
    .insert(libraryCollectionDocument)
    .values({ documentId, collectionId })
    .onConflictDoNothing();

  await db
    .update(libraryCollection)
    .set({
      documentCount: sql`${libraryCollection.documentCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(libraryCollection.id, collectionId));
}

export async function detachDocumentFromCollection(
  documentId: string,
  collectionId: string,
): Promise<void> {
  const deleted = await db
    .delete(libraryCollectionDocument)
    .where(
      and(
        eq(libraryCollectionDocument.documentId, documentId),
        eq(libraryCollectionDocument.collectionId, collectionId),
      ),
    )
    .returning({ documentId: libraryCollectionDocument.documentId });

  if (deleted.length > 0) {
    await db
      .update(libraryCollection)
      .set({
        documentCount: sql`GREATEST(${libraryCollection.documentCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(libraryCollection.id, collectionId));
  }
}

export async function listCollectionsOwnedByUser(
  userId: string,
  collectionIds: string[],
): Promise<LibraryCollection[]> {
  if (collectionIds.length === 0) return [];
  return db
    .select()
    .from(libraryCollection)
    .where(
      and(
        eq(libraryCollection.userId, userId),
        inArray(libraryCollection.id, collectionIds),
      ),
    );
}

export async function listDocumentsOwnedByUser(
  userId: string,
  documentIds: string[],
): Promise<LibraryDocument[]> {
  if (documentIds.length === 0) return [];
  return db
    .select()
    .from(libraryDocument)
    .where(
      and(
        eq(libraryDocument.userId, userId),
        inArray(libraryDocument.id, documentIds),
      ),
    );
}

export async function listDocumentsByXaiFileIds(
  userId: string,
  xaiFileIds: string[],
): Promise<LibraryDocument[]> {
  if (xaiFileIds.length === 0) return [];
  return db
    .select()
    .from(libraryDocument)
    .where(
      and(
        eq(libraryDocument.userId, userId),
        inArray(libraryDocument.xaiFileId, xaiFileIds),
      ),
    );
}
