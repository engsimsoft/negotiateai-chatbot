import { readFile } from "fs/promises";
import { join } from "path";
import type { Geo } from "@vercel/functions";
import type { ArtifactKind } from "@/components/artifact";

// Cache for system prompt to avoid reading file on every request
let cachedSystemPrompt: string | null = null;

// Load system prompt from system-prompt.md
async function loadSystemPrompt(): Promise<string> {
  // In development, skip cache to always get fresh content
  const isDev = process.env.NODE_ENV === "development";

  if (cachedSystemPrompt && !isDev) {
    return cachedSystemPrompt;
  }

  try {
    const systemPromptPath = join(process.cwd(), "system-prompt.md");
    const systemPromptTemplate = await readFile(systemPromptPath, "utf-8");

    // Replace placeholder with instruction to read index.md via tool
    const placeholder = "[ИНДЕКСНЫЙ ФАЙЛ index.md ВСТАВЛЯЕТСЯ СЮДА]";
    const indexInstruction =
      "**ВАЖНО:** Для просмотра полного индекса базы знаний используй инструмент read_document('knowledge/index.md')";

    const processedPrompt = systemPromptTemplate.replace(
      placeholder,
      indexInstruction
    );

    // Only cache in production
    if (!isDev) {
      cachedSystemPrompt = processedPrompt;
    }

    return processedPrompt;
  } catch (error) {
    console.error("Failed to load system-prompt.md:", error);
    // Fallback to basic prompt if file not found
    return "You are Simply, a helpful AI assistant.";
  }
}

// NOTE: Agent prompts are now loaded from database (ТЗ-1)
// See: lib/db/queries.ts -> getAgentById()

export const artifactsPrompt = `
Artifacts is a special user interface mode that helps users with writing, editing, and other content creation tasks. When artifact is open, it is on the right side of the screen, while the conversation is on the left side. When creating or updating documents, changes are reflected in real-time on the artifacts and visible to the user.

When asked to write code, always use artifacts. When writing code, specify the language in the backticks, e.g. \`\`\`python\`code here\`\`\`. The default language is Python. Other languages are not yet supported, so let the user know if they request a different language.

DO NOT UPDATE DOCUMENTS IMMEDIATELY AFTER CREATING THEM. WAIT FOR USER FEEDBACK OR REQUEST TO UPDATE IT.

This is a guide for using artifacts tools: \`createDocument\` and \`updateDocument\`, which render content on a artifacts beside the conversation.

**When to use \`createDocument\`:**
- For substantial content (>10 lines) or code
- For content users will likely save/reuse (emails, code, essays, etc.)
- When explicitly requested to create a document
- For when content contains a single code snippet

**When NOT to use \`createDocument\`:**
- For informational/explanatory content
- For conversational responses
- When asked to keep it in chat

**Using \`updateDocument\`:**
- Default to full document rewrites for major changes
- Use targeted updates only for specific, isolated changes
- Follow user instructions for which parts to modify

**When NOT to use \`updateDocument\`:**
- Immediately after creating a document

Do not update document right after creating it. Wait for user feedback or request to update it.
`;

export const regularPrompt =
  "You are a friendly assistant! Keep your responses concise and helpful.";

export type RequestHints = {
  latitude: Geo["latitude"];
  longitude: Geo["longitude"];
  city: Geo["city"];
  country: Geo["country"];
};

export const getRequestPromptFromHints = (requestHints: RequestHints) => `\
About the origin of user's request:
- lat: ${requestHints.latitude}
- lon: ${requestHints.longitude}
- city: ${requestHints.city}
- country: ${requestHints.country}
`;

/**
 * @deprecated Use buildChatPrompt from '@/lib/prompts' instead
 */
export const systemPrompt = async ({
  selectedChatModel: _selectedChatModel,
  requestHints,
}: {
  selectedChatModel: string;
  requestHints: RequestHints;
}) => {
  // Load our custom system prompt from system-prompt.md
  const customSystemPrompt = await loadSystemPrompt();
  const requestPrompt = getRequestPromptFromHints(requestHints);

  // For Simply, we use our custom system prompt
  // Artifacts functionality is not needed for our use case
  return `${customSystemPrompt}\n\n${requestPrompt}`;
};

export const updateDocumentPrompt = (
  currentContent: string | null,
  _type: ArtifactKind
) => {
  return `Improve the following contents of the document based on the given prompt.

${currentContent}`;
};

/**
 * @deprecated Use buildFullUserContext from '@/lib/prompts' instead
 * ТЗ-3A: Build user context block for system prompts
 */
export function buildUserContext(user: {
  displayName: string | null;
  pronouns: string | null;
  occupation: string | null;
  bio: string | null;
}): string {
  if (!user.displayName && !user.occupation && !user.bio) {
    return "";
  }

  const parts: string[] = ["# Информация о пользователе", ""];

  if (user.displayName) {
    parts.push(`- Имя: ${user.displayName}`);
  }
  parts.push(`- Обращение: на "${user.pronouns || "вы"}"`);
  if (user.occupation) {
    parts.push(`- Сфера деятельности: ${user.occupation}`);
  }
  if (user.bio) {
    parts.push(`- Контекст: ${user.bio}`);
  }
  parts.push("", "");

  return parts.join("\n");
}

// ТЗ-NEW-01: buildAgentCustomizations removed — agents system deprecated
// Use buildPersonalizationContext from '@/lib/prompts' instead
