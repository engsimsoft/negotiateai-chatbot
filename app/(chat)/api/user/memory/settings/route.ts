// ТЗ-RAG2: Memory settings API — get/update memoryEnabled toggle
// ТЗ-MindOnVisit: + factExtractionStrategy (always / on-visit / cron)
import { auth } from "@/app/(auth)/auth";
import {
  getMemorySettings,
  updateMemorySettings,
  getProfileSummary,
} from "@/lib/db/queries";
import { countUserMemories } from "@/lib/ai/memory/memory-queries";
import { ChatSDKError } from "@/lib/errors";

const VALID_STRATEGIES = ["always", "on-visit", "cron"] as const;
type FactExtractionStrategy = (typeof VALID_STRATEGIES)[number];

function isValidStrategy(v: unknown): v is FactExtractionStrategy {
  return typeof v === "string" && (VALID_STRATEGIES as readonly string[]).includes(v);
}

/**
 * GET /api/user/memory/settings
 * Returns current memory settings + stats.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const [settings, factCount, profile] = await Promise.all([
      getMemorySettings({ userId: session.user.id }),
      countUserMemories(session.user.id),
      getProfileSummary({ userId: session.user.id }),
    ]);

    return Response.json({
      memoryEnabled: settings.memoryEnabled,
      factExtractionStrategy: settings.factExtractionStrategy,
      factCount,
      profile: profile
        ? {
            generatedAt: profile.generatedAt.toISOString(),
            factCount: profile.factCount,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError("bad_request:api", "Failed to get memory settings").toResponse();
  }
}

/**
 * PATCH /api/user/memory/settings
 * Body: { memoryEnabled?: boolean, factExtractionStrategy?: 'always' | 'on-visit' | 'cron' }
 */
export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const body = await request.json();
    const patch: {
      memoryEnabled?: boolean;
      factExtractionStrategy?: FactExtractionStrategy;
    } = {};

    if (body.memoryEnabled !== undefined) {
      if (typeof body.memoryEnabled !== "boolean") {
        return Response.json(
          { error: "memoryEnabled must be a boolean" },
          { status: 400 },
        );
      }
      patch.memoryEnabled = body.memoryEnabled;
    }

    if (body.factExtractionStrategy !== undefined) {
      if (!isValidStrategy(body.factExtractionStrategy)) {
        return Response.json(
          { error: `factExtractionStrategy must be one of: ${VALID_STRATEGIES.join(", ")}` },
          { status: 400 },
        );
      }
      patch.factExtractionStrategy = body.factExtractionStrategy;
    }

    if (Object.keys(patch).length === 0) {
      return Response.json(
        { error: "No settings to update" },
        { status: 400 },
      );
    }

    // Ensure settings row exists
    await getMemorySettings({ userId: session.user.id });

    await updateMemorySettings({
      userId: session.user.id,
      patch,
    });

    return Response.json({ ok: true, ...patch });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError("bad_request:api", "Failed to update memory settings").toResponse();
  }
}
