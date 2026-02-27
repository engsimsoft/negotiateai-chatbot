import { auth } from "@/app/(auth)/auth";
import {
  getBriefingSettings,
  getTelegramConnection,
  upsertBriefingSettings,
} from "@/lib/db/queries";

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
 * Update delivery settings (deliveryEnabled, deliveryFormat, generationTime, timezone).
 */
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const update: {
    deliveryEnabled?: boolean;
    deliveryFormat?: string;
    generationTime?: string;
    timezone?: string;
  } = {};

  if (typeof body.deliveryEnabled === "boolean") {
    update.deliveryEnabled = body.deliveryEnabled;
  }
  if (
    typeof body.deliveryFormat === "string" &&
    ["text", "audio", "text_audio"].includes(body.deliveryFormat)
  ) {
    update.deliveryFormat = body.deliveryFormat;
  }
  if (
    typeof body.generationTime === "string" &&
    /^\d{2}:\d{2}$/.test(body.generationTime)
  ) {
    update.generationTime = body.generationTime;
  }
  if (typeof body.timezone === "string" && body.timezone.length <= 50) {
    update.timezone = body.timezone;
  }

  if (Object.keys(update).length === 0) {
    return Response.json({ error: "No valid fields" }, { status: 400 });
  }

  const updated = await upsertBriefingSettings({
    userId: session.user.id,
    ...update,
  });

  return Response.json({
    deliveryEnabled: updated.deliveryEnabled,
    deliveryFormat: updated.deliveryFormat,
    generationTime: updated.generationTime,
    timezone: updated.timezone,
  });
}
