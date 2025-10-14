import { streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import fs from 'fs/promises';
import path from 'path';

// Initialize Anthropic provider
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export const runtime = 'nodejs';

// Cache system prompt in memory
let systemPrompt: string | null = null;

async function getSystemPrompt(): Promise<string> {
  if (systemPrompt) {
    return systemPrompt;
  }

  try {
    const projectRoot = process.cwd();
    const promptPath = path.join(projectRoot, 'system-prompt.md');
    systemPrompt = await fs.readFile(promptPath, 'utf-8');
    return systemPrompt;
  } catch (error) {
    console.error('Failed to load system prompt:', error);
    return 'You are NegotiateAI Assistant, an AI expert in international trade, government procurement, and tender processes.';
  }
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid request: messages array required', {
        status: 400,
      });
    }

    // Load system prompt
    const systemPromptText = await getSystemPrompt();

    // Convert AI SDK v5 format (with parts) to standard format
    const convertedMessages = messages.map((msg: any) => {
      if (msg.parts && Array.isArray(msg.parts)) {
        // Extract text from parts
        const textContent = msg.parts
          .filter((part: any) => part.type === 'text')
          .map((part: any) => part.text)
          .join('');

        return {
          role: msg.role,
          content: textContent,
        };
      }
      return msg;
    });

    // Stream chat completion (without tools for now - will add later)
    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: systemPromptText,
      messages: convertedMessages,
      maxTokens: 4096,
      temperature: 1,
    });

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
