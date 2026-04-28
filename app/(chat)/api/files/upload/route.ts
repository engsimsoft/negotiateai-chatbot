import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import { xaiUploadFile } from "@/lib/ai/files/xai-files-client";

// Use Blob instead of File since File is not available in Node.js environment
const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= 20 * 1024 * 1024, {
      message: "File size should be less than 20MB",
    })
    .refine(
      (file) =>
        [
          "image/jpeg",
          "image/png",
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // DOCX
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // XLSX
          "application/vnd.ms-excel", // XLS
          "application/vnd.ms-excel.sheet.macroEnabled.12", // XLSM
          "text/plain",
          "text/csv", // CSV
          "text/markdown",
          "text/x-markdown", // Alternative MD MIME type
          "application/octet-stream", // Generic binary (browsers may use this for .md or .xlsx)
        ].includes(file.type),
      {
        message:
          "File type should be JPEG, PNG, PDF, DOCX, XLSX, XLS, XLSM, CSV, TXT, or MD",
      }
    ),
});

// Dynamic import for mammoth (DOCX parser)
const getMammoth = async () => {
  const mammoth = await import("mammoth");
  return mammoth.default || mammoth;
};

// Dynamic import for xlsx (Excel parser)
const getXLSX = async () => {
  const xlsx = await import("xlsx");
  return xlsx;
};

/**
 * Upload в xAI Files API. Best-effort — на ошибке возвращаем null, в БД
 * запишем chat_attachment без xaiFileId (только Blob backup). Пользователь
 * увидит файл в чате как обычно, но в этой сессии без agentic поиска по нему.
 */
async function uploadToXai(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<string | null> {
  try {
    const file = await xaiUploadFile({
      buffer,
      filename,
      mimeType,
      purpose: "assistants",
    });
    return file.id;
  } catch (err) {
    console.warn(
      `[Upload API] xAI Files upload failed for ${filename}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (request.body === null) {
    return new Response("Request body is empty", { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const validatedFile = FileSchema.safeParse({ file });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.errors
        .map((error) => error.message)
        .join(", ");

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // Get filename from formData since Blob doesn't have name property
    const originalFilename = (formData.get("file") as File).name;
    const fileBuffer = await file.arrayBuffer();
    const fileType = file.type;

    // Get file extension for better type detection
    const fileExt = originalFilename.toLowerCase().match(/\.(docx|txt|md|csv|xlsx|xls|xlsm|pdf)$/)?.[1];

    try {
      // Check if it's an Excel file
      const isExcelFile =
        fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        fileType === "application/vnd.ms-excel" ||
        fileType === "application/vnd.ms-excel.sheet.macroEnabled.12" ||
        fileExt === "xlsx" ||
        fileExt === "xls" ||
        fileExt === "xlsm";

      // Process document files (DOCX, TXT, MD) and extract text
      // These will be uploaded as text/plain to work with Claude multimodal API
      const isDocumentFile =
        fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        fileType === "text/plain" ||
        fileType === "text/csv" ||
        fileType === "text/markdown" ||
        fileType === "text/x-markdown" ||
        (fileType === "application/octet-stream" && (fileExt === "md" || fileExt === "txt")) ||
        fileExt === "docx" ||
        fileExt === "csv" ||
        fileExt === "txt" ||
        fileExt === "md";

      // Process Excel files (XLSX, XLS) — extract as CSV text, upload to Blob + xAI Files API.
      if (isExcelFile) {
        const xlsx = await getXLSX();
        const workbook = xlsx.read(Buffer.from(fileBuffer), { type: "buffer" });

        let extractedText = "";
        workbook.SheetNames.forEach((sheetName, index) => {
          const worksheet = workbook.Sheets[sheetName];
          const csv = xlsx.utils.sheet_to_csv(worksheet);
          if (index > 0) extractedText += "\n\n";
          extractedText += `=== Лист: ${sheetName} ===\n${csv}`;
        });

        const textFilename = originalFilename.replace(/\.(xlsx|xls|xlsm)$/i, ".txt");
        const textBuffer = Buffer.from(extractedText, "utf-8");

        const data = await put(textFilename, textBuffer, {
          access: "public",
          contentType: "text/plain",
        });
        const xaiFileId = await uploadToXai(textBuffer, textFilename, "text/plain");

        return NextResponse.json({
          ...data,
          originalFilename,
          originalContentType: fileType,
          processed: true,
          fileType: "excel",
          xaiFileId,
        });
      }

      // DOCX/CSV/TXT/MD — extract text, upload to Blob + xAI Files API.
      if (isDocumentFile) {
        let extractedText: string;

        if (fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || fileExt === "docx") {
          const mammoth = await getMammoth();
          const result = await mammoth.extractRawText({ buffer: Buffer.from(fileBuffer) });
          extractedText = result.value;
        } else {
          const decoder = new TextDecoder("utf-8");
          extractedText = decoder.decode(fileBuffer);
        }

        const textFilename = originalFilename.replace(/\.(docx|csv|txt|md)$/i, ".txt");
        const textBuffer = Buffer.from(extractedText, "utf-8");

        const data = await put(textFilename, textBuffer, {
          access: "public",
          contentType: "text/plain",
        });
        const xaiFileId = await uploadToXai(textBuffer, textFilename, "text/plain");

        return NextResponse.json({
          ...data,
          originalFilename,
          originalContentType: fileType,
          processed: true,
          xaiFileId,
        });
      }

      // PDF — upload as-is to Blob (backup) + xAI Files API (primary path).
      // No more pdf-parse / эвристика 30 chars/page / 50K trim — xAI делает
      // OCR и layout-aware parsing на своей стороне через document_search
      // (Шаг 4 SPEC v3 §2.1 п.10-11). Сканы и текстовые PDF — единый путь.
      const isPdfFile = fileType === "application/pdf" || fileExt === "pdf";
      if (isPdfFile) {
        const pdfBuffer = Buffer.from(fileBuffer);
        const data = await put(originalFilename, fileBuffer, {
          access: "public",
          contentType: "application/pdf",
        });
        const xaiFileId = await uploadToXai(pdfBuffer, originalFilename, "application/pdf");

        return NextResponse.json({
          ...data,
          originalFilename,
          originalContentType: "application/pdf",
          processed: true,
          fileType: "pdf",
          xaiFileId,
        });
      }

      // Images (JPEG/PNG) — без xAI upload, идут через Grok native vision.
      const data = await put(originalFilename, fileBuffer, {
        access: "public",
        contentType: fileType,
      });

      return NextResponse.json(data);
    } catch (error) {
      console.error("[Upload API] Error processing file:", error);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  } catch (error) {
    console.error("[Upload API] Request processing error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
