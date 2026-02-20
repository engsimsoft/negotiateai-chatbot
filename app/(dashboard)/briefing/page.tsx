import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import {
  getBriefingSettings,
  getBriefingHistory,
} from "@/lib/db/queries";
import { BriefingPage } from "@/components/briefing/briefing-page";
import { BriefingIssueHeader } from "@/components/briefing/briefing-issue-header";
import { BriefingPlayerPlaceholder } from "@/components/briefing/briefing-player-placeholder";
import {
  BriefingArticleView,
  NoBriefingsYet,
} from "@/components/briefing/briefing-article-view";
import {
  BriefingSidebar,
  BriefingSidebarMobile,
} from "@/components/briefing/briefing-sidebar";
import type { BriefingArticle } from "@/lib/briefing/briefing-types";
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

  // ТЗ-А4: load history for sidebar (limit 10)
  const timezone = settings.timezone || "Europe/Moscow";
  const historyRows = await getBriefingHistory({ userId, limit: 10 });
  const readyBriefings = historyRows.filter((h) => h.status === "ready");
  const latestBriefing = readyBriefings[0] ?? null;

  // Parse article, guard against old format
  const article = latestBriefing
    ? (latestBriefing.briefingJson as unknown as BriefingArticle)
    : null;
  const hasValidArticle = article?.sections && article.sections.length > 0;

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

  // Sidebar props (shared between desktop and mobile)
  const sidebarProps = {
    sections: hasValidArticle ? article.sections : [],
    history: historyItems.slice(1), // exclude current issue
    currentDate,
  };

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <BriefingIssueHeader
        title={hasValidArticle ? article.title : "☀️ Утренний брифинг"}
        mobileTrigger={
          hasValidArticle ? (
            <BriefingSidebarMobile {...sidebarProps} />
          ) : undefined
        }
      />

      {hasValidArticle ? (
        <>
          <BriefingPlayerPlaceholder />
          <div className="flex flex-1">
            {/* Desktop sidebar */}
            <aside className="sticky top-[7rem] hidden h-[calc(100svh-7rem)] w-64 shrink-0 border-r md:block">
              <BriefingSidebar {...sidebarProps} />
            </aside>
            <main className="min-w-0 flex-1">
              <BriefingArticleView article={article} />
            </main>
          </div>
        </>
      ) : (
        <main className="flex-1">
          <NoBriefingsYet />
        </main>
      )}
    </div>
  );
}
