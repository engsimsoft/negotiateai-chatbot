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
  isNull,
  notInArray,
  lt,
  sql,
  type SQL,
} from "drizzle-orm";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import type { ArtifactKind } from "@/components/artifact";
import type { VisibilityType } from "@/components/visibility-selector";
import type { BriefingArticle } from "../briefing/briefing-types";
import { ChatSDKError } from "../errors";
import type { AppUsage } from "../usage";
import { estimateMessageTokens, generateUUID } from "../utils";
import {
  aiUsageLog,
  type BriefingHistory,
  type BriefingSettings,
  type BriefingSource,
  type BriefingTopic,
  briefingHistory,
  briefingSettings,
  briefingSources,
  briefingTopics,
  type Chat,
  chat,
  type ContextState,
  type DBMessage,
  document,
  message,
  type Project,
  project,
  type ProjectFile,
  projectFile,
  type ProjectFolder,
  projectFolder,
  type ProjectTask,
  projectTask,
  type SavedBriefingTopic,
  savedBriefingTopics,
  type SnapshotMeta,
  type Suggestion,
  stream,
  suggestion,
  type TelegramConnection,
  telegramConnection,
  type TelegramGroup,
  telegramGroup,
  type TelegramGroupTopic,
  telegramGroupTopic,
  type TelegramLinkToken,
  telegramLinkToken,
  telegramMessage,
  type TelegramMessage,
  type MeetingRecord,
  meetingRecord,
  type CronRunLog,
  cronRunLog,
  type User,
  user,
  vote,
} from "./schema";
import { generateHashedPassword } from "./utils";

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// Neon serverless driver: WebSocket-based, no TCP ECONNRESET
// Handles reconnection natively, serverless-compatible
neonConfig.webSocketConstructor = ws;
// biome-ignore lint: Forbidden non-null assertion.
const pool = new Pool({ connectionString: process.env.POSTGRES_URL! });
const db = drizzle(pool);

export async function getUser(email: string): Promise<User[]> {
  try {
    return await db.select().from(user).where(eq(user.email, email.toLowerCase()));
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
    return await db.insert(user).values({ email: email.toLowerCase(), password: hashedPassword });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to create user");
  }
}

export async function getUserById(id: string): Promise<User | null> {
  try {
    const [result] = await db.select().from(user).where(eq(user.id, id));
    return result || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user by id"
    );
  }
}

export async function updateUserProfile({
  id,
  displayName,
  pronouns,
  occupation,
  bio,
  theme,
}: {
  id: string;
  displayName?: string | null;
  pronouns?: string | null;
  occupation?: string | null;
  bio?: string | null;
  theme?: string | null;
}) {
  try {
    const updateData: Record<string, string | null> = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (pronouns !== undefined) updateData.pronouns = pronouns;
    if (occupation !== undefined) updateData.occupation = occupation;
    if (bio !== undefined) updateData.bio = bio;
    if (theme !== undefined) updateData.theme = theme;

    return await db
      .update(user)
      .set(updateData)
      .where(eq(user.id, id))
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update user profile"
    );
  }
}

// ТЗ-NEW-01: Update Ben intro flag
export async function updateUserBenIntro({
  id,
  hasSeenBenIntro,
}: {
  id: string;
  hasSeenBenIntro: boolean;
}) {
  try {
    return await db
      .update(user)
      .set({ hasSeenBenIntro })
      .where(eq(user.id, id))
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update Ben intro flag"
    );
  }
}

// ТЗ-BF2: Update last seen Simply News version
export async function updateLastSeenSimplyVersion({
  userId,
  version,
}: {
  userId: string;
  version: string;
}) {
  try {
    return await db
      .update(user)
      .set({ lastSeenSimplyVersion: version })
      .where(eq(user.id, userId))
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update last seen Simply version"
    );
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
  projectId,
  chatMode,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
  projectId?: string;
  chatMode?: string;
}) {
  try {
    console.log('[saveChat] Attempting to save chat:', { id, userId, title, visibility, projectId, chatMode });
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
      projectId: projectId || null,
      chatMode: chatMode || "chat",
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
    await db.delete(aiUsageLog).where(eq(aiUsageLog.chatId, id));

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
    // ТЗ-03: Only delete free chats (projectId = null), not project chats
    const userChats = await db
      .select({ id: chat.id })
      .from(chat)
      .where(and(eq(chat.userId, userId), isNull(chat.projectId)));

    if (userChats.length === 0) {
      return { deletedCount: 0 };
    }

    const chatIds = userChats.map(c => c.id);

    await db.delete(vote).where(inArray(vote.chatId, chatIds));
    await db.delete(message).where(inArray(message.chatId, chatIds));
    await db.delete(stream).where(inArray(stream.chatId, chatIds));
    await db.delete(aiUsageLog).where(inArray(aiUsageLog.chatId, chatIds));

    const deletedChats = await db
      .delete(chat)
      .where(and(eq(chat.userId, userId), isNull(chat.projectId)))
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
  chatMode,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
  chatMode?: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    // Performance: Exclude lastContext (heavy JSONB) from history listing
    // ТЗ-03: Filter out project chats - only show free chats (projectId = null)
    // ТЗ-RG: Filter by chatMode when provided
    const baseCondition = and(
      eq(chat.userId, id),
      isNull(chat.projectId),
      chatMode ? eq(chat.chatMode, chatMode) : undefined
    );

    const query = (whereCondition?: SQL<any>) =>
      db
        .select({
          id: chat.id,
          createdAt: chat.createdAt,
          title: chat.title,
          userId: chat.userId,
          projectId: chat.projectId,
          chatMode: chat.chatMode,
          isRenamed: chat.isRenamed,
          summary: chat.summary,
          isStarred: chat.isStarred,
          taskStatus: chat.taskStatus,
          visibility: chat.visibility,
          lastContext: sql<null>`NULL`.as("lastContext"),
          snapshots: sql<null>`NULL`.as("snapshots"),
          contextState: sql<null>`NULL`.as("contextState"),
        })
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, baseCondition)
            : baseCondition
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
    return selectedChat || null;
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
  maxMessages = 200, // Hard limit to prevent loading thousands of messages
}: {
  id: string;
  maxTokens?: number;
  minMessages?: number;
  maxMessages?: number;
}) {
  try {
    // Performance: Load only last N messages from DB (not all)
    const allMessages = await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(desc(message.createdAt))
      .limit(maxMessages);

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

/**
 * Get votes with chat ownership verification in a single query
 * Optimized: Combines chat lookup + votes fetch into one query
 * Returns null if chat doesn't exist or user doesn't own it
 */
export async function getVotesByChatIdWithAuth({
  chatId,
  userId,
}: {
  chatId: string;
  userId: string;
}) {
  try {
    // First verify chat ownership
    const [chatOwner] = await db
      .select({ userId: chat.userId })
      .from(chat)
      .where(eq(chat.id, chatId))
      .limit(1);

    if (!chatOwner) {
      return { error: "not_found" as const, votes: null };
    }

    if (chatOwner.userId !== userId) {
      return { error: "forbidden" as const, votes: null };
    }

    // Then get votes (now we know chat exists and user owns it)
    const votes = await db.select().from(vote).where(eq(vote.chatId, chatId));

    return { error: null, votes };
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

export async function updateChatTitle({
  chatId,
  title,
}: {
  chatId: string;
  title: string;
}) {
  try {
    return await db.update(chat).set({ title }).where(eq(chat.id, chatId));
  } catch (_error) {
    console.warn("Failed to update chat title:", _error);
    // Don't throw - title update is non-critical
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
// Project Functions (ТЗ-03)
// ============================================

/**
 * Get all projects for a user
 */
export async function getProjectsByUserId({ userId }: { userId: string }) {
  try {
    const projects = await db
      .select()
      .from(project)
      .where(eq(project.userId, userId))
      .orderBy(desc(project.updatedAt));

    return projects;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get projects by user id"
    );
  }
}

/**
 * Get a single project by ID
 */
export async function getProjectById({ id }: { id: string }) {
  try {
    const [selectedProject] = await db
      .select()
      .from(project)
      .where(eq(project.id, id));

    return selectedProject || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get project by id"
    );
  }
}

/**
 * Create a new project
 */
export async function saveProject({
  id,
  userId,
  name,
  description,
  instruction,
  context,
}: {
  id: string;
  userId: string;
  name: string;
  description?: string;
  instruction?: string;
  context?: string;
}) {
  try {
    const now = new Date();
    const [newProject] = await db
      .insert(project)
      .values({
        id,
        userId,
        name,
        description: description || null,
        instruction: instruction || null,
        context: context || null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return newProject;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save project");
  }
}

/**
 * Update project details
 */
export async function updateProject({
  id,
  name,
  description,
  instruction,
}: {
  id: string;
  name?: string;
  description?: string;
  instruction?: string;
}) {
  try {
    const updateData: Partial<Project> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (instruction !== undefined) updateData.instruction = instruction;

    const [updated] = await db
      .update(project)
      .set(updateData)
      .where(eq(project.id, id))
      .returning();

    return updated;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to update project");
  }
}

/**
 * ТЗ-A1: Update project phase
 */
export async function updateProjectPhase({
  id,
  phase,
}: {
  id: string;
  phase: string;
}) {
  try {
    const [updated] = await db
      .update(project)
      .set({
        phase,
        updatedAt: new Date(),
      })
      .where(eq(project.id, id))
      .returning();

    return updated;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update project phase"
    );
  }
}

/**
 * ТЗ-B1: Update project plan (from Professor)
 */
export async function updateProjectPlan({
  id,
  planJson,
  planReport,
}: {
  id: string;
  planJson: unknown;
  planReport: string;
}) {
  try {
    const [updated] = await db
      .update(project)
      .set({
        planJson,
        planReport,
        updatedAt: new Date(),
      })
      .where(eq(project.id, id))
      .returning();

    return updated;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update project plan"
    );
  }
}

/**
 * ТЗ-07C2: Update project summary (AI-generated from task summaries)
 */
export async function updateProjectSummary({
  id,
  summary,
}: {
  id: string;
  summary: string;
}) {
  try {
    const [updated] = await db
      .update(project)
      .set({
        summary,
        summaryUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(project.id, id))
      .returning();

    return updated;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update project summary"
    );
  }
}

/**
 * Delete a project and all its files and chats (cascade)
 */
export async function deleteProjectById({ id }: { id: string }) {
  try {
    // Delete project tasks (FK: ProjectTask.chatId → Chat.id, must go before chats)
    await db.delete(projectTask).where(eq(projectTask.projectId, id));

    // Get all chats in this project
    const projectChats = await db
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.projectId, id));

    const chatIds = projectChats.map((c) => c.id);

    // Delete all chat-dependent records
    if (chatIds.length > 0) {
      // Delete streams (FK: Stream.chatId → Chat.id)
      await db.delete(stream).where(inArray(stream.chatId, chatIds));

      // Delete votes (FK: Vote_v2.chatId → Chat.id)
      await db.delete(vote).where(inArray(vote.chatId, chatIds));

      // Delete messages (FK: Message_v2.chatId → Chat.id)
      await db.delete(message).where(inArray(message.chatId, chatIds));

      // Delete legacy Vote/Message if they exist
      for (const chatId of chatIds) {
        await db.execute(sql`DELETE FROM "Vote" WHERE "chatId" = ${chatId}`);
        await db.execute(sql`DELETE FROM "Message" WHERE "chatId" = ${chatId}`);
      }

      // Delete chats
      await db.delete(chat).where(inArray(chat.id, chatIds));
    }

    // Delete project files (before folders due to FK: projectFile.folderId → projectFolder.id)
    await db.delete(projectFile).where(eq(projectFile.projectId, id));

    // Delete project folders
    await db.delete(projectFolder).where(eq(projectFolder.projectId, id));

    // Delete project
    await db.delete(project).where(eq(project.id, id));

    return { success: true };
  } catch (error) {
    console.error("[deleteProjectById] Error:", error);
    throw new ChatSDKError("bad_request:database", "Failed to delete project");
  }
}

// ============================================
// ProjectFile Functions (ТЗ-03)
// ============================================

/**
 * Get all files for a project
 */
export async function getFilesByProjectId({ projectId }: { projectId: string }) {
  try {
    const files = await db
      .select()
      .from(projectFile)
      .where(eq(projectFile.projectId, projectId))
      .orderBy(desc(projectFile.createdAt));

    return files;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get files by project id"
    );
  }
}

/**
 * Save a new project file
 */
export async function saveProjectFile({
  id,
  projectId,
  name,
  type,
  mimeType,
  size,
  url,
  metadata,
}: {
  id: string;
  projectId: string;
  name: string;
  type: string;
  mimeType: string;
  size: number;
  url: string;
  metadata?: ProjectFile["metadata"];
}) {
  try {
    const [newFile] = await db
      .insert(projectFile)
      .values({
        id,
        projectId,
        name,
        type,
        mimeType,
        size,
        url,
        metadata: metadata || null,
        createdAt: new Date(),
      })
      .returning();

    // Update project's updatedAt
    await db
      .update(project)
      .set({ updatedAt: new Date() })
      .where(eq(project.id, projectId));

    return newFile;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to save project file"
    );
  }
}

