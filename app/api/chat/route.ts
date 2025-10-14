import { streamText, convertToModelMessages } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';

// Initialize Anthropic provider
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // Basic validation
    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid request: messages array required', {
        status: 400,
      });
    }

    // Convert UI messages to model messages
    const modelMessages = convertToModelMessages(messages);

    // Stream chat completion
    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      messages: modelMessages,
      maxTokens: 4096,
      temperature: 1,
    });

    // Return UI message stream response (for useChat compatibility)
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Error in chat API:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to process chat request',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
