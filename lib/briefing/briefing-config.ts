// ТЗ-BR1: Briefing configuration constants

/** Fetch timeout per source (ms) */
export const FETCH_TIMEOUT_MS = 10_000;

/** Max sources to fetch in one briefing */
export const MAX_SOURCES = 20;

/** Max news items in final briefing */
export const MAX_BRIEFING_ITEMS = 15;

/** Max candidates after filter stage */
export const MAX_FILTER_CANDIDATES = 30;

/** Max content length per article (chars) */
export const MAX_CONTENT_LENGTH = 6000;

/** Hours to look back for fresh content */
export const FRESHNESS_HOURS = 24;

/** API route max duration (seconds) */
export const ROUTE_MAX_DURATION = 90;

/** Jina Reader API timeout (ms) */
export const JINA_READER_TIMEOUT = 10_000;

// --- AI Models ---

/** Stage 1: Filter — cheap & fast (MiniMax M2.7, ТЗ-Briefing-1) */
export const FILTER_MODEL = "MiniMax-M2.7";

/** Stage 2: Author — article generation (MiniMax M2.7, ТЗ-Briefing-1) */
export const AUTHOR_MODEL = "MiniMax-M2.7";

// --- Cron ---

/** ТЗ-TG4a: Cron interval in minutes (Vercel Cron schedule) */
export const CRON_INTERVAL_MINUTES = 15;

/** ТЗ-TG4a: Max concurrent briefing generations per cron invocation */
export const CRON_CONCURRENCY_LIMIT = 3;

/** ТЗ-TG4a: Max duration for cron route (seconds). Vercel Pro allows up to 300s. */
export const CRON_MAX_DURATION = 240;
