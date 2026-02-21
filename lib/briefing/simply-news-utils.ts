import fs from "fs";
import path from "path";

// ============================================================================
// Types
// ============================================================================

export interface SimplyNewsMeta {
  version: string;
  date: string;
  hasUpdate: boolean;
  title: string;
}

export interface SimplyNewsData {
  meta: SimplyNewsMeta;
  content: string;
}

// ============================================================================
// Frontmatter parser (regex, no gray-matter dependency)
// ============================================================================

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

export function parseSimplyNewsFrontmatter(raw: string): {
  meta: SimplyNewsMeta;
  content: string;
} {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    throw new Error("simply-news.md: invalid frontmatter format");
  }

  const frontmatterBlock = match[1];
  const content = match[2].trim();

  const getValue = (key: string): string => {
    const re = new RegExp(`^${key}:\\s*"?([^"\\n]*)"?`, "m");
    const m = frontmatterBlock.match(re);
    return m ? m[1].trim() : "";
  };

  return {
    meta: {
      version: getValue("version"),
      date: getValue("date"),
      hasUpdate: getValue("hasUpdate") === "true",
      title: getValue("title"),
    },
    content,
  };
}

// ============================================================================
// File readers (server-only, fs-based)
// ============================================================================

const SIMPLY_NEWS_PATH = path.join(
  process.cwd(),
  "lib",
  "briefing",
  "simply-news.md",
);

const SIMPLY_OVERVIEW_PATH = path.join(
  process.cwd(),
  "lib",
  "briefing",
  "simply-overview.md",
);

/**
 * Read and parse simply-news.md — returns metadata + markdown body.
 */
export function getSimplyNewsData(): SimplyNewsData {
  const raw = fs.readFileSync(SIMPLY_NEWS_PATH, "utf-8");
  return parseSimplyNewsFrontmatter(raw);
}

/**
 * Read simply-overview.md — returns raw markdown content.
 */
export function getSimplyOverviewContent(): string {
  return fs.readFileSync(SIMPLY_OVERVIEW_PATH, "utf-8");
}
