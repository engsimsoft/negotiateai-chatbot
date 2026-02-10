import { tool } from "ai";
import { z } from "zod";
import { getProjectFileByName } from "@/lib/db/queries";
import { wrapToolExecution } from "./tool-wrapper";

const MAX_CONTENT_LENGTH = 30_000;

const TEXT_MIME_PREFIXES = ["text/"];
const TEXT_MIME_EXACT = [
  "application/json",
  "application/xml",
  "application/csv",
  "application/javascript",
  "application/typescript",
  "application/x-yaml",
  "application/yaml",
];

// Extensions that are always text, even if MIME is application/octet-stream
const TEXT_EXTENSIONS = new Set([
  ".md", ".txt", ".csv", ".json", ".xml", ".yaml", ".yml",
  ".js", ".ts", ".jsx", ".tsx", ".py", ".html", ".css",
  ".svg", ".env", ".ini", ".toml", ".cfg", ".conf",
  ".sh", ".bash", ".zsh", ".sql", ".graphql", ".gql",
  ".log", ".rst", ".tex", ".r", ".rb", ".go", ".java",
]);

function isTextFile(mimeType: string, fileName: string): boolean {
  if (TEXT_MIME_PREFIXES.some((p) => mimeType.startsWith(p))) return true;
  if (TEXT_MIME_EXACT.includes(mimeType)) return true;
  // Fallback: check extension (handles application/octet-stream)
  const ext = fileName.lastIndexOf(".") >= 0
    ? fileName.slice(fileName.lastIndexOf(".")).toLowerCase()
    : "";
  return TEXT_EXTENSIONS.has(ext);
}

interface ReadProjectFileProps {
  projectId: string;
}

export const readProjectFile = ({ projectId }: ReadProjectFileProps) =>
  tool({
    description: `Read the contents of a project file by name. Use this when you need to see the actual content of a file from the project manifest. Works with text files (md, txt, csv, json, xml, yaml, etc). For binary files (pdf, docx, xlsx, pptx) returns the file description from manifest.`,

    inputSchema: z.object({
      fileName: z
        .string()
        .describe("The file name exactly as shown in the manifest"),
    }),

    execute: wrapToolExecution(
      { name: "readProjectFile", timeout: 15000, enableLogging: true },
      async ({ fileName }) => {
        const file = await getProjectFileByName({
          projectId,
          name: fileName,
        });

        if (!file) {
          return {
            error: `File "${fileName}" not found in project. Check the manifest for available file names.`,
          };
        }

        // Binary files — return description from metadata
        if (!isTextFile(file.mimeType, file.name)) {
          const analysis = file.metadata?.analysis;
          return {
            fileName: file.name,
            mimeType: file.mimeType,
            size: file.size,
            isBinary: true,
            description: analysis?.description || "No description available",
            documentType: analysis?.documentType || file.type,
            keyTopics: analysis?.keyTopics || [],
            message:
              "This is a binary file. The content cannot be displayed as text. Use the description and key topics above.",
          };
        }

        // Text files — fetch from Vercel Blob
        const response = await fetch(file.url);

        if (!response.ok) {
          return {
            error: `Failed to fetch file content (HTTP ${response.status})`,
          };
        }

        let content = await response.text();
        let truncated = false;

        if (content.length > MAX_CONTENT_LENGTH) {
          content = content.slice(0, MAX_CONTENT_LENGTH);
          truncated = true;
        }

        return {
          fileName: file.name,
          mimeType: file.mimeType,
          size: file.size,
          content,
          ...(truncated && {
            truncated: true,
            message: `Content truncated to ${MAX_CONTENT_LENGTH} characters (original: ${file.size} bytes)`,
          }),
        };
      }
    ),
  });
