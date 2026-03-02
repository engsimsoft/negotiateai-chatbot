/**
 * ТЗ-A3: Clerk File Analyzer Endpoint
 *
 * POST /api/projects/[id]/analyze-file
 * Accepts { fileId }, calls Claude Haiku with clerk prompt,
 * saves analysis to file metadata, auto-creates folder,
 * moves file, rebuilds project manifest.
 */

import fs from "fs";
import path from "path";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import { myProvider } from "@/lib/ai/providers";
import { logUsage } from "@/lib/ai/usage-utils";
import {
  getProjectById,
  getProjectFileById,
  getProjectFolders,
  updateProjectFileMetadata,
  updateProjectFileFolder,
  createProjectFolder,
  rebuildProjectManifest,
} from "@/lib/db/queries";

// Load clerk prompt from .md file
const CLERK_PROMPT_PATH = path.join(
  process.cwd(),
  "lib",
  "prompts",
  "clerks",
  "file-analyzer.md"
);
const CLERK_SYSTEM_PROMPT = fs.readFileSync(CLERK_PROMPT_PATH, "utf-8");

const requestSchema = z.object({
  fileId: z.string().uuid(),
});

// Expected shape of clerk response
const analysisSchema = z.object({
  description: z.string(),
  documentType: z.string(),
  suggestedFolder: z.string(),
  relevance: z.enum(["core", "reference", "unclear"]),
  keyTopics: z.array(z.string()),
  language: z.string(),
});

/**
 * POST /api/projects/[id]/analyze-file
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
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request: fileId required" },
        { status: 400 }
      );
    }

    const { fileId } = parsed.data;

    // Verify project ownership
    const projectData = await getProjectById({ id: projectId });
    if (!projectData || projectData.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Load file
    const file = await getProjectFileById({ id: fileId });
    if (!file || file.projectId !== projectId) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    // Load existing folders for context
    const folders = await getProjectFolders({ projectId });
    const folderNames = folders.map((f) => f.name);

    // Build user message with XML blocks
    const preview = file.metadata?.extractedContent
      ? file.metadata.extractedContent.slice(0, 2000)
      : "Превью не доступно";

    const userMessage = `<file>
{
  "name": "${file.name}",
  "type": "${file.mimeType}",
  "size": ${file.size}
}
</file>

<preview>
${preview}
</preview>

<existing_folders>
${folderNames.length > 0 ? JSON.stringify(folderNames) : "[]"}
</existing_folders>`;

    const resolvedModelId = myProvider.languageModel("claude-haiku").modelId;

    const result = await generateText({
      model: myProvider.languageModel("claude-haiku"),
      system: CLERK_SYSTEM_PROMPT,
      prompt: userMessage,
      temperature: 0.1,
    });

    // ТЗ-CACHE2: Usage logging
    logUsage({
      userId: session.user.id!,
      usage: result.usage,
      modelId: resolvedModelId,
      chatMode: "clerk:file-analyzer",
    });

    // Parse JSON response
    let analysis;
    try {
      // Strip markdown code blocks if present
      let jsonText = result.text.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      const rawAnalysis = JSON.parse(jsonText);
      analysis = analysisSchema.parse(rawAnalysis);
    } catch (parseError) {
      console.error("[AnalyzeFile] Failed to parse clerk response:", result.text);
      return NextResponse.json(
        { error: "Failed to parse analysis", raw: result.text },
        { status: 502 }
      );
    }

    // Save analysis to file metadata
    const updatedMetadata = {
      ...file.metadata,
      analysis: {
        description: analysis.description,
        documentType: analysis.documentType,
        suggestedFolder: analysis.suggestedFolder,
        relevance: analysis.relevance,
        keyTopics: analysis.keyTopics,
        language: analysis.language,
      },
    };

    await updateProjectFileMetadata({
      fileId,
      metadata: updatedMetadata,
    });

    // Auto-folder logic: find or create folder, move file
    let targetFolderId: string | null = null;
    let newFolderData: { id: string; name: string; emoji: string; projectId: string; sortOrder: number; createdAt: Date } | null = null;

    if (analysis.suggestedFolder) {
      // Check if folder already exists (case-insensitive match)
      const existingFolder = folders.find(
        (f) => f.name.toLowerCase() === analysis.suggestedFolder.toLowerCase()
      );

      if (existingFolder) {
        targetFolderId = existingFolder.id;
      } else {
        // Create new folder
        const newFolder = await createProjectFolder({
          projectId,
          name: analysis.suggestedFolder,
        });
        targetFolderId = newFolder.id;
        newFolderData = newFolder;
      }

      // Move file to folder
      await updateProjectFileFolder({
        fileId,
        folderId: targetFolderId,
      });
    }

    // Rebuild manifest
    await rebuildProjectManifest({ projectId });

    return NextResponse.json({
      success: true,
      analysis,
      folderId: targetFolderId,
      ...(newFolderData && { folder: newFolderData }),
    });
  } catch (error) {
    console.error("[AnalyzeFile] Error:", error);
    return NextResponse.json(
      { error: "Failed to analyze file" },
      { status: 500 }
    );
  }
}