/**
 * Delete a project file
 */
export async function deleteProjectFile({ id }: { id: string }) {
  try {
    const [deleted] = await db
      .delete(projectFile)
      .where(eq(projectFile.id, id))
      .returning();

    if (deleted) {
      // Update project's updatedAt
      await db
        .update(project)
        .set({ updatedAt: new Date() })
        .where(eq(project.id, deleted.projectId));
    }

    return deleted || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete project file"
    );
  }
}

/**
 * Update project file's folder (ТЗ-07C1)
 */
export async function updateProjectFileFolder({
  fileId,
  folderId,
}: {
  fileId: string;
  folderId: string | null;
}) {
  try {
    const [updated] = await db
      .update(projectFile)
      .set({ folderId })
      .where(eq(projectFile.id, fileId))
      .returning();

    if (updated) {
      await db
        .update(project)
        .set({ updatedAt: new Date() })
        .where(eq(project.id, updated.projectId));
    }

    return updated || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update project file folder"
    );
  }
}

// ============================================
// ProjectFolder Functions (ТЗ-07C1)
// ============================================

/**
 * Get all folders for a project
 */
export async function getProjectFolders({ projectId }: { projectId: string }) {
  try {
    const folders = await db
      .select()
      .from(projectFolder)
      .where(eq(projectFolder.projectId, projectId))
      .orderBy(asc(projectFolder.sortOrder), asc(projectFolder.createdAt));

    return folders;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get project folders"
    );
  }
}

/**
 * Create a new project folder
 */
export async function createProjectFolder({
  projectId,
  name,
  emoji = "📁",
}: {
  projectId: string;
  name: string;
  emoji?: string;
}) {
  try {
    // Get max sortOrder for this project
    const [maxOrder] = await db
      .select({ maxOrder: sql<number>`COALESCE(MAX(${projectFolder.sortOrder}), -1)` })
      .from(projectFolder)
      .where(eq(projectFolder.projectId, projectId));

    const [newFolder] = await db
      .insert(projectFolder)
      .values({
        projectId,
        name,
        emoji,
        sortOrder: (maxOrder?.maxOrder ?? -1) + 1,
        createdAt: new Date(),
      })
      .returning();

    // Update project's updatedAt
    await db
      .update(project)
      .set({ updatedAt: new Date() })
      .where(eq(project.id, projectId));

    return newFolder;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create project folder"
    );
  }
}

/**
 * Update a project folder
 */
export async function updateProjectFolder({
  id,
  name,
  emoji,
}: {
  id: string;
  name?: string;
  emoji?: string;
}) {
  try {
    const updateData: Partial<{ name: string; emoji: string }> = {};
    if (name !== undefined) updateData.name = name;
    if (emoji !== undefined) updateData.emoji = emoji;

    const [updated] = await db
      .update(projectFolder)
      .set(updateData)
      .where(eq(projectFolder.id, id))
      .returning();

    if (updated) {
      await db
        .update(project)
        .set({ updatedAt: new Date() })
        .where(eq(project.id, updated.projectId));
    }

    return updated || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update project folder"
    );
  }
}

/**
 * Delete a project folder (files move to root)
 */
export async function deleteProjectFolder({ id }: { id: string }) {
  try {
    // Move all files from this folder to root (folderId = null)
    await db
      .update(projectFile)
      .set({ folderId: null })
      .where(eq(projectFile.folderId, id));

    // Delete the folder
    const [deleted] = await db
      .delete(projectFolder)
      .where(eq(projectFolder.id, id))
      .returning();

    if (deleted) {
      await db
        .update(project)
        .set({ updatedAt: new Date() })
        .where(eq(project.id, deleted.projectId));
    }

    return deleted || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete project folder"
    );
  }
}

/**
 * Get folder with file count (for delete confirmation)
 */
export async function getProjectFolderWithFileCount({ id }: { id: string }) {
  try {
    const [result] = await db
      .select({
        id: projectFolder.id,
        projectId: projectFolder.projectId,
        name: projectFolder.name,
        emoji: projectFolder.emoji,
        fileCount: sql<number>`COALESCE(COUNT(${projectFile.id}), 0)::int`,
      })
      .from(projectFolder)
      .leftJoin(projectFile, eq(projectFile.folderId, projectFolder.id))
      .where(eq(projectFolder.id, id))
      .groupBy(projectFolder.id);

    return result || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get project folder with file count"
    );
  }
}

/**
 * ТЗ-A3: Get a single project file by ID
 */
export async function getProjectFileById({ id }: { id: string }) {
  try {
    const [file] = await db
      .select()
      .from(projectFile)
      .where(eq(projectFile.id, id));

    return file || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get project file by id"
    );
  }
}

/**
 * ТЗ-C2: Get project file by name (for readProjectFile tool)
 */
export async function getProjectFileByName({
  projectId,
  name,
}: {
  projectId: string;
  name: string;
}) {
  try {
    const [file] = await db
      .select()
      .from(projectFile)
      .where(
        and(eq(projectFile.projectId, projectId), eq(projectFile.name, name))
      );

    return file || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get project file by name"
    );
  }
}

/**
 * ТЗ-A3: Update project file metadata (add analysis results)
 */
export async function updateProjectFileMetadata({
  fileId,
  metadata,
}: {
  fileId: string;
  metadata: ProjectFile["metadata"];
}) {
  try {
    const [updated] = await db
      .update(projectFile)
      .set({ metadata })
      .where(eq(projectFile.id, fileId))
      .returning();

    return updated || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update project file metadata"
    );
  }
}

/**
 * ТЗ-A3: Rebuild project manifest from all analyzed files
 * Aggregates analysis data from all ProjectFiles into Project.manifestJson
 */
export async function rebuildProjectManifest({ projectId }: { projectId: string }) {
  try {
    // Get all files for project
    const files = await db
      .select()
      .from(projectFile)
      .where(eq(projectFile.projectId, projectId))
      .orderBy(asc(projectFile.createdAt));

    // Get all folders for mapping folderId → name
    const folders = await db
      .select()
      .from(projectFolder)
      .where(eq(projectFolder.projectId, projectId));

    const folderMap = new Map(folders.map(f => [f.id, f.name]));

    // Build manifest from files that have analysis
    const manifestFiles = files
      .filter(f => f.metadata && (f.metadata as any).analysis)
      .map(f => {
        const analysis = (f.metadata as any).analysis;
        return {
          fileId: f.id,
          name: f.name,
          description: analysis.description,
          documentType: analysis.documentType,
          folder: f.folderId ? (folderMap.get(f.folderId) || "Без папки") : "Без папки",
          relevance: analysis.relevance,
          keyTopics: analysis.keyTopics,
          language: analysis.language,
        };
      });

    const manifest = {
      files: manifestFiles,
      updatedAt: new Date().toISOString(),
    };

    // Update project
    const [updated] = await db
      .update(project)
      .set({
        manifestJson: manifest,
        updatedAt: new Date(),
      })
      .where(eq(project.id, projectId))
      .returning();

    return updated;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to rebuild project manifest"
    );
  }
}

