import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import {
  getFilesByProjectId,
  getProjectById,
  saveProjectFile,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { generateUUID } from "@/lib/utils";

// File validation schema - 50MB limit for project files
const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= 50 * 1024 * 1024, {
      message: "File size should be less than 50MB",
    }),
});

// Dynamic imports for file processing
const getMammoth = async () => {
  const mammoth = await import("mammoth");
  return mammoth.default || mammoth;
};

const getXLSX = async () => {
  const xlsx = await import("xlsx");
  return xlsx;
};

const getPdfParse = async () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse");
  return pdfParse;
};

// Determine file category
function getFileType(mimeType: string, extension: string): string {
  const docTypes = ["pdf", "doc", "docx", "txt", "md"];
  const tableTypes = ["xls", "xlsx", "csv"];
  const imageTypes = ["jpg", "jpeg", "png", "gif", "webp"];
  const audioTypes = ["mp3", "wav", "m4a", "ogg"];
  const videoTypes = ["mp4", "mov", "webm"];

  if (docTypes.includes(extension)) return "document";
  if (tableTypes.includes(extension)) return "table";
  if (imageTypes.includes(extension)) return "image";
  if (audioTypes.includes(extension)) return "audio";
  if (videoTypes.includes(extension)) return "video";

  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.includes("pdf")) return "document";
  if (mimeType.includes("word")) return "document";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "table";

  return "other";
}

// Extract text content from file for AI context
async function extractContent(
  fileBuffer: ArrayBuffer,
  mimeType: string,
  extension: string
): Promise<string | undefined> {
  try {
    // Text files
    if (extension === "txt" || extension === "md" || mimeType === "text/plain") {
      const decoder = new TextDecoder("utf-8");
      return decoder.decode(fileBuffer);
    }

    // DOCX files
    if (extension === "docx" || mimeType.includes("wordprocessingml")) {
      const mammoth = await getMammoth();
      const result = await mammoth.extractRawText({
        buffer: Buffer.from(fileBuffer),
      });
      return result.value;
    }

    // PDF files
    if (extension === "pdf" || mimeType === "application/pdf") {
      try {
        const pdfParse = await getPdfParse();
        const data = await pdfParse(Buffer.from(fileBuffer));
        return data.text;
      } catch (error) {
        console.warn("[ProjectFiles] PDF parsing failed:", error);
        return undefined;
      }
    }

    // Excel files
    if (
      extension === "xlsx" ||
      extension === "xls" ||
      extension === "csv" ||
      mimeType.includes("sheet") ||
      mimeType.includes("excel")
    ) {
      const xlsx = await getXLSX();
      const workbook = xlsx.read(Buffer.from(fileBuffer), { type: "buffer" });

      let extractedText = "";
      workbook.SheetNames.forEach((sheetName, index) => {
        const worksheet = workbook.Sheets[sheetName];
        const csv = xlsx.utils.sheet_to_csv(worksheet);
        if (index > 0) extractedText += "\n\n";
        extractedText += `=== Лист: ${sheetName} ===\n${csv}`;
      });
      return extractedText;
    }

    // Images - no text extraction, will use vision API
    // Audio/Video - no extraction (transcription in future)

    return undefined;
  } catch (error) {
    console.error("[ProjectFiles] Content extraction failed:", error);
    return undefined;
  }
}

/**
 * GET /api/projects/[id]/files
 * Get all files for a project
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const { id } = await params;
    const project = await getProjectById({ id });

    if (!project) {
      return new ChatSDKError(
        "not_found:database",
        "Project not found"
      ).toResponse();
    }

    if (project.userId !== session.user.id) {
      return new ChatSDKError(
        "unauthorized:chat",
        "You don't have access to this project"
      ).toResponse();
    }

    const files = await getFilesByProjectId({ projectId: id });
    return Response.json(files);
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to get project files"
    ).toResponse();
  }
}

/**
 * POST /api/projects/[id]/files
 * Upload a file to a project
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: projectId } = await params;
    const project = await getProjectById({ id: projectId });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.userId !== session.user.id) {
      return NextResponse.json(
        { error: "You don't have access to this project" },
        { status: 403 }
      );
    }

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

    const originalFilename = (formData.get("file") as File).name;
    const fileBuffer = await file.arrayBuffer();
    const mimeType = file.type || "application/octet-stream";
    const extension = originalFilename.split(".").pop()?.toLowerCase() || "";

    // Upload to Vercel Blob
    const blobData = await put(
      `projects/${projectId}/${originalFilename}`,
      fileBuffer,
      {
        access: "public",
        contentType: mimeType,
      }
    );

    // Extract content for AI context
    const extractedContent = await extractContent(fileBuffer, mimeType, extension);

    // Determine file type category
    const fileType = getFileType(mimeType, extension);

    // Build metadata
    const metadata: {
      extractedContent?: string;
      pageCount?: number;
      dimensions?: { width: number; height: number };
    } = {};

    if (extractedContent) {
      // Limit extracted content to ~50K chars to avoid context overflow
      metadata.extractedContent =
        extractedContent.length > 50000
          ? extractedContent.slice(0, 50000) + "\n...[контент обрезан]"
          : extractedContent;
    }

    // Save to database
    const savedFile = await saveProjectFile({
      id: generateUUID(),
      projectId,
      name: originalFilename,
      type: fileType,
      mimeType,
      size: file.size,
      url: blobData.url,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    });

    return NextResponse.json(savedFile, { status: 201 });
  } catch (error) {
    console.error("[ProjectFiles] Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
