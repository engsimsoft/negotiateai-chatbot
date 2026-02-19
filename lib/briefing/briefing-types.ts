// ТЗ-BR2: Shared BriefingJSON types (client-safe)
// Extracted from briefing-analyzer.ts for use in UI components

export interface BriefingItem {
  title: string;
  summary: string;
  importance: "high" | "medium" | "low";
  sourceUrl: string;
  sourceName: string;
  sourceLanguage: string;
  publishedAt?: string;
}

export interface BriefingBlock {
  topicId: string;
  topicName: string;
  emoji: string;
  items: BriefingItem[];
}

export interface BriefingJSON {
  date: string;
  totalSourcesChecked: number;
  totalCandidates: number;
  blocks: BriefingBlock[];
}
