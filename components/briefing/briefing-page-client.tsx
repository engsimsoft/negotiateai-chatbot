// ТЗ-А5 + ТЗ-BF1: Client wrapper for /briefing page — manages generation + saved topics state

"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useBriefingGeneration } from "@/hooks/use-briefing-generation";
import { BriefingGenerationProgress } from "./briefing-generation-progress";
import { BriefingIssueHeader } from "./briefing-issue-header";
import { BriefingIssueContent } from "./briefing-issue-content";
import { BriefingSidebarMobile } from "./briefing-sidebar";
import { NoBriefingsYet } from "./briefing-article-view";
import type {
  BriefingArticle,
  BriefingArticleSection,
  SavedBriefingTopicClient,
} from "@/lib/briefing/briefing-types";

interface BriefingPageClientProps {
  article: BriefingArticle | null;
  hasValidArticle: boolean;
  initialSavedTopics?: SavedBriefingTopicClient[];
}

export function BriefingPageClient({
  article,
  hasValidArticle,
  initialSavedTopics = [],
}: BriefingPageClientProps) {
  const { steps, isGenerating, error, redirectUrl, startGeneration } =
    useBriefingGeneration();

  // ТЗ-BF1: Saved topics state (lifted from BriefingIssueContent for sidebar sharing)
  const [savedTopics, setSavedTopics] =
    useState<SavedBriefingTopicClient[]>(initialSavedTopics);
  const [selectedSavedTopic, setSelectedSavedTopic] =
    useState<SavedBriefingTopicClient | null>(null);

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
            briefingGeneratedAt: new Date().toISOString(),
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
    []
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
    },
    []
  );

  const handleBackToArticle = useCallback(() => {
    setSelectedSavedTopic(null);
  }, []);

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
          onGenerate={startGeneration}
          savedTopics={savedTopics}
          onSaveTopic={handleSaveTopic}
          onDeleteTopic={handleDeleteTopic}
          selectedSavedTopic={selectedSavedTopic}
          onSelectSavedTopic={handleSelectSavedTopic}
          onBackToArticle={handleBackToArticle}
        />
      ) : (
        <main className="flex-1">
          <NoBriefingsYet onGenerate={startGeneration} />
        </main>
      )}
    </div>
  );
}
