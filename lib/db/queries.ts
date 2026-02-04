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
  lt,
  sql,
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
  type Chat,
  chat,
  type DBMessage,
  document,
  type Helper,
  helper,
  message,
  type Project,
  project,
  type ProjectFile,
  projectFile,
  type Suggestion,
  stream,
  suggestion,
  type User,
  user,
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

export async function saveChat({
  id,
  userId,
  title,
  visibility,
  projectId,
  helperId,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
  projectId?: string;
  helperId?: string;
}) {
  try {
    console.log('[saveChat] Attempting to save chat:', { id, userId, title, visibility, projectId, helperId });
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
      projectId: projectId || null,
      helperId: helperId || null,
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
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    // Performance: Exclude lastContext (heavy JSONB) from history listing
    // ТЗ-03: Filter out project chats - only show free chats (projectId = null)
    const baseCondition = and(eq(chat.userId, id), isNull(chat.projectId));

    const query = (whereCondition?: SQL<any>) =>
      db
        .select({
          id: chat.id,
          createdAt: chat.createdAt,
          title: chat.title,
          userId: chat.userId,
          projectId: chat.projectId,
          helperId: chat.helperId,
          isRenamed: chat.isRenamed,
          visibility: chat.visibility,
          lastContext: sql<null>`NULL`.as("lastContext"),
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
}: {
  id: string;
  userId: string;
  name: string;
  description?: string;
  instruction?: string;
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
 * Delete a project and all its files and chats (cascade)
 */
export async function deleteProjectById({ id }: { id: string }) {
  try {
    // Get all chats in this project
    const projectChats = await db
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.projectId, id));

    const chatIds = projectChats.map((c) => c.id);

    // Delete messages and votes for project chats
    if (chatIds.length > 0) {
      // Delete votes first (FK constraint)
      await db.delete(vote).where(inArray(vote.chatId, chatIds));

      // Delete messages
      await db.delete(message).where(inArray(message.chatId, chatIds));

      // Delete chats
      await db.delete(chat).where(inArray(chat.id, chatIds));
    }

    // Delete project files
    await db.delete(projectFile).where(eq(projectFile.projectId, id));

    // Delete project
    await db.delete(project).where(eq(project.id, id));

    return { success: true };
  } catch (_error) {
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
        helperId: chat.helperId,
        isRenamed: chat.isRenamed,
        visibility: chat.visibility,
        lastContext: sql<null>`NULL`.as("lastContext"),
      })
      .from(chat)
      .where(eq(chat.projectId, projectId))
      .orderBy(desc(chat.createdAt));

    return chats;
  } catch (_error) {
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
// Helper Functions (ТЗ-07A) - Кастомные помощники
// ============================================

/**
 * Get all custom helpers for a user
 */
export async function getHelpersByUserId({ userId }: { userId: string }) {
  try {
    const helpers = await db
      .select()
      .from(helper)
      .where(eq(helper.userId, userId))
      .orderBy(desc(helper.createdAt));

    return helpers;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get helpers by user id"
    );
  }
}

/**
 * Get a single helper by ID
 */
export async function getHelperById({ id }: { id: string }) {
  try {
    const [selectedHelper] = await db
      .select()
      .from(helper)
      .where(eq(helper.id, id));

    return selectedHelper || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get helper by id"
    );
  }
}

/**
 * Create a new custom helper
 */
export async function saveHelper({
  id,
  userId,
  name,
  emoji,
  instruction,
  skills,
}: {
  id: string;
  userId: string;
  name: string;
  emoji?: string;
  instruction?: string;
  skills?: string[];
}) {
  try {
    const [newHelper] = await db
      .insert(helper)
      .values({
        id,
        userId,
        name,
        emoji: emoji || "🤖",
        instruction: instruction || null,
        skills: skills || null,
        createdAt: new Date(),
      })
      .returning();

    return newHelper;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save helper");
  }
}

/**
 * Update helper details
 */
export async function updateHelper({
  id,
  name,
  emoji,
  instruction,
  skills,
}: {
  id: string;
  name?: string;
  emoji?: string;
  instruction?: string;
  skills?: string[];
}) {
  try {
    const updateData: Partial<Helper> = {};

    if (name !== undefined) updateData.name = name;
    if (emoji !== undefined) updateData.emoji = emoji;
    if (instruction !== undefined) updateData.instruction = instruction;
    if (skills !== undefined) updateData.skills = skills;

    const [updated] = await db
      .update(helper)
      .set(updateData)
      .where(eq(helper.id, id))
      .returning();

    return updated;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to update helper");
  }
}

/**
 * Delete a helper and unlink all its chats (set helperId to null)
 */
export async function deleteHelperById({ id }: { id: string }) {
  try {
    // First, unlink all chats from this helper (don't delete them)
    await db
      .update(chat)
      .set({ helperId: null })
      .where(eq(chat.helperId, id));

    // Then delete the helper
    await db.delete(helper).where(eq(helper.id, id));

    return { success: true };
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to delete helper");
  }
}

/**
 * Get chats for a specific helper
 */
export async function getChatsByHelperId({ helperId }: { helperId: string }) {
  try {
    const chats = await db
      .select({
        id: chat.id,
        createdAt: chat.createdAt,
        title: chat.title,
        userId: chat.userId,
        projectId: chat.projectId,
        helperId: chat.helperId,
        isRenamed: chat.isRenamed,
        visibility: chat.visibility,
        lastContext: sql<null>`NULL`.as("lastContext"),
      })
      .from(chat)
      .where(eq(chat.helperId, helperId))
      .orderBy(desc(chat.createdAt));

    return chats;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get chats by helper id"
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
