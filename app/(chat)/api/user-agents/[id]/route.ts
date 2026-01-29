import type { NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  deleteUserAgent,
  getUserAgentById,
  updateUserAgent,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

/**
 * PATCH /api/user-agents/[id]
 * ТЗ-3B: Update a personal agent
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const { id } = await params;
    const body = await request.json();
    const { name, customizations } = body;

    // Verify ownership
    const existingAgent = await getUserAgentById({
      id,
      userId: session.user.id,
    });

    if (!existingAgent) {
      return new ChatSDKError("not_found:api", "User agent not found").toResponse();
    }

    // Update the agent
    const updated = await updateUserAgent({
      id,
      userId: session.user.id,
      name,
      customizations,
    });

    if (!updated) {
      return new ChatSDKError(
        "bad_request:api",
        "Failed to update user agent"
      ).toResponse();
    }

    return Response.json(updated);
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to update user agent"
    ).toResponse();
  }
}

/**
 * DELETE /api/user-agents/[id]
 * ТЗ-3B: Delete a personal agent (soft delete)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const { id } = await params;

    // Verify ownership
    const existingAgent = await getUserAgentById({
      id,
      userId: session.user.id,
    });

    if (!existingAgent) {
      return new ChatSDKError("not_found:api", "User agent not found").toResponse();
    }

    // Soft delete
    const deleted = await deleteUserAgent({
      id,
      userId: session.user.id,
    });

    if (!deleted) {
      return new ChatSDKError(
        "bad_request:api",
        "Failed to delete user agent"
      ).toResponse();
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to delete user agent"
    ).toResponse();
  }
}
