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
import type { BriefingArticle } from "@/lib/briefing/briefing-types";

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

  const historyRows = await getBriefingHistory({ userId, limit: 1 });
  const latestBriefing = historyRows.find((h) => h.status === "ready") ?? null;

  // ТЗ-А4: parse article, guard against old format
  const article = latestBriefing
    ? (latestBriefing.briefingJson as unknown as BriefingArticle)
    : null;
  const hasValidArticle = article?.sections && article.sections.length > 0;

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <BriefingIssueHeader
        title={hasValidArticle ? article.title : "☀️ Утренний брифинг"}
      />

      {hasValidArticle ? (
        <>
          <BriefingPlayerPlaceholder />
          <main className="flex-1">
            <BriefingArticleView article={article} />
          </main>
        </>
      ) : (
        <main className="flex-1">
          <NoBriefingsYet />
        </main>
      )}
    </div>
  );
}
