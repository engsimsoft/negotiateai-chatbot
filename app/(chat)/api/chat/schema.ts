import { z } from "zod";

const textPartSchema = z.object({
  type: z.enum(["text"]),
  text: z.string().min(1).max(2000),
});

const filePartSchema = z.object({
  type: z.enum(["file"]),
  mediaType: z.enum([
    "image/jpeg",
    "image/png",
    "application/pdf",
    "text/plain", // DOCX/MD/TXT are converted to text/plain by upload API
  ]),
  name: z.string().min(1).max(100),
  url: z.string().url(),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: z.object({
    id: z.string().uuid(),
    role: z.enum(["user"]),
    parts: z.array(partSchema),
  }),
  selectedChatModel: z.enum([
    "auto",                 // Auto-select model based on agent
    "gemini-3-pro",         // Professional agents model
    "gemini-2.5-flash",     // Casual agents model
    "claude-sonnet-4",      // Legacy ID, maps to gemini-2.5-pro (for artifacts)
    "claude-haiku-3.5",     // Legacy ID, maps to gemini-2.5-flash
  ]),
  selectedVisibilityType: z.enum(["public", "private"]),
  agentId: z.string().optional(), // Agent ID for agent-specific prompts
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
