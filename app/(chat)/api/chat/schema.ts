import { z } from "zod";
import { chatModeSchema } from "@/lib/ai/chat-mode-config";

const textPartSchema = z.object({
  type: z.enum(["text"]),
  text: z.string().min(1).max(16000),
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
  // ТЗ-DV2: chatMode replaces selectedChatModel — server determines model
  chatMode: chatModeSchema.default("chat"),
  selectedVisibilityType: z.enum(["public", "private"]),
  // ТЗ-03: Project chat support
  projectId: z.string().uuid().optional(),
  projectModelTier: z.enum(["executor", "expert", "professor"]).optional(),
  // ТЗ-PX: Override depth for deepResearch (dev-mode UI switcher)
  researchDepth: z.enum(["pro", "deep"]).optional(),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
