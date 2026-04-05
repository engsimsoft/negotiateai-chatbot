import { auth } from "@/app/(auth)/auth";
import {
  getTelegramConnection,
  createTelegramLinkToken,
  deleteTelegramConnection,
} from "@/lib/db/queries";
import { disableDeliveryOnTelegramDisconnect } from "@/lib/briefing/delivery-service";
import { ChatSDKError } from "@/lib/errors";

const BOT_USERNAME = "GetSimplyBot";

/**
 * ТЗ-TG3: POST /api/telegram/link
 * Generate a deep link URL for Telegram account linking.
 * Returns { linkUrl: "https://t.me/GetSimplyBot?start={token}" }
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const linkToken = await createTelegramLinkToken({
      userId: session.user.id,
    });

    const linkUrl = `https://t.me/${BOT_USERNAME}?start=${linkToken.token}`;

    return Response.json({ linkUrl });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError(
      "bad_request:api",
      "Failed to generate Telegram link"
    ).toResponse();
  }
}

/**
 * ТЗ-TG3: GET /api/telegram/link
 * Check current Telegram connection status.
 * Returns { connected: boolean, username?, firstName?, linkedAt? }
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const connection = await getTelegramConnection({
      userId: session.user.id,
    });

    if (!connection) {
      return Response.json({ connected: false });
    }

    return Response.json({
      connected: true,
      username: connection.telegramUsername,
      firstName: connection.telegramFirstName,
      linkedAt: connection.linkedAt.toISOString(),
      isActive: connection.isActive,
    });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError(
      "bad_request:api",
      "Failed to get Telegram status"
    ).toResponse();
  }
}

/**
 * ТЗ-TG3: DELETE /api/telegram/link
 * Unlink Telegram from Simply account.
 * Returns { success: true } (idempotent)
 */
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    await deleteTelegramConnection({ userId: session.user.id });

    // ТЗ-COSTCTRL Phase 1: Cascade — disable delivery to maintain invariant
    //   deliveryEnabled=true ⇒ active TelegramConnection exists
    await disableDeliveryOnTelegramDisconnect(session.user.id);

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError(
      "bad_request:api",
      "Failed to unlink Telegram"
    ).toResponse();
  }
}
