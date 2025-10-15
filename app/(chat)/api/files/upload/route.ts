import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";

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
          "text/plain",
          "text/markdown",
          "text/x-markdown", // Alternative MD MIME type
          "application/octet-stream", // Generic binary (browsers may use this for .md)
        ].includes(file.type),
      {
        message:
          "File type should be JPEG, PNG, PDF, DOCX, TXT, or MD",
      }
    ),
});

// Dynamic import for mammoth (DOCX parser)
const getMammoth = async () => {
  const mammoth = await import("mammoth");
  return mammoth.default || mammoth;
};

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
    const fileExt = originalFilename.toLowerCase().match(/\.(docx|txt|md)$/)?.[1];

    try {
      // Process document files (DOCX, TXT, MD) and extract text
      // These will be uploaded as text/plain to work with Claude multimodal API
      const isDocumentFile =
        fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        fileType === "text/plain" ||
        fileType === "text/markdown" ||
        fileType === "text/x-markdown" ||
        (fileType === "application/octet-stream" && (fileExt === "md" || fileExt === "txt")) ||
        fileExt === "docx" ||
        fileExt === "txt" ||
        fileExt === "md";

      if (isDocumentFile) {
        let extractedText: string;

        if (fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || fileExt === "docx") {
          // Extract text from DOCX
          const mammoth = await getMammoth();
          const result = await mammoth.extractRawText({ buffer: Buffer.from(fileBuffer) });
          extractedText = result.value;
        } else {
          // Read TXT/MD as UTF-8 text
          const decoder = new TextDecoder("utf-8");
          extractedText = decoder.decode(fileBuffer);
        }

        // Upload extracted text as .txt file
        const textFilename = originalFilename.replace(/\.(docx|txt|md)$/i, ".txt");
        const textBuffer = Buffer.from(extractedText, 'utf-8');

        const data = await put(textFilename, textBuffer, {
          access: "public",
          contentType: "text/plain",
        });

        // Return with metadata indicating this was processed
        return NextResponse.json({
          ...data,
          originalFilename,
          originalContentType: fileType,
          processed: true,
        });
      }

      // For images and PDFs, upload as-is (they work with Claude multimodal API)
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
