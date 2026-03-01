"use client";

import { useState, useRef, useCallback } from "react";
import {
  BriefingArticleView,
  SavedTopicView,
  SimplyContentView,
} from "./briefing-article-view";
import { BriefingSidebar } from "./briefing-sidebar";
import { PodcastProgress } from "./podcast-progress";
import { PodcastPlayer } from "./podcast-player";
import type { SimplyContentType } from "./briefing-sidebar";
import type { PodcastTopicStatus } from "@/hooks/use-podcast-generation";
import type {
  PipelineStageTrace,
  PipelineTraceSummary,
} from "@/lib/ai/pipeline-trace";
import type { BriefingViewMode } from "./briefing-mode-toggle";
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
  /** ТЗ-DEV2: Per-section refresh trace summaries (dev mode only) */
  sectionTraces?: Record<string, PipelineTraceSummary>;
  /** ТЗ-Б2: Current audio/podcast status */
  audioStatus?: AudioStatus;
  /** ТЗ-Б2 Этап 3: Current view mode (read article / listen to podcast) */
  viewMode?: BriefingViewMode;
  /** ТЗ-Б2 Этап 3: Player props (when audio is available) */
  playerProps?: React.ComponentProps<typeof PodcastPlayer>;
  /** ТЗ-Б2: Podcast generation per-topic statuses (for sidebar) */
  podcastTopicStatuses?: PodcastTopicStatus[];
  /** ТЗ-Б2: Whether podcast is currently generating (for sidebar) */
  podcastIsGenerating?: boolean;
  /** ТЗ-Б2 Этап 4: Callback when user clicks a track in sidebar tracklist */
  onSelectPodcastTrack?: (index: number) => void;
  /** ТЗ-Б2 Этап 5: Failed podcast topics (for sidebar partial state) */
  failedPodcastTopics?: { topicId: string; emoji: string; topicName: string }[];
  /** ТЗ-Б2 Этап 5: Retry a single failed topic */
  onRetryPodcastTopic?: (topicId: string) => void;
  /** ТЗ-Б2: Podcast generation progress (full-screen view replaces article) */
  podcastProgress?: {
    topicStatuses: PodcastTopicStatus[];
    isGenerating: boolean;
    error: string | null;
    completionMessage: string | null;
    readyCount: number;
    failedCount: number;
    onRetry: () => void;
    onDismiss: () => void;
    traceStages?: PipelineStageTrace[];
    traceSummary?: PipelineTraceSummary | null;
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
  sectionTraces,
  audioStatus,
  viewMode,
  playerProps,
  onSelectPodcastTrack,
  failedPodcastTopics,
  onRetryPodcastTopic,
  podcastTopicStatuses,
  podcastIsGenerating,
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
          podcastTopicStatuses={podcastTopicStatuses}
          podcastIsGenerating={podcastIsGenerating}
          viewMode={viewMode}
          podcastTracks={playerProps?.tracks}
          podcastCurrentTrackIndex={playerProps?.currentTrackIndex}
          podcastIsPlayerPlaying={playerProps?.isPlaying}
          onSelectPodcastTrack={onSelectPodcastTrack}
          failedPodcastTopics={failedPodcastTopics}
          onRetryPodcastTopic={onRetryPodcastTopic}
        />
      </aside>
      {/* Content area — scrolls independently */}
      <main ref={mainRef} className="min-w-0 flex-1 overflow-y-auto">
        {/* ТЗ-Б2: Podcast generation progress — full-screen view replaces article */}
        {podcastProgress ? (
          <PodcastProgress {...podcastProgress} />
        ) : viewMode === "listen" && playerProps ? (
          <PodcastPlayer {...playerProps} />
        ) : selectedSimplyType && simplyContentTitle && simplyContentBody ? (
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
            sectionTraces={sectionTraces}
          />
        )}
      </main>
    </div>
  );
}
