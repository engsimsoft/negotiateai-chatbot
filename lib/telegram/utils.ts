// TZ-TG1: Telegram URL utilities

/**
 * Normalize any Telegram channel input to the web preview URL.
 * Accepts any format and always returns https://t.me/s/{handle}.
 *
 * @channel              → https://t.me/s/channel
 * channel               → https://t.me/s/channel
 * https://t.me/channel  → https://t.me/s/channel
 * https://t.me/s/channel→ https://t.me/s/channel
 * t.me/channel          → https://t.me/s/channel
 * t.me/s/channel        → https://t.me/s/channel
 */
export function normalizeChannelUrl(input: string): string {
  const handle = extractChannelHandle(input);
  return `https://t.me/s/${handle}`;
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
