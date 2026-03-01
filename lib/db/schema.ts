import type { InferSelectModel } from "drizzle-orm";
import {
  bigint,
  boolean,
  foreignKey,
  index,
  integer,
  numeric,
  uniqueIndex,
  json,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { AppUsage } from "../usage";

// ============================================================================
// User
// ============================================================================

export const user = pgTable("User", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 64 }).notNull().unique(),
  password: varchar("password", { length: 64 }),
  // ТЗ-3A: User profile fields
  displayName: varchar("display_name", { length: 100 }),
  pronouns: varchar("pronouns", { length: 10 }), // "ты" | "вы"
  occupation: varchar("occupation", { length: 100 }),
  bio: text("bio"),
  theme: varchar("theme", { length: 20 }), // "light" | "dark" | "system"
  // ТЗ-NEW-01: Ben intro flag
  hasSeenBenIntro: boolean("has_seen_ben_intro").default(false),
  // ТЗ-BF2: Last seen Simply News version (for unread indicator)
  lastSeenSimplyVersion: varchar("lastSeenSimplyVersion", { length: 20 }),
});

export type User = InferSelectModel<typeof user>;

// ============================================================================
// Project (ТЗ-03)
// ============================================================================

export const project = pgTable("Project", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  instruction: text("instruction"),
  // ТЗ-11: Контекст проекта (справка о бизнесе, заполняется Секретарём)
  context: text("context"),
  // ТЗ-A1: Фаза проекта (setup → documents → planning → approved → execution → completed)
  phase: varchar("phase", { length: 20 }).notNull().default("setup"),
  // ТЗ-A3: Manifest проекта (агрегированные данные о файлах от Клерка-анализатора)
  manifestJson: jsonb("manifestJson").$type<{
    files: Array<{
      fileId: string;
      name: string;
      description: string;
      documentType: string;
      folder: string;
      relevance: "core" | "reference" | "unclear";
      keyTopics: string[];
      language: string;
    }>;
    updatedAt: string;
  } | null>(),
  // ТЗ-B1: План проекта (structured JSON от Профессора)
  planJson: jsonb("planJson"),
  // ТЗ-B1: Подробный отчёт Профессора (Markdown)
  planReport: text("planReport"),
  // ТЗ-07C2: Итог проекта (AI-generated из summary задач)
  summary: text("summary"),
  summaryUpdatedAt: timestamp("summaryUpdatedAt"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export type Project = InferSelectModel<typeof project>;

// ============================================================================
// ProjectFolder (ТЗ-07C1) — папки для группировки файлов проекта
// ============================================================================

export const projectFolder = pgTable("ProjectFolder", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  projectId: uuid("projectId")
    .notNull()
    .references(() => project.id),
  name: varchar("name", { length: 100 }).notNull(),
  emoji: varchar("emoji", { length: 10 }).notNull().default("📁"),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").notNull(),
});

export type ProjectFolder = InferSelectModel<typeof projectFolder>;

// ============================================================================
// ProjectFile (ТЗ-03, ТЗ-07C1)
// ============================================================================

export const projectFile = pgTable("ProjectFile", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  projectId: uuid("projectId")
    .notNull()
    .references(() => project.id),
  // ТЗ-07C1: Привязка к папке (null = файл в корне проекта)
  folderId: uuid("folderId").references(() => projectFolder.id),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // document, audio, image, other
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  size: integer("size").notNull(), // bytes
  url: text("url").notNull(), // Vercel Blob URL
  metadata: jsonb("metadata").$type<{
    extractedContent?: string;
    pageCount?: number;
    duration?: number; // for audio/video
    dimensions?: { width: number; height: number }; // for images
    // ТЗ-A3: Результат анализа Клерка-анализатора
    analysis?: {
      description: string;
      documentType: string;
      suggestedFolder: string;
      relevance: "core" | "reference" | "unclear";
      keyTopics: string[];
      language: string;
    };
  } | null>(),
  createdAt: timestamp("createdAt").notNull(),
});

export type ProjectFile = InferSelectModel<typeof projectFile>;

// ============================================================================
// ProjectTask (ТЗ-B2) — задачи проекта из утверждённого плана Профессора
// ============================================================================

export const projectTaskStatusEnum = pgEnum("project_task_status", [
  "locked",
  "pending",
  "in_progress",
  "review",
  "issues",
  "done",
]);

