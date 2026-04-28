/**
 * xAI Responses API client — POST /v1/responses со streaming SSE.
 *
 * Используется в chat/route.ts ПУТЬ для сообщений с non-image file attachments.
 * Через input_file content type активирует server-side document_search
 * автоматически (Phase 1.5 R2 verified). См. SPEC v3 §4.2.
 *
 * Bypass @ai-sdk/xai потому что 3.0.83 не поддерживает input_file part.
 *
 * Source: https://docs.x.ai/developers/model-capabilities/files/chat-with-files
 */

import type { ModelMessage } from "ai";

export interface ResponsesInputFilePart {
  type: "input_file";
  file_id: string;
}
export interface ResponsesInputTextPart {
  type: "input_text";
  text: string;
}
export interface ResponsesInputImagePart {
  type: "input_image";
  image_url: string;
}
export type ResponsesInputContent =
  | ResponsesInputTextPart
  | ResponsesInputImagePart
  | ResponsesInputFilePart;

export interface ResponsesInputItem {
  role: "user" | "assistant" | "system";
  content: ResponsesInputContent[];
}

/**
 * Конверсия AI SDK ModelMessage[] (которые подготовлены в chat/route.ts с
 * compaction + MIND + history) в формат Responses API input. file parts
 * с xai-file_id (по messageId mapping) превращаются в `input_file`.
 *
 * Для текущего message file_id берётся из `providerMetadata.xai.fileId`,
 * проставленного в multimodal-input.tsx. Для history file parts xaiFileId
 * резолвится через `attachmentsByUrl` mapping (заранее загружено из БД).
 */
export function buildResponsesInput(params: {
  messages: ModelMessage[];
  /** url → xaiFileId mapping для всей истории чата (из chat_attachment table). */
  attachmentsByUrl: Map<string, string>;
}): ResponsesInputItem[] {
  const result: ResponsesInputItem[] = [];

  for (const msg of params.messages) {
    if (msg.role === "system") {
      const text =
        typeof msg.content === "string" ? msg.content : "";
      if (text) {
        result.push({
          role: "system",
          content: [{ type: "input_text", text }],
        });
      }
      continue;
    }

    if (msg.role === "user") {
      const parts: ResponsesInputContent[] = [];
      const content = msg.content;
      if (typeof content === "string") {
        parts.push({ type: "input_text", text: content });
      } else {
        for (const part of content as any[]) {
          if (part.type === "text") {
            parts.push({ type: "input_text", text: part.text });
          } else if (part.type === "image") {
            const url =
              part.image instanceof URL
                ? part.image.toString()
                : typeof part.image === "string"
                  ? part.image
                  : null;
            if (url) parts.push({ type: "input_image", image_url: url });
          } else if (part.type === "file") {
            const mediaType: string = part.mediaType ?? "";
            const url: string = part.data instanceof URL
              ? part.data.toString()
              : typeof part.data === "string"
                ? part.data
                : (part.url ?? "");
            const xaiFileId =
              part.providerOptions?.xai?.fileId ??
              part.providerMetadata?.xai?.fileId ??
              params.attachmentsByUrl.get(url);

            if (mediaType.startsWith("image/") && url) {
              parts.push({ type: "input_image", image_url: url });
            } else if (xaiFileId) {
              parts.push({ type: "input_file", file_id: xaiFileId });
            }
          }
        }
      }
      if (parts.length > 0) result.push({ role: "user", content: parts });
      continue;
    }

    if (msg.role === "assistant") {
      const text =
        typeof msg.content === "string"
          ? msg.content
          : (msg.content as any[])
              .filter((p) => p.type === "text")
              .map((p) => p.text)
              .join("");
      if (text) {
        result.push({
          role: "assistant",
          content: [{ type: "input_text", text }],
        });
      }
      continue;
    }
  }

  return result;
}

export interface ResponsesUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens?: number;
  input_tokens_details?: { cached_tokens?: number };
  output_tokens_details?: { reasoning_tokens?: number };
  cost_in_usd_ticks?: number;
  num_sources_used?: number;
  num_server_side_tools_used?: number;
  server_side_tool_usage_details?: {
    document_search_calls?: number;
    web_search_calls?: number;
    x_search_calls?: number;
    code_interpreter_calls?: number;
    file_search_calls?: number;
    mcp_calls?: number;
  };
}

export type ResponsesStreamEvent =
  | { type: "text-delta"; delta: string }
  | { type: "completed"; usage?: ResponsesUsage; modelId?: string }
  | { type: "error"; error: string }
  | { type: "raw"; raw: any };

/**
 * Streaming запрос к POST /v1/responses. Парсит SSE chunks и эмиттит
 * нормализованные события. Сейчас распознаёт минимум: text-delta + completed.
 * Прочие event types отдаются как `raw` для логирования и debug.
 *
 * Source: https://docs.x.ai/api-reference (POST /v1/responses, stream:true)
 */
export async function* streamXaiResponses(params: {
  modelId: string;
  input: ResponsesInputItem[];
  /** Sticky routing для xAI prompt cache. Тот же chatId. */
  conversationId?: string;
  signal?: AbortSignal;
}): AsyncGenerator<ResponsesStreamEvent> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("XAI_API_KEY is not set");

  const body = {
    model: params.modelId,
    input: params.input,
    stream: true,
  };

  const r = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(params.conversationId
        ? { "x-grok-conv-id": params.conversationId }
        : {}),
    },
    body: JSON.stringify(body),
    signal: params.signal,
  });

  if (!r.ok || !r.body) {
    const errBody = await r.text().catch(() => "");
    yield { type: "error", error: `xAI Responses ${r.status}: ${errBody.slice(0, 300)}` };
    return;
  }

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let eolIdx: number;
      while ((eolIdx = buffer.indexOf("\n\n")) !== -1) {
        const chunk = buffer.slice(0, eolIdx);
        buffer = buffer.slice(eolIdx + 2);
        const dataLine = chunk
          .split("\n")
          .find((l) => l.startsWith("data:"));
        if (!dataLine) continue;
        const data = dataLine.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          const eventType: string = parsed.type ?? "";

          if (eventType === "response.output_text.delta") {
            const delta: string = parsed.delta ?? "";
            if (delta) yield { type: "text-delta", delta };
          } else if (
            eventType === "response.completed" ||
            eventType === "response.done"
          ) {
            yield {
              type: "completed",
              usage: parsed.response?.usage,
              modelId: parsed.response?.model,
            };
          } else if (
            eventType === "response.failed" ||
            eventType === "response.error" ||
            eventType === "error"
          ) {
            yield {
              type: "error",
              error: parsed.error?.message ?? parsed.message ?? JSON.stringify(parsed),
            };
          } else {
            yield { type: "raw", raw: parsed };
          }
        } catch (e) {
          // Игнор malformed chunk — следующий event может быть валидным.
          console.warn("[xai-responses] failed to parse SSE chunk:", data.slice(0, 200));
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
