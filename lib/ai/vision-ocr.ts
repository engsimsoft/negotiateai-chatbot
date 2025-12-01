/**
 * Google Gemini Vision OCR Module
 *
 * Provides document OCR capabilities using Google Gemini Vision API.
 * Supports: PDFs, images (JPG/PNG), scanned documents
 *
 * @module vision-ocr
 */

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

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
 * Extract text from a single image using Google Gemini Vision API
 *
 * @param imageBuffer - Image buffer (PNG or JPEG)
 * @param mediaType - MIME type ("image/png" or "image/jpeg")
 * @returns Extracted text
 */
export async function extractTextFromImage(
  imageBuffer: Buffer,
  mediaType: "image/png" | "image/jpeg"
): Promise<string> {
  console.log(`[Vision OCR] Processing image (${Math.round(imageBuffer.length / 1024)}KB, ${mediaType})`);
  const startTime = Date.now();

  try {
    const { text } = await generateText({
      model: google("gemini-1.5-pro"),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: OCR_PROMPT },
            { type: "image", image: imageBuffer, mimeType: mediaType },
          ],
        },
      ],
    });

    const processingTime = Date.now() - startTime;
    console.log(
      `[Vision OCR] Image processed in ${processingTime}ms, extracted ${text.length} chars`
    );

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
 * Extract text from PDF using Google Gemini Vision API
 *
 * @param pdfBuffer - PDF file buffer
 * @returns OCR result with text and metadata
 */
export async function extractTextFromPDF(
  pdfBuffer: Buffer
): Promise<VisionOCRResult> {
  console.log(`[Vision OCR] Processing PDF (${Math.round(pdfBuffer.length / 1024)}KB)`);
  const startTime = Date.now();

  try {
    const { text } = await generateText({
      model: google("gemini-1.5-pro"),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: OCR_PROMPT },
            {
              type: "file",
              data: pdfBuffer,
              mimeType: "application/pdf",
            },
          ],
        },
      ],
    });

    const processingTime = Date.now() - startTime;
    console.log(
      `[Vision OCR] PDF processed in ${processingTime}ms, extracted ${text.length} chars`
    );

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
