"use client";

import { useState, useRef, useCallback } from "react";
import {
  BriefingArticleView,
  SavedTopicView,
  SimplyContentView,
} from "./briefing-article-view";
import { BriefingSidebar } from "./briefing-sidebar";
import { PodcastProgress } from "./podcast-progress";
import type { SimplyContentType } from "./briefing-sidebar";
import type { PodcastTopicStatus } from "@/hooks/use-podcast-generation";
import type {
  BriefingArticle,
  BriefingArticleSection,
  SavedBriefingTopicClient,
  AudioStatus,
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
  /** ISO timestamp of current briefing (for bookmark matching) */
  briefingGeneratedAt?: string | null;
  /** ТЗ-BF2: Simply News version */
  simplyNewsVersion?: string | null;
  /** ТЗ-BF2: Simply News title */
  simplyNewsTitle?: string | null;
  /** ТЗ-BF2: Currently selected Simply content type */
  selectedSimplyType?: SimplyContentType | null;
  /** ТЗ-BF2: Select simply content */
  onSelectSimplyContent?: (type: SimplyContentType) => void;
  /** ТЗ-BF2: Simply content to render (title + markdown) */
  simplyContentTitle?: string;
  /** ТЗ-BF2: Simply content markdown body */
  simplyContentBody?: string;
  /** ТЗ-BF2: Whether Simply News is unread */
  simplyNewsUnread?: boolean;
  /** ТЗ-BF4: Refresh a single section */
  onRefreshSection?: (topicId: string) => Promise<void>;
  /** ТЗ-BF4: Currently refreshing topic id */
  refreshingTopicId?: string | null;
  /** ТЗ-Б2: Current audio/podcast status */
  audioStatus?: AudioStatus;
  /** ТЗ-Б2: Podcast generation progress (shown as compact banner above content) */
  podcastProgress?: {
    topicStatuses: PodcastTopicStatus[];
    isGenerating: boolean;
    error: string | null;
    completionMessage: string | null;
    readyCount: number;
    failedCount: number;
    onRetry: () => void;
    onDismiss: () => void;
  };
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
  briefingGeneratedAt,
  simplyNewsVersion,
  simplyNewsTitle,
  selectedSimplyType,
  onSelectSimplyContent,
  simplyContentTitle,
  simplyContentBody,
  simplyNewsUnread,
  onRefreshSection,
  refreshingTopicId,
  audioStatus,
  podcastProgress,
}: BriefingIssueContentProps) {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  const handleScrollToTop = useCallback(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className="flex min-h-0 flex-1">
      {/* Desktop sidebar — fixed column, internal scroll */}
      <aside className="hidden w-64 shrink-0 overflow-hidden border-r md:block">
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
          simplyNewsVersion={simplyNewsVersion}
          simplyNewsTitle={simplyNewsTitle}
          onSelectSimplyContent={onSelectSimplyContent}
          selectedSimplyType={selectedSimplyType}
          simplyNewsUnread={simplyNewsUnread}
          onScrollToTop={handleScrollToTop}
        />
      </aside>
      {/* Content area — scrolls independently */}
      <main ref={mainRef} className="min-w-0 flex-1 overflow-y-auto">
        {/* ТЗ-Б2: Podcast generation progress banner */}
        {podcastProgress && (
          <PodcastProgress {...podcastProgress} />
        )}
        {selectedSimplyType && simplyContentTitle && simplyContentBody ? (
          <SimplyContentView
            title={simplyContentTitle}
            content={simplyContentBody}
            onBack={onBackToArticle}
          />
        ) : selectedSavedTopic ? (
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
            briefingGeneratedAt={briefingGeneratedAt}
            scrollRoot={mainRef}
            onRefreshSection={onRefreshSection}
            refreshingTopicId={refreshingTopicId}
          />
        )}
      </main>
    </div>
  );
}