/**
 * Get chats for a specific project
 */
export async function getChatsByProjectId({ projectId }: { projectId: string }) {
  try {
    const chats = await db
      .select({
        id: chat.id,
        createdAt: chat.createdAt,
        title: chat.title,
        userId: chat.userId,
        projectId: chat.projectId,
        chatMode: chat.chatMode,
        isRenamed: chat.isRenamed,
        summary: chat.summary,
        isStarred: chat.isStarred,
        taskStatus: chat.taskStatus,
        visibility: chat.visibility,
        lastContext: sql<null>`NULL`.as("lastContext"),
      })
      .from(chat)
      .where(and(
        eq(chat.projectId, projectId),
        sql`${chat.title} NOT LIKE '__service:%'`
      ))
      .orderBy(desc(chat.createdAt));

    return chats;
  } catch (error) {
    console.error("[getChatsByProjectId] Error:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get chats by project id"
    );
  }
}

/**
 * Get project with file count and chat count (for listing)
 * Optimized: Single query with LEFT JOINs instead of N+1 queries
 */
export async function getProjectsWithStats({ userId }: { userId: string }) {
  try {
    // Single query with LEFT JOINs and GROUP BY
    // This replaces N+1 queries (1 + N*2) with ONE query
    const result = await db
      .select({
        id: project.id,
        userId: project.userId,
        name: project.name,
        description: project.description,
        instruction: project.instruction,
        phase: project.phase,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        fileCount: sql<number>`COALESCE(COUNT(DISTINCT ${projectFile.id}), 0)::int`,
        chatCount: sql<number>`COALESCE(COUNT(DISTINCT ${chat.id}), 0)::int`,
      })
      .from(project)
      .leftJoin(projectFile, eq(projectFile.projectId, project.id))
      .leftJoin(chat, eq(chat.projectId, project.id))
      .where(eq(project.userId, userId))
      .groupBy(project.id)
      .orderBy(desc(project.updatedAt));

    return result;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get projects with stats"
    );
  }
}

// ============================================
// ProjectTask Functions (ТЗ-B2)
// ============================================

/**
 * Bulk-create project tasks from approved plan
 */
export async function createProjectTasks({
  projectId,
  tasks,
}: {
  projectId: string;
  tasks: Array<{
    orderIndex: number;
    title: string;
    description?: string | null;
    goal?: string | null;
    input?: string | null;
    expectedOutput?: string | null;
    status: "locked" | "pending";
    dependsOn?: number[] | null;
    tools?: string[] | null;
    needsReview: boolean;
  }>;
}) {
  try {
    const now = new Date();
    const rows = tasks.map((t) => ({
      projectId,
      orderIndex: t.orderIndex,
      title: t.title,
      description: t.description ?? null,
      goal: t.goal ?? null,
      input: t.input ?? null,
      expectedOutput: t.expectedOutput ?? null,
      status: t.status as "locked" | "pending",
      dependsOn: t.dependsOn ?? null,
      tools: t.tools ?? null,
      needsReview: t.needsReview,
      createdAt: now,
      updatedAt: now,
    }));

    const created = await db.insert(projectTask).values(rows).returning();
    return created;
  } catch (error) {
    console.error("[createProjectTasks] Error:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create project tasks"
    );
  }
}

/**
 * Get all tasks for a project, ordered by orderIndex
 */
export async function getProjectTasksByProjectId({
  projectId,
}: {
  projectId: string;
}) {
  try {
    const tasks = await db
      .select()
      .from(projectTask)
      .where(eq(projectTask.projectId, projectId))
      .orderBy(asc(projectTask.orderIndex));

    return tasks;
  } catch (error) {
    console.error("[getProjectTasksByProjectId] Error:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get project tasks"
    );
  }
}


/**
 * Update chat isRenamed flag (for auto-naming feature)
 */
export async function updateChatIsRenamed({
  chatId,
  isRenamed,
}: {
  chatId: string;
  isRenamed: boolean;
}) {
  try {
    return await db
      .update(chat)
      .set({ isRenamed })
      .where(eq(chat.id, chatId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update chat isRenamed flag"
    );
  }
}

/**
 * Update chat title with isRenamed flag (for manual rename)
 */
export async function updateChatTitleWithRenamedFlag({
  chatId,
  title,
  isRenamed,
}: {
  chatId: string;
  title: string;
  isRenamed: boolean;
}) {
  try {
    return await db
      .update(chat)
      .set({ title, isRenamed })
      .where(eq(chat.id, chatId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update chat title with renamed flag"
    );
  }
}

// ============================================
// ТЗ-07B: Chat History Functions
// ============================================

/**
 * Update chat title and summary (for auto-naming with summary)
 */
export async function updateChatTitleAndSummary({
  chatId,
  title,
  summary,
}: {
  chatId: string;
  title: string;
  summary: string;
}) {
  try {
    return await db
      .update(chat)
      .set({ title, summary, isRenamed: false })
      .where(eq(chat.id, chatId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update chat title and summary"
    );
  }
}

/**
 * Update chat isStarred flag
 */
export async function updateChatIsStarred({
  chatId,
  isStarred,
}: {
  chatId: string;
  isStarred: boolean;
}) {
  try {
    return await db
      .update(chat)
      .set({ isStarred })
      .where(eq(chat.id, chatId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update chat isStarred"
    );
  }
}

/**
 * ТЗ-07C2: Update chat taskStatus
 * Valid values: 'not_started', 'in_progress', 'done'
 */
export async function updateChatTaskStatus({
  chatId,
  taskStatus,
}: {
  chatId: string;
  taskStatus: "not_started" | "in_progress" | "done";
}) {
  try {
    return await db
      .update(chat)
      .set({ taskStatus })
      .where(eq(chat.id, chatId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update chat taskStatus"
    );
  }
}

/**
 * Get count of general chats (not in projects) for a user
 * Used for the chat history card counter on Glavnaya
 */
export async function getGeneralChatsCount({ userId }: { userId: string }) {
  try {
    const [result] = await db
      .select({ count: count(chat.id) })
      .from(chat)
      .where(
        and(
          eq(chat.userId, userId),
          isNull(chat.projectId),
          eq(chat.chatMode, "chat")
        )
      );

    return result?.count ?? 0;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get general chats count"
    );
  }
}

/**
 * Get general chats with message count for /chats page
 * Returns chats not in projects, with messageCount for each
 */
export async function getGeneralChatsWithStats({
  userId,
  limit = 50,
}: {
  userId: string;
  limit?: number;
}) {
  try {
    const result = await db
      .select({
        id: chat.id,
        createdAt: chat.createdAt,
        title: chat.title,
        summary: chat.summary,
        isStarred: chat.isStarred,
        isRenamed: chat.isRenamed,
        chatMode: chat.chatMode,
        messageCount: sql<number>`COALESCE(COUNT(${message.id}), 0)::int`,
      })
      .from(chat)
      .leftJoin(message, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, userId),
          isNull(chat.projectId),
          eq(chat.chatMode, "chat")
        )
      )
      .groupBy(chat.id)
      .orderBy(desc(chat.createdAt))
      .limit(limit);

    return result;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get general chats with stats"
    );
  }
}

/**
 * ТЗ-DV2: Get chats filtered by chatMode with stats
 * Used for /expertise and /create pages
 */
export async function getChatsByModeWithStats({
  userId,
  mode,
  limit = 50,
}: {
  userId: string;
  mode: string;
  limit?: number;
}) {
  try {
    const result = await db
      .select({
        id: chat.id,
        createdAt: chat.createdAt,
        title: chat.title,
        summary: chat.summary,
        isStarred: chat.isStarred,
        isRenamed: chat.isRenamed,
        chatMode: chat.chatMode,
        messageCount: sql<number>`COALESCE(COUNT(${message.id}), 0)::int`,
      })
      .from(chat)
      .leftJoin(message, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, userId),
          isNull(chat.projectId),
          eq(chat.chatMode, mode)
        )
      )
      .groupBy(chat.id)
      .orderBy(desc(chat.createdAt))
      .limit(limit);

    return result;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get chats by mode with stats"
    );
  }
}

/**
 * ТЗ-07C1: Get project chats (tasks) with message count
 * Returns chats for a specific project with messageCount for each
 */
export async function getProjectChatsWithStats({
  projectId,
  limit = 50,
}: {
  projectId: string;
  limit?: number;
}) {
  try {
    const result = await db
      .select({
        id: chat.id,
        createdAt: chat.createdAt,
        title: chat.title,
        summary: chat.summary,
        isStarred: chat.isStarred,
        isRenamed: chat.isRenamed,
        taskStatus: chat.taskStatus,
        messageCount: sql<number>`COALESCE(COUNT(${message.id}), 0)::int`,
      })
      .from(chat)
      .leftJoin(message, eq(message.chatId, chat.id))
      .where(and(
        eq(chat.projectId, projectId),
        sql`${chat.title} NOT LIKE '__service:%'`
      ))
      .groupBy(chat.id)
      .orderBy(desc(chat.createdAt))
      .limit(limit);

    return result;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get project chats with stats"
    );
  }
}

/**
 * ТЗ-07C1: Get count of chats (tasks) for a project
 * Used for the task history card counter on project page
 */
export async function getProjectChatsCount({ projectId }: { projectId: string }) {
  try {
    const [result] = await db
      .select({ count: count(chat.id) })
      .from(chat)
      .where(and(
        eq(chat.projectId, projectId),
        sql`${chat.title} NOT LIKE '__service:%'`
      ));

    return result?.count ?? 0;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get project chats count"
    );
  }
}

