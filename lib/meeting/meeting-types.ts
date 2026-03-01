// ТЗ-MR Этап 3: Meeting pipeline types (client-safe)

/** Pipeline progress step identifiers */
export type MeetingProgressStep =
  | "uploading"
  | "transcribing"
  | "summarizing"
  | "saving"
  | "complete"
  | "error";

/** NDJSON event emitted during /api/meeting/process streaming */
export interface MeetingProgressEvent {
  step: MeetingProgressStep;
  message: string;
  done?: boolean;
  detail?: string;
  /** Set on "complete" step — the record ID for navigation */
  recordId?: string;
}

/** Summary detail levels */
export type SummaryLevel = "compact" | "standard" | "detailed";

/** Pipeline input parameters */
export interface MeetingPipelineInput {
  blobUrl: string;
  summaryLevel: SummaryLevel;
  durationSeconds: number;
  userId: string;
}

/** Pipeline result returned after completion */
export interface MeetingPipelineResult {
  status: "success" | "failed";
  recordId?: string;
  title?: string;
  error?: string;
}
