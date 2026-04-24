/**
 * Общий text-extractor: DOCX / TXT / MD / CSV / XLSX / XLS / XLSM / PDF.
 *
 * SSOT для извлечения текста из пользовательских файлов. Используется:
 *  - Chat attachments upload (app/(chat)/api/files/upload/route.ts — миграция при рефакторинге)
 *  - Library upload (app/(chat)/api/library/documents/route.ts — auto-analyze source)
 *
 * Pattern: динамические импорты mammoth / xlsx (у нас lazy, чтобы не раздувать edge bundle).
 * PDF — через `lib/pdf/extract-pdf-text`.
 */

import { extractPdfText } from "@/lib/pdf/extract-pdf-text";

const getMammoth = async () => {
  const mammoth = await import("mammoth");
  return mammoth.default || mammoth;
};

const getXLSX = async () => await import("xlsx");

export const DEFAULT_TEXT_TRUNCATE_CHARS = 50_000;

export interface ExtractTextResult {
  text: string;
  /** Было ли содержимое обрезано по лимиту */
  truncated: boolean;
  /** Количество страниц (для PDF) */
  pageCount?: number;
  /** Предположительно скан PDF без извлекаемого текста */
  isLikelyScan?: boolean;
  /** Тип распознан как (для логики вниз) */
  kind: "docx" | "text" | "csv" | "xlsx" | "pdf-text" | "pdf-scan" | "unknown";
}

function truncate(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  return { text: text.slice(0, maxChars), truncated: true };
}

export async function extractTextFromFile(params: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  maxChars?: number;
}): Promise<ExtractTextResult | null> {
  const { buffer, filename, mimeType } = params;
  const maxChars = params.maxChars ?? DEFAULT_TEXT_TRUNCATE_CHARS;
  const ext = filename.toLowerCase().split(".").pop() ?? "";

  const isDocx =
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx";
  const isText =
    mimeType === "text/plain" ||
    mimeType === "text/markdown" ||
    mimeType === "text/x-markdown" ||
    ext === "txt" ||
    ext === "md";
  const isCsv = mimeType === "text/csv" || ext === "csv";
  const isXlsx =
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    ext === "xlsx" ||
    ext === "xls" ||
    ext === "xlsm";
  const isPdf = mimeType === "application/pdf" || ext === "pdf";

  if (isDocx) {
    const mammoth = await getMammoth();
    const result = await mammoth.extractRawText({ buffer });
    const { text, truncated } = truncate(result.value, maxChars);
    return { text, truncated, kind: "docx" };
  }

  if (isText) {
    const decoded = new TextDecoder("utf-8").decode(buffer);
    const { text, truncated } = truncate(decoded, maxChars);
    return { text, truncated, kind: "text" };
  }

  if (isCsv) {
    const decoded = new TextDecoder("utf-8").decode(buffer);
    const { text, truncated } = truncate(decoded, maxChars);
    return { text, truncated, kind: "csv" };
  }

  if (isXlsx) {
    const xlsx = await getXLSX();
    const workbook = xlsx.read(buffer, { type: "buffer" });
    let extracted = "";
    workbook.SheetNames.forEach((sheetName, index) => {
      const worksheet = workbook.Sheets[sheetName];
      const csv = xlsx.utils.sheet_to_csv(worksheet);
      if (index > 0) extracted += "\n\n";
      extracted += `=== Лист: ${sheetName} ===\n${csv}`;
    });
    const { text, truncated } = truncate(extracted, maxChars);
    return { text, truncated, kind: "xlsx" };
  }

  if (isPdf) {
    try {
      const pdfResult = await extractPdfText(buffer);
      if (pdfResult.isLikelyScan || pdfResult.text.length === 0) {
        return {
          text: "",
          truncated: false,
          pageCount: pdfResult.pageCount,
          isLikelyScan: true,
          kind: "pdf-scan",
        };
      }
      const { text, truncated } = truncate(pdfResult.text, maxChars);
      return {
        text,
        truncated,
        pageCount: pdfResult.pageCount,
        isLikelyScan: false,
        kind: "pdf-text",
      };
    } catch {
      return { text: "", truncated: false, kind: "pdf-scan", isLikelyScan: true };
    }
  }

  return null;
}
