/**
 * Claude Vision OCR Module
 *
 * Provides document OCR capabilities using Claude Vision API.
 * Supports: PDFs, images (JPG/PNG), scanned documents
 *
 * @module vision-ocr
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
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
 * Extract text from a single image using Claude Vision API
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
    const base64Image = imageBuffer.toString("base64");

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022", // Latest vision-capable model
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: "text",
              text: OCR_PROMPT,
            },
          ],
        },
      ],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block: any) => block.text)
      .join("\n");

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
 * Extract text from PDF using Claude Vision API
 *
 * NOTE: Currently sends PDF as-is to Claude.
 * Anthropic API supports PDF documents natively via base64 encoding.
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
    const base64Pdf = pdfBuffer.toString("base64");

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 8192, // Larger context for multi-page PDFs
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64Pdf,
              },
            } as any, // Type assertion needed for document type
            {
              type: "text",
              text: OCR_PROMPT,
            },
          ],
        },
      ],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block: any) => block.text)
      .join("\n");

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