export const projectTask = pgTable(
  "ProjectTask",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    projectId: uuid("projectId")
      .notNull()
      .references(() => project.id),
    orderIndex: integer("orderIndex").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    goal: text("goal"),
    input: text("input"),
    expectedOutput: text("expectedOutput"),
    status: projectTaskStatusEnum("status").notNull().default("locked"),
    chatId: uuid("chatId"),
    inputSummary: text("inputSummary"),
    outputSummary: text("outputSummary"),
    professorVerdict: jsonb("professorVerdict"),
    dependsOn: integer("dependsOn").array(),
    tools: text("tools").array(),
    needsReview: boolean("needsReview").notNull().default(false),
    createdAt: timestamp("createdAt").notNull(),
    updatedAt: timestamp("updatedAt").notNull(),
  },
  (table) => ({
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  })
);

export type ProjectTask = InferSelectModel<typeof projectTask>;

// ============================================================================
// Chat
// ============================================================================

// ТЗ-C1.5: Context snapshot types
export type SnapshotMeta = {
  messageId: string;
  createdAt: string;
  summary: string;
  /** Present in fallback (clerk-generated) snapshots */
  fullMarkdown?: string;
};

export type ContextState = {
  suggestionActive: boolean;
  messagesSinceSuggestion: number;
};

export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  title: text("title").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  // ТЗ-03: Привязка к проекту (null = свободный чат)
  projectId: uuid("projectId").references(() => project.id),
  // ТЗ-DV2: Режим чата (chat/expertise/create)
  chatMode: varchar("chatMode", { length: 20 }).notNull().default("chat"),
  // ТЗ-07A: Флаг ручного переименования (для автонейминга)
  isRenamed: boolean("isRenamed").notNull().default(false),
  // ТЗ-07B: Краткое содержание чата (AI-generated)
  summary: text("summary"),
  // ТЗ-07B: Важный чат (для будущей индексации RAG)
  isStarred: boolean("isStarred").notNull().default(false),
  // ТЗ-07C2: Статус задачи (только для проектных чатов)
  taskStatus: varchar("taskStatus", { length: 20 }).default("not_started"),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
  lastContext: jsonb("lastContext").$type<AppUsage | null>(),
  // ТЗ-C1.5: Context window management (snapshots)
  snapshots: jsonb("snapshots").default([]).$type<SnapshotMeta[]>(),
  contextState: jsonb("contextState").$type<ContextState | null>(),
});

export type Chat = InferSelectModel<typeof chat>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const messageDeprecated = pgTable("Message", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  content: json("content").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type MessageDeprecated = InferSelectModel<typeof messageDeprecated>;

export const message = pgTable("Message_v2", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  parts: json("parts").notNull(),
  attachments: json("attachments").notNull(),
  createdAt: timestamp("createdAt").notNull(),
  tokenCount: integer("tokenCount").default(0),
});

export type DBMessage = InferSelectModel<typeof message>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const voteDeprecated = pgTable(
  "Vote",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => messageDeprecated.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

export type VoteDeprecated = InferSelectModel<typeof voteDeprecated>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    kind: varchar("text", { enum: ["text", "image", "presentation-reveal", "presentation-pptx", "markdown", "excel"] })
      .notNull()
      .default("text"),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    // Public share fields
    isPublic: boolean("is_public").notNull().default(false),
    shareToken: varchar("share_token", { length: 32 }).unique(),
    sharedAt: timestamp("shared_at"),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
    };
  }
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    id: uuid("id").notNull().defaultRandom(),
    documentId: uuid("documentId").notNull(),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    description: text("description"),
    isResolved: boolean("isResolved").notNull().default(false),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  "Stream",
  {
    id: uuid("id").notNull().defaultRandom(),
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  })
);

export type Stream = InferSelectModel<typeof stream>;

// ============================================================================
// Briefing (ТЗ-BR1)
// ============================================================================

export const briefingSettings = pgTable(
  "BriefingSettings",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .unique()
      .references(() => user.id),
    isActive: boolean("isActive").notNull().default(false),
    timezone: varchar("timezone", { length: 50 }).notNull().default("Europe/Moscow"),
    generationTime: varchar("generationTime", { length: 5 }).notNull().default("06:00"),
    language: varchar("language", { length: 10 }).notNull().default("ru"),
    maxItems: integer("maxItems").notNull().default(15),
    volume: varchar("volume", { length: 20 }).notNull().default("standard"),
    // ТЗ-TG4a: Delivery settings
    deliveryEnabled: boolean("deliveryEnabled").notNull().default(false),
    deliveryFormat: varchar("deliveryFormat", { length: 20 }).notNull().default("text_audio"),
    createdAt: timestamp("createdAt").notNull(),
    updatedAt: timestamp("updatedAt").notNull(),
  },
  (table) => ({
    userIdx: index("briefing_settings_user_idx").on(table.userId),
  })
);

