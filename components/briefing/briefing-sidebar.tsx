"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  RefreshCw,
  Menu,
  BookOpen,
  Bookmark,
  ChevronDown,
  ChevronRight,
  X,
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
import type {
  BriefingArticleSection,
  SavedBriefingTopicClient,
} from "@/lib/briefing/briefing-types";

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
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set<string>();
    try {
      const stored = localStorage.getItem(EXPANDED_TOPICS_KEY);
      return stored ? new Set<string>(JSON.parse(stored)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

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
      {/* ТЗ-BF3: Branded header — matches app-sidebar.tsx */}
      <div className="shrink-0 border-b px-3 py-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/60"
          onClick={() => onNavigate?.()}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold text-sm">
            S
          </div>
          <span className="font-semibold text-lg">Simply</span>
        </Link>
      </div>

      {/* Topic navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
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

        {sections.map((section) => (
          <button
            key={section.topicId}
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
