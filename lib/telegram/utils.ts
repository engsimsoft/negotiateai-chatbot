// TZ-TG1: Telegram URL utilities

/**
 * Normalize any Telegram channel input to the web preview URL.
 * @channel        → https://t.me/s/channel
 * https://t.me/channel   → https://t.me/s/channel
 * https://t.me/s/channel → https://t.me/s/channel (no-op)
 */
export function normalizeChannelUrl(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("@")) {
    return `https://t.me/s/${trimmed.slice(1)}`;
  }
  if (trimmed.includes("t.me/") && !trimmed.includes("t.me/s/")) {
    return trimmed.replace("t.me/", "t.me/s/");
  }
  return trimmed;
}

/**
 * Extract channel handle from any Telegram channel input.
 * @channel        → channel
 * https://t.me/channel   → channel
 * https://t.me/s/channel → channel
 * channel                → channel
 */
export function extractChannelHandle(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("@")) {
    return trimmed.slice(1);
  }
  const match = trimmed.match(/t\.me\/(?:s\/)?([a-zA-Z0-9_]+)/);
  return match?.[1] || trimmed;
}