export type BriefingSettings = InferSelectModel<typeof briefingSettings>;

export const briefingSources = pgTable(
  "BriefingSources",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    topicId: varchar("topicId", { length: 50 }).notNull(),
    sourceUrl: text("sourceUrl").notNull(),
    sourceName: varchar("sourceName", { length: 200 }).notNull(),
    sourceLanguage: varchar("sourceLanguage", { length: 10 }).notNull().default("ru"),
    tier: varchar("tier", { length: 20 }).notNull().default("unknown"),
    rssUrl: text("rssUrl"),
    fetchMethod: varchar("fetchMethod", { length: 20 }).notNull(),
    isActive: boolean("isActive").notNull().default(true),
    priority: integer("priority").notNull().default(5),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    userIdx: index("briefing_sources_user_idx").on(table.userId),
  })
);

export type BriefingSource = InferSelectModel<typeof briefingSources>;

// ТЗ-A2: Custom user topics (AI-generated during onboarding)
export const briefingTopics = pgTable(
  "BriefingTopics",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    topicId: varchar("topicId", { length: 50 }).notNull(),
    topicName: varchar("topicName", { length: 100 }).notNull(),
    emoji: varchar("emoji", { length: 10 }).notNull(),
    orderIndex: integer("orderIndex").notNull().default(0),
    briefingStyle: text("briefing_style"), // ТЗ-HF1: инструкция автору по стилю (1-3 предложения), nullable
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    userIdx: index("briefing_topics_user_idx").on(table.userId),
    userTopicIdx: uniqueIndex("briefing_topics_user_topic_idx").on(
      table.userId,
      table.topicId
    ),
  })
);

export type BriefingTopic = InferSelectModel<typeof briefingTopics>;

export const briefingHistory = pgTable(
  "BriefingHistory",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    briefingJson: jsonb("briefingJson").notNull(),
    sourcesChecked: integer("sourcesChecked"),
    itemsIncluded: integer("itemsIncluded"),
    duplicatesRemoved: integer("duplicatesRemoved"),
    tokensUsed: integer("tokensUsed"),
    status: varchar("status", { length: 20 }).notNull(),
    generatedAt: timestamp("generatedAt").notNull(),
    createdAt: timestamp("createdAt").notNull(),
    // ТЗ-TG4a: Delivery status per-issue
    deliveryStatus: varchar("deliveryStatus", { length: 20 }).notNull().default("none"),
    // ТЗ-Б1: Podcast Engine audio columns
    audioUrls: jsonb("audioUrls"),
    audioStatus: text("audioStatus").default("none"),
    audioDurations: jsonb("audioDurations"),
    // ТЗ-DEV2: Pipeline trace metadata (jsonb, nullable)
    metadata: jsonb("metadata"),
  },
  (table) => ({
    userIdx: index("briefing_history_user_idx").on(table.userId),
    userGeneratedAtIdx: index("briefing_history_user_generated_idx").on(
      table.userId,
      table.generatedAt
    ),
  })
);

export type BriefingHistory = InferSelectModel<typeof briefingHistory>;

export const savedBriefingTopics = pgTable(
  "SavedBriefingTopics",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    topicId: text("topicId").notNull(),
    topicName: text("topicName").notNull(),
    emoji: text("emoji").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    sources: jsonb("sources").notNull(),
    briefingGeneratedAt: timestamp("briefingGeneratedAt").notNull(),
    savedAt: timestamp("savedAt").notNull(),
  },
  (table) => ({
    userIdx: index("saved_briefing_topics_user_idx").on(table.userId),
  })
);

export type SavedBriefingTopic = InferSelectModel<typeof savedBriefingTopics>;

// ============================================================================
// AI Usage Log (ТЗ-OPT1)
// ============================================================================

export const aiUsageLog = pgTable(
  "ai_usage_log",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    chatId: uuid("chatId").references(() => chat.id),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    modelId: varchar("modelId", { length: 100 }).notNull(),
    inputTokens: integer("inputTokens").notNull().default(0),
    outputTokens: integer("outputTokens").notNull().default(0),
    thinkingTokens: integer("thinkingTokens").notNull().default(0),
    cacheWriteTokens: integer("cacheWriteTokens").notNull().default(0),
    cacheReadTokens: integer("cacheReadTokens").notNull().default(0),
    costUsd: numeric("costUsd", { precision: 10, scale: 6 }),
    chatMode: varchar("chatMode", { length: 50 }).notNull(),
    durationMs: integer("durationMs"),
    guardianFlags: jsonb("guardianFlags"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    userCreatedAtIdx: index("ai_usage_log_user_created_idx").on(
      table.userId,
      table.createdAt
    ),
    chatModeCreatedAtIdx: index("ai_usage_log_chatmode_created_idx").on(
      table.chatMode,
      table.createdAt
    ),
  })
);

