import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  json,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { AppUsage } from "../usage";

// ============================================================================
// Enums
// ============================================================================

export const agentTypeEnum = pgEnum("agent_type", ["system", "catalog"]);

// ============================================================================
// Types for JSONB columns
// ============================================================================

export type AgentCapabilities = {
  superpowers: string[];
  exampleTasks: string[];
  limitations: string[];
};

export type AgentCustomizations = {
  communicationStyle?: "formal" | "friendly" | "brief";
  userAddress?: "ты" | "вы" | string;
  specialization?: string;
  userContext?: string;
  systemPromptOverride?: string | null;
};

// ============================================================================
// User
// ============================================================================

export const user = pgTable("User", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 64 }).notNull(),
  password: varchar("password", { length: 64 }),
  // NOTE: role field removed in v2.3.0 (ТЗ-1 migration)
});

export type User = InferSelectModel<typeof user>;

// ============================================================================
// Agents (каталог)
// ============================================================================

export const agent = pgTable(
  "Agent",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    slug: varchar("slug", { length: 64 }).notNull(),
    type: agentTypeEnum("type").notNull().default("catalog"),
    name: varchar("name", { length: 100 }).notNull(),
    icon: varchar("icon", { length: 10 }).notNull(),
    description: text("description").notNull(),
    systemPrompt: text("system_prompt").notNull(),
    greeting: text("greeting").notNull(),
    defaultModel: varchar("default_model", { length: 50 }).notNull(),
    toolAccess: jsonb("tool_access").$type<string[] | null>(),
    capabilities: jsonb("capabilities").$type<AgentCapabilities>().notNull(),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    slugIdx: uniqueIndex("agent_slug_idx").on(table.slug),
    typeIdx: index("agent_type_idx").on(table.type),
    isActiveIdx: index("agent_is_active_idx").on(table.isActive),
  })
);

export type Agent = InferSelectModel<typeof agent>;

// ============================================================================
// User Agents (персональные копии)
// ============================================================================

export const userAgent = pgTable(
  "UserAgent",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    sourceAgentId: uuid("source_agent_id")
      .notNull()
      .references(() => agent.id),
    name: varchar("name", { length: 100 }).notNull(),
    customizations: jsonb("customizations").$type<AgentCustomizations | null>(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("user_agent_user_id_idx").on(table.userId),
    sourceAgentIdIdx: index("user_agent_source_agent_id_idx").on(table.sourceAgentId),
    userNameIdx: uniqueIndex("user_agent_user_name_idx").on(table.userId, table.name),
  })
);

export type UserAgent = InferSelectModel<typeof userAgent>;

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
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
  // agentId can reference either Agent.id or UserAgent.id (no strict FK)
  agentId: uuid("agentId"),
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
    kind: varchar("text", { enum: ["text", "image", "presentation-reveal", "presentation-pptx"] })
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
