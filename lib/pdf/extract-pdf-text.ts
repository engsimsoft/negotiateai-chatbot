import "server-only";

// pdf-parse v2 is ESM-first. Next.js RSC webpack bundler fails on top-level
// named imports ("Object.defineProperty called on non-object") AND dynamic
// imports when bundling this package. Fix: declare pdf-parse as external
// in next.config.ts → serverExternalPackages → resolved via Node require at
// runtime, identical to how `lamejs` is handled.
import { PDFParse } from "pdf-parse";

export interface PdfExtractionResult {
  text: string;
  pageCount: number;
  avgCharsPerPage: number;
  isLikelyScan: boolean;
}

const SCAN_AVG_CHARS_PER_PAGE_THRESHOLD = 30;
const SCAN_SINGLE_PAGE_MIN_CHARS = 100;

export async function extractPdfText(
  buffer: Buffer
): Promise<PdfExtractionResult> {
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    const text = result.text ?? "";
    const pageCount = result.total ?? 0;
    const avgCharsPerPage = pageCount > 0 ? text.length / pageCount : 0;

    const isLikelyScan =
      pageCount === 1
        ? text.length < SCAN_SINGLE_PAGE_MIN_CHARS
        : avgCharsPerPage < SCAN_AVG_CHARS_PER_PAGE_THRESHOLD;

    console.log(
      `[PDF Extract] pageCount=${pageCount} chars=${text.length} avgCharsPerPage=${avgCharsPerPage.toFixed(1)} isLikelyScan=${isLikelyScan}`
    );

    return { text, pageCount, avgCharsPerPage, isLikelyScan };
  } finally {
    await parser.destroy();
  }
}
