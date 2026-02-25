import { NextResponse } from "next/server";
import { bot } from "@/lib/telegram/bot";

/**
 * ТЗ-TG3: Admin route for webhook registration/inspection.
 * Protected by TELEGRAM_WEBHOOK_SECRET via Authorization header.
 *
 * POST — register webhook with Telegram
 * GET  — check current webhook status
 */

function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return false;
  const token = authHeader.replace("Bearer ", "");
  return token === process.env.TELEGRAM_WEBHOOK_SECRET;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL is not set" },
      { status: 500 },
    );
  }

  const webhookUrl = `${appUrl}/api/telegram/webhook`;
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;

  await bot.api.setWebhook(webhookUrl, {
    secret_token: secretToken,
  });

  return NextResponse.json({
    ok: true,
    webhookUrl,
    message: "Webhook registered successfully",
  });
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const info = await bot.api.getWebhookInfo();

  return NextResponse.json({
    ok: true,
    url: info.url,
    hasCustomCertificate: info.has_custom_certificate,
    pendingUpdateCount: info.pending_update_count,
    lastErrorDate: info.last_error_date,
    lastErrorMessage: info.last_error_message,
    maxConnections: info.max_connections,
  });
}
