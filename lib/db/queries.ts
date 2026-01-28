import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  type SQL,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { ArtifactKind } from "@/components/artifact";
import type { VisibilityType } from "@/components/visibility-selector";
import { ChatSDKError } from "../errors";
import type { AppUsage } from "../usage";
import { estimateMessageTokens, generateUUID } from "../utils";
import {
  type Agent,
  agent,
  type Chat,
  chat,
  type DBMessage,
  document,
  message,
  type Suggestion,
  stream,
  suggestion,
  type User,
  user,
  type UserAgent,
  userAgent,
  vote,
} from "./schema";
import { generateHashedPassword } from "./utils";

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export async function getUser(email: string): Promise<User[]> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user by email"
    );
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db.insert(user).values({ email, password: hashedPassword });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to create user");
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
  agentId,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
  agentId?: string;
}) {
  try {
    console.log('[saveChat] Attempting to save chat:', { id, userId, title, visibility, agentId });
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
      agentId,
    });
  } catch (error) {
    console.error('[saveChat] Database error:', error);
    throw new ChatSDKError("bad_request:database", "Failed to save chat");
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete chat by id"
    );
  }
}

export async function deleteAllChatsByUserId({ userId }: { userId: string }) {
  try {
    const userChats = await db
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.userId, userId));

    if (userChats.length === 0) {
      return { deletedCount: 0 };
    }

    const chatIds = userChats.map(c => c.id);

    await db.delete(vote).where(inArray(vote.chatId, chatIds));
    await db.delete(message).where(inArray(message.chatId, chatIds));
    await db.delete(stream).where(inArray(stream.chatId, chatIds));

    const deletedChats = await db
      .delete(chat)
      .where(eq(chat.userId, userId))
      .returning();

    return { deletedCount: deletedChats.length };
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete all chats by user id"
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<any>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id)
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Chat[] = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          "not_found:database",
          `Chat with id ${startingAfter} not found`
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          "not_found:database",
          `Chat with id ${endingBefore} not found`
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get chats by user id"
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    if (!selectedChat) {
      return null;
    }

    return selectedChat;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to get chat by id");
  }
}

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    return await db.insert(message).values(messages);
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save messages");
  }
}

export async function getMessagesByChatId({
  id,
  maxTokens = 140000,
  minMessages = 20,
}: {
  id: string;
  maxTokens?: number;
  minMessages?: number;
}) {
  try {
    // Загружаем все сообщения от новых к старым
    const allMessages = await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(desc(message.createdAt));

    if (allMessages.length === 0) {
      return [];
    }

    // Стратегия Token-Aware Sliding Window:
    // 1. Всегда загружаем минимум minMessages последних сообщений
    // 2. Добавляем старые сообщения, пока не превысим maxTokens
    // 3. Graceful degradation: если tokenCount = null, оцениваем на лету

    const selectedMessages: DBMessage[] = [];
    let currentTokens = 0;
    let messagesWithFallback = 0; // Счётчик сообщений без tokenCount

    console.log(
      `[Token Aware] Chat ${id}: Starting to load messages (total in DB: ${allMessages.length}, limit: ${maxTokens} tokens, minMessages: ${minMessages})`
    );

    for (let i = 0; i < allMessages.length; i++) {
      const msg = allMessages[i];

      // Получаем количество токенов (с fallback на оценку)
      const msgTokens = msg.tokenCount || estimateMessageTokens(msg.parts as any);

      // Отслеживаем fallback
      if (!msg.tokenCount) {
        messagesWithFallback++;
      }

      // Всегда берём первые minMessages (самые новые)
      if (i < minMessages) {
        selectedMessages.push(msg);
        currentTokens += msgTokens;
        continue;
      }

      // После minMessages - проверяем лимит
      if (currentTokens + msgTokens > maxTokens) {
        // Достигли лимита - прекращаем загрузку
        console.log(
          `[Token Aware] Chat ${id}: Reached token limit! ` +
          `Loaded ${selectedMessages.length}/${allMessages.length} messages, ~${currentTokens} tokens ` +
          `(${messagesWithFallback} messages used fallback estimation)`
        );
        break;
      }

      selectedMessages.push(msg);
      currentTokens += msgTokens;
    }

    // Если загрузили все сообщения - логируем
    if (selectedMessages.length === allMessages.length) {
      console.log(
        `[Token Aware] Chat ${id}: Loaded ALL ${selectedMessages.length} messages, ~${currentTokens} tokens ` +
        `(${messagesWithFallback} messages used fallback estimation)`
      );
    }

    // Возвращаем в правильном порядке (от старых к новым)
    return selectedMessages.reverse();
  } catch (error) {
    console.error(`[Token Aware] Error in getMessagesByChatId for chat ${id}:`, error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get messages by chat id"
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === "up" })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === "up",
    });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to vote message");
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get votes by chat id"
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    return await db
      .insert(document)
      .values({
        id,
        title,
        kind,
        content,
        userId,
        createdAt: new Date(),
      })
      .returning();
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save document");
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get documents by id"
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get document by id"
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp)
        )
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete documents by id after timestamp"
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to save suggestions"
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(and(eq(suggestion.documentId, documentId)));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get suggestions by document id"
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get message by id"
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp))
      );

    const messageIds = messagesToDelete.map(
      (currentMessage) => currentMessage.id
    );

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds))
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds))
        );
    }
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete messages by chat id after timestamp"
    );
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: "private" | "public";
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update chat visibility by id"
    );
  }
}

