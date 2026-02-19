// ТЗ-BR1: Source fetcher types

export interface RawContent {
  title: string;
  url: string;
  /** Article text (first MAX_CONTENT_LENGTH chars) */
  content: string;
  publishedAt?: Date;
  sourceName: string;
  sourceLanguage: string;
}

export interface FetchResult {
  items: RawContent[];
  errors: string[];
}
