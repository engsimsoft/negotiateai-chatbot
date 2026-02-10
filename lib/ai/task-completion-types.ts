import { z } from "zod";

// ============================================================================
// ТЗ-C2: Task Completion — Types & Zod schemas
// ============================================================================

// --- TaskSummary (Клерк-суммаризатор output) ---

export const taskSummaryArtifactSchema = z.object({
  name: z.string(),
  description: z.string(),
});

export type TaskSummaryArtifact = z.infer<typeof taskSummaryArtifactSchema>;

export const taskSummarySchema = z.object({
  summary: z.string(),
  keyDecisions: z.array(z.string()).default([]),
  createdArtifacts: z.array(taskSummaryArtifactSchema).default([]),
  openQuestions: z.array(z.string()).default([]),
});

export type TaskSummary = z.infer<typeof taskSummarySchema>;

// --- ProfessorVerdict (Профессор-ревьюер output) ---

export const verdictIssueSchema = z.object({
  severity: z.enum(["minor", "major", "critical"]),
  criterion: z.string().optional().default(""),
  description: z.string(),
  suggestion: z.string(),
});

export type VerdictIssue = z.infer<typeof verdictIssueSchema>;

export const professorVerdictSchema = z.object({
  verdict: z.enum(["approved", "issues", "critical"]),
  shortSummary: z.string(),
  fullAnalysis: z.string().default(""),
  issues: z.array(verdictIssueSchema).default([]),
});

export type ProfessorVerdict = z.infer<typeof professorVerdictSchema>;

// --- Helpers ---

export function isVerdictApproved(verdict: ProfessorVerdict): boolean {
  return verdict.verdict === "approved";
}

export function isVerdictIssues(verdict: ProfessorVerdict): boolean {
  return verdict.verdict === "issues" || verdict.verdict === "critical";
}

// --- Fallback summary (когда AI не отвечает) ---

export function createFallbackSummary(
  taskTitle: string,
  taskGoal: string
): TaskSummary {
  return {
    summary: `Задача "${taskTitle}" завершена. Цель: ${taskGoal || "не указана"}.`,
    keyDecisions: [],
    createdArtifacts: [],
    openQuestions: [],
  };
}