export async function updateChatLastContextById({
  chatId,
  context,
}: {
  chatId: string;
  // Store merged server-enriched usage object
  context: AppUsage;
}) {
  try {
    return await db
      .update(chat)
      .set({ lastContext: context })
      .where(eq(chat.id, chatId));
  } catch (error) {
    console.warn("Failed to update lastContext for chat", chatId, error);
    return;
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, twentyFourHoursAgo),
          eq(message.role, "user")
        )
      )
      .execute();

    return stats?.count ?? 0;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get message count by user id"
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create stream id"
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get stream ids by chat id"
    );
  }
}

// ============================================
// Public Share Functions
// ============================================

/**
 * Generate a unique share token (32 characters)
 */
function generateShareToken(): string {
  return generateUUID().replace(/-/g, "");
}

/**
 * Create a public share link for a document.
 * Only the document owner can share it.
 */
export async function shareDocument({
  documentId,
  userId,
}: {
  documentId: string;
  userId: string;
}) {
  try {
    // Get the latest version of the document
    const latestDoc = await getDocumentById({ id: documentId });

    if (!latestDoc) {
      throw new ChatSDKError("not_found:database", "Document not found");
    }

    // Verify ownership
    if (latestDoc.userId !== userId) {
      throw new ChatSDKError(
        "forbidden:database",
        "Only the document owner can share it"
      );
    }

    // If already shared, return existing token
    if (latestDoc.isPublic && latestDoc.shareToken) {
      return {
        shareToken: latestDoc.shareToken,
        alreadyShared: true,
      };
    }

    // Generate new share token
    const shareToken = generateShareToken();

    // Update the document with share info
    await db
      .update(document)
      .set({
        isPublic: true,
        shareToken,
        sharedAt: new Date(),
      })
      .where(
        and(
          eq(document.id, documentId),
          eq(document.createdAt, latestDoc.createdAt)
        )
      );

    return {
      shareToken,
      alreadyShared: false,
    };
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError("bad_request:database", "Failed to share document");
  }
}

/**
 * Revoke a public share link for a document.
 * Only the document owner can unshare it.
 */
