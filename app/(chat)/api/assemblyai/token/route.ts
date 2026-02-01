import type { NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { ChatSDKError } from "@/lib/errors";

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

export async function POST(_request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return new ChatSDKError("unauthorized:api").toResponse();
    }

    // Check if API key is configured
    if (!ASSEMBLYAI_API_KEY) {
      return new ChatSDKError(
        "bad_request:api",
        "AssemblyAI API key is not configured"
      ).toResponse();
    }

    // Request temporary token from AssemblyAI
    const response = await fetch("https://api.assemblyai.com/v2/realtime/token", {
      method: "POST",
      headers: {
        Authorization: ASSEMBLYAI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expires_in: 3600, // 1 hour
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AssemblyAI token error:", errorText);
      return new ChatSDKError(
        "bad_request:api",
        "Failed to get AssemblyAI token"
      ).toResponse();
    }

    const data = await response.json();

    return Response.json({
      token: data.token,
      expiresAt: Date.now() + 3600 * 1000, // 1 hour from now
    });
  } catch (error) {
    console.error("AssemblyAI token endpoint error:", error);
    return new ChatSDKError("bad_request:api").toResponse();
  }
}

// GET endpoint to check if voice input is available (public - no auth required)
// This only checks if API key is configured, doesn't expose any secrets
export async function GET(_request: NextRequest) {
  return Response.json({
    available: !!ASSEMBLYAI_API_KEY,
  });
}
