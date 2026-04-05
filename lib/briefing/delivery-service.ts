/**
 * Briefing Delivery Service — ТЗ-COSTCTRL Phase 1
 *
 * Single point of truth for mutating BriefingSettings delivery state.
 * Enforces the system invariant:
 *
 *   deliveryEnabled=true ⇒ active TelegramConnection exists for same userId
 *
 * All code paths (API, cron, admin tools) must go through this service
 * instead of calling upsertBriefingSettings directly for delivery flags.
 */

import "server-only";

import {
  getTelegramConnection,
  upsertBriefingSettings,
} from "@/lib/db/queries";

export type SetBriefingDeliveryInput = {
  userId: string;
  enabled?: boolean;
  format?: "text" | "audio" | "text_audio";
  time?: string; // HH:MM
  timezone?: string;
};

export type SetBriefingDeliveryResult =
  | {
      ok: true;
      settings: {
        deliveryEnabled: boolean;
        deliveryFormat: string;
        generationTime: string;
        timezone: string;
      };
    }
  | {
      ok: false;
      code: "telegram_required" | "invalid_format" | "invalid_time";
      message: string;
    };

/**
 * Update briefing delivery settings with invariant enforcement.
 *
 * - enabled=true: requires an active TelegramConnection for userId. Otherwise
 *   returns { ok: false, code: "telegram_required" }.
 * - enabled=false: always allowed (escape hatch for users in invalid state).
 * - Other fields (format, time, timezone) validated in isolation.
 */
export async function setBriefingDelivery(
  input: SetBriefingDeliveryInput,
): Promise<SetBriefingDeliveryResult> {
  const { userId, enabled, format, time, timezone } = input;

  // Invariant: enabling delivery requires active Telegram
  if (enabled === true) {
    const tg = await getTelegramConnection({ userId });
    if (!tg || !tg.isActive) {
      return {
        ok: false,
        code: "telegram_required",
        message: "Подключите Telegram в настройках для автоматической доставки",
      };
    }
  }

  // Validate format
  if (format !== undefined && !["text", "audio", "text_audio"].includes(format)) {
    return {
      ok: false,
      code: "invalid_format",
      message: "Формат должен быть text, audio или text_audio",
    };
  }

  // Validate time (HH:MM)
  if (time !== undefined && !/^\d{2}:\d{2}$/.test(time)) {
    return {
      ok: false,
      code: "invalid_time",
      message: "Время должно быть в формате HH:MM",
    };
  }

  const updated = await upsertBriefingSettings({
    userId,
    ...(enabled !== undefined && { deliveryEnabled: enabled }),
    ...(format !== undefined && { deliveryFormat: format }),
    ...(time !== undefined && { generationTime: time }),
    ...(timezone !== undefined && { timezone }),
  });

  return {
    ok: true,
    settings: {
      deliveryEnabled: updated.deliveryEnabled,
      deliveryFormat: updated.deliveryFormat,
      generationTime: updated.generationTime,
      timezone: updated.timezone,
    },
  };
}

/**
 * Cascade action: called when Telegram is disconnected.
 *
 * Automatically disables delivery to maintain the system invariant.
 * Idempotent: safe to call even if delivery was already disabled.
 */
export async function disableDeliveryOnTelegramDisconnect(
  userId: string,
): Promise<void> {
  await upsertBriefingSettings({ userId, deliveryEnabled: false });
}

/**
 * Auto-repair action: called from cron pre-flight when invalid state is detected.
 *
 * Logs a warning and disables delivery. Distinct from the cascade variant
 * for observability — we want to know when invariants were violated.
 */
export async function autoRepairInvalidDeliveryState(
  userId: string,
  reason: string,
): Promise<void> {
  console.warn(
    `[delivery-service] Auto-repair invalid state for user ${userId}: ${reason}`,
  );
  await upsertBriefingSettings({ userId, deliveryEnabled: false });
}
