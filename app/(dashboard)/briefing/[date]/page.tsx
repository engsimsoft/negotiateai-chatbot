import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import {
  getBriefingSettings,
  getBriefingHistory,
  getBriefingByDate,
} from "@/lib/db/queries";
import { BriefingIssueHeader } from "@/components/briefing/briefing-issue-header";
import { BriefingSidebarMobile } from "@/components/briefing/briefing-sidebar";
import { BriefingIssueContent } from "@/components/briefing/briefing-issue-content";
import type { BriefingArticle } from "@/lib/briefing/briefing-types";
import type { BriefingHistoryItem } from "@/components/briefing/briefing-sidebar";

const RUSSIAN_MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

function formatDateForUrl(date: Date, timezone: string): string {
  return date.toLocaleDateString("en-CA", { timeZone: timezone });
}

function formatDateLabel(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  const monthIdx = parseInt(month, 10) - 1;
  return `${parseInt(day, 10)} ${RUSSIAN_MONTHS_GENITIVE[monthIdx]}`;
}

/**
 * ТЗ-А4 Этап 3: Route for a specific briefing issue by date.
 * /briefing/2026-02-20 → shows that day's briefing with sidebar.
 * Redirects to /briefing if date is invalid or no briefing found.
 */
export default async function BriefingDateRoute({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { date } = await params;

  // Validate date format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    redirect("/briefing");
  }

  // Validate it's a real date
  const parsed = new Date(`${date}T00:00:00`);
  if (isNaN(parsed.getTime())) {
    redirect("/briefing");
  }

  const userId = session.user.id;
  const settings = await getBriefingSettings({ userId });

  if (!settings?.isActive) {
    redirect("/briefing");
  }

  const timezone = settings.timezone || "Europe/Moscow";
  const briefing = await getBriefingByDate({ userId, date, timezone });

  if (!briefing) {
    redirect("/briefing");
  }

  const article = briefing.briefingJson as unknown as BriefingArticle;
  const hasValidArticle = article?.sections && article.sections.length > 0;

  // Load history for sidebar (limit 10, deduplicate by date)
  const historyRows = await getBriefingHistory({ userId, limit: 10 });
  const readyBriefings = historyRows.filter((h) => h.status === "ready");

  const seenDates = new Set<string>();
  const historyItems: BriefingHistoryItem[] = [];
  for (const h of readyBriefings) {
    const dateStr = formatDateForUrl(h.generatedAt, timezone);
    if (seenDates.has(dateStr)) continue;
    seenDates.add(dateStr);
    historyItems.push({ date: dateStr, label: formatDateLabel(dateStr) });
  }

  // Exclude current date from history list
  const historyForSidebar = historyItems.filter((item) => item.date !== date);

  const sidebarProps = {
    sections: hasValidArticle ? article.sections : [],
    history: historyForSidebar,
    currentDate: date,
  };

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <BriefingIssueHeader
        title={hasValidArticle ? article.title : `☀️ Выпуск · ${formatDateLabel(date)}`}
        mobileTrigger={
          hasValidArticle ? (
            <BriefingSidebarMobile {...sidebarProps} />
          ) : undefined
        }
      />
      {hasValidArticle ? (
        <BriefingIssueContent
          article={article}
          history={historyForSidebar}
          currentDate={date}
        />
      ) : (
        <main className="flex-1 py-16 text-center">
          <span className="mb-4 inline-block text-5xl">📰</span>
          <h2 className="mb-3 font-serif text-xl font-semibold">
            Старый формат выпуска
          </h2>
          <p className="mx-auto max-w-sm text-muted-foreground">
            Этот выпуск был создан в предыдущей версии и не может быть
            отображён в новом формате статьи.
          </p>
        </main>
      )}
    </div>
  );
}
