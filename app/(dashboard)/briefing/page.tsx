import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import {
  getBriefingSettings,
  getBriefingHistory,
  getSavedBriefingTopics,
} from "@/lib/db/queries";
import { BriefingPage } from "@/components/briefing/briefing-page";
import { BriefingPageClient } from "@/components/briefing/briefing-page-client";
import type { BriefingArticle, SavedBriefingTopicClient } from "@/lib/briefing/briefing-types";

export default async function BriefingRoute() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;
  const settings = await getBriefingSettings({ userId });

  // ТЗ-А2: профиль активен → показываем выпуск / заглушку, нет → лендинг
  if (!settings?.isActive) {
    return <BriefingPage />;
  }

  // Load latest briefing + saved topics in parallel
  const [readyBriefings, savedTopicsRaw] = await Promise.all([
    getBriefingHistory({ userId, limit: 1, status: "ready" }),
    getSavedBriefingTopics({ userId }),
  ]);
  const latestBriefing = readyBriefings[0] ?? null;

  // Parse article, guard against old format
  const article = latestBriefing
    ? (latestBriefing.briefingJson as unknown as BriefingArticle)
    : null;
  const hasValidArticle = !!(article?.sections && article.sections.length > 0);

  // ТЗ-BF1: serialize saved topics for client (Date → ISO string)
  const savedTopics: SavedBriefingTopicClient[] = savedTopicsRaw.map((t) => ({
    id: t.id,
    topicId: t.topicId,
    topicName: t.topicName,
    emoji: t.emoji,
    title: t.title,
    content: t.content,
    sources: (t.sources ?? []) as SavedBriefingTopicClient["sources"],
    briefingGeneratedAt: t.briefingGeneratedAt.toISOString(),
    savedAt: t.savedAt.toISOString(),
  }));

  // ТЗ-А5: delegate rendering to client wrapper for generation state management
  return (
    <BriefingPageClient
      article={article}
      hasValidArticle={hasValidArticle}
      initialSavedTopics={savedTopics}
    />
  );
}
