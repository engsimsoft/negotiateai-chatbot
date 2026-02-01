import type { NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { ChatSDKError } from "@/lib/errors";

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

export async function POST(_request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return new ChatSDKError("unauthorized:api").toResponse();
    }

    // Check if API key is configured
    if (!DEEPGRAM_API_KEY) {
      return new ChatSDKError(
        "bad_request:api",
        "Deepgram API key is not configured"
      ).toResponse();
    }

    // For MVP: return the API key directly
    // In production: create temporary keys via Deepgram API with TTL
    // https://developers.deepgram.com/reference/create-key
    return Response.json({
      apiKey: DEEPGRAM_API_KEY,
      expiresAt: Date.now() + 600 * 1000, // 10 minutes
    });
  } catch {
    return new ChatSDKError("bad_request:api").toResponse();
  }
}

// GET endpoint to check if voice input is available (public - no auth required)
// This only checks if API key is configured, doesn't expose any secrets
export async function GET(_request: NextRequest) {
  return Response.json({
    available: !!DEEPGRAM_API_KEY,
  });
}
