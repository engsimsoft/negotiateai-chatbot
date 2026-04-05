import { auth } from "@/app/(auth)/auth";
import {
  getBriefingSettings,
  getTelegramConnection,
} from "@/lib/db/queries";
import { setBriefingDelivery } from "@/lib/briefing/delivery-service";

/**
 * GET /api/briefing/delivery
 *
 * Returns delivery settings + telegram connection status.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [settings, telegram] = await Promise.all([
    getBriefingSettings({ userId: session.user.id }),
    getTelegramConnection({ userId: session.user.id }),
  ]);

  return Response.json({
    deliveryEnabled: settings?.deliveryEnabled ?? false,
    deliveryFormat: settings?.deliveryFormat ?? "text_audio",
    generationTime: settings?.generationTime ?? "07:00",
    timezone: settings?.timezone ?? "Europe/Moscow",
    telegramConnected: telegram?.isActive ?? false,
    telegramUsername: telegram?.telegramUsername ?? null,
  });
}

/**
 * PATCH /api/briefing/delivery
 *
 * Update delivery settings. Delegates to setBriefingDelivery service
 * which enforces the invariant:
 *   deliveryEnabled=true ⇒ active TelegramConnection exists
 *
 * Returns 409 Conflict with error code if invariant violated.
 */
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const result = await setBriefingDelivery({
    userId: session.user.id,
    enabled:
      typeof body.deliveryEnabled === "boolean"
        ? body.deliveryEnabled
        : undefined,
    format:
      typeof body.deliveryFormat === "string"
        ? (body.deliveryFormat as "text" | "audio" | "text_audio")
        : undefined,
    time: typeof body.generationTime === "string" ? body.generationTime : undefined,
    timezone:
      typeof body.timezone === "string" && body.timezone.length <= 50
        ? body.timezone
        : undefined,
  });

  if (!result.ok) {
    return Response.json(
      { error: result.code, message: result.message },
      { status: 409 },
    );
  }

  return Response.json(result.settings);
}
