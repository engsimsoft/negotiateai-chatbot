// ТЗ-BF1: POST/DELETE /api/briefing/topics/save — save/delete a briefing topic

import { auth } from "@/app/(auth)/auth";
import {
  deleteSavedBriefingTopic,
  saveBriefingTopic,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:chat");
  }

  const userId = session.user.id;
  const body = await request.json();

  const {
    topicId,
    topicName,
    emoji,
    title,
    content,
    sources,
    briefingGeneratedAt,
  } = body;

  if (!topicId || !topicName || !title || !content) {
    return Response.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const saved = await saveBriefingTopic({
    userId,
    topicId,
    topicName,
    emoji: emoji ?? "",
    title,
    content,
    sources: sources ?? [],
    briefingGeneratedAt: new Date(briefingGeneratedAt),
  });

  return Response.json(saved);
}

export async function DELETE(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:chat");
  }

  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "Missing id parameter" }, { status: 400 });
  }

  const deleted = await deleteSavedBriefingTopic({ id, userId });

  if (!deleted) {
    return Response.json({ error: "Topic not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}
