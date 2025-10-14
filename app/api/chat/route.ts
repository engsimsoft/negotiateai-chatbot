import { streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';

// Initialize Anthropic provider for Vercel AI SDK
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

    // Stream chat completion using Vercel AI SDK
    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      messages,
      maxTokens: 4096,
      temperature: 1,
    });

    // Return streaming response
    return result.toDataStreamResponse();
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
