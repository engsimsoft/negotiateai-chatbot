import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

/**
 * Create a streaming chat completion with Claude
 * @param messages - Array of messages in the conversation
 * @param systemPrompt - Optional system prompt for Claude
 * @returns AsyncGenerator of text chunks
 */
export async function* streamChatCompletion(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt?: string
): AsyncGenerator<string> {
  try {
    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: messages,
      system: systemPrompt,
    });

    // Stream text chunks as they arrive
    for await (const chunk of stream) {
      if (
        chunk.type === 'content_block_delta' &&
        chunk.delta.type === 'text_delta'
      ) {
        yield chunk.delta.text;
      }
    }
  } catch (error) {
    console.error('Error in streamChatCompletion:', error);
    throw error;
  }
}

/**
 * Simple non-streaming chat completion (for testing)
 * @param message - User message
 * @returns Claude's response
 */
export async function simpleChatCompletion(message: string): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: message }],
    });

    const textContent = response.content.find((block) => block.type === 'text');
    return textContent && textContent.type === 'text' ? textContent.text : '';
  } catch (error) {
    console.error('Error in simpleChatCompletion:', error);
    throw error;
  }
}

export default anthropic;