// ============================================
// ТЗ-A3: Service Chat Persistence (Manager)
// ============================================

/** Service chat title convention: __service:{context} */
const SERVICE_CHAT_TITLE_PREFIX = "__service:";

/**
 * ТЗ-A3: Get or create a persistent service chat for a project
 * Used for Manager drawer — chat persists across sessions
 */
export async function getOrCreateManagerChat({
  projectId,
  userId,
}: {
  projectId: string;
  userId: string;
}) {
  const title = `${SERVICE_CHAT_TITLE_PREFIX}project-manager`;

  try {
    // Find existing manager chat for this project
    const [existing] = await db
      .select()
      .from(chat)
      .where(and(
        eq(chat.projectId, projectId),
        eq(chat.title, title)
      ))
      .limit(1);

    if (existing) return existing;

    // Create new
    const id = generateUUID();
    const [newChat] = await db
      .insert(chat)
      .values({
        id,
        createdAt: new Date(),
        userId,
        title,
        projectId,
        visibility: "private",
      })
      .returning();

    return newChat;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get or create manager chat"
    );
  }
}

/**
 * ТЗ-A3: Find existing manager chat for a project (without creating)
 * Used by GET endpoint to check if chat exists
 */
export async function findManagerChat({ projectId }: { projectId: string }) {
  const title = `${SERVICE_CHAT_TITLE_PREFIX}project-manager`;

  try {
    const [existing] = await db
      .select()
      .from(chat)
      .where(and(
        eq(chat.projectId, projectId),
        eq(chat.title, title)
      ))
      .limit(1);

    return existing || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to find manager chat"
    );
  }
}

// ============================================
// ТЗ-C1: ExpertTaskChat Functions
// ============================================

/**
 * ТЗ-C1: Get a single project task by ID with project ownership check
 */
export async function getProjectTaskById({
  taskId,
  projectId,
}: {
  taskId: string;
  projectId: string;
}) {
  try {
    const [task] = await db
      .select()
      .from(projectTask)
      .where(
        and(eq(projectTask.id, taskId), eq(projectTask.projectId, projectId))
      );

    return task || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get project task by id"
    );
  }
}

/**
 * ТЗ-C1: Get completed task summaries for building expert context
 * Returns tasks with status='done' and non-null outputSummary
 */
export async function getCompletedTaskSummaries({
  projectId,
}: {
  projectId: string;
}) {
  try {
    const tasks = await db
      .select({
        orderIndex: projectTask.orderIndex,
        title: projectTask.title,
        outputSummary: projectTask.outputSummary,
      })
      .from(projectTask)
      .where(
        and(
          eq(projectTask.projectId, projectId),
          eq(projectTask.status, "done"),
          sql`${projectTask.outputSummary} IS NOT NULL`
        )
      )
      .orderBy(asc(projectTask.orderIndex));

    return tasks as Array<{
      orderIndex: number;
      title: string;
      outputSummary: string;
    }>;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get completed task summaries"
    );
  }
}

/**
 * ТЗ-C1: Unlock a locked task (status: locked → pending)
 * Used when user confirms they want to start a locked task out of order
 */
export async function unlockTask({ taskId }: { taskId: string }) {
  try {
    const [updated] = await db
      .update(projectTask)
      .set({
        status: "pending",
        updatedAt: new Date(),
      })
      .where(
        and(eq(projectTask.id, taskId), eq(projectTask.status, "locked"))
      )
      .returning();

    return updated || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to unlock task"
    );
  }
}

/**
 * ТЗ-C1: Start a task — create Chat, link to ProjectTask, set status to in_progress
 * Returns the created chatId
 */
export async function startTask({
  taskId,
  userId,
  projectId,
  taskTitle,
}: {
  taskId: string;
  userId: string;
  projectId: string;
  taskTitle: string;
}) {
  try {
    const chatId = generateUUID();
    const now = new Date();

    // Create chat for this task
    await db.insert(chat).values({
      id: chatId,
      createdAt: now,
      userId,
      title: taskTitle,
      projectId,
      visibility: "private",
    });

    // Link chat to task and set status to in_progress
    await db
      .update(projectTask)
      .set({
        chatId,
        status: "in_progress",
        updatedAt: now,
      })
      .where(eq(projectTask.id, taskId));

    return chatId;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to start task"
    );
  }
}

// ============================================
// ТЗ-C2: Task Completion Functions
// ============================================

/**
 * ТЗ-C2: Internal — unlock dependent tasks and check if project is completed
 */
async function unlockDependentsAndCheckCompletion({
  projectId,
  completedOrderIndex,
}: {
  projectId: string;
  completedOrderIndex: number;
}) {
  const allTasks = await db
    .select()
    .from(projectTask)
    .where(eq(projectTask.projectId, projectId))
    .orderBy(asc(projectTask.orderIndex));

  // Build set of done task orderIndexes
  const doneIndexes = new Set(
    allTasks.filter((t) => t.status === "done").map((t) => t.orderIndex)
  );

  // Find locked tasks whose dependencies are now all satisfied
  const unlockedTasks: Array<{ id: string; title: string; orderIndex: number }> = [];

  for (const task of allTasks) {
    if (task.status !== "locked" || !task.dependsOn?.length) continue;
    if (!task.dependsOn.includes(completedOrderIndex)) continue;

    const allDepsDone = task.dependsOn.every((idx) => doneIndexes.has(idx));
    if (!allDepsDone) continue;

    await db
      .update(projectTask)
      .set({ status: "pending", updatedAt: new Date() })
      .where(eq(projectTask.id, task.id));

    unlockedTasks.push({
      id: task.id,
      title: task.title,
      orderIndex: task.orderIndex,
    });
  }

  // Check project completion: any non-done tasks left?
  const [nonDone] = await db
    .select({ count: count(projectTask.id) })
    .from(projectTask)
    .where(
      and(
        eq(projectTask.projectId, projectId),
        sql`${projectTask.status} != 'done'`
      )
    );

  const projectCompleted = (nonDone?.count ?? 1) === 0;

  if (projectCompleted) {
    await db
      .update(project)
      .set({ phase: "completed", updatedAt: new Date() })
      .where(eq(project.id, projectId));
  }

  return { unlockedTasks, projectCompleted };
}

/**
 * ТЗ-C2: Complete a task — save summary + verdict, unlock dependents, check project completion
 */
export async function completeTask({
  taskId,
  projectId,
  outputSummary,
  professorVerdict,
}: {
  taskId: string;
  projectId: string;
  outputSummary: string;
  professorVerdict?: unknown;
}) {
  try {
    // Determine final status based on verdict
    let finalStatus: "done" | "issues" = "done";
    if (professorVerdict) {
      const v = professorVerdict as { verdict: string };
      if (v.verdict === "issues" || v.verdict === "critical") {
        finalStatus = "issues";
      }
    }

    const [updated] = await db
      .update(projectTask)
      .set({
        status: finalStatus,
        outputSummary,
        professorVerdict: professorVerdict ?? null,
        updatedAt: new Date(),
      })
      .where(eq(projectTask.id, taskId))
      .returning();

    if (!updated) {
      throw new ChatSDKError("not_found:database", "Task not found");
    }

    // If done, unlock dependents and check project completion
    let unlockedTasks: Array<{ id: string; title: string; orderIndex: number }> = [];
    let projectCompleted = false;

    if (finalStatus === "done") {
      const result = await unlockDependentsAndCheckCompletion({
        projectId,
        completedOrderIndex: updated.orderIndex,
      });
      unlockedTasks = result.unlockedTasks;
      projectCompleted = result.projectCompleted;
    }

    return { status: finalStatus, unlockedTasks, projectCompleted };
  } catch (error) {
    if (error instanceof ChatSDKError) throw error;
    console.error("[completeTask] Error:", error);
    throw new ChatSDKError("bad_request:database", "Failed to complete task");
  }
}

/**
 * ТЗ-C2: Reopen a task with issues — status: issues → in_progress
 */
export async function reopenTask({ taskId }: { taskId: string }) {
  try {
    const [updated] = await db
      .update(projectTask)
      .set({
        status: "in_progress",
        updatedAt: new Date(),
      })
      .where(
        and(eq(projectTask.id, taskId), eq(projectTask.status, "issues"))
      )
      .returning();

    return updated || null;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to reopen task");
  }
}

/**
 * ТЗ-C2: Accept a task despite issues — status: issues → done + unlock dependents
 */
export async function acceptTask({
  taskId,
  projectId,
}: {
  taskId: string;
  projectId: string;
}) {
  try {
    const [updated] = await db
      .update(projectTask)
      .set({
        status: "done",
        updatedAt: new Date(),
      })
      .where(
        and(eq(projectTask.id, taskId), eq(projectTask.status, "issues"))
      )
      .returning();

    if (!updated) {
      return null;
    }

    const result = await unlockDependentsAndCheckCompletion({
      projectId,
      completedOrderIndex: updated.orderIndex,
    });

    return {
      status: "done" as const,
      unlockedTasks: result.unlockedTasks,
      projectCompleted: result.projectCompleted,
    };
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to accept task");
  }
}

// ============================================
// ТЗ-C1.5: Context Snapshot Functions
// ============================================

/**
 * ТЗ-C1.5: Get chat with snapshot state (one query)
 * Returns Chat including snapshots[] and contextState
 */
export async function getChatWithSnapshotState({ chatId }: { chatId: string }) {
  try {
    const [result] = await db
      .select({
        id: chat.id,
        snapshots: chat.snapshots,
        contextState: chat.contextState,
      })
      .from(chat)
      .where(eq(chat.id, chatId));

    return result || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get chat snapshot state"
    );
  }
}

/**
 * ТЗ-C1.5: Append a snapshot to Chat.snapshots[] (JSONB append)
 */
