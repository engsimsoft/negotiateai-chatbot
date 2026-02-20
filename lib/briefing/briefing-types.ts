// ТЗ-А3: Shared BriefingArticle types (client-safe)
// Replaces old BriefingJSON/BriefingBlock/BriefingItem (v3.30.0)

/** Source card within an article section */
export interface BriefingArticleSource {
  title: string;
  url: string;
  sourceName: string;
  tier: string;
  summary: string;
}

/** Article section (one topic) */
export interface BriefingArticleSection {
  topicId: string;
  topicName: string;
  emoji: string;
  content: string;
  newsCount: number;
  sources: BriefingArticleSource[];
}

/** Article metadata */
export interface BriefingArticleMeta {
  totalNews: number;
  topicsCount: number;
  readingTimeMinutes: number;
}

/** Full briefing article (one issue) */
export interface BriefingArticle {
  title: string;
  intro: string;
  sections: BriefingArticleSection[];
  outro: string;
  meta: BriefingArticleMeta;
}
