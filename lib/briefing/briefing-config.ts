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
export const MAX_CONTENT_LENGTH = 1000;

/** Hours to look back for fresh content */
export const FRESHNESS_HOURS = 24;

/** API route max duration (seconds) */
export const ROUTE_MAX_DURATION = 60;

// --- AI Models ---

/** Stage 1: Filter — cheap & fast */
export const FILTER_MODEL = "gemini-2.0-flash";

/** Stage 2: Analyzer — smart & quality */
export const ANALYZER_MODEL = "gemini-3-pro-preview";

/** Fallback analyzer if primary is unavailable */
export const ANALYZER_MODEL_FALLBACK = "gemini-2.5-pro";