export async function addChatSnapshot({
  chatId,
  messageId,
  summary,
  fullMarkdown,
}: {
  chatId: string;
  messageId: string;
  summary: string;
  fullMarkdown?: string;
}) {
  try {
    const newEntry: SnapshotMeta = {
      messageId,
      createdAt: new Date().toISOString(),
      summary,
      ...(fullMarkdown && { fullMarkdown }),
    };

    await db
      .update(chat)
      .set({
        snapshots: sql`COALESCE(${chat.snapshots}, '[]'::jsonb) || ${JSON.stringify(newEntry)}::jsonb`,
      })
      .where(eq(chat.id, chatId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to add chat snapshot"
    );
  }
}

/**
 * ТЗ-C1.5: Update contextState on Chat
 */
export async function updateChatContextState({
  chatId,
  contextState,
}: {
  chatId: string;
  contextState: ContextState;
}) {
  try {
    await db
      .update(chat)
      .set({ contextState })
      .where(eq(chat.id, chatId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update chat context state"
    );
  }
}

/**
 * ТЗ-C1.5: Reset contextState after snapshot is created
 */
export async function resetChatContextState({ chatId }: { chatId: string }) {
  try {
    await db
      .update(chat)
      .set({ contextState: null })
      .where(eq(chat.id, chatId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to reset chat context state"
    );
  }
}

// ============================================
// ТЗ-BR1: Briefing Functions
// ============================================

/**
 * Get briefing settings for a user
 */
export async function getBriefingSettings({ userId }: { userId: string }) {
  try {
    const [settings] = await db
      .select()
      .from(briefingSettings)
      .where(eq(briefingSettings.userId, userId));

    return settings || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get briefing settings"
    );
  }
}

/**
 * Create or update briefing settings (one per user)
 */
export async function upsertBriefingSettings({
  userId,
  isActive,
  timezone,
  generationTime,
  language,
  maxItems,
  volume,
  deliveryEnabled,
  deliveryFormat,
}: {
  userId: string;
  isActive?: boolean;
  timezone?: string;
  generationTime?: string;
  language?: string;
  maxItems?: number;
  volume?: string;
  deliveryEnabled?: boolean;
  deliveryFormat?: string;
}) {
  try {
    const now = new Date();
    const existing = await getBriefingSettings({ userId });

    if (existing) {
      const updateData: Record<string, unknown> = { updatedAt: now };
      if (isActive !== undefined) updateData.isActive = isActive;
      if (timezone !== undefined) updateData.timezone = timezone;
      if (generationTime !== undefined) updateData.generationTime = generationTime;
      if (language !== undefined) updateData.language = language;
      if (maxItems !== undefined) updateData.maxItems = maxItems;
      if (volume !== undefined) updateData.volume = volume;
      if (deliveryEnabled !== undefined) updateData.deliveryEnabled = deliveryEnabled;
      if (deliveryFormat !== undefined) updateData.deliveryFormat = deliveryFormat;

      const [updated] = await db
        .update(briefingSettings)
        .set(updateData)
        .where(eq(briefingSettings.userId, userId))
        .returning();

      return updated;
    }

    const [created] = await db
      .insert(briefingSettings)
      .values({
        userId,
        isActive: isActive ?? false,
        timezone: timezone ?? "Europe/Moscow",
        generationTime: generationTime ?? "07:00",
        language: language ?? "ru",
        maxItems: maxItems ?? 15,
        volume: volume ?? "standard",
        deliveryEnabled: deliveryEnabled ?? false,
        deliveryFormat: deliveryFormat ?? "text_audio",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return created;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to upsert briefing settings"
    );
  }
}

/**
 * ТЗ-TG4a: Update delivery status on a briefing history record
 */
export async function updateBriefingDeliveryStatus({
  briefingId,
  deliveryStatus,
}: {
  briefingId: string;
  deliveryStatus: "none" | "pending" | "sent" | "failed";
}) {
  try {
    const [updated] = await db
      .update(briefingHistory)
      .set({ deliveryStatus })
      .where(eq(briefingHistory.id, briefingId))
      .returning();

    return updated;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update briefing delivery status"
    );
  }
}

/**
 * ТЗ-TG4a: Get users whose delivery window matches the current cron slot.
 * Converts each user's generationTime (in their timezone) to UTC and checks
 * if it falls within ±7 minutes of the given UTC time.
 */
export async function getUsersForDelivery({
  currentUtcTime: _currentUtcTime,
}: {
  currentUtcTime: Date;
}): Promise<Array<{ userId: string; timezone: string; generationTime: string; deliveryFormat: string }>> {
  try {
    // ТЗ-COSTCTRL Phase 3: INNER JOIN on active TelegramConnection.
    // Only return users who BOTH have deliveryEnabled=true AND an active Telegram.
    // This prevents the AI pipeline from running for undeliverable users.
    const rows = await db
      .select({
        userId: briefingSettings.userId,
        timezone: briefingSettings.timezone,
        generationTime: briefingSettings.generationTime,
        deliveryFormat: briefingSettings.deliveryFormat,
      })
      .from(briefingSettings)
      .innerJoin(
        telegramConnection,
        and(
          eq(telegramConnection.userId, briefingSettings.userId),
          eq(telegramConnection.isActive, true),
        ),
      )
      .where(eq(briefingSettings.deliveryEnabled, true));

    // ТЗ-TG4b: Hobby plan — cron runs once daily (0 5 * * *).
    // Return ALL qualifying users, ignoring generationTime.
    // When upgrading to Pro plan with */15 cron, uncomment the time-window filter below.
    return rows;

    // --- Pro plan: time-window filter (uncomment when switching to */15 cron) ---
    // const WINDOW_MINUTES = 7; // tight window for 15-min cron
    // const currentMinutes = currentUtcTime.getUTCHours() * 60 + currentUtcTime.getUTCMinutes();
    //
    // return rows.filter((row) => {
    //   const [hours, minutes] = row.generationTime.split(":").map(Number);
    //   const userLocalMinutes = hours * 60 + minutes;
    //   const userUtcOffset = getTimezoneOffsetMinutes(row.timezone, currentUtcTime);
    //   const userUtcMinutes = ((userLocalMinutes - userUtcOffset) % 1440 + 1440) % 1440;
    //   const generateAtUtc = ((userUtcMinutes - 15) % 1440 + 1440) % 1440;
    //   const diff = Math.abs(currentMinutes - generateAtUtc);
    //   const wrappedDiff = Math.min(diff, 1440 - diff);
    //   return wrappedDiff <= WINDOW_MINUTES;
    // });
  } catch (_error) {
    console.error("[getUsersForDelivery] Failed:", _error);
    return [];
  }
}

/**
 * Get timezone offset in minutes from UTC for a given IANA timezone.
 * Positive = east of UTC (e.g., Moscow = +180).
 * NOTE: Currently unused (Hobby plan daily cron). Needed for Pro plan time-window filter.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getTimezoneOffsetMinutes(timezone: string, date: Date): number {
  try {
    const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" });
    const tzStr = date.toLocaleString("en-US", { timeZone: timezone });
    const utcDate = new Date(utcStr);
    const tzDate = new Date(tzStr);
    return (tzDate.getTime() - utcDate.getTime()) / 60000;
  } catch {
    // Fallback to Moscow (+3)
    return 180;
  }
}

/**
 * Get all active sources for a user
 */
export async function getBriefingSources({ userId }: { userId: string }) {
  try {
    return await db
      .select()
      .from(briefingSources)
      .where(
        and(eq(briefingSources.userId, userId), eq(briefingSources.isActive, true))
      )
      .orderBy(asc(briefingSources.priority));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get briefing sources"
    );
  }
}

/**
 * Add a briefing source for a user
 */
export async function addBriefingSource({
  userId,
  topicId,
  sourceUrl,
  sourceName,
  sourceLanguage,
  tier,
  rssUrl,
  fetchMethod,
  priority,
}: {
  userId: string;
  topicId: string;
  sourceUrl: string;
  sourceName: string;
  sourceLanguage?: string;
  tier?: string;
  rssUrl?: string;
  fetchMethod: string;
  priority?: number;
}) {
  try {
    const [created] = await db
      .insert(briefingSources)
      .values({
        userId,
        topicId,
        sourceUrl,
        sourceName,
        sourceLanguage: sourceLanguage ?? "ru",
        tier: tier ?? "unknown",
        rssUrl: rssUrl ?? null,
        fetchMethod,
        priority: priority ?? 5,
        createdAt: new Date(),
      })
      .returning();

    return created;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to add briefing source"
    );
  }
}

/**
 * Delete a briefing source
 */
export async function deleteBriefingSource({ id }: { id: string }) {
  try {
    const [deleted] = await db
      .delete(briefingSources)
      .where(eq(briefingSources.id, id))
      .returning();

    return deleted || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete briefing source"
    );
  }
}

/**
 * Save a generated briefing to history
 */
export async function saveBriefingHistory({
  userId,
  briefingJson,
  sourcesChecked,
  itemsIncluded,
  duplicatesRemoved,
  tokensUsed,
  status,
  metadata,
}: {
  userId: string;
  briefingJson: unknown;
  sourcesChecked?: number;
  itemsIncluded?: number;
  duplicatesRemoved?: number;
  tokensUsed?: number;
  status: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const now = new Date();
    const [created] = await db
      .insert(briefingHistory)
      .values({
        userId,
        briefingJson,
        sourcesChecked: sourcesChecked ?? null,
        itemsIncluded: itemsIncluded ?? null,
        duplicatesRemoved: duplicatesRemoved ?? null,
        tokensUsed: tokensUsed ?? null,
        status,
        generatedAt: now,
        createdAt: now,
        metadata: metadata ?? null,
      })
      .returning();

    return created;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to save briefing history"
    );
  }
}

/**
 * Get briefing history for a user (most recent first)
 */
