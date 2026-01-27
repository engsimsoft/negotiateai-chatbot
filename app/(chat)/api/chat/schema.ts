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
    "auto",                 // Авто-выбор на основе агента (по умолчанию)
    "gemini-3-pro",         // Gemini 3 Pro - профессиональные задачи
    "gemini-2.5-flash",     // Gemini 2.5 Flash - простые задачи
  ]),
  selectedVisibilityType: z.enum(["public", "private"]),
  agentId: z.string().optional(), // Agent ID for agent-specific prompts
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
