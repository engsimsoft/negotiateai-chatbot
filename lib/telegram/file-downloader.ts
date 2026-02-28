import { put } from "@vercel/blob";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB — Telegram Bot API limit
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

interface TelegramFileResponse {
  ok: boolean;
  result?: { file_id: string; file_size?: number; file_path?: string };
}

export interface FileDownloadResult {
  blobUrl: string;
  fileName: string;
  fileSize: number;
}

/**
 * Download a file from Telegram Bot API and upload to Vercel Blob.
 * Returns null if the file is too large or download fails.
 */
export async function downloadAndUploadTelegramFile(
  fileId: string,
  groupId: string,
  options?: { fileName?: string; mimeType?: string },
): Promise<FileDownloadResult | null> {
  // 1. Get file info from Telegram
  const infoRes = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
  if (!infoRes.ok) return null;

  const info = (await infoRes.json()) as TelegramFileResponse;
  if (!info.ok || !info.result?.file_path) return null;

  const filePath = info.result.file_path;
  const fileSize = info.result.file_size ?? 0;

  // 2. Skip files exceeding Telegram Bot API limit
  if (fileSize > MAX_FILE_SIZE) {
    console.warn(`[file-downloader] File too large (${fileSize} bytes), skipping`);
    return null;
  }

  // 3. Download file binary
  const fileRes = await fetch(
    `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`,
  );
  if (!fileRes.ok) return null;

  const buffer = Buffer.from(await fileRes.arrayBuffer());

  // 4. Determine file name
  const fileName =
    options?.fileName ||
    filePath.split("/").pop() ||
    `file-${Date.now()}`;

  // 5. Upload to Vercel Blob
  const blobPath = `telegram-files/${groupId}/${Date.now()}-${fileName}`;
  const contentType = options?.mimeType || guessContentType(fileName);

  const blob = await put(blobPath, buffer, {
    access: "public",
    contentType,
  });

  return {
    blobUrl: blob.url,
    fileName,
    fileSize: buffer.length,
  };
}

function guessContentType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    mp4: "video/mp4",
    ogg: "audio/ogg",
    mp3: "audio/mpeg",
    txt: "text/plain",
    csv: "text/csv",
    zip: "application/zip",
  };
  return map[ext ?? ""] || "application/octet-stream";
}
