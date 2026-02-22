// ТЗ-А5 + ТЗ-BF1: Client wrapper for /briefing page — manages generation + saved topics state

"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useBriefingGeneration } from "@/hooks/use-briefing-generation";
import { BriefingGenerationProgress } from "./briefing-generation-progress";
import { BriefingIssueHeader } from "./briefing-issue-header";
import { BriefingIssueContent } from "./briefing-issue-content";
import { BriefingSidebarMobile } from "./briefing-sidebar";
import { NoBriefingsYet, SimplyContentView } from "./briefing-article-view";
import type {
  BriefingArticle,
  BriefingArticleSection,
  SavedBriefingTopicClient,
  AudioStatus,
  AudioUrls,
  AudioDurations,
} from "@/lib/briefing/briefing-types";
import type { SimplyContentType } from "./briefing-sidebar";

/** ТЗ-BF2: Simply content data passed from server */
export interface SimplyData {
  overviewContent: string;
  newsContent: string | null;
  newsMeta: {
    version: string;
    title: string;
    hasUpdate: boolean;
    /** Whether current user hasn't seen this version yet */
    hasUnread: boolean;
  } | null;
}

interface BriefingPageClientProps {
  article: BriefingArticle | null;
  hasValidArticle: boolean;
  initialSavedTopics?: SavedBriefingTopicClient[];
  /** ISO timestamp of current briefing (for bookmark matching) */
  briefingGeneratedAt?: string | null;
  /** ТЗ-BF2: Simply content data */
  simplyData?: SimplyData | null;
  /** ТЗ-Б2: Audio/Podcast state from server */
  initialAudioStatus?: AudioStatus;
  initialAudioUrls?: AudioUrls;
  initialAudioDurations?: AudioDurations;
}

