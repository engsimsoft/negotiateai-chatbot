import { z } from "zod";

// ============================================================================
// ТЗ-B1: Professor Planning — Types & Zod schemas
// ============================================================================

// --- Task ---

export const professorTaskSchema = z.object({
  order: z.number(),
  title: z.string(),
  description: z.string(),
  goal: z.string(),
  input: z.string(),
  expectedOutput: z.string(),
  dependencies: z.array(z.number()),
  tools: z.array(z.string()),
  needsReview: z.boolean(),
  reviewReason: z.string(),
});

export type ProfessorTask = z.infer<typeof professorTaskSchema>;

// --- Risk ---

export const professorRiskSchema = z.object({
  description: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  mitigation: z.string(),
});

export type ProfessorRisk = z.infer<typeof professorRiskSchema>;

// --- Recommendation ---

export const professorRecommendationSchema = z.object({
  type: z.enum(["connect_tool", "upload_data", "clarify"]),
  description: z.string(),
  impact: z.string(),
});

export type ProfessorRecommendation = z.infer<typeof professorRecommendationSchema>;

// --- Caveat (for partial plans) ---

export const professorCaveatSchema = z.object({
  affectedTasks: z.array(z.number()),
  issue: z.string(),
  consequence: z.string(),
  question: z.string(),
});

export type ProfessorCaveat = z.infer<typeof professorCaveatSchema>;

// --- Question (for needs_input) ---

export const professorQuestionSchema = z.object({
  question: z.string(),
  why: z.string(),
  blocking: z.boolean(),
});

export type ProfessorQuestion = z.infer<typeof professorQuestionSchema>;

// --- Plan JSON variants ---

export const needsInputPlanSchema = z.object({
  status: z.literal("needs_input"),
  questions: z.array(professorQuestionSchema),
});

export const completePlanSchema = z.object({
  status: z.literal("complete"),
  tasks: z.array(professorTaskSchema),
  risks: z.array(professorRiskSchema),
  recommendations: z.array(professorRecommendationSchema),
});

export const partialPlanSchema = z.object({
  status: z.literal("partial"),
  tasks: z.array(professorTaskSchema),
  risks: z.array(professorRiskSchema),
  recommendations: z.array(professorRecommendationSchema),
  caveats: z.array(professorCaveatSchema),
});

// --- Union ---

export const professorPlanJsonSchema = z.discriminatedUnion("status", [
  needsInputPlanSchema,
  completePlanSchema,
  partialPlanSchema,
]);

export type ProfessorPlanJson = z.infer<typeof professorPlanJsonSchema>;

// --- Helpers ---

export function isPlanWithTasks(
  plan: ProfessorPlanJson
): plan is z.infer<typeof completePlanSchema> | z.infer<typeof partialPlanSchema> {
  return plan.status === "complete" || plan.status === "partial";
}

export function isNeedsInput(
  plan: ProfessorPlanJson
): plan is z.infer<typeof needsInputPlanSchema> {
  return plan.status === "needs_input";
}

// --- Tools manifest (hardcoded for MVP) ---

export const MVP_TOOLS_MANIFEST = {
  tools: [
    {
      name: "web_search",
      status: "connected",
      capabilities: "Поиск информации в интернете",
    },
    {
      name: "file_generation",
      status: "connected",
      capabilities: "Создание документов (docx, pptx, xlsx)",
    },
    {
      name: "file_analysis",
      status: "connected",
      capabilities: "Анализ загруженных файлов",
    },
  ],
} as const;
