// TZ-TG1: Shared Telegram types

export interface TelegramPost {
  /** Full post text. Empty string for media-only posts */
  text: string;
  /** ISO 8601 date string, or null if missing */
  date: string | null;
  /** Direct link to post: https://t.me/{channel}/{id} */
  url: string;
  /** true if post contains photo/video/document/sticker/voice */
  hasMedia: boolean;
}

export interface TelegramParseResult {
  /** Channel handle without @ (e.g. "omggpt") */
  channel: string;
  /** Canonical channel URL: https://t.me/{channel} */
  channelUrl: string;
  /** false if channel is private, non-existent, or fetch failed */
  isValid: boolean;
  /** Parsed posts (newest first, as returned by Telegram) */
  posts: TelegramPost[];
  /** Error description when isValid=false */
  error?: string;
  /** ТЗ-DEV2: Per-post parse warnings (malformed HTML, missing fields) */
  warnings?: string[];
}

export interface ParseTelegramOptions {
  /** Timeout in ms (default: 10_000) */
  timeout?: number;
  /** Skip posts older than this Date */
  freshnessDate?: Date;
  /** Max content length per post text (chars). Default: no limit */
  maxContentLength?: number;
  /** Include posts without text (media-only). Default: true */
  includeMediaOnly?: boolean;
  /** Follow HTTP redirects. Default: false (to detect private channels) */
  followRedirects?: boolean;
}
