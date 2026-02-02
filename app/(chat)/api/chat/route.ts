import { geolocation } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from "ai";
import { unstable_cache as cache } from "next/cache";
import type { ModelCatalog } from "tokenlens/core";
import { fetchModels } from "tokenlens/fetch";
import { getUsage } from "tokenlens/helpers";
import { auth } from "@/app/(auth)/auth";
import type { VisibilityType } from "@/components/visibility-selector";
import { userEntitlements } from "@/lib/ai/entitlements";
import type { ChatModel } from "@/lib/ai/models";
import { buildChatPrompt, type BuildContext } from "@/lib/prompts";
import { myProvider } from "@/lib/ai/providers";
import { createDocument } from "@/lib/ai/tools/create-document";
import { parseExcel } from "@/lib/ai/tools/excel";
import { getCurrentDate } from "@/lib/ai/tools/get-current-date";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { readDocument } from "@/lib/ai/tools/read-document";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { webSearch } from "@/lib/ai/tools/web-search";
import { isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  getUserById,
  saveChat,
  saveMessages,
  updateChatLastContextById,
  updateChatTitle,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { convertToUIMessages, estimateMessageTokens, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 180; // 3 minutes - increased for complex document generation

const getTokenlensCatalog = cache(
  async (): Promise<ModelCatalog | undefined> => {
    try {
      return await fetchModels();
    } catch (err) {
      console.warn(
        "TokenLens: catalog fetch failed, using default catalog",
        err
      );
      return; // tokenlens helpers will fall back to defaultCatalog
    }
  },
  ["tokenlens-catalog"],
  { revalidate: 24 * 60 * 60 } // 24 hours
);

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel["id"];
      selectedVisibilityType: VisibilityType;
    } = requestBody;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    // Performance: Parallelize independent DB queries
    const [userProfile, messageCount, chat] = await Promise.all([
      getUserById(session.user.id),
      getMessageCountByUserId({ id: session.user.id, differenceInHours: 24 }),
      getChatById({ id }),
    ]);

    // User profile will be passed to buildChatPrompt later

    if (messageCount > userEntitlements.maxMessagesPerDay) {
      return new ChatSDKError("rate_limit:chat").toResponse();
    }

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError("forbidden:chat").toResponse();
      }
    } else {
      // Performance: Save chat with temporary title, generate real title in background
      await saveChat({
        id,
        userId: session.user.id,
        title: "Новый чат",
        visibility: selectedVisibilityType,
      });

      // Generate title in background (non-blocking)
      generateTitleFromUserMessage({ message })
        .then((title) => updateChatTitle({ chatId: id, title }))
        .catch((err) => console.warn("Background title generation failed:", err));
      // ТЗ-4: Greeting НЕ добавляется как сообщение — используем UI с заголовком + suggested actions
    }

    // Вычисляем токены нового user message
    const newMessageTokens = estimateMessageTokens(message.parts);
    console.log(
      `[Token Aware] Chat ${id}: New user message has ~${newMessageTokens} tokens`
    );

    // Загружаем сообщения с учётом токенов нового сообщения
    // maxTokens = 140K, оставляем ~60K для system prompt (10K) + response (50K)
    const messagesFromDb = await getMessagesByChatId({
      id,
      maxTokens: 140000 - newMessageTokens, // Вычитаем токены нового сообщения
      minMessages: 20,
    });

    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    // Подсчитываем общее количество токенов в контексте
    const totalHistoryTokens = messagesFromDb.reduce((sum, msg) => {
      return sum + (msg.tokenCount || estimateMessageTokens(msg.parts as any));
    }, 0);

    console.log(
      `[Token Aware] Chat ${id}: Total context = ${totalHistoryTokens + newMessageTokens} tokens ` +
      `(${messagesFromDb.length} history messages + 1 new message)`
    );

    const { longitude, latitude, city, country } = geolocation(request);

    // Build context for new prompt system
    const promptContext: BuildContext = {
      user: userProfile ? {
        displayName: userProfile.displayName,
        pronouns: userProfile.pronouns,
        occupation: userProfile.occupation,
        bio: userProfile.bio,
      } : undefined,
      requestHints: {
        longitude: longitude ?? undefined,
        latitude: latitude ?? undefined,
        city: city ?? undefined,
        country: country ?? undefined,
      },
    };

    await saveMessages({
      messages: [
        {
          chatId: id,
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
    await createStreamId({ streamId, chatId: id });

    let finalMergedUsage: AppUsage | undefined;

    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        // ТЗ-NEW-01: Build system prompt using new prompt system
        const builtPrompt = buildChatPrompt(promptContext);
        const systemPromptText = builtPrompt.systemPrompt;

        // Use selected model (default to gemini-3-pro for "auto")
        const modelToUse = selectedChatModel === "auto" ? "gemini-3-pro" : selectedChatModel;

        const startTime = Date.now();
        let firstTokenTime: number | null = null;

        const result = streamText({
          model: myProvider.languageModel(modelToUse),
          system: systemPromptText,
          messages: convertToModelMessages(uiMessages),
          // Gemini works best when creativity budget is not artificially limited
          temperature: 1.0,
          providerOptions: {
            google: {
              thinkingConfig: {
                thinkingBudget: 1024,
              },
            },
          },
          stopWhen: stepCountIs(5),
          experimental_activeTools: [
            "getCurrentDate",
            "getWeather",
            "readDocument",
            "webSearch",
            "createDocument",
            "updateDocument",
            "requestSuggestions",
            "parseExcel",
          ],
          experimental_transform: smoothStream({ chunking: "word" }),
          tools: {
            getCurrentDate,
            getWeather,
            readDocument,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
            webSearch,
            parseExcel,
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text",
          },
          onFinish: async ({ usage }) => {
            const totalTime = Date.now() - startTime;
            if (firstTokenTime === null) {
              firstTokenTime = totalTime;
            }
            console.log(
              `[Performance] Chat ${id}: TTFT = ${firstTokenTime}ms, Total = ${totalTime}ms`
            );
            try {
              const providers = await getTokenlensCatalog();
              const modelId =
                myProvider.languageModel(selectedChatModel).modelId;
              if (!modelId) {
                finalMergedUsage = usage;
                dataStream.write({
                  type: "data-usage",
                  data: finalMergedUsage,
                });
                return;
              }

              if (!providers) {
                finalMergedUsage = usage;
                dataStream.write({
                  type: "data-usage",
                  data: finalMergedUsage,
                });
                return;
              }

              const summary = getUsage({ modelId, usage, providers });
              finalMergedUsage = { ...usage, ...summary, modelId } as AppUsage;
              dataStream.write({ type: "data-usage", data: finalMergedUsage });
            } catch (err) {
              console.warn("TokenLens enrichment failed", err);
              finalMergedUsage = usage;
              dataStream.write({ type: "data-usage", data: finalMergedUsage });
            }
          },
        });

        result.consumeStream();

        const baseStream = result.toUIMessageStream({
          sendReasoning: true,
        });

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
                  `[Performance] Chat ${id}: first chunk = ${firstTokenTime}ms`
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
          // Filter out tool results to prevent context overflow
          // Tool results are needed only during response generation, not in history
          const filteredParts = currentMessage.parts.filter((part: any) => {
            const type = part.type;

            // Keep text and step markers
            if (type === 'text' || type === 'step-start' || type === 'step-finish') {
              return true;
            }

            // Keep artifact tool results (createDocument, updateDocument)
            // These are small and needed to render artifact buttons after reload
            if (type === 'tool-createDocument' || type === 'tool-updateDocument') {
              return true;
            }

            // Filter out other tool calls and results (web search, etc.)
            return false;
          });

          const tokenCount = estimateMessageTokens(filteredParts);

          return {
            id: currentMessage.id,
            role: currentMessage.role,
            parts: filteredParts,
            createdAt: new Date(),
            attachments: [],
            chatId: id,
            tokenCount,
          };
        });

        // Логируем сохранение ассистент-сообщений
        const totalTokens = messagesToSave.reduce((sum, msg) => sum + (msg.tokenCount || 0), 0);
        console.log(
          `[Token Aware] Chat ${id}: Saving ${messagesToSave.length} assistant message(s) with ~${totalTokens} tokens`
        );

        await saveMessages({ messages: messagesToSave });

        if (finalMergedUsage) {
          try {
            await updateChatLastContextById({
              chatId: id,
              context: finalMergedUsage,
            });
          } catch (err) {
            console.warn("Unable to persist last usage for chat", id, err);
          }
        }
      },
      onError: () => {
        return "Oops, an error occurred!";
      },
    });

    return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    // Check for Vercel AI Gateway credit card error
    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new ChatSDKError("bad_request:activate_gateway").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatSDKError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
