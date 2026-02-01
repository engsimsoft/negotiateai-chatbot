/**
 * Chat Memory Context Builder
 *
 * Builds context block from chat memory/history.
 * Used for maintaining context across conversations.
 *
 * Note: Full implementation depends on future chat memory feature (ТЗ-10).
 * This is a placeholder with basic structure.
 */

/**
 * Memory entry structure
 */
export interface MemoryEntry {
  /** What was remembered */
  content: string;

  /** When it was saved */
  timestamp: Date;

  /** Category/type of memory */
  category?: 'preference' | 'fact' | 'task' | 'context';

  /** Relevance score (0-1) */
  relevance?: number;
}

/**
 * Build memory context block
 *
 * @param memories - Array of memory entries
 * @param maxEntries - Maximum entries to include (default: 5)
 * @returns Formatted context string or empty string
 */
export function buildMemoryContext(
  memories?: MemoryEntry[],
  maxEntries: number = 5
): string {
  if (!memories || memories.length === 0) {
    return '';
  }

  // Sort by relevance (if available) or recency
  const sorted = [...memories].sort((a, b) => {
    if (a.relevance !== undefined && b.relevance !== undefined) {
      return b.relevance - a.relevance;
    }
    return b.timestamp.getTime() - a.timestamp.getTime();
  });

  // Take top entries
  const topMemories = sorted.slice(0, maxEntries);

  const lines: string[] = ['## Контекст из предыдущих разговоров', ''];

  for (const memory of topMemories) {
    const categoryEmoji = getCategoryEmoji(memory.category);
    lines.push(`${categoryEmoji} ${memory.content}`);
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Get emoji for memory category
 */
function getCategoryEmoji(category?: MemoryEntry['category']): string {
  switch (category) {
    case 'preference':
      return '⭐';
    case 'fact':
      return '📌';
    case 'task':
      return '✅';
    case 'context':
      return '💬';
    default:
      return '•';
  }
}

/**
 * Build simple memory context from string
 *
 * @param memoryText - Plain text memory/context
 * @returns Formatted context string
 */
export function buildSimpleMemoryContext(memoryText?: string): string {
  if (!memoryText || !memoryText.trim()) {
    return '';
  }

  return `## Контекст

${memoryText}

`;
}

/**
 * Placeholder for future RAG integration
 * Will retrieve relevant context from vector database
 */
export async function retrieveRelevantContext(
  _query: string,
  _userId: string,
  _limit: number = 5
): Promise<MemoryEntry[]> {
  // TODO: Implement with vector DB (ТЗ-9 RAG)
  return [];
}