export async function unshareDocument({
  documentId,
  userId,
}: {
  documentId: string;
  userId: string;
}) {
  try {
    // Get the latest version of the document
    const latestDoc = await getDocumentById({ id: documentId });

    if (!latestDoc) {
      throw new ChatSDKError("not_found:database", "Document not found");
    }

    // Verify ownership
    if (latestDoc.userId !== userId) {
      throw new ChatSDKError(
        "forbidden:database",
        "Only the document owner can unshare it"
      );
    }

    // If not shared, nothing to do
    if (!latestDoc.isPublic) {
      return { wasShared: false };
    }

    // Remove share info
    await db
      .update(document)
      .set({
        isPublic: false,
        shareToken: null,
        sharedAt: null,
      })
      .where(
        and(
          eq(document.id, documentId),
          eq(document.createdAt, latestDoc.createdAt)
        )
      );

    return { wasShared: true };
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to unshare document"
    );
  }
}

/**
 * Get a document by its public share token.
 * No authentication required - this is for public access.
 */
export async function getPublicDocument({ token }: { token: string }) {
  try {
    // Find document by share token
    const [sharedDoc] = await db
      .select()
      .from(document)
      .where(and(eq(document.shareToken, token), eq(document.isPublic, true)))
      .orderBy(desc(document.createdAt))
      .limit(1);

    if (!sharedDoc) {
      return null;
    }

    // Return only public-safe fields (no userId for privacy)
    return {
      id: sharedDoc.id,
      title: sharedDoc.title,
      content: sharedDoc.content,
      kind: sharedDoc.kind,
      createdAt: sharedDoc.createdAt,
      sharedAt: sharedDoc.sharedAt,
    };
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get public document"
    );
  }
}

// ============================================
// Agent Functions (ТЗ-1)
// ============================================

/**
 * Get all active catalog agents ordered by sortOrder
 */
export async function getAgents(): Promise<Agent[]> {
  try {
    return await db
      .select()
      .from(agent)
      .where(eq(agent.isActive, true))
      .orderBy(asc(agent.sortOrder));
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to get agents");
  }
}

/**
 * Get agent by slug
 */
export async function getAgentBySlug({
  slug,
}: {
  slug: string;
}): Promise<Agent | null> {
  try {
    const [selectedAgent] = await db
      .select()
      .from(agent)
      .where(and(eq(agent.slug, slug), eq(agent.isActive, true)));
    return selectedAgent || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get agent by slug"
    );
  }
}

/**
 * Get agent by ID
 */
export async function getAgentById({
  id,
}: {
  id: string;
}): Promise<Agent | null> {
  try {
    const [selectedAgent] = await db
      .select()
      .from(agent)
      .where(eq(agent.id, id));
    return selectedAgent || null;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to get agent by id");
  }
}

/**
 * Get user's personal agents
 */
export async function getUserAgents({
  userId,
}: {
  userId: string;
}): Promise<UserAgent[]> {
  try {
    return await db
      .select()
      .from(userAgent)
      .where(and(eq(userAgent.userId, userId), eq(userAgent.isActive, true)));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user agents"
    );
  }
}

/**
 * Get user agent by ID
 */
export async function getUserAgentById({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<UserAgent | null> {
  try {
    const [selectedUserAgent] = await db
      .select()
      .from(userAgent)
      .where(and(eq(userAgent.id, id), eq(userAgent.userId, userId)));
    return selectedUserAgent || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user agent by id"
    );
  }
}

/**
 * Update chat agent
 */
export async function updateChatAgent({
  chatId,
  agentId,
  userId,
}: {
  chatId: string;
  agentId: string;
  userId: string;
}) {
  try {
    // Verify chat ownership
    const [existingChat] = await db
      .select()
      .from(chat)
      .where(and(eq(chat.id, chatId), eq(chat.userId, userId)));

    if (!existingChat) {
      throw new ChatSDKError("not_found:database", "Chat not found");
    }

    return await db
      .update(chat)
      .set({ agentId })
      .where(eq(chat.id, chatId));
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update chat agent"
    );
  }
}
