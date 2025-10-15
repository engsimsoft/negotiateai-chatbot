import { tool } from "ai";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { extractTextFromImage, extractTextFromPDF } from "../vision-ocr";

// Dynamic import for mammoth (DOCX parser)
const getMammoth = async () => {
  const mammoth = await import("mammoth");
  return mammoth.default || mammoth;
};

/**
 * Security: Only allow reading files from the knowledge/ directory
 */
function validateFilePath(filepath: string): string {
  // Normalize the path to prevent directory traversal attacks
  const normalizedPath = path.normalize(filepath);

  // Ensure the path starts with "knowledge/"
  if (!normalizedPath.startsWith("knowledge/") && !normalizedPath.startsWith("knowledge\\")) {
    throw new Error("Access denied: Only files in knowledge/ directory can be read");
  }

  // Resolve to absolute path
  const projectRoot = process.cwd();
  const absolutePath = path.join(projectRoot, normalizedPath);

  // Double-check that resolved path is still within knowledge/
  const knowledgeDir = path.join(projectRoot, "knowledge");
  if (!absolutePath.startsWith(knowledgeDir)) {
    throw new Error("Access denied: Path traversal detected");
  }

  return absolutePath;
}

export const readDocument = tool({
  description: `Read a document from the knowledge base (knowledge/ folder).
Supports: DOCX, PDF (including scanned/OCR), TXT, MD, JPG, JPEG, PNG.
PDF and image files are processed using Claude Vision OCR for accurate text extraction.
Use the index.md file to find available documents. Always cite the source document.

Example usage:
- To read the main commercial proposal: "knowledge/КП AGORA - Мир Групп от 20.04.2022_КРАТКО.pdf"
- To read Vietnam tenders info: "knowledge/Вьетнам/тендерные площадки Вьетнама.docx"
- To read scanned documents or photos: "knowledge/photo_document.jpg"`,

  inputSchema: z.object({
    filepath: z.string().describe(
      "Relative path to the document from project root (e.g., 'knowledge/document.pdf' or 'knowledge/Алжир/file.docx')"
    ),
  }),

  execute: async ({ filepath }) => {
    try {
      // Validate and resolve file path
      const absolutePath = validateFilePath(filepath);

      // Check if file exists
      try {
        await fs.access(absolutePath);
      } catch {
        return {
          success: false,
          error: `File not found: ${filepath}`,
          suggestion: "Please check the file path. Use index.md to see available documents.",
        };
      }

      // Get file stats
      const stats = await fs.stat(absolutePath);
      const fileSizeKB = Math.round(stats.size / 1024);

      // Check file extension
      const ext = path.extname(absolutePath).toLowerCase();
      const supportedExtensions = [".pdf", ".docx", ".txt", ".md", ".jpg", ".jpeg", ".png"];

      if (!supportedExtensions.includes(ext)) {
        return {
          success: false,
          error: `Unsupported file type: ${ext}`,
          supportedTypes: supportedExtensions,
        };
      }

      // Read file content
      if (ext === ".txt" || ext === ".md") {
        // For text files, read as UTF-8 string
        const content = await fs.readFile(absolutePath, "utf-8");
        return {
          success: true,
          filepath,
          fileType: ext,
          fileSizeKB,
          content,
          encoding: "utf-8",
        };
      } else if (ext === ".jpg" || ext === ".jpeg" || ext === ".png") {
        // For images, use Claude Vision OCR
        try {
          const buffer = await fs.readFile(absolutePath);
          const mediaType = ext === ".png" ? "image/png" : "image/jpeg";
          const content = await extractTextFromImage(buffer, mediaType);

          return {
            success: true,
            filepath,
            fileType: ext,
            fileSizeKB,
            content,
            encoding: "vision-ocr",
            note: "Text extracted using Claude Vision OCR",
          };
        } catch (ocrError) {
          return {
            success: false,
            error: `Failed to extract text from image: ${ocrError instanceof Error ? ocrError.message : 'Unknown error'}`,
            suggestion: "The image may be corrupted or unreadable. Try a different image format.",
          };
        }
      } else if (ext === ".pdf") {
        // For PDF, use Claude Vision OCR (supports both text and scanned PDFs)
        try {
          const buffer = await fs.readFile(absolutePath);
          const result = await extractTextFromPDF(buffer);

          return {
            success: true,
            filepath,
            fileType: ext,
            fileSizeKB,
            content: result.text,
            encoding: "vision-ocr",
            processingTimeMs: result.processingTimeMs,
            note: "Text extracted using Claude Vision OCR (supports scanned documents)",
          };
        } catch (pdfError) {
          return {
            success: false,
            error: `Failed to process PDF: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`,
            suggestion: "The PDF file may be corrupted, encrypted, or too large.",
          };
        }
      } else {
        // For DOCX, extract text using mammoth (prevents context overflow from base64)
        try {
          const buffer = await fs.readFile(absolutePath);
          const mammoth = await getMammoth();
          const result = await mammoth.extractRawText({ buffer });
          
          return {
            success: true,
            filepath,
            fileType: ext,
            fileSizeKB,
            content: result.value,
            encoding: "text",
          };
        } catch (docxError) {
          return {
            success: false,
            error: `Failed to parse DOCX: ${docxError instanceof Error ? docxError.message : 'Unknown error'}`,
            suggestion: "The DOCX file may be corrupted or password-protected.",
          };
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});
