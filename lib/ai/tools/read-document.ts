import { tool } from "ai";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";

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
Supports DOCX, PDF, TXT, and MD files. Use the index.md file to find available documents.
Always cite the source document when using information from it.

Example usage:
- To read the main commercial proposal: "knowledge/КП AGORA - Мир Групп от 20.04.2022_КРАТКО.pdf"
- To read Vietnam tenders info: "knowledge/Вьетнам/тендерные площадки Вьетнама.docx"`,

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
      const supportedExtensions = [".pdf", ".docx", ".txt", ".md"];

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
      } else {
        // For DOCX and PDF, read as base64 for Claude's document understanding
        const buffer = await fs.readFile(absolutePath);
        const base64Content = buffer.toString("base64");

        return {
          success: true,
          filepath,
          fileType: ext,
          fileSizeKB,
          content: base64Content,
          encoding: "base64",
          mimeType: ext === ".pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        };
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
