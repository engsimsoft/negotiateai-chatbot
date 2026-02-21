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
import type { BriefingHistoryItem } from "@/components/briefing/briefing-sidebar";

const RUSSIAN_MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

/** Convert Date to YYYY-MM-DD in user timezone */
function formatDateForUrl(date: Date, timezone: string): string {
  return date.toLocaleDateString("en-CA", { timeZone: timezone });
}

/** Format "YYYY-MM-DD" → "20 февраля" */
function formatDateLabel(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  const monthIdx = parseInt(month, 10) - 1;
  return `${parseInt(day, 10)} ${RUSSIAN_MONTHS_GENITIVE[monthIdx]}`;
}

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

  // ТЗ-А4: load history for sidebar (limit 10, only ready — ТЗ-HF1 fix)
  // ТЗ-BF1: load saved topics for bookmark state
  const timezone = settings.timezone || "Europe/Moscow";
  const [readyBriefings, savedTopicsRaw] = await Promise.all([
    getBriefingHistory({ userId, limit: 10, status: "ready" }),
    getSavedBriefingTopics({ userId }),
  ]);
  const latestBriefing = readyBriefings[0] ?? null;

  // Parse article, guard against old format
  const article = latestBriefing
    ? (latestBriefing.briefingJson as unknown as BriefingArticle)
    : null;
  const hasValidArticle = !!(article?.sections && article.sections.length > 0);

  // Prepare history items for sidebar (deduplicate by date — multiple per day possible)
  const seenDates = new Set<string>();
  const historyItems: BriefingHistoryItem[] = [];
  for (const h of readyBriefings) {
    const dateStr = formatDateForUrl(h.generatedAt, timezone);
    if (seenDates.has(dateStr)) continue;
    seenDates.add(dateStr);
    historyItems.push({ date: dateStr, label: formatDateLabel(dateStr) });
  }
  const currentDate = historyItems[0]?.date;

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
      historyItems={historyItems}
      currentDate={currentDate}
      initialSavedTopics={savedTopics}
    />
  );
}
