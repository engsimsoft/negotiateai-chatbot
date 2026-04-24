/**
 * ТЗ-XAI-COL-1 A2: end-to-end smoke test xAI Collections API.
 *
 * Временный скрипт для проверки wrapper'а `lib/ai/library/xai-collections.ts`.
 * Прогоняет: create collection → upload file → attach → search → cleanup.
 *
 * Запуск:  npx tsx scripts/test-library-e2e.ts
 *
 * НЕ КОММИТИМ в финализации ТЗ (по ROADMAP A2).
 */

import { config } from "dotenv";

config({ path: ".env.local" });

import {
  attachFileToCollection,
  createCollection,
  deleteCollection,
  deleteFile,
  listCollections,
  searchDocuments,
  uploadFile,
} from "../lib/ai/library/xai-collections";
import { parseCitation } from "../lib/ai/library/citations-parser";

const TEST_TEXT = `Simply Library E2E test document.

This is a test document for xAI Collections API integration.

Key facts for search verification:
- Project name: Simply
- Current date: 2026-04-21
- Migration task: TZ-XAI-COL-1
- Test marker: SIMPLY_LIBRARY_E2E_MARKER_4242

The quick brown fox jumps over the lazy dog.
`;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("— xAI Collections E2E —");

  const before = await listCollections().catch((err) => {
    console.error("✗ listCollections failed:", err.message);
    throw err;
  });
  console.log(
    `✓ listCollections OK (existing: ${before.collections?.length ?? 0})`,
  );

  console.log("\n→ createCollection …");
  const created = await createCollection(
    `simply-e2e-${Date.now()}`,
  );
  const collectionId = created.collection_id;
  console.log(`✓ created ${collectionId}`);

  console.log("\n→ uploadFile (TXT) …");
  const buffer = Buffer.from(TEST_TEXT, "utf-8");
  const file = await uploadFile({
    buffer,
    filename: "simply-e2e-test.txt",
    mimeType: "text/plain",
  });
  const fileId = file.id;
  console.log(`✓ uploaded ${fileId}`);

  console.log("\n→ attachFileToCollection …");
  await attachFileToCollection(collectionId, fileId);
  console.log(`✓ attached`);

  console.log("\n→ waiting 10s for indexing …");
  await sleep(10_000);

  console.log("\n→ searchDocuments …");
  const searchResult = await searchDocuments({
    query: "SIMPLY_LIBRARY_E2E_MARKER_4242",
    collectionIds: [collectionId],
    maxNumResults: 5,
  });

  console.log(`  chunks returned: ${searchResult.chunks.length}`);
  if (searchResult.chunks.length > 0) {
    const first = searchResult.chunks[0];
    console.log(
      `  first chunk content (first 120 chars): ${first.content.slice(0, 120)}`,
    );
    console.log(`  score: ${first.score}`);
    console.log(`  citation: ${first.citation}`);
    const parsed = parseCitation(first.citation);
    console.log(`  parsed citation: ${JSON.stringify(parsed)}`);
  }
  console.log(`\n  normalized result:\n${JSON.stringify(searchResult, null, 2)}`);

  console.log("\n— cleanup —");
  await deleteFile(fileId).catch((err) =>
    console.warn("  deleteFile warn:", err.message),
  );
  await deleteCollection(collectionId).catch((err) =>
    console.warn("  deleteCollection warn:", err.message),
  );
  console.log("✓ cleanup done");

  console.log("\n✓ E2E PASSED");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n✗ E2E FAILED");
  console.error(err);
  process.exit(1);
});
