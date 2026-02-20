// ТЗ-А5: Client wrapper for /briefing page — manages generation state

"use client";

import { useEffect } from "react";
import { useBriefingGeneration } from "@/hooks/use-briefing-generation";
import { BriefingGenerationProgress } from "./briefing-generation-progress";
import { BriefingIssueHeader } from "./briefing-issue-header";
import { BriefingIssueContent } from "./briefing-issue-content";
import { BriefingSidebarMobile } from "./briefing-sidebar";
import { NoBriefingsYet } from "./briefing-article-view";
import type { BriefingArticle } from "@/lib/briefing/briefing-types";
import type { BriefingHistoryItem } from "./briefing-sidebar";

interface BriefingPageClientProps {
  article: BriefingArticle | null;
  hasValidArticle: boolean;
  historyItems: BriefingHistoryItem[];
  currentDate?: string;
}

export function BriefingPageClient({
  article,
  hasValidArticle,
  historyItems,
  currentDate,
}: BriefingPageClientProps) {
  const { steps, isGenerating, error, redirectUrl, startGeneration } =
    useBriefingGeneration();

  // Auto-navigate on completion — full reload clears client state and loads fresh server data
  useEffect(() => {
    if (!redirectUrl) return;
    const timer = setTimeout(() => {
      window.location.href = redirectUrl;
    }, 1500);
    return () => clearTimeout(timer);
  }, [redirectUrl]);

  const sidebarProps = {
    sections: hasValidArticle && article ? article.sections : [],
    history: historyItems.slice(1),
    currentDate,
    onGenerate: startGeneration,
  };

  // Show progress UI when generating
  if (isGenerating || steps.length > 0) {
    return (
      <div className="flex min-h-svh flex-col bg-muted/30">
        <BriefingIssueHeader title="Утренний брифинг" />
        <BriefingGenerationProgress
          steps={steps}
          isGenerating={isGenerating}
          error={error}
          onRetry={startGeneration}
        />
      </div>
    );
  }

  // Normal content
  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <BriefingIssueHeader
        title={hasValidArticle && article ? article.title : "Утренний брифинг"}
        mobileTrigger={
          hasValidArticle ? (
            <BriefingSidebarMobile {...sidebarProps} />
          ) : undefined
        }
      />

      {hasValidArticle && article ? (
        <BriefingIssueContent
          article={article}
          history={historyItems.slice(1)}
          currentDate={currentDate}
          onGenerate={startGeneration}
        />
      ) : (
        <main className="flex-1">
          <NoBriefingsYet onGenerate={startGeneration} />
        </main>
      )}
    </div>
  );
}
