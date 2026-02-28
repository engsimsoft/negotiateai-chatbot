import type { InferUITool, UIMessage } from "ai";
import { z } from "zod";
import type { ArtifactKind } from "@/components/artifact";
import type { createDocument } from "./ai/tools/create-document";
import type {
  DebugStepData,
  DebugFinishData,
  DebugGuardianData,
  DebugPromptData,
} from "./ai/debug-events";
import type { getWeather } from "./ai/tools/get-weather";
import type { requestSuggestions } from "./ai/tools/request-suggestions";
import type { updateDocument } from "./ai/tools/update-document";
import type { Suggestion } from "./db/schema";
import type { AppUsage } from "./usage";

export type DataPart = { type: "append-message"; message: string };

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type weatherTool = InferUITool<typeof getWeather>;
type createDocumentTool = InferUITool<ReturnType<typeof createDocument>>;
type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type requestSuggestionsTool = InferUITool<
  ReturnType<typeof requestSuggestions>
>;

export type ChatTools = {
  getWeather: weatherTool;
  createDocument: createDocumentTool;
  updateDocument: updateDocumentTool;
  requestSuggestions: requestSuggestionsTool;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  markdownDelta: string;
  presentationDelta: {
    jsonContent?: string;
    themeId?: string;
    html?: string;
    isComplete?: boolean;
  };
  pptxStatus: {
    status: string;
    message: string;
    pptxUrl?: string;
  };
  pptxComplete: {
    pptxUrl: string;
    previewUrls: string[];
    slideCount: number;
    themeId: string;
  };
  excelDelta: {
    excelData?: string; // JSON stringified ExcelData
    fileUrl?: string;
    isComplete?: boolean;
  };
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  usage: AppUsage;
  // ТЗ-07: Tool activity started event (sent from instrumentedStream)
  "tool-activity": {
    toolName: string;
    toolCallId: string;
    args?: any;
  };
  // Dev: model info for dev badge (emitted per response)
  "model-info": {
    modelId: string;
    modelName: string;
  };
  // ТЗ-PX: Research depth override (dev-mode, emitted when researchDepth is set)
  "research-depth": {
    depth: string;
  };
  // ТЗ-DEV1: Developer Panel debug events (transient, dev-mode only)
  "debug-prompt": DebugPromptData;
  "debug-step": DebugStepData;
  "debug-guardian": DebugGuardianData;
  "debug-finish": DebugFinishData;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};
