"use client";

import { useState } from "react";
import { BriefingPlayerPlaceholder } from "./briefing-player-placeholder";
import { BriefingArticleView, SavedTopicView } from "./briefing-article-view";
import { BriefingSidebar } from "./briefing-sidebar";
import type {
  BriefingArticle,
  BriefingArticleSection,
  SavedBriefingTopicClient,
} from "@/lib/briefing/briefing-types";

interface BriefingIssueContentProps {
  article: BriefingArticle;
  /** ТЗ-А5: Callback to trigger generation (handled by parent) */
  onGenerate?: () => void;
  /** ТЗ-BF1: Saved topics (managed by parent) */
  savedTopics: SavedBriefingTopicClient[];
  /** ТЗ-BF1: Save a topic from article section */
  onSaveTopic: (section: BriefingArticleSection) => void;
  /** ТЗ-BF1: Delete a saved topic */
  onDeleteTopic: (savedId: string) => void;
  /** ТЗ-BF1: Currently selected saved topic (null = show article) */
  selectedSavedTopic: SavedBriefingTopicClient | null;
  /** ТЗ-BF1: Select a saved topic to view */
  onSelectSavedTopic: (topic: SavedBriefingTopicClient) => void;
  /** ТЗ-BF1: Return to article view */
  onBackToArticle: () => void;
}

/**
 * ТЗ-А4 + ТЗ-BF1: Client wrapper that holds activeSectionId state.
 * Connects IntersectionObserver scroll spy (from ArticleView) with sidebar active highlight.
 * Switches main area between article and saved topic view.
 */
export function BriefingIssueContent({
  article,
  onGenerate,
  savedTopics,
  onSaveTopic,
  onDeleteTopic,
  selectedSavedTopic,
  onSelectSavedTopic,
  onBackToArticle,
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
            activeSectionId={activeSectionId}
            savedTopics={savedTopics}
            selectedSavedTopicId={selectedSavedTopic?.id ?? null}
            onSelectSavedTopic={onSelectSavedTopic}
            onBackToArticle={onBackToArticle}
            onDeleteSavedTopic={onDeleteTopic}
            onGenerate={onGenerate}
            hasArticle
          />
        </aside>
        <main className="min-w-0 flex-1">
          {selectedSavedTopic ? (
            <SavedTopicView
              topic={selectedSavedTopic}
              onBack={onBackToArticle}
              onDelete={onDeleteTopic}
            />
          ) : (
            <BriefingArticleView
              article={article}
              onActiveSectionChange={setActiveSectionId}
              savedTopics={savedTopics}
              onSaveTopic={onSaveTopic}
              onDeleteTopic={onDeleteTopic}
            />
          )}
        </main>
      </div>
    </>
  );
}
