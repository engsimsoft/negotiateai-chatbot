/**
 * Vision OCR Module
 *
 * Provides document OCR capabilities using Claude Haiku 4.5 vision.
 * Supports: PDFs, images (JPG/PNG), scanned documents
 *
 * @module vision-ocr
 */

import { generateText } from "ai";
import {
  getModel,
  getModelIdForTask,
  getProviderForTask,
} from "@/lib/ai/getModel";
import { logUsage } from "@/lib/ai/usage-utils";

const VISION_OCR_TASK = "vision:ocr" as const;

/**
 * OCR prompt optimized for document extraction
 */
const OCR_PROMPT = `Extract all text from this document image.
Preserve formatting, structure, and layout as much as possible.
Return ONLY the extracted text content without any additional commentary.
If the image contains tables, preserve them in markdown format.
If the text is in multiple languages, extract all of them.`;

/**
 * Result from Vision OCR processing
 */
export interface VisionOCRResult {
  text: string;
  pageCount?: number;
  processingTimeMs?: number;
}

/**
 * Extract text from a single image using Claude Haiku 4.5 vision
 *
 * @param imageBuffer - Image buffer (PNG or JPEG)
 * @param mediaType - MIME type ("image/png" or "image/jpeg")
 * @returns Extracted text
 */
export async function extractTextFromImage(
  imageBuffer: Buffer,
  mediaType: "image/png" | "image/jpeg",
  /** ТЗ-BILLING1: userId required — cost must always be logged. */
  userId: string,
): Promise<string> {
  console.log(`[Vision OCR] Processing image (${Math.round(imageBuffer.length / 1024)}KB, ${mediaType})`);
  const startTime = Date.now();

  try {
    // Convert Buffer to base64 data URL to avoid type issues with mimeType property
    const base64Image = imageBuffer.toString("base64");
    const dataUrl = `data:${mediaType};base64,${base64Image}`;

    const { text, usage } = await generateText({
      model: getModel(VISION_OCR_TASK),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: OCR_PROMPT },
            { type: "image", image: dataUrl },
          ],
        },
      ],
    });

    const processingTime = Date.now() - startTime;
    console.log(
      `[Vision OCR] Image processed in ${processingTime}ms, extracted ${text.length} chars`
    );

    logUsage({
      userId,
      usage,
      modelId: getModelIdForTask(VISION_OCR_TASK),
      provider: getProviderForTask(VISION_OCR_TASK),
      chatMode: "util:vision-ocr",
      durationMs: processingTime,
    });

    return text;
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(
      `[Vision OCR] Image processing failed after ${processingTime}ms:`,
      error instanceof Error ? error.message : error
    );
    throw error;
  }
}

/**
 * Extract text from PDF using Claude Haiku 4.5 vision
 *
 * @param pdfBuffer - PDF file buffer
 * @returns OCR result with text and metadata
 */
export async function extractTextFromPDF(
  pdfBuffer: Buffer,
  /** ТЗ-BILLING1: userId required — cost must always be logged. */
  userId: string,
): Promise<VisionOCRResult> {
  console.log(`[Vision OCR] Processing PDF (${Math.round(pdfBuffer.length / 1024)}KB)`);
  const startTime = Date.now();

  try {
    const { text, usage } = await generateText({
      model: getModel(VISION_OCR_TASK),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: OCR_PROMPT },
            {
              type: "file",
              data: pdfBuffer,
              mimeType: "application/pdf",
            } as any,
          ],
        },
      ],
    });

    const processingTime = Date.now() - startTime;
    console.log(
      `[Vision OCR] PDF processed in ${processingTime}ms, extracted ${text.length} chars`
    );

    logUsage({
      userId,
      usage,
      modelId: getModelIdForTask(VISION_OCR_TASK),
      provider: getProviderForTask(VISION_OCR_TASK),
      chatMode: "util:vision-ocr",
      durationMs: processingTime,
    });

    return {
      text,
      processingTimeMs: processingTime,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(
      `[Vision OCR] PDF processing failed after ${processingTime}ms:`,
      error instanceof Error ? error.message : error
    );
    throw error;
  }
}