export function BriefingPageClient({
  article: initialArticle,
  hasValidArticle,
  initialSavedTopics = [],
  briefingGeneratedAt,
  simplyData,
  initialAudioStatus = "none",
  initialAudioUrls = {},
  initialAudioDurations = {},
}: BriefingPageClientProps) {
  const { steps, isGenerating, error, redirectUrl, startGeneration } =
    useBriefingGeneration();

  // ТЗ-BF4: Article state (lifted from prop for per-section refresh mutation)
  const [article, setArticle] = useState(initialArticle);

  // ТЗ-Б2: Audio/Podcast state (lifted from server props for mutation during generation)
  const [audioStatus, setAudioStatus] = useState<AudioStatus>(initialAudioStatus);
  const [audioUrls, setAudioUrls] = useState<AudioUrls>(initialAudioUrls);
  const [audioDurations, setAudioDurations] = useState<AudioDurations>(initialAudioDurations);

  // ТЗ-BF4: Per-section refresh state
  const [refreshingTopicId, setRefreshingTopicId] = useState<string | null>(null);

  // ТЗ-BF1: Saved topics state (lifted from BriefingIssueContent for sidebar sharing)
  const [savedTopics, setSavedTopics] =
    useState<SavedBriefingTopicClient[]>(initialSavedTopics);
  const [selectedSavedTopic, setSelectedSavedTopic] =
    useState<SavedBriefingTopicClient | null>(null);

  // ТЗ-BF2: Simply content state
  const [selectedSimplyType, setSelectedSimplyType] =
    useState<SimplyContentType | null>(null);

  // ТЗ-BF2: Optimistic unread state (initialized from server, cleared on view)
  const [simplyNewsUnread, setSimplyNewsUnread] =
    useState(simplyData?.newsMeta?.hasUnread ?? false);

  // ТЗ-BF1 + ТЗ-BF3: Save a topic (extract headline from content as title)
  const handleSaveTopic = useCallback(
    async (section: BriefingArticleSection) => {
      try {
        // ТЗ-BF3: Extract headline from content (## header or first line)
        const headerMatch = section.content.match(/^#{2,3}\s+(.+)/m);
        const firstLine = !headerMatch
          ? section.content.split("\n").find((l) => l.trim().length > 10)
          : null;
        const headline = headerMatch?.[1]?.trim() ?? firstLine?.trim().slice(0, 80) ?? section.topicName;

        const res = await fetch("/api/briefing/topics/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topicId: section.topicId,
            topicName: section.topicName,
            emoji: section.emoji,
            title: headline,
            content: section.content,
            sources: section.sources,
            briefingGeneratedAt: briefingGeneratedAt ?? new Date().toISOString(),
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
    [briefingGeneratedAt]
  );

  // ТЗ-BF1: Delete a saved topic (used by sidebar ✕, article bookmark, and SavedTopicView)
  const handleDeleteTopic = useCallback(async (savedId: string) => {
    try {
      const res = await fetch(`/api/briefing/topics/save?id=${savedId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete");

      setSavedTopics((prev) => prev.filter((t) => t.id !== savedId));
      // If viewing this topic, go back to article
      setSelectedSavedTopic((prev) => (prev?.id === savedId ? null : prev));
      toast.success("Тема удалена");
    } catch {
      toast.error("Не удалось удалить тему");
    }
  }, []);

  const handleSelectSavedTopic = useCallback(
    (topic: SavedBriefingTopicClient) => {
      setSelectedSavedTopic(topic);
      setSelectedSimplyType(null);
    },
    []
  );

  const handleBackToArticle = useCallback(() => {
    setSelectedSavedTopic(null);
    setSelectedSimplyType(null);
  }, []);

  // ТЗ-BF4: Refresh a single section by topicId
  const handleRefreshSection = useCallback(
    async (topicId: string) => {
      setRefreshingTopicId(topicId);
      try {
        const res = await fetch("/api/briefing/refresh-section", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topicId }),
        });

        if (!res.ok) throw new Error("Failed to refresh");

        const updatedSection: BriefingArticleSection = await res.json();

        setArticle((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            sections: prev.sections.map((s) =>
              s.topicId === topicId ? updatedSection : s
            ),
          };
        });
        toast.success("Тема обновлена");
      } catch {
        toast.error("Не удалось обновить тему");
      } finally {
        setRefreshingTopicId(null);
      }
    },
    []
  );

  // ТЗ-BF2: Handle simply content selection (clear saved topic when selecting simply)
  const handleSelectSimplyContent = useCallback(
    (type: SimplyContentType) => {
      setSelectedSimplyType(type);
      setSelectedSavedTopic(null);
    },
    []
  );

  // ТЗ-BF2: Auto-mark simply-news as seen when user views it
  useEffect(() => {
    if (selectedSimplyType !== "news") return;
    if (!simplyData?.newsMeta?.hasUpdate) return;
    setSimplyNewsUnread(false);
    fetch("/api/briefing/simply-news/seen", { method: "PATCH" }).catch(() => {});
  }, [selectedSimplyType, simplyData?.newsMeta?.hasUpdate]);

  // ТЗ-BF2: Compute simply content title + body for current selection
  const simplyContentTitle = selectedSimplyType
    ? selectedSimplyType === "overview"
      ? "Simply — обзор платформы"
      : simplyData?.newsMeta?.title ?? "Что нового"
    : undefined;

  const simplyContentBody = selectedSimplyType
    ? selectedSimplyType === "overview"
      ? simplyData?.overviewContent ?? ""
      : simplyData?.newsContent ?? ""
    : undefined;

  // Auto-navigate on completion — full reload clears client state and loads fresh server data
  useEffect(() => {
    if (!redirectUrl) return;
    const timer = setTimeout(() => {
      window.location.href = redirectUrl;
    }, 1500);
    return () => clearTimeout(timer);
  }, [redirectUrl]);

  // Sidebar props shared between desktop (inside BriefingIssueContent) and mobile (in header)
  const sidebarProps = {
    sections: hasValidArticle && article ? article.sections : [],
    savedTopics,
    selectedSavedTopicId: selectedSavedTopic?.id ?? null,
    onSelectSavedTopic: handleSelectSavedTopic,
    onBackToArticle: handleBackToArticle,
    onDeleteSavedTopic: handleDeleteTopic,
    onGenerate: startGeneration,
    hasArticle: hasValidArticle,
    // ТЗ-BF2: Simply content props
    simplyNewsVersion: simplyData?.newsMeta?.hasUpdate ? simplyData.newsMeta.version : null,
    simplyNewsTitle: simplyData?.newsMeta?.title ?? null,
    onSelectSimplyContent: handleSelectSimplyContent,
    selectedSimplyType,
    simplyNewsUnread,
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
    <div className={`flex flex-col bg-muted/30 ${hasValidArticle ? "h-svh overflow-hidden" : "min-h-svh"}`}>
      <BriefingIssueHeader
        title={hasValidArticle && article ? article.title : "Утренний брифинг"}
        audioStatus={audioStatus}
        mobileTrigger={
          hasValidArticle ? (
            <BriefingSidebarMobile {...sidebarProps} />
          ) : undefined
        }
      />

      {hasValidArticle && article ? (
        <BriefingIssueContent
          article={article}
          onGenerate={startGeneration}
          savedTopics={savedTopics}
          onSaveTopic={handleSaveTopic}
          onDeleteTopic={handleDeleteTopic}
          selectedSavedTopic={selectedSavedTopic}
          onSelectSavedTopic={handleSelectSavedTopic}
          onBackToArticle={handleBackToArticle}
          briefingGeneratedAt={briefingGeneratedAt}
          simplyNewsVersion={sidebarProps.simplyNewsVersion}
          simplyNewsTitle={sidebarProps.simplyNewsTitle}
          selectedSimplyType={selectedSimplyType}
          onSelectSimplyContent={handleSelectSimplyContent}
          simplyContentTitle={simplyContentTitle}
          simplyContentBody={simplyContentBody}
          simplyNewsUnread={simplyNewsUnread}
          onRefreshSection={handleRefreshSection}
          refreshingTopicId={refreshingTopicId}
          audioStatus={audioStatus}
        />
      ) : (
        <main className="flex-1">
          {selectedSimplyType && simplyContentTitle && simplyContentBody ? (
            <SimplyContentView
              title={simplyContentTitle}
              content={simplyContentBody}
              onBack={handleBackToArticle}
            />
          ) : (
            <>
              <NoBriefingsYet onGenerate={startGeneration} />
              {/* ТЗ-BF2: Simply links even without generated briefing */}
              {simplyData && (
                <div className="mx-auto max-w-sm px-4 pb-12">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Simply
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSelectSimplyContent("overview")}
                    className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/60"
                  >
                    <span>📋</span>
                    <span>Обзор платформы</span>
                  </button>
                  {simplyData.newsMeta?.hasUpdate && (
                    <button
                      type="button"
                      onClick={() => handleSelectSimplyContent("news")}
                      className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/60"
                    >
                      <span>🆕</span>
                      <span>{simplyData.newsMeta.title ?? "Что нового"}</span>
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      )}
    </div>
  );
}