export async function getBriefingHistory({
  userId,
  limit = 10,
  status,
}: {
  userId: string;
  limit?: number;
  /** Filter by status (e.g. "ready"). If omitted, returns all statuses. */
  status?: string;
}) {
  try {
    const conditions = [eq(briefingHistory.userId, userId)];
    if (status) {
      conditions.push(eq(briefingHistory.status, status));
    }

    return await db
      .select()
      .from(briefingHistory)
      .where(and(...conditions))
      .orderBy(desc(briefingHistory.generatedAt))
      .limit(limit);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get briefing history"
    );
  }
}


// ============================================================================
// Briefing Topics (ТЗ-A2)
// ============================================================================

/**
 * Get all topics for a user (ordered by orderIndex)
 */
export async function getBriefingTopics({ userId }: { userId: string }) {
  try {
    return await db
      .select()
      .from(briefingTopics)
      .where(eq(briefingTopics.userId, userId))
      .orderBy(asc(briefingTopics.orderIndex));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get briefing topics"
    );
  }
}

/**
 * Add a briefing topic for a user
 */
export async function addBriefingTopic({
  userId,
  topicId,
  topicName,
  emoji,
  orderIndex,
  briefingStyle,
}: {
  userId: string;
  topicId: string;
  topicName: string;
  emoji: string;
  orderIndex?: number;
  briefingStyle?: string | null;
}) {
  try {
    const [created] = await db
      .insert(briefingTopics)
      .values({
        userId,
        topicId,
        topicName,
        emoji,
        orderIndex: orderIndex ?? 0,
        briefingStyle: briefingStyle ?? null,
        createdAt: new Date(),
      })
      .returning();

    return created;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to add briefing topic"
    );
  }
}

/**
 * Delete all topics for a user (for reset during onboarding)
 */
export async function deleteAllBriefingTopicsByUser({
  userId,
}: {
  userId: string;
}) {
  try {
    await db
      .delete(briefingTopics)
      .where(eq(briefingTopics.userId, userId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete briefing topics"
    );
  }
}

/**
 * Delete all sources for a user (for reset during onboarding)
 */
export async function deleteAllBriefingSourcesByUser({
  userId,
}: {
  userId: string;
}) {
  try {
    await db
      .delete(briefingSources)
      .where(eq(briefingSources.userId, userId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete briefing sources"
    );
  }
}

// ============================================================================
// Saved Briefing Topics (ТЗ-BF1)
// ============================================================================

/**
 * Save a topic from a briefing issue
 */
export async function saveBriefingTopic({
  userId,
  topicId,
  topicName,
  emoji,
  title,
  content,
  sources,
  briefingGeneratedAt,
}: {
  userId: string;
  topicId: string;
  topicName: string;
  emoji: string;
  title: string;
  content: string;
  sources: unknown;
  briefingGeneratedAt: Date;
}) {
  try {
    const [created] = await db
      .insert(savedBriefingTopics)
      .values({
        userId,
        topicId,
        topicName,
        emoji,
        title,
        content,
        sources,
        briefingGeneratedAt,
        savedAt: new Date(),
      })
      .returning();

    return created;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to save briefing topic"
    );
  }
}

/**
 * Get all saved topics for a user (most recent first)
 */
export async function getSavedBriefingTopics({
  userId,
}: {
  userId: string;
}) {
  try {
    return await db
      .select()
      .from(savedBriefingTopics)
      .where(eq(savedBriefingTopics.userId, userId))
      .orderBy(desc(savedBriefingTopics.savedAt));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get saved briefing topics"
    );
  }
}

/**
 * Delete a saved topic (with ownership check)
 */
export async function deleteSavedBriefingTopic({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  try {
    const [deleted] = await db
      .delete(savedBriefingTopics)
      .where(
        and(
          eq(savedBriefingTopics.id, id),
          eq(savedBriefingTopics.userId, userId)
        )
      )
      .returning();

    return deleted ?? null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete saved briefing topic"
    );
  }
}

/**
 * ТЗ-BF4: Update a single section in the latest briefing (JSONB patch).
 * Finds latest "ready" briefing, replaces the section matching topicId,
 * recalculates meta, and saves back.
 * Returns the updated section or null if no matching briefing/section found.
 */
export async function updateBriefingSection({
  userId,
  topicId,
  newSection,
}: {
  userId: string;
  topicId: string;
  newSection: {
    topicId: string;
    topicName: string;
    emoji: string;
    content: string;
    newsCount: number;
    sources: Array<{
      title: string;
      url: string;
      sourceName: string;
      tier: string;
      summary: string;
    }>;
  };
}) {
  try {
    // 1. Get latest ready briefing
    const [latest] = await db
      .select()
      .from(briefingHistory)
      .where(
        and(
          eq(briefingHistory.userId, userId),
          eq(briefingHistory.status, "ready"),
        ),
      )
      .orderBy(desc(briefingHistory.generatedAt))
      .limit(1);

    if (!latest) return null;

    // 2. Parse and patch
    const article = latest.briefingJson as {
      title: string;
      intro: string;
      sections: Array<{
        topicId: string;
        topicName: string;
        emoji: string;
        content: string;
        newsCount: number;
        sources: Array<{
          title: string;
          url: string;
          sourceName: string;
          tier: string;
          summary: string;
        }>;
      }>;
      outro: string;
      meta: { totalNews: number; topicsCount: number; readingTimeMinutes: number };
    };

    const sectionIdx = article.sections.findIndex(
      (s) => s.topicId === topicId,
    );
    if (sectionIdx === -1) return null;

    // 3. Replace section
    article.sections[sectionIdx] = newSection;

    // 4. Recalculate meta
    const totalNews = article.sections.reduce(
      (sum, s) => sum + (s.newsCount || 0),
      0,
    );
    const wordCount = article.sections.reduce(
      (sum, s) => sum + s.content.split(/\s+/).length,
      0,
    );
    article.meta = {
      totalNews,
      topicsCount: article.sections.length,
      readingTimeMinutes: Math.max(1, Math.round(wordCount / 200)),
    };

    // 5. Save back
    await db
      .update(briefingHistory)
      .set({ briefingJson: article })
      .where(eq(briefingHistory.id, latest.id));

    return newSection;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update briefing section",
    );
  }
}

/**
 * ТЗ-Б1: Update audio fields for a briefing (incremental per-topic)
 */
export async function updateBriefingAudio({
  userId,
  audioUrls,
  audioStatus,
  audioDurations,
}: {
  userId: string;
  audioUrls?: Record<string, string>;
  audioStatus?: string;
  audioDurations?: Record<string, number>;
}) {
  try {
    const latest = await db
      .select()
      .from(briefingHistory)
      .where(
        and(
          eq(briefingHistory.userId, userId),
          eq(briefingHistory.status, "ready"),
        ),
      )
      .orderBy(desc(briefingHistory.generatedAt))
      .limit(1);

    if (latest.length === 0) return null;

    const record = latest[0];
    const currentUrls =
      (record.audioUrls as Record<string, string> | null) ?? {};
    const currentDurations =
      (record.audioDurations as Record<string, number> | null) ?? {};

    const mergedUrls = audioUrls
      ? { ...currentUrls, ...audioUrls }
      : currentUrls;
    const mergedDurations = audioDurations
      ? { ...currentDurations, ...audioDurations }
      : currentDurations;

    const updateFields: Record<string, unknown> = {};
    if (audioUrls) updateFields.audioUrls = mergedUrls;
    if (audioDurations) updateFields.audioDurations = mergedDurations;
    if (audioStatus) updateFields.audioStatus = audioStatus;

    if (Object.keys(updateFields).length === 0) return record;

    await db
      .update(briefingHistory)
      .set(updateFields)
      .where(eq(briefingHistory.id, record.id));

    return { ...record, ...updateFields };
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update briefing audio",
    );
  }
}

/**
 * ТЗ-DEV2: Merge additional metadata into a briefing history record.
 * Used by cron to append podcast trace after briefing is already saved.
 */
export async function updateBriefingMetadata({
  briefingId,
  metadata,
}: {
  briefingId: string;
  metadata: Record<string, unknown>;
}) {
  try {
    const existing = await db
      .select({ metadata: briefingHistory.metadata })
      .from(briefingHistory)
      .where(eq(briefingHistory.id, briefingId))
      .limit(1);

    const currentMetadata =
      (existing[0]?.metadata as Record<string, unknown> | null) ?? {};
    const merged = { ...currentMetadata, ...metadata };

    await db
      .update(briefingHistory)
      .set({ metadata: merged })
      .where(eq(briefingHistory.id, briefingId));

    return merged;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update briefing metadata",
    );
  }
}

/**
 * ТЗ-BF1 TTL: Delete old briefing history for a user (before new generation)
 * ТЗ-Б1: Also cleans up MP3 files from Vercel Blob
 * ТЗ-BF5: keepLast — preserve last N ready briefings for dedup context
 */
export async function deleteOldBriefingHistory({
  userId,
  keepLast = 0,
}: {
  userId: string;
  /** Number of latest ready briefings to keep (default: 0 = delete all) */
  keepLast?: number;
}) {
  try {
    // ТЗ-BF5: Find IDs of ready records to keep
    const keepIds: string[] = [];
    if (keepLast > 0) {
      const toKeep = await db
        .select({ id: briefingHistory.id })
        .from(briefingHistory)
        .where(
          and(
            eq(briefingHistory.userId, userId),
            eq(briefingHistory.status, "ready"),
          ),
        )
        .orderBy(desc(briefingHistory.generatedAt))
        .limit(keepLast);
      keepIds.push(...toKeep.map((r) => r.id));
    }

    // Build delete condition: userId + exclude kept records
    const deleteConditions: SQL[] = [eq(briefingHistory.userId, userId)];
    if (keepIds.length > 0) {
      deleteConditions.push(notInArray(briefingHistory.id, keepIds));
    }

    // ТЗ-Б1: Read audio URLs before deletion for Blob cleanup (only from records to be deleted)
    const recordsToDelete = await db
      .select({ audioUrls: briefingHistory.audioUrls })
      .from(briefingHistory)
      .where(and(...deleteConditions));

    if (recordsToDelete.length === 0) return;

    const blobUrlsToDelete: string[] = [];
    for (const record of recordsToDelete) {
      if (record.audioUrls && typeof record.audioUrls === "object") {
        blobUrlsToDelete.push(
          ...Object.values(record.audioUrls as Record<string, string>),
        );
      }
    }

    // Delete DB records (only those not kept)
    await db
      .delete(briefingHistory)
      .where(and(...deleteConditions));

    // Cleanup Blob files (best-effort, don't block on failure)
    if (blobUrlsToDelete.length > 0) {
      try {
        const { del } = await import("@vercel/blob");
        await del(blobUrlsToDelete);
      } catch (blobErr) {
        console.warn(
          "[deleteOldBriefingHistory] Blob cleanup failed (non-blocking):",
          blobErr,
        );
      }
    }
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete old briefing history"
    );
  }
}

