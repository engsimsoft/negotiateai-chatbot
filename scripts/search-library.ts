/**
 * Library search test. Прогоняет xAI search по фразе — выводит chunks, score, page.
 *
 * Запуск: npx tsx scripts/search-library.ts "фраза из файла"
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import {
  listCollections,
  searchDocuments,
} from "../lib/ai/library/xai-collections";

async function main() {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query) {
    console.error("Usage: npx tsx scripts/search-library.ts <query>");
    process.exit(1);
  }

  const colls = await listCollections();
  const collectionIds = (colls.collections ?? []).map((c) => c.collection_id);
  console.log(`Search "${query}" over ${collectionIds.length} collections`);

  for (const mode of ["hybrid", "keyword", "semantic"] as const) {
    console.log(`\n--- mode: ${mode} ---`);
    const r = await searchDocuments({
      query,
      collectionIds,
      retrievalMode: mode,
      maxNumResults: 5,
    });
    if (r.chunks.length === 0) {
      console.log("  (no chunks)");
      continue;
    }
    r.chunks.forEach((c, i) => {
      console.log(
        `  [${i}] score=${c.score.toFixed(3)} file=${c.fileId.slice(0, 14)}… page=${c.pageNumber ?? "-"}`,
      );
      const preview = c.content.slice(0, 300).replace(/\n/g, " ");
      console.log(`      ${preview}…`);
    });
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
