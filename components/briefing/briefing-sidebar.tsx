"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Menu,
  BookOpen,
  Bookmark,
  ChevronDown,
  ChevronRight,
  X,
  Mic,
  Loader2,
  Check,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { PodcastSidebarTracklist } from "./podcast-sidebar";
import type { FailedPodcastTopic } from "./podcast-sidebar";
import type {
  BriefingArticleSection,
  SavedBriefingTopicClient,
} from "@/lib/briefing/briefing-types";
import type { PodcastTopicStatus } from "@/hooks/use-podcast-generation";
import type { PodcastTrack } from "@/hooks/use-podcast-player";
import type { BriefingViewMode } from "./briefing-mode-toggle";

/* --- Types --- */

/** @deprecated Will be removed in Etap 4 (cleanup) */
export interface BriefingHistoryItem {
  date: string; // YYYY-MM-DD
  label: string; // "20 февраля"
}

export type SimplyContentType = "overview" | "news";

export interface BriefingSidebarProps {
  /** Sections from current article (for topic navigation) */
  sections: BriefingArticleSection[];
  /** Active section id from scroll spy */
  activeSectionId?: string | null;
  /** ТЗ-BF1: Saved topics for sidebar display */
  savedTopics?: SavedBriefingTopicClient[];
  /** ТЗ-BF1: Currently selected saved topic id (for highlight) */
  selectedSavedTopicId?: string | null;
  /** ТЗ-BF1: Callback when user clicks a saved topic */
  onSelectSavedTopic?: (topic: SavedBriefingTopicClient) => void;
  /** ТЗ-BF1: Callback to return to current article view */
  onBackToArticle?: () => void;
  /** ТЗ-BF1: Callback to delete a saved topic */
  onDeleteSavedTopic?: (savedId: string) => void;
  /** ТЗ-А5: Callback to trigger generation (handled by parent) */
  onGenerate?: () => void;
  /** Whether there's an existing article (for confirm dialog) */
  hasArticle?: boolean;
  /** ТЗ-BF2: Simply News version (shown when hasUpdate) */
  simplyNewsVersion?: string | null;
  /** ТЗ-BF2: Simply News title */
  simplyNewsTitle?: string | null;
  /** ТЗ-BF2: Callback when user selects a Simply content item */
  onSelectSimplyContent?: (type: SimplyContentType) => void;
  /** ТЗ-BF2: Currently selected Simply content type */
  selectedSimplyType?: SimplyContentType | null;
  /** ТЗ-BF2: Whether Simply News is unread (shows indicator) */
  simplyNewsUnread?: boolean;
  /** Scroll content area to top (used instead of window.scrollTo) */
  onScrollToTop?: () => void;
  /** ТЗ-Б2: Podcast generation per-topic statuses (shows generation section when present) */
  podcastTopicStatuses?: PodcastTopicStatus[];
  /** ТЗ-Б2: Whether podcast is currently generating */
  podcastIsGenerating?: boolean;
  /** ТЗ-Б2 Этап 4: Current view mode (read/listen) */
  viewMode?: BriefingViewMode;
  /** ТЗ-Б2 Этап 4: Podcast tracks (for tracklist in sidebar) */
  podcastTracks?: PodcastTrack[];
  /** ТЗ-Б2 Этап 4: Current track index in player */
  podcastCurrentTrackIndex?: number;
  /** ТЗ-Б2 Этап 4: Whether player is currently playing (for equalizer animation) */
  podcastIsPlayerPlaying?: boolean;
  /** ТЗ-Б2 Этап 4: Callback when user clicks a track in sidebar */
  onSelectPodcastTrack?: (index: number) => void;
  /** ТЗ-Б2 Этап 5: Topics that failed podcast generation (shown gray with retry) */
  failedPodcastTopics?: FailedPodcastTopic[];
  /** ТЗ-Б2 Этап 5: Retry a single failed topic */
  onRetryPodcastTopic?: (topicId: string) => void;
}

/* --- Short date formatter: ISO → "21 фев" --- */

