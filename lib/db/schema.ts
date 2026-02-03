import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  integer,
  json,
  jsonb,
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
  email: varchar("email", { length: 64 }).notNull(),
  password: varchar("password", { length: 64 }),
  // ТЗ-3A: User profile fields
  displayName: varchar("display_name", { length: 100 }),
  pronouns: varchar("pronouns", { length: 10 }), // "ты" | "вы"
  occupation: varchar("occupation", { length: 100 }),
  bio: text("bio"),
  theme: varchar("theme", { length: 20 }), // "light" | "dark" | "system"
  // ТЗ-NEW-01: Ben intro flag
  hasSeenBenIntro: boolean("has_seen_ben_intro").default(false),
});

export type User = InferSelectModel<typeof user>;

// ============================================================================
// Helper (ТЗ-07A) - Кастомные помощники пользователя
// ============================================================================

export const helper = pgTable("Helper", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  name: varchar("name", { length: 100 }).notNull(),
  emoji: varchar("emoji", { length: 10 }).notNull().default("🤖"),
  instruction: text("instruction"), // Системный промпт помощника
  skills: jsonb("skills").$type<string[] | null>(), // Массив ID навыков
  createdAt: timestamp("createdAt").notNull(),
});

export type Helper = InferSelectModel<typeof helper>;

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
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export type Project = InferSelectModel<typeof project>;

// ============================================================================
// ProjectFile (ТЗ-03)
// ============================================================================

export const projectFile = pgTable("ProjectFile", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  projectId: uuid("projectId")
    .notNull()
    .references(() => project.id),
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
  } | null>(),
  createdAt: timestamp("createdAt").notNull(),
});

export type ProjectFile = InferSelectModel<typeof projectFile>;

// ============================================================================
// Chat
// ============================================================================

export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  title: text("title").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  // ТЗ-03: Привязка к проекту (null = свободный чат)
  projectId: uuid("projectId").references(() => project.id),
  // ТЗ-07A: Привязка к помощнику (null = обычный чат)
  helperId: uuid("helperId").references(() => helper.id),
  // ТЗ-07A: Флаг ручного переименования (для автонейминга)
  isRenamed: boolean("isRenamed").notNull().default(false),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
  lastContext: jsonb("lastContext").$type<AppUsage | null>(),
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
