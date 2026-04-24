/**
 * Diagnostic: xAI Library state — collections + documents (status + metadata) + orphan files.
 * Per-format validation: загружаете 1 файл в UI → запускаете скрипт → читаете статус.
 *
 * Запуск: npx tsx scripts/diagnose-xai-library-state.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import {
  getDocumentMetadata,
  listCollections,
} from "../lib/ai/library/xai-collections";

const MANAGEMENT_BASE = "https://management-api.x.ai/v1";
const API_BASE = "https://api.x.ai/v1";

async function mgmtGet(path: string) {
  const key = process.env.XAI_MANAGEMENT_API_KEY!;
  const r = await fetch(`${MANAGEMENT_BASE}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const text = await r.text();
  return { status: r.status, body: text };
}

async function apiGet(path: string) {
  const key = process.env.XAI_API_KEY!;
  const r = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const text = await r.text();
  return { status: r.status, body: text };
}

function parseFileIds(body: string): string[] {
  try {
    const j = JSON.parse(body) as {
      documents?: Array<{
        file_id?: string;
        file_metadata?: { file_id?: string };
      }>;
    };
    return (j.documents ?? [])
      .map((d) => d.file_metadata?.file_id ?? d.file_id)
      .filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

async function main() {
  console.log("=== xAI COLLECTIONS ===");
  const colls = await listCollections();
  for (const c of colls.collections ?? []) {
    console.log(
      `• ${c.collection_id}  "${c.collection_name}"  docs=${(c as any).documents_count ?? "?"}  size=${(c as any).total_file_size ?? "?"}`,
    );
  }

  const collIds = (colls.collections ?? []).map((c: any) => c.collection_id);

  for (const cid of collIds) {
    console.log(`\n=== DOCUMENTS IN ${cid} ===`);
    const r = await mgmtGet(`/collections/${cid}/documents`);
    console.log(`HTTP ${r.status}`);
    console.log(`  raw body: ${r.body}`);
    const fileIds = parseFileIds(r.body);
    if (fileIds.length === 0) {
      console.log("  (пусто)");
      continue;
    }
    for (const fid of fileIds) {
      console.log(`\n  --- DocumentMetadata [${fid}] ---`);
      try {
        const m = await getDocumentMetadata(cid, fid);
        console.log(
          `  status:            ${m.status ?? "?"}`,
        );
        console.log(
          `  error_message:     ${m.error_message ?? "(none)"}`,
        );
        console.log(
          `  last_indexed_at:   ${m.last_indexed_at ?? "(none)"}`,
        );
        if (m.file_metadata) {
          console.log(
            `  name:              ${m.file_metadata.name ?? "?"}`,
          );
          console.log(
            `  content_type:      ${m.file_metadata.content_type ?? "?"}`,
          );
          console.log(
            `  size_bytes:        ${m.file_metadata.size_bytes ?? "?"}`,
          );
          console.log(
            `  upload_status:     ${m.file_metadata.upload_status ?? "?"}`,
          );
          console.log(
            `  upload_error:      ${m.file_metadata.upload_error_message ?? "(none)"}`,
          );
          console.log(
            `  processing_status: ${m.file_metadata.processing_status ?? "?"}`,
          );
        }
        if (m.fields && Object.keys(m.fields).length > 0) {
          console.log(`  fields:            ${JSON.stringify(m.fields)}`);
        }
      } catch (err) {
        console.log(
          `  ✗ getDocumentMetadata failed: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  console.log("\n=== ALL XAI FILES (api.x.ai/v1/files) ===");
  const f = await apiGet("/files");
  console.log(`HTTP ${f.status}`);
  try {
    const j = JSON.parse(f.body) as { data?: Array<Record<string, unknown>> };
    const arr = j.data ?? [];
    if (arr.length === 0) console.log("  (пусто — orphan-файлов нет)");
    else for (const x of arr) console.log("  " + JSON.stringify(x));
  } catch {
    console.log(f.body);
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