const MONTHS_SHORT = [
  "янв", "фев", "мар", "апр", "мая", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

/** ТЗ-BF3: Short date without time — "21 фев" */
function formatShortDate(isoString: string): string {
  const date = new Date(isoString);
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

/** ТЗ-BF3: Extract headline from markdown content (##/### header or first sentence) */
function extractHeadline(content: string): string | null {
  // 1. Try ## or ### markdown header
  const headerMatch = content.match(/^#{2,3}\s+(.+)/m);
  if (headerMatch) return headerMatch[1].trim();
  // 2. First non-empty line as fallback (bold names like **Шарль Леклер** are unreliable as headlines)
  const firstLine = content.split("\n").find((l) => l.trim().length > 0);
  if (firstLine && firstLine.trim().length > 10) return firstLine.trim().slice(0, 80);
  return null;
}

/** ТЗ-BF3: Get display title — use title if different from topicName, otherwise extract from content */
function getDisplayTitle(topic: SavedBriefingTopicClient): string {
  if (topic.title && topic.title !== topic.topicName) return topic.title;
  // Fallback: extract headline from content for legacy saved topics
  const headline = topic.content ? extractHeadline(topic.content) : null;
  return headline || topic.title || topic.topicName;
}

/** ТЗ-BF3: Group saved topics by topicId, sorted by latest savedAt DESC */
function groupByTopic(topics: SavedBriefingTopicClient[]) {
  const groups = new Map<string, SavedBriefingTopicClient[]>();
  for (const topic of topics) {
    const key = topic.topicId;
    const list = groups.get(key);
    if (list) {
      list.push(topic);
    } else {
      groups.set(key, [topic]);
    }
  }
  // Sort each group by savedAt DESC (newest first)
  for (const list of groups.values()) {
    list.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  }
  // Sort groups by latest savedAt DESC (most recently saved topic folder first)
  return [...groups.entries()].sort(
    ([, a], [, b]) => new Date(b[0].savedAt).getTime() - new Date(a[0].savedAt).getTime()
  );
}

const EXPANDED_TOPICS_KEY = "briefing-sidebar-expanded-topics";

/**
 * ТЗ-BF1: Briefing sidebar — topic navigation, saved topics, settings, generate.
 * Desktop: static left column. Mobile: Sheet via BriefingSidebarMobile.
 */
export function BriefingSidebar(props: BriefingSidebarProps) {
  return (
    <div className="flex h-full flex-col">
      <SidebarContent {...props} />
    </div>
  );
}

/**
 * Mobile trigger button — renders in header, opens Sheet with sidebar.
 */
export function BriefingSidebarMobile(props: BriefingSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        className="md:hidden"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" />
        <span className="sr-only">Навигация</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-[280px] bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Навигация по брифингу</SheetTitle>
            <SheetDescription>Темы и сохранённые материалы</SheetDescription>
          </SheetHeader>
          <div className="flex h-full flex-col">
            <SidebarContent
              {...props}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/* --- Shared sidebar content --- */

function SidebarContent({
  sections,
  activeSectionId,
  savedTopics = [],
  selectedSavedTopicId,
  onSelectSavedTopic,
  onBackToArticle,
  onDeleteSavedTopic,
  onGenerate,
  hasArticle,
  simplyNewsVersion,
  simplyNewsTitle,
  onSelectSimplyContent,
  selectedSimplyType,
  simplyNewsUnread,
  onScrollToTop,
  podcastTopicStatuses,
  podcastIsGenerating,
  viewMode,
  podcastTracks,
  podcastCurrentTrackIndex,
  podcastIsPlayerPlaying,
  onSelectPodcastTrack,
  failedPodcastTopics,
  onRetryPodcastTopic,
  onNavigate,
}: BriefingSidebarProps & { onNavigate?: () => void }) {
  const handleSelectSimply = useCallback(
    (type: SimplyContentType) => {
      onSelectSimplyContent?.(type);
      onNavigate?.();
    },
    [onSelectSimplyContent, onNavigate]
  );

  const handleScrollTo = useCallback(
    (id: string) => {
      // If viewing saved topic or simply content, go back to article first
      if (selectedSavedTopicId || selectedSimplyType) {
        onBackToArticle?.();
      }
      // Use requestAnimationFrame to let React re-render before scrolling
      requestAnimationFrame(() => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
          onNavigate?.();
        }
      });
    },
    [onNavigate, selectedSavedTopicId, onBackToArticle]
  );

  const handleScrollToTop = useCallback(() => {
    if (selectedSavedTopicId || selectedSimplyType) {
      onBackToArticle?.();
    }
    requestAnimationFrame(() => {
      onScrollToTop?.();
      onNavigate?.();
    });
  }, [onNavigate, selectedSavedTopicId, selectedSimplyType, onBackToArticle, onScrollToTop]);

  const handleSelectSaved = useCallback(
    (topic: SavedBriefingTopicClient) => {
      onSelectSavedTopic?.(topic);
      onNavigate?.();
    },
    [onSelectSavedTopic, onNavigate]
  );

  // ТЗ-BF3: Collapsible topic folders state + localStorage persistence
  // Initialize empty to match server render, then hydrate from localStorage
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored = localStorage.getItem(EXPANDED_TOPICS_KEY);
      if (stored) {
        setExpandedTopics(new Set<string>(JSON.parse(stored)));
      }
    } catch { /* ignore */ }
  }, []);

  const toggleTopic = useCallback((topicId: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      try {
        localStorage.setItem(EXPANDED_TOPICS_KEY, JSON.stringify([...next]));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  return (
    <>
      {/* Topic navigation / Podcast tracklist / Generation status */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {/* ТЗ-Б2 Этап 4: Podcast tracklist — shown when viewMode === "listen" and tracks available */}
        {viewMode === "listen" && podcastTracks && podcastTracks.length > 0 && onSelectPodcastTrack ? (
          <PodcastSidebarTracklist
            tracks={podcastTracks}
            currentTrackIndex={podcastCurrentTrackIndex ?? 0}
            isPlaying={podcastIsPlayerPlaying ?? false}
            onSelectTrack={(index) => {
              onSelectPodcastTrack(index);
              onNavigate?.();
            }}
            failedTopics={failedPodcastTopics}
            onRetryTopic={onRetryPodcastTopic}
          />
        ) : /* ТЗ-Б2: Podcast generation sidebar — replaces topic nav during generation */
        podcastTopicStatuses && podcastTopicStatuses.length > 0 ? (
          <>
            <p className="mb-2 flex items-center gap-1.5 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Mic className="size-3" />
              {podcastIsGenerating ? "Создаём подкаст" : "Подкаст"}
            </p>
            {podcastTopicStatuses.map((topic) => {
              const isActive = topic.step === "script" || topic.step === "recording";
              return (
                <div
                  key={topic.topicId}
                  className={cn(
                    "mb-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-all duration-150",
                    isActive && "bg-primary/10 text-primary font-medium"
                  )}
                >
                  <span className="shrink-0">
                    {topic.step === "pending" && (
                      <Loader2 className="size-3.5 text-muted-foreground" />
                    )}
                    {(topic.step === "script" || topic.step === "recording") && (
                      <Loader2 className="size-3.5 animate-spin text-primary" />
                    )}
                    {topic.step === "done" && (
                      <Check className="size-3.5 text-success" />
                    )}
                    {topic.step === "error" && (
                      <X className="size-3.5 text-destructive" />
                    )}
                  </span>
                  <span className="min-w-0 truncate">{topic.message}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {topic.step === "pending" && "Ожидание"}
                    {topic.step === "script" && "Сценарий..."}
                    {topic.step === "recording" && "Запись..."}
                    {topic.step === "done" && "Готово"}
                    {topic.step === "error" && "Ошибка"}
                  </span>
                </div>
              );
            })}
          </>
        ) : (
          <>
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Текущий выпуск
            </p>

            <button
              type="button"
              onClick={handleScrollToTop}
              className={cn(
                "mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/60",
                !selectedSavedTopicId && !selectedSimplyType && !activeSectionId && "bg-primary/10 font-medium text-primary"
              )}
            >
              <BookOpen className="size-4 text-muted-foreground" />
              <span>Полный брифинг</span>
            </button>

            {sections.map((section, idx) => (
              <button
                key={`${section.topicId}-${idx}`}
                type="button"
                onClick={() => handleScrollTo(section.topicId)}
                className={cn(
                  "mb-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/60",
                  !selectedSavedTopicId &&
                    !selectedSimplyType &&
                    activeSectionId === section.topicId &&
                    "bg-primary/10 font-medium text-primary"
                )}
              >
                <span>{section.emoji}</span>
                <span className="truncate">{section.topicName}</span>
              </button>
            ))}
          </>
        )}

        {/* ТЗ-BF3: Saved topics — collapsible folders by topic */}
        {savedTopics.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Bookmark className="mr-1 inline size-3" />
              Сохранённые
            </p>
            {groupByTopic(savedTopics).map(([topicId, topics]) => {
              const isExpanded = expandedTopics.has(topicId);
              const { emoji, topicName } = topics[0];
              return (
                <Collapsible
                  key={topicId}
                  open={isExpanded}
                  onOpenChange={() => toggleTopic(topicId)}
                  className="mb-1"
                >
                  <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/60">
                    {isExpanded ? (
                      <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="shrink-0">{emoji}</span>
                    <span className="min-w-0 truncate">{topicName}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground/70">
                      {topics.length}
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-3 space-y-0.5 border-l border-border/50 pl-2 pt-1">
                      {topics.map((topic) => (
                        <div
                          key={topic.id}
                          className={cn(
                            "group flex w-full items-center rounded-lg px-2 py-1 text-sm transition-colors hover:bg-muted/60",
                            selectedSavedTopicId === topic.id &&
                              "bg-primary/10 font-medium text-primary"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectSaved(topic)}
                            className="flex min-w-0 flex-1 items-center gap-1.5"
                          >
                            <span className="shrink-0 text-[11px] text-muted-foreground/70">
                              {formatShortDate(topic.savedAt)}
                            </span>
                            <span className="text-muted-foreground/50">·</span>
                            <span className="truncate">{getDisplayTitle(topic)}</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSavedTopic?.(topic.id);
                            }}
                            className="ml-1 shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                            title="Удалить из сохранённых"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}

        {/* ТЗ-BF2: Simply section — overview + what's new */}
        <div className="mt-6">
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Simply
          </p>
          <button
            type="button"
            onClick={() => handleSelectSimply("overview")}
            className={cn(
              "mb-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/60",
              selectedSimplyType === "overview" &&
                "bg-primary/10 font-medium text-primary"
            )}
          >
            <span>{"📋"}</span>
            <span className="truncate">Обзор платформы</span>
          </button>
          {simplyNewsVersion && (
            <button
              type="button"
              onClick={() => handleSelectSimply("news")}
              className={cn(
                "mb-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/60",
                selectedSimplyType === "news" &&
                  "bg-primary/10 font-medium text-primary",
                simplyNewsUnread && selectedSimplyType !== "news" &&
                  "font-semibold text-primary"
              )}
            >
              <span>{"🆕"}</span>
              <span className="truncate">
                {simplyNewsTitle ?? `Что нового в v${simplyNewsVersion}`}
              </span>
              {simplyNewsUnread && selectedSimplyType !== "news" && (
                <span className="ml-auto size-2 shrink-0 rounded-full bg-primary" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Footer: Generate (primary button) */}
      <div className="shrink-0 border-t px-3 py-4">
        {hasArticle ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="default" className="w-full gap-2 rounded-lg">
                <RefreshCw className="size-4" />
                Сгенерировать
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Сгенерировать новый брифинг?</AlertDialogTitle>
                <AlertDialogDescription>
                  Текущий брифинг будет заменён. Сохранённые темы останутся.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction onClick={onGenerate}>
                  Сгенерировать
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button
            variant="default"
            className="w-full gap-2 rounded-lg"
            onClick={onGenerate}
          >
            <RefreshCw className="size-4" />
            Сгенерировать
          </Button>
        )}
      </div>
    </>
  );
}