/**
 * ТЗ-BF5: Get previous ready briefing for dedup context.
 * Returns the latest ready briefing article + generatedAt, or null if none exists.
 */
export async function getPreviousBriefing({
  userId,
}: {
  userId: string;
}): Promise<{ generatedAt: string; article: BriefingArticle } | null> {
  try {
    const rows = await getBriefingHistory({ userId, limit: 1, status: "ready" });
    if (rows.length === 0) return null;

    const row = rows[0];
    const article = row.briefingJson as BriefingArticle;
    if (!article || !article.sections) return null;

    return {
      generatedAt: row.generatedAt.toISOString(),
      article,
    };
  } catch (_error) {
    // Non-blocking: if we can't load previous briefing, dedup just won't happen
    console.warn("[getPreviousBriefing] Failed to load, skipping dedup:", _error);
    return null;
  }
}

// ============================================================================
// AI Usage Log (ТЗ-OPT1)
// ============================================================================

/**
 * ТЗ-OPT1: Save AI usage log entry (fire-and-forget, never throws).
 */
export async function saveAiUsageLog({
  chatId,
  userId,
  modelId,
  inputTokens,
  outputTokens,
  thinkingTokens = 0,
  cacheWriteTokens = 0,
  cacheReadTokens = 0,
  costUsd,
  chatMode,
  durationMs,
  guardianFlags,
}: {
  chatId?: string | null;
  userId: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens?: number;
  cacheWriteTokens?: number;
  cacheReadTokens?: number;
  costUsd?: number | null;
  chatMode: string;
  durationMs?: number | null;
  guardianFlags?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await db.insert(aiUsageLog).values({
      chatId: chatId ?? null,
      userId,
      modelId,
      inputTokens,
      outputTokens,
      thinkingTokens,
      cacheWriteTokens,
      cacheReadTokens,
      costUsd: costUsd != null ? String(costUsd) : null,
      chatMode,
      durationMs: durationMs ?? null,
      guardianFlags: guardianFlags ?? null,
    });
  } catch (error) {
    console.error("[saveAiUsageLog] Failed to save usage log:", error);
  }
}

// ============================================================================
// Telegram Bot (ТЗ-TG3)
// ============================================================================

/**
 * ТЗ-TG3: Get Telegram connection by Simply userId
 */
export async function getTelegramConnection({
  userId,
}: {
  userId: string;
}): Promise<TelegramConnection | null> {
  try {
    const [connection] = await db
      .select()
      .from(telegramConnection)
      .where(eq(telegramConnection.userId, userId));

    return connection || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get Telegram connection"
    );
  }
}

/**
 * ТЗ-TG3: Get Telegram connection by Telegram user ID
 */
export async function getTelegramConnectionByTelegramId({
  telegramUserId,
}: {
  telegramUserId: number;
}): Promise<TelegramConnection | null> {
  try {
    const [connection] = await db
      .select()
      .from(telegramConnection)
      .where(eq(telegramConnection.telegramUserId, telegramUserId));

    return connection || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get Telegram connection by Telegram ID"
    );
  }
}

/**
 * ТЗ-TG3: Create a new Telegram connection (link Simply ↔ Telegram)
 */
export async function createTelegramConnection({
  userId,
  telegramUserId,
  telegramUsername,
  telegramFirstName,
}: {
  userId: string;
  telegramUserId: number;
  telegramUsername?: string | null;
  telegramFirstName?: string | null;
}) {
  try {
    const [created] = await db
      .insert(telegramConnection)
      .values({
        userId,
        telegramUserId,
        telegramUsername: telegramUsername ?? null,
        telegramFirstName: telegramFirstName ?? null,
        linkedAt: new Date(),
      })
      .returning();

    return created;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create Telegram connection"
    );
  }
}

/**
 * ТЗ-TG3: Delete Telegram connection (unlink)
 */
export async function deleteTelegramConnection({
  userId,
}: {
  userId: string;
}) {
  try {
    await db
      .delete(telegramConnection)
      .where(eq(telegramConnection.userId, userId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete Telegram connection"
    );
  }
}

/**
 * ТЗ-TG3: Toggle isActive on Telegram connection (/stop, /start)
 */
export async function setTelegramConnectionActive({
  userId,
  isActive,
}: {
  userId: string;
  isActive: boolean;
}) {
  try {
    const [updated] = await db
      .update(telegramConnection)
      .set({ isActive })
      .where(eq(telegramConnection.userId, userId))
      .returning();

    return updated || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update Telegram connection active status"
    );
  }
}

/**
 * ТЗ-TG3: Create a link token (UUID, expires in 10 minutes)
 */
export async function createTelegramLinkToken({
  userId,
}: {
  userId: string;
}) {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // +10 min

    const [created] = await db
      .insert(telegramLinkToken)
      .values({
        token: generateUUID(),
        userId,
        createdAt: now,
        expiresAt,
      })
      .returning();

    return created;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create Telegram link token"
    );
  }
}

/**
 * ТЗ-TG3: Get a link token (for validation during /start deep link)
 */
export async function getTelegramLinkToken({
  token,
}: {
  token: string;
}): Promise<TelegramLinkToken | null> {
  try {
    const [linkToken] = await db
      .select()
      .from(telegramLinkToken)
      .where(eq(telegramLinkToken.token, token));

    return linkToken || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get Telegram link token"
    );
  }
}

/**
 * ТЗ-TG3: Delete a used link token
 */
export async function deleteTelegramLinkToken({
  token,
}: {
  token: string;
}) {
  try {
    await db
      .delete(telegramLinkToken)
      .where(eq(telegramLinkToken.token, token));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete Telegram link token"
    );
  }
}

// ============================================================================
// Telegram Groups (ТЗ-TG5)
// ============================================================================

/**
 * ТЗ-TG5: Create or reactivate a Telegram group when bot is added
 */
export async function upsertTelegramGroup({
  telegramChatId,
  title,
  type,
  isForum,
  ownerUserId,
  memberCount,
}: {
  telegramChatId: number;
  title: string;
  type: string;
  isForum: boolean;
  ownerUserId: string | null;
  memberCount: number | null;
}): Promise<TelegramGroup> {
  const now = new Date();
  try {
    const existing = await db
      .select()
      .from(telegramGroup)
      .where(eq(telegramGroup.telegramChatId, telegramChatId));

    if (existing.length > 0) {
      const [updated] = await db
        .update(telegramGroup)
        .set({
          title,
          type,
          isForum,
          isActive: true,
          memberCount,
          updatedAt: now,
          ...(ownerUserId && !existing[0].ownerUserId
            ? { ownerUserId }
            : {}),
        })
        .where(eq(telegramGroup.telegramChatId, telegramChatId))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(telegramGroup)
      .values({
        telegramChatId,
        title,
        type,
        isForum,
        ownerUserId,
        isActive: true,
        memberCount,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to upsert Telegram group"
    );
  }
}

/**
 * ТЗ-TG5: Get group by Telegram chat ID
 */
export async function getTelegramGroupByChatId({
  telegramChatId,
}: {
  telegramChatId: number;
}): Promise<TelegramGroup | null> {
  try {
    const [group] = await db
      .select()
      .from(telegramGroup)
      .where(eq(telegramGroup.telegramChatId, telegramChatId));
    return group || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get Telegram group by chat ID"
    );
  }
}

/**
 * ТЗ-TG5: Deactivate group (bot removed or user disabled)
 */
export async function deactivateTelegramGroup({
  telegramChatId,
}: {
  telegramChatId: number;
}) {
  try {
    await db
      .update(telegramGroup)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(telegramGroup.telegramChatId, telegramChatId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to deactivate Telegram group"
    );
  }
}

/**
 * ТЗ-TG5: Deactivate group by internal ID (for UI "Disconnect" button)
 */
export async function deactivateTelegramGroupById({
  groupId,
  ownerUserId,
}: {
  groupId: string;
  ownerUserId: string;
}) {
  try {
    await db
      .update(telegramGroup)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(telegramGroup.id, groupId),
          eq(telegramGroup.ownerUserId, ownerUserId)
        )
      );
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to deactivate Telegram group by ID"
    );
  }
}

/**
 * ТЗ-TG5: List groups for a user (with message count and last message date)
 */
export async function getTelegramGroupsByOwner({
  ownerUserId,
}: {
  ownerUserId: string;
}): Promise<
  (TelegramGroup & { messageCount: number; lastMessageAt: Date | null })[]
> {
  try {
    const groups = await db
      .select({
        id: telegramGroup.id,
        telegramChatId: telegramGroup.telegramChatId,
        title: telegramGroup.title,
        type: telegramGroup.type,
        isForum: telegramGroup.isForum,
        ownerUserId: telegramGroup.ownerUserId,
        isActive: telegramGroup.isActive,
        memberCount: telegramGroup.memberCount,
        createdAt: telegramGroup.createdAt,
        updatedAt: telegramGroup.updatedAt,
        messageCount: count(telegramMessage.id),
        lastMessageAt: sql<Date | null>`max(${telegramMessage.sentAt})`,
      })
      .from(telegramGroup)
      .leftJoin(
        telegramMessage,
        eq(telegramGroup.id, telegramMessage.groupId)
      )
      .where(eq(telegramGroup.ownerUserId, ownerUserId))
      .groupBy(telegramGroup.id)
      .orderBy(desc(sql`max(${telegramMessage.sentAt})`));

    return groups.map((g) => ({
      ...g,
      messageCount: Number(g.messageCount),
    }));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get Telegram groups by owner"
    );
  }
}

