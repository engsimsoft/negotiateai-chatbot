"use client";

import { useState } from "react";
import { BriefingPlayerPlaceholder } from "./briefing-player-placeholder";
import { BriefingArticleView } from "./briefing-article-view";
import { BriefingSidebar } from "./briefing-sidebar";
import type { BriefingArticle } from "@/lib/briefing/briefing-types";
import type { BriefingHistoryItem } from "./briefing-sidebar";

interface BriefingIssueContentProps {
  article: BriefingArticle;
  history: BriefingHistoryItem[];
  currentDate?: string;
}

/**
 * ТЗ-А4 Этап 3: Client wrapper that holds activeSectionId state.
 * Connects IntersectionObserver scroll spy (from ArticleView) with sidebar active highlight.
 */
export function BriefingIssueContent({
  article,
  history,
  currentDate,
}: BriefingIssueContentProps) {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  return (
    <>
      <BriefingPlayerPlaceholder />
      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="sticky top-[7rem] hidden h-[calc(100svh-7rem)] w-64 shrink-0 border-r md:block">
          <BriefingSidebar
            sections={article.sections}
            history={history}
            currentDate={currentDate}
            activeSectionId={activeSectionId}
          />
        </aside>
        <main className="min-w-0 flex-1">
          <BriefingArticleView
            article={article}
            onActiveSectionChange={setActiveSectionId}
          />
        </main>
      </div>
    </>
  );
}
