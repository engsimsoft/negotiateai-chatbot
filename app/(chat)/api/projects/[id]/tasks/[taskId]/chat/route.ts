import {
  convertToCoreMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from "ai";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { buildTaskExpertPrompt } from "@/lib/prompts/build-task-expert-prompt";
import { myProvider } from "@/lib/ai/providers";
import { getStandardTools, getActiveToolNames } from "@/lib/ai/tools/chat-tools";
import { isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  getCompletedTaskSummaries,
  getMessagesByChatId,
  getProjectById,
  getProjectTaskById,
  saveMessages,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { convertToUIMessages, estimateMessageTokens, generateUUID } from "@/lib/utils";

export const maxDuration = 180;

// Simplified schema for task chat — no model selector, no visibility, no projectModelTier
const textPartSchema = z.object({
  type: z.enum(["text"]),
  text: z.string().min(1).max(2000),
});

const taskChatRequestSchema = z.object({
  id: z.string().uuid(), // chatId
  message: z.object({
    id: z.string().uuid(),
    role: z.enum(["user"]),
    parts: z.array(textPartSchema),
  }),
  projectId: z.string().uuid(),
  taskId: z.string().uuid(),
});

type TaskChatRequest = z.infer<typeof taskChatRequestSchema>;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  let requestBody: TaskChatRequest;

  try {
    const json = await request.json();
    requestBody = taskChatRequestSchema.parse(json);
  } catch (_error) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  try {
    const { id: chatId, message, projectId, taskId } = requestBody;
    const { id: paramProjectId, taskId: paramTaskId } = await params;

    // Verify URL params match body
    if (projectId !== paramProjectId || taskId !== paramTaskId) {
      return new ChatSDKError("bad_request:api", "URL params mismatch").toResponse();
    }

    const session = await auth();
    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    // Parallel: load project + task
    const [project, task] = await Promise.all([
      getProjectById({ id: projectId }),
      getProjectTaskById({ taskId, projectId }),
    ]);

    // Guards
    if (!project || project.userId !== session.user.id) {
      return new ChatSDKError("forbidden:chat", "Project not found or access denied").toResponse();
    }

    if (!task) {
      return new ChatSDKError("not_found:chat", "Task not found").toResponse();
    }

    if (task.chatId !== chatId) {
      return new ChatSDKError("forbidden:chat", "Chat does not belong to this task").toResponse();
    }

    // Load messages + completed tasks in parallel
    const newMessageTokens = estimateMessageTokens(message.parts);
    const [messagesFromDb, completedTasks] = await Promise.all([
      getMessagesByChatId({
        id: chatId,
        maxTokens: 140000 - newMessageTokens,
        minMessages: 20,
      }),
      getCompletedTaskSummaries({ projectId }),
    ]);

    const uiMessages = [...convertToUIMessages(messagesFromDb), message as any];

    // Build expert prompt
    const systemPromptText = buildTaskExpertPrompt({
      project,
      task,
      completedTasks,
      manifest: project.manifestJson,
    });

    // Save user message before streaming
    await saveMessages({
      messages: [
        {
          chatId,
          id: message.id,
          role: "user",
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
          tokenCount: estimateMessageTokens(message.parts),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId });

    // Model: env variable with fallback
    const expertModelId = process.env.EXPERT_MODEL || "gemini-3-pro";
    const modelToUse = myProvider.languageModel(expertModelId);
    const isProjectChat = true;

    const startTime = Date.now();
    let firstTokenTime: number | null = null;

    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        const result = streamText({
          model: modelToUse,
          system: systemPromptText,
          messages: convertToCoreMessages(uiMessages),
          temperature: 1.0,
          stopWhen: stepCountIs(5),
          experimental_activeTools: getActiveToolNames(isProjectChat),
          experimental_transform: smoothStream({ chunking: "word" }),
          tools: getStandardTools({ session, dataStream, isProjectChat }),
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-task-expert",
          },
          onFinish: async ({ usage }) => {
            const totalTime = Date.now() - startTime;
            if (firstTokenTime === null) {
              firstTokenTime = totalTime;
            }
            console.log(
              `[TaskExpert] Task ${taskId}: TTFT = ${firstTokenTime}ms, Total = ${totalTime}ms, Usage = ${JSON.stringify(usage)}`
            );
          },
        });

        result.consumeStream();

        const baseStream = result.toUIMessageStream({
          sendReasoning: true,
        });

        // Instrumented stream with TTFT tracking
        const instrumentedStream = new ReadableStream({
          async start(controller) {
            const reader = baseStream.getReader();
            const ignoredTypes = new Set([
              "response-metadata",
              "data-usage",
              "tool-call",
              "tool-result",
              "tool-error",
            ]);

            while (true) {
              const { value, done } = await reader.read();
              if (done) {
                controller.close();
                break;
              }

              if (
                firstTokenTime === null &&
                value &&
                typeof value === "object" &&
                "type" in value &&
                !ignoredTypes.has((value as any).type)
              ) {
                firstTokenTime = Date.now() - startTime;
                console.log(
                  `[TaskExpert] Task ${taskId}: first chunk = ${firstTokenTime}ms`
                );
              }

              controller.enqueue(value);
            }
          },
        });

        dataStream.merge(instrumentedStream);
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        const messagesToSave = messages.map((currentMessage) => {
          const filteredParts = currentMessage.parts.filter((part: any) => {
            const type = part.type;
            if (type === "text" || type === "step-start" || type === "step-finish") {
              return true;
            }
            if (type === "tool-createDocument" || type === "tool-updateDocument") {
              return true;
            }
            return false;
          });

          return {
            id: currentMessage.id,
            role: currentMessage.role,
            parts: filteredParts,
            createdAt: new Date(),
            attachments: [],
            chatId,
            tokenCount: estimateMessageTokens(filteredParts),
          };
        });

        await saveMessages({ messages: messagesToSave });
      },
      onError: () => {
        return "Oops, an error occurred!";
      },
    });

    return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    console.error("[TaskExpert] Unhandled error:", error);
    return new ChatSDKError("offline:chat").toResponse();
  }
}
