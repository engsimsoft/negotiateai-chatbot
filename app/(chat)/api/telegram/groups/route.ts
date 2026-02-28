// ТЗ-TG5: GET /api/telegram/groups — список групп текущего пользователя

import { auth } from "@/app/(auth)/auth";
import { getTelegramGroupsByOwner } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const groups = await getTelegramGroupsByOwner({
      ownerUserId: session.user.id,
    });

    return Response.json({ groups });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError(
      "bad_request:api",
      "Failed to get Telegram groups",
    ).toResponse();
  }
}
