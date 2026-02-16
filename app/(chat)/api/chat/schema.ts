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
    "claude-sonnet",        // Claude Sonnet — баланс скорости и качества
    "claude-haiku",         // Claude Haiku — быстрая модель
    "claude-opus",          // Claude Opus — максимальное качество
  ]),
  selectedVisibilityType: z.enum(["public", "private"]),
  // ТЗ-03: Project chat support
  projectId: z.string().uuid().optional(),
  projectModelTier: z.enum(["executor", "expert", "professor"]).optional(),
  // ТЗ-07A: Helper chat support
  helperId: z.string().optional(),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