export type AiUsageLog = InferSelectModel<typeof aiUsageLog>;

// ============================================================================
// Telegram Bot (ТЗ-TG3)
// ============================================================================

export const telegramConnection = pgTable("TelegramConnection", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .unique()
    .references(() => user.id),
  telegramUserId: bigint("telegramUserId", { mode: "number" }).notNull().unique(),
  telegramUsername: text("telegramUsername"),
  telegramFirstName: text("telegramFirstName"),
  isActive: boolean("isActive").notNull().default(true),
  linkedAt: timestamp("linkedAt").notNull(),
});

export type TelegramConnection = InferSelectModel<typeof telegramConnection>;

export const telegramLinkToken = pgTable("TelegramLinkToken", {
  token: text("token").primaryKey().notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  createdAt: timestamp("createdAt").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
});

export type TelegramLinkToken = InferSelectModel<typeof telegramLinkToken>;

// ============================================================================
// Telegram Groups (ТЗ-TG5)
// ============================================================================

export const telegramGroup = pgTable("TelegramGroup", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  telegramChatId: bigint("telegramChatId", { mode: "number" })
    .notNull()
    .unique(),
  title: varchar("title", { length: 255 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // "group" | "supergroup"
  isForum: boolean("isForum").notNull().default(false),
  ownerUserId: uuid("ownerUserId").references(() => user.id),
  isActive: boolean("isActive").notNull().default(true),
  memberCount: integer("memberCount"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export type TelegramGroup = InferSelectModel<typeof telegramGroup>;

export const telegramGroupTopic = pgTable(
  "TelegramGroupTopic",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    groupId: uuid("groupId")
      .notNull()
      .references(() => telegramGroup.id),
    telegramTopicId: integer("telegramTopicId").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    groupTopicIdx: uniqueIndex("tg_group_topic_unique_idx").on(
      table.groupId,
      table.telegramTopicId
    ),
  })
);

export type TelegramGroupTopic = InferSelectModel<typeof telegramGroupTopic>;

export const telegramMessage = pgTable(
  "TelegramMessage",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    groupId: uuid("groupId")
      .notNull()
      .references(() => telegramGroup.id),
    topicId: uuid("topicId").references(() => telegramGroupTopic.id),
    telegramMessageId: integer("telegramMessageId").notNull(),
    fromUserId: bigint("fromUserId", { mode: "number" }).notNull(),
    fromUsername: varchar("fromUsername", { length: 255 }),
    fromFirstName: varchar("fromFirstName", { length: 255 }),
    text: text("text").notNull(),
    hasMedia: boolean("hasMedia").notNull().default(false),
    mediaType: varchar("mediaType", { length: 20 }), // "photo"|"video"|"document"|"voice"|"sticker"
    fileName: varchar("fileName", { length: 255 }),
    fileSize: integer("fileSize"),
    blobUrl: text("blobUrl"),
    sentAt: timestamp("sentAt").notNull(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    groupSentAtIdx: index("tg_message_group_sent_idx").on(
      table.groupId,
      table.sentAt
    ),
    groupTopicSentAtIdx: index("tg_message_group_topic_sent_idx").on(
      table.groupId,
      table.topicId,
      table.sentAt
    ),
  })
);

export type TelegramMessage = InferSelectModel<typeof telegramMessage>;

// ============================================================================
// Meeting Recorder (ТЗ-MR)
// ============================================================================

export const meetingRecord = pgTable(
  "MeetingRecord",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    title: varchar("title", { length: 255 }).notNull(),
    durationSeconds: integer("durationSeconds").notNull(),
    speakerCount: integer("speakerCount").notNull().default(0),
    summaryLevel: varchar("summaryLevel", { length: 20 }).notNull(), // "compact" | "standard" | "detailed"
    transcript: text("transcript").notNull(),
    summary: text("summary").notNull(),
    metadata: jsonb("metadata").$type<{
      modelId?: string;
      inputTokens?: number;
      outputTokens?: number;
      costUsd?: number;
      deepgramDurationMs?: number;
      claudeDurationMs?: number;
    } | null>(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    userIdx: index("meeting_record_user_idx").on(table.userId),
    userCreatedAtIdx: index("meeting_record_user_created_idx").on(
      table.userId,
      table.createdAt
    ),
  })
);

export type MeetingRecord = InferSelectModel<typeof meetingRecord>;
