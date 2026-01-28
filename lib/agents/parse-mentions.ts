import type { Agent } from "@/lib/db/schema";

export type MentionMatch = {
  agent: Agent;
  /** The raw @mention string found in text (e.g. "@Маркетолог") */
  raw: string;
  /** Start index of the @mention in the original text */
  index: number;
};

/**
 * Parse @-mentions from user message text.
 * Matches by agent name or slug (case-insensitive).
 * Returns the first matched agent and the cleaned text (without the @mention).
 */
export function parseMention(
  text: string,
  agents: Agent[]
): { agent: Agent | null; cleanText: string } {
  // Match @SomeName at the beginning of text (most common pattern)
  const mentionRegex = /^@(\S+)\s*/;
  const match = text.match(mentionRegex);

  if (!match) {
    return { agent: null, cleanText: text };
  }

  const mentionName = match[1];

  // Try to find agent by name or slug (case-insensitive)
  const agent = agents.find(
    (a) =>
      a.name.toLowerCase() === mentionName.toLowerCase() ||
      a.slug.toLowerCase() === mentionName.toLowerCase()
  );

  if (!agent) {
    return { agent: null, cleanText: text };
  }

  // Remove the @mention from text
  const cleanText = text.slice(match[0].length).trim();

  return { agent, cleanText: cleanText || text };
}

/**
 * Build the {AGENTS_LIST} block for the Helper agent prompt.
 * Generates a formatted description of all active agents.
 */
export function buildAgentsList(agents: Agent[]): string {
  return agents
    .filter((a) => a.slug !== "helper" && a.isActive)
    .map((a) => {
      const caps = a.capabilities as { superpowers?: string[] };
      const superpowers = caps?.superpowers?.slice(0, 3).join(", ") || "";
      return `## ${a.icon} ${a.name} (@${a.name}, @${a.slug})\n${a.description}\nУмеет: ${superpowers}`;
    })
    .join("\n\n");
}
