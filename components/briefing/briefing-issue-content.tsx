"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { BriefingPlayerPlaceholder } from "./briefing-player-placeholder";
import { BriefingArticleView } from "./briefing-article-view";
import { BriefingSidebar } from "./briefing-sidebar";
import type {
  BriefingArticle,
  BriefingArticleSection,
  SavedBriefingTopicClient,
} from "@/lib/briefing/briefing-types";
import type { BriefingHistoryItem } from "./briefing-sidebar";

interface BriefingIssueContentProps {
  article: BriefingArticle;
  history: BriefingHistoryItem[];
  currentDate?: string;
  /** ТЗ-А5: Callback to trigger generation (handled by parent) */
  onGenerate?: () => void;
  /** ТЗ-BF1: Initial saved topics from server */
  initialSavedTopics?: SavedBriefingTopicClient[];
}

/**
 * ТЗ-А4 Этап 3: Client wrapper that holds activeSectionId state.
 * Connects IntersectionObserver scroll spy (from ArticleView) with sidebar active highlight.
 * ТЗ-BF1: Manages savedTopics state for bookmark buttons.
 */
export function BriefingIssueContent({
  article,
  history,
  currentDate,
  onGenerate,
  initialSavedTopics = [],
}: BriefingIssueContentProps) {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [savedTopics, setSavedTopics] = useState<SavedBriefingTopicClient[]>(initialSavedTopics);

  // ТЗ-BF1: Save a topic
  const handleSaveTopic = useCallback(
    async (section: BriefingArticleSection) => {
      try {
        const res = await fetch("/api/briefing/topics/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topicId: section.topicId,
            topicName: section.topicName,
            emoji: section.emoji,
            title: section.topicName,
            content: section.content,
            sources: section.sources,
            briefingGeneratedAt: article.meta
              ? new Date().toISOString()
              : new Date().toISOString(),
          }),
        });

        if (!res.ok) throw new Error("Failed to save");

        const saved: SavedBriefingTopicClient = await res.json();
        setSavedTopics((prev) => [saved, ...prev]);
        toast.success("Тема сохранена");
      } catch {
        toast.error("Не удалось сохранить тему");
      }
    },
    [article.meta]
  );

  // ТЗ-BF1: Delete a saved topic
  const handleDeleteTopic = useCallback(async (savedId: string) => {
    try {
      const res = await fetch(`/api/briefing/topics/save?id=${savedId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete");

      setSavedTopics((prev) => prev.filter((t) => t.id !== savedId));
      toast.success("Тема удалена");
    } catch {
      toast.error("Не удалось удалить тему");
    }
  }, []);

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
            onGenerate={onGenerate}
          />
        </aside>
        <main className="min-w-0 flex-1">
          <BriefingArticleView
            article={article}
            onActiveSectionChange={setActiveSectionId}
            savedTopics={savedTopics}
            onSaveTopic={handleSaveTopic}
            onDeleteTopic={handleDeleteTopic}
          />
        </main>
      </div>
    </>
  );
}