/**
 * ТЗ-TG5: Get a single group (with ownership check)
 */
export async function getTelegramGroupById({
  groupId,
  ownerUserId,
}: {
  groupId: string;
  ownerUserId: string;
}): Promise<TelegramGroup | null> {
  try {
    const [group] = await db
      .select()
      .from(telegramGroup)
      .where(
        and(
          eq(telegramGroup.id, groupId),
          eq(telegramGroup.ownerUserId, ownerUserId)
        )
      );
    return group || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get Telegram group by ID"
    );
  }
}

/**
 * ТЗ-TG5: Create or update a forum topic (upsert by groupId + telegramTopicId)
 */
export async function upsertTelegramGroupTopic({
  groupId,
  telegramTopicId,
  name,
}: {
  groupId: string;
  telegramTopicId: number;
  name: string;
}): Promise<TelegramGroupTopic> {
  try {
    const [existing] = await db
      .select()
      .from(telegramGroupTopic)
      .where(
        and(
          eq(telegramGroupTopic.groupId, groupId),
          eq(telegramGroupTopic.telegramTopicId, telegramTopicId)
        )
      );

    if (existing) {
      if (existing.name !== name) {
        const [updated] = await db
          .update(telegramGroupTopic)
          .set({ name })
          .where(eq(telegramGroupTopic.id, existing.id))
          .returning();
        return updated;
      }
      return existing;
    }

    const [created] = await db
      .insert(telegramGroupTopic)
      .values({
        groupId,
        telegramTopicId,
        name,
        createdAt: new Date(),
      })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to upsert Telegram group topic"
    );
  }
}

/**
 * ТЗ-TG5: Get topics for a group (with message counts)
 */
export async function getTelegramGroupTopics({
  groupId,
}: {
  groupId: string;
}): Promise<(TelegramGroupTopic & { messageCount: number })[]> {
  try {
    const topics = await db
      .select({
        id: telegramGroupTopic.id,
        groupId: telegramGroupTopic.groupId,
        telegramTopicId: telegramGroupTopic.telegramTopicId,
        name: telegramGroupTopic.name,
        createdAt: telegramGroupTopic.createdAt,
        messageCount: count(telegramMessage.id),
      })
      .from(telegramGroupTopic)
      .leftJoin(
        telegramMessage,
        eq(telegramGroupTopic.id, telegramMessage.topicId)
      )
      .where(eq(telegramGroupTopic.groupId, groupId))
      .groupBy(telegramGroupTopic.id)
      .orderBy(asc(telegramGroupTopic.telegramTopicId));

    return topics.map((t) => ({
      ...t,
      messageCount: Number(t.messageCount),
    }));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get Telegram group topics"
    );
  }
}

/**
 * ТЗ-TG5: Find topic UUID by (groupId, telegramTopicId) — for message handler
 */
export async function getTelegramTopicByTelegramId({
  groupId,
  telegramTopicId,
}: {
  groupId: string;
  telegramTopicId: number;
}): Promise<TelegramGroupTopic | null> {
  try {
    const [topic] = await db
      .select()
      .from(telegramGroupTopic)
      .where(
        and(
          eq(telegramGroupTopic.groupId, groupId),
          eq(telegramGroupTopic.telegramTopicId, telegramTopicId)
        )
      );
    return topic || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get Telegram topic by Telegram ID"
    );
  }
}

/**
 * ТЗ-TG5: Save a message from a group
 */
export async function createTelegramMessage({
  groupId,
  topicId,
  telegramMessageId,
  fromUserId,
  fromUsername,
  fromFirstName,
  text,
  hasMedia,
  mediaType,
  sentAt,
  fileName,
  fileSize,
  blobUrl,
}: {
  groupId: string;
  topicId: string | null;
  telegramMessageId: number;
  fromUserId: number;
  fromUsername: string | null;
  fromFirstName: string | null;
  text: string;
  hasMedia: boolean;
  mediaType: string | null;
  sentAt: Date;
  fileName?: string | null;
  fileSize?: number | null;
  blobUrl?: string | null;
}): Promise<TelegramMessage> {
  try {
    const [created] = await db
      .insert(telegramMessage)
      .values({
        groupId,
        topicId,
        telegramMessageId,
        fromUserId,
        fromUsername,
        fromFirstName,
        text,
        hasMedia,
        mediaType,
        sentAt,
        createdAt: new Date(),
        ...(fileName != null && { fileName }),
        ...(fileSize != null && { fileSize }),
        ...(blobUrl != null && { blobUrl }),
      })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create Telegram message"
    );
  }
}

/**
 * ТЗ-TG5: Get messages for a group with cursor pagination
 */
export async function getTelegramMessages({
  groupId,
  topicId,
  cursor,
  limit = 50,
}: {
  groupId: string;
  topicId?: string | null;
  cursor?: string | null; // ISO date string of sentAt
  limit?: number;
}): Promise<{ messages: TelegramMessage[]; nextCursor: string | null }> {
  try {
    const conditions: SQL[] = [eq(telegramMessage.groupId, groupId)];

    if (topicId) {
      conditions.push(eq(telegramMessage.topicId, topicId));
    }

    if (cursor) {
      conditions.push(lt(telegramMessage.sentAt, new Date(cursor)));
    }

    const messages = await db
      .select()
      .from(telegramMessage)
      .where(and(...conditions))
      .orderBy(desc(telegramMessage.sentAt))
      .limit(limit + 1);

    const hasMore = messages.length > limit;
    const result = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore
      ? result[result.length - 1].sentAt.toISOString()
      : null;

    return { messages: result, nextCursor };
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get Telegram messages"
    );
  }
}

/**
 * ТЗ-TG5: Delete a message (with group ownership check)
 */
export async function deleteTelegramMessage({
  messageId,
  groupId,
}: {
  messageId: string;
  groupId: string;
}): Promise<boolean> {
  try {
    const result = await db
      .delete(telegramMessage)
      .where(
        and(
          eq(telegramMessage.id, messageId),
          eq(telegramMessage.groupId, groupId),
        ),
      );
    return (result.rowCount ?? 0) > 0;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete Telegram message",
    );
  }
}

// ============================================================================
// Meeting Recorder (ТЗ-MR)
// ============================================================================

/**
 * Save a new meeting record
 */
export async function saveMeetingRecord({
  userId,
  title,
  durationSeconds,
  speakerCount,
  summaryLevel,
  transcript,
  summary,
  userInstructions,
  originalRecordId,
  metadata,
}: {
  userId: string;
  title: string;
  durationSeconds: number;
  speakerCount: number;
  summaryLevel: string;
  transcript: string;
  summary: string;
  userInstructions?: string | null;
  originalRecordId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    const [created] = await db
      .insert(meetingRecord)
      .values({
        userId,
        title,
        durationSeconds,
        speakerCount,
        summaryLevel,
        transcript,
        summary,
        userInstructions: userInstructions ?? null,
        originalRecordId: originalRecordId ?? null,
        metadata: metadata ?? null,
        createdAt: new Date(),
      })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to save meeting record",
    );
  }
}

/**
 * Get meeting records for a user (newest first)
 */
export async function getMeetingRecords({
  userId,
  limit = 20,
}: {
  userId: string;
  limit?: number;
}) {
  try {
    return await db
      .select()
      .from(meetingRecord)
      .where(eq(meetingRecord.userId, userId))
      .orderBy(desc(meetingRecord.createdAt))
      .limit(limit);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get meeting records",
    );
  }
}

/**
 * Get a single meeting record by ID (with user ownership check)
 */
export async function getMeetingRecordById({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  try {
    const [record] = await db
      .select()
      .from(meetingRecord)
      .where(
        and(eq(meetingRecord.id, id), eq(meetingRecord.userId, userId)),
      )
      .limit(1);
    return record ?? null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get meeting record",
    );
  }
}

/**
 * Delete a meeting record (with user ownership check)
 */
export async function deleteMeetingRecord({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<boolean> {
  try {
    const result = await db
      .delete(meetingRecord)
      .where(
        and(eq(meetingRecord.id, id), eq(meetingRecord.userId, userId)),
      );
    return (result.rowCount ?? 0) > 0;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete meeting record",
    );
  }
}

/**
 * Get meeting records count for a user
 */
export async function getMeetingRecordsCount({
  userId,
}: {
  userId: string;
}): Promise<number> {
  try {
    const [result] = await db
      .select({ count: count(meetingRecord.id) })
      .from(meetingRecord)
      .where(eq(meetingRecord.userId, userId));
    return result?.count ?? 0;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get meeting records count",
    );
  }
}

// ============================================================================
// Cron Run Log (ТЗ-COSTCTRL Phase 4)
// ============================================================================

export async function saveCronRunLog({
  cronName,
  startedAt,
  finishedAt,
  usersProcessed,
  usersSkipped,
  usersFailed,
  results,
}: {
  cronName: string;
  startedAt: Date;
  finishedAt: Date;
  usersProcessed: number;
  usersSkipped: number;
  usersFailed: number;
  results: CronRunLog["results"];
}): Promise<void> {
  try {
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    await db.insert(cronRunLog).values({
      cronName,
      startedAt,
      finishedAt,
      usersProcessed,
      usersSkipped,
      usersFailed,
      results,
      durationMs,
    });
  } catch (error) {
    // Non-blocking: log warning but never throw (cron must complete regardless)
    console.warn("[saveCronRunLog] Failed to save cron run log:", error);
  }
}
