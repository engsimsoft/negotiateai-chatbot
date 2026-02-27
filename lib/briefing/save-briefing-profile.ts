import {
  upsertBriefingSettings,
  addBriefingTopic,
  addBriefingSource,
  deleteAllBriefingTopicsByUser,
  deleteAllBriefingSourcesByUser,
} from "@/lib/db/queries";

export interface SaveBriefingProfileInput {
  topics: Array<{
    topicId: string;
    topicName: string;
    emoji: string;
    briefingStyle?: string | null;
  }>;
  sources: Array<{
    topicId: string;
    sourceName: string;
    sourceUrl: string;
    rssUrl?: string | null;
    fetchMethod: "rss" | "telegram_parse" | "jina";
    sourceLanguage: "ru" | "en";
    tier: "flagship" | "respected" | "niche" | "community";
  }>;
  settings?: {
    timezone?: string;
    language?: "ru" | "en" | "both";
    maxItems?: number;
    volume?: "compact" | "standard" | "detailed";
  };
}

export async function saveBriefingProfile(
  userId: string,
  input: SaveBriefingProfileInput,
) {
  console.log(
    `[saveBriefingProfile] Saving ${input.topics.length} topics, ${input.sources.length} sources for user ${userId}`,
  );

  // 1. Upsert settings
  await upsertBriefingSettings({
    userId,
    isActive: true,
    timezone: input.settings?.timezone ?? "Europe/Moscow",
    language: input.settings?.language ?? "ru",
    maxItems: input.settings?.maxItems ?? 15,
    volume: input.settings?.volume ?? "standard",
  });

  // 2. Replace all topics
  await deleteAllBriefingTopicsByUser({ userId });
  for (let i = 0; i < input.topics.length; i++) {
    const t = input.topics[i];
    await addBriefingTopic({
      userId,
      topicId: t.topicId,
      topicName: t.topicName,
      emoji: t.emoji,
      orderIndex: i,
      briefingStyle: t.briefingStyle ?? null,
    });
  }

  // 3. Replace all sources
  await deleteAllBriefingSourcesByUser({ userId });
  for (const s of input.sources) {
    await addBriefingSource({
      userId,
      topicId: s.topicId,
      sourceName: s.sourceName,
      sourceUrl: s.sourceUrl,
      rssUrl: s.rssUrl ?? undefined,
      fetchMethod: s.fetchMethod,
      sourceLanguage: s.sourceLanguage,
      tier: s.tier,
    });
  }

  return {
    success: true as const,
    topicsCount: input.topics.length,
    sourcesCount: input.sources.length,
  };
}
